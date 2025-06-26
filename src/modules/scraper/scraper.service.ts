import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ThemeParksWikiService } from '../themeparks-wiki/themeparks-wiki.service';
import { ParkLocationService } from '../geocoding/park-location.service';
import { OperatingStatus, QueueType } from '../themeparks-wiki/dto/themeparks-wiki.dto';
import { ParkGroup } from '../../entities/park-group.entity';
import { Park } from '../../entities/park.entity';
import { Attraction, EntityType } from '../../entities/attraction.entity';
import { ShowTime, ShowType } from '../../entities/show-time.entity';
import { ParkSchedule, ParkScheduleType } from '../../entities/park-schedule.entity';
import { WaitTime } from '../../entities/wait-time.entity';

// Interface definitions for API responses
interface ParkApiResponse {
	id: string;
	name: string;
	timezone?: string;
	location?: {
		latitude?: number | null;
		longitude?: number | null;
	};
	parentId?: string;
}

interface LiveEntityApiResponse {
	id: string;
	status?: OperatingStatus;
}

@Injectable()
export class ScraperService implements OnApplicationBootstrap {
	private readonly logger = new Logger(ScraperService.name);

	/**
	 * Generate a URL-friendly slug from text, keeping Chinese characters and percent-encoding them.
	 */
	private static toSlug(text: string): string {
		// Remove diacritics
		const normalized = text.normalize('NFD').replace(/\p{M}/gu, '');
		// Lowercase, remove dots, replace spaces
		let slug = normalized.toLowerCase().replace(/\./g, '').replace(/\s+/g, '-');
		// Keep alphanumeric, hyphens, and CJK Unified Ideographs
		slug = slug.replace(/[^a-z0-9\u4e00-\u9fff-]/gu, '');
		// Collapse hyphens and trim
		slug = slug.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
		// Percent-encode non-ASCII characters
		return encodeURI(slug);
	}

	constructor(
		private readonly wikiService: ThemeParksWikiService,
		private readonly parkLocationService: ParkLocationService,
		@InjectRepository(ParkGroup) private readonly parkGroupRepo: Repository<ParkGroup>,
		@InjectRepository(Park) private readonly parkRepo: Repository<Park>,
		@InjectRepository(Attraction) private readonly attractionRepo: Repository<Attraction>,
		@InjectRepository(ShowTime) private readonly showTimeRepo: Repository<ShowTime>,
		@InjectRepository(ParkSchedule) private readonly scheduleRepo: Repository<ParkSchedule>,
		@InjectRepository(WaitTime) private readonly waitTimeRepo: Repository<WaitTime>
	) {}

	onApplicationBootstrap() {
		this.logger.debug('Scheduling initial scrape on application bootstrap');
		// Run initial scrape in background without blocking app startup
		setImmediate(() => {
			this.scrapeAll().catch((error) => {
				this.logger.error(
					`Initial scrape failed: ${error instanceof Error ? error.message : 'Unknown error'}`
				);
			});
		});
	}

	@Cron('0 0 */12 * * *') // every 12 hours at minute 0
	async scrapeAll() {
		this.logger.log('--- Starting master scraping job ---');
		await this.scrapeParkGroups();
		await this.scrapeParks();
		await this.updateParkLocations(); // Add geocoding after parks are updated
		await this.scrapeAttractionsAndShows();
		await this.scrapeSchedules();
		this.logger.log('--- Master scraping job completed ---');
	}

	@Cron('0 */5 * * * *') // every 5 minutes
	async scrapeParkStatus() {
		this.logger.log('--- Starting park status scraping job ---');
		const parks = await this.parkRepo.find();

		// Process parks in parallel
		await Promise.all(
			parks.map(async (park) => {
				try {
					const currentStatus = await this.wikiService.fetchCurrentParkStatus(park.externalId);

					if (currentStatus && currentStatus !== park.operatingStatus) {
						// Update park status if it changed
						await this.parkRepo.update(park.id, {
							operatingStatus: currentStatus,
							lastSynced: new Date(),
						});
						this.logger.debug(`Updated status for park ${park.name}: ${currentStatus}`);
					}
				} catch (error) {
					this.logger.debug(
						`Failed to scrape status for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
					);
				}
			})
		);

		this.logger.debug('--- Park status scraping job completed ---');
	}

	@Cron('0 */10 * * * *') // every 10 minutes
	async scrapeWaitTimes() {
		this.logger.log('--- Starting wait-time scraping job ---');
		const parks = await this.parkRepo.find();

		// Process parks in parallel
		await Promise.all(
			parks.map(async (park) => {
				try {
					const waitTimes = await this.wikiService.fetchWaitTimes(park.externalId);

					// Process wait times in parallel
					await Promise.all(
						waitTimes.map(async (wt) => {
							// Find the attraction by external ID
							const attraction = await this.attractionRepo.findOne({
								where: { externalId: wt.attractionId || wt.id },
							});
							if (!attraction) return;

							// Efficiently fetch the most recent wait time
							const last = await this.waitTimeRepo
								.createQueryBuilder('wt')
								.where('wt.attractionId = :id', { id: attraction.id })
								.orderBy('wt.recordedAt', 'DESC')
								.limit(1)
								.getOne();

							if (!last || last.waitTimeMinutes !== wt.waitTime || last.status !== wt.status) {
								const entity = this.waitTimeRepo.create({
									attractionId: attraction.id,
									waitTimeMinutes: wt.waitTime || undefined,
									queueType: wt.queueType || QueueType.STANDBY,
									status: wt.status || OperatingStatus.OPERATING,
									recordedAt: new Date(),
									isActive: true,
								});
								await this.waitTimeRepo.save(entity);

								// Mark all previous wait times for this attraction as inactive
								await this.waitTimeRepo
									.createQueryBuilder()
									.update(WaitTime)
									.set({ isActive: false })
									.where('attraction_id = :id AND id != :currentId', {
										id: attraction.id,
										currentId: entity.id,
									})
									.execute();
							}
						})
					);
				} catch (error) {
					this.logger.warn(
						`Failed to scrape wait times for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
					);
				}
			})
		);

		this.logger.debug('--- Wait-time scraping job completed ---');
	}

	@Cron('0 */5 * * * *') // every 5 minutes
	async scrapeAttractionStatus() {
		this.logger.log('--- Starting attraction status scraping job ---');
		const parks = await this.parkRepo.find();

		// Process parks in parallel
		await Promise.all(
			parks.map(async (park) => {
				try {
					const liveData = await this.wikiService.fetchLiveData(park.externalId);

					// Process live entities for attraction status updates
					await Promise.all(
						liveData.entities.map(async (entity) => {
							if (entity.status) {
								const attraction = await this.attractionRepo.findOne({
									where: { externalId: entity.id },
								});

								if (attraction && attraction.status !== entity.status) {
									// Update attraction status if it changed
									await this.attractionRepo.update(attraction.id, {
										status: entity.status,
										lastSynced: new Date(),
									});
									this.logger.debug(`Updated status for attraction ${attraction.name}: ${entity.status}`);
								}
							}
						})
					);
				} catch (error) {
					this.logger.debug(
						`Failed to scrape attraction status for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
					);
				}
			})
		);

		this.logger.debug('--- Attraction status scraping job completed ---');
	}

	private async scrapeParkGroups() {
		this.logger.debug('--- Starting park-groups scraping job ---');
		const parkGroups = await this.wikiService.fetchParkGroups();
		const foundGroupIds = parkGroups.map((pg) => pg.id);

		// Process park groups in parallel
		await Promise.all(
			parkGroups.map(async (pg) => {
				const existing = await this.parkGroupRepo.findOne({ where: { externalId: pg.id } });
				const entity = new ParkGroup();
				entity.externalId = pg.id;
				entity.name = pg.name;
				entity.slug = ScraperService.toSlug(pg.name);
				entity.isActive = true;
				entity.lastSynced = new Date();

				if (existing) {
					entity.id = existing.id;
				}
				await this.parkGroupRepo.save(entity);
			})
		);

		// Deactivate park groups not encountered in this scrape
		await this.parkGroupRepo
			.createQueryBuilder()
			.update(ParkGroup)
			.set({ isActive: false })
			.where('external_id NOT IN (:...ids)', { ids: foundGroupIds })
			.execute();

		this.logger.debug('--- Done park-groups scraping job ---');
	}

	private async scrapeParks() {
		this.logger.debug('--- Starting park scraping job ---');
		// Get all park groups first, then get their parks
		const parkGroups = await this.wikiService.fetchParkGroups();
		const allParks: ParkApiResponse[] = [];

		// Collect all parks from all groups
		for (const group of parkGroups) {
			allParks.push(
				...group.parks.map((park) => ({
					...park,
					parentId: group.id, // Set the parent (group) ID
				}))
			);
		}

		const foundParkIds = allParks.map((p) => p.id);

		// Process parks in parallel and fetch detailed information for each
		await Promise.all(
			allParks.map(async (p) => {
				try {
					// Fetch detailed park information including timezone and location
					const detailedPark = await this.wikiService.fetchPark(p.id);

					// Fetch current park status from schedule
					let currentStatus: string | undefined;
					try {
						currentStatus = await this.wikiService.fetchCurrentParkStatus(p.id);
					} catch (statusError) {
						this.logger.debug(
							`Could not fetch status for park ${p.id}: ${statusError instanceof Error ? statusError.message : 'Unknown error'}`
						);
					}

					// Map external parentId to internal primary key
					let groupId: string | undefined;
					if (p.parentId) {
						const group = await this.parkGroupRepo.findOne({ where: { externalId: p.parentId } });
						groupId = group?.id;
					}

					const existing = await this.parkRepo.findOne({ where: { externalId: p.id } });
					const entity = new Park();
					entity.externalId = p.id;
					entity.name = detailedPark.name || p.name;
					entity.slug = ScraperService.toSlug(detailedPark.name || p.name);
					entity.timezone = detailedPark.timezone || 'UTC';
					entity.latitude = detailedPark.location?.latitude || undefined;
					entity.longitude = detailedPark.location?.longitude || undefined;
					entity.parkGroupId = groupId;
					entity.operatingStatus = currentStatus || undefined; // Set operating status from live data
					entity.isActive = true;
					entity.lastSynced = new Date();

					if (existing) {
						entity.id = existing.id;
					}
					await this.parkRepo.save(entity);
				} catch (error) {
					this.logger.error(
						`Failed to fetch detailed info for park ${p.id}: ${error instanceof Error ? error.message : 'Unknown error'}`
					);

					// Fallback to basic info if detailed fetch fails
					let groupId: string | undefined;
					if (p.parentId) {
						const group = await this.parkGroupRepo.findOne({ where: { externalId: p.parentId } });
						groupId = group?.id;
					}

					const existing = await this.parkRepo.findOne({ where: { externalId: p.id } });
					const entity = new Park();
					entity.externalId = p.id;
					entity.name = p.name;
					entity.slug = ScraperService.toSlug(p.name);
					entity.timezone = p.timezone || 'UTC';
					entity.latitude = p.location?.latitude || undefined;
					entity.longitude = p.location?.longitude || undefined;
					entity.parkGroupId = groupId;
					entity.isActive = true;
					entity.lastSynced = new Date();

					if (existing) {
						entity.id = existing.id;
					}
					await this.parkRepo.save(entity);
				}
			})
		);

		// Deactivate parks not found in this scrape
		await this.parkRepo
			.createQueryBuilder()
			.update(Park)
			.set({ isActive: false })
			.where('external_id NOT IN (:...ids)', { ids: foundParkIds })
			.execute();

		this.logger.debug('--- Done parks scraping job ---');
	}

	/**
	 * Updates location data for parks that have coordinates but missing location info
	 */
	private async updateParkLocations() {
		this.logger.debug('--- Starting park location update job ---');

		try {
			// Get statistics before update
			const statsBefore = await this.parkLocationService.getLocationStats();
			this.logger.log(`Parks needing location updates: ${statsBefore.needingUpdate}`);

			if (statsBefore.needingUpdate > 0) {
				// Update all parks without complete location data
				await this.parkLocationService.updateAllParksWithoutLocation();

				// Get statistics after update
				const statsAfter = await this.parkLocationService.getLocationStats();
				this.logger.log(
					`Location update completed: ${statsAfter.withFullLocation} parks now have complete location data`
				);
			} else {
				this.logger.debug('No parks need location updates');
			}
		} catch (error) {
			this.logger.error(
				`Park location update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}

		this.logger.debug('--- Done park location update job ---');
	}

	/**
	 * Dedicated cron job for updating park locations
	 * Runs weekly on Sundays at 3 AM to minimize API usage
	 */
	@Cron('0 0 3 * * 0') // Weekly on Sunday at 3 AM
	async updateParkLocationsScheduled() {
		this.logger.log('--- Starting scheduled park location update ---');
		await this.updateParkLocations();
		this.logger.log('--- Scheduled park location update completed ---');
	}

	private async scrapeAttractionsAndShows() {
		this.logger.debug('--- Starting attractions-show scraping job ---');
		const parks = await this.parkRepo.find();

		// Process parks in parallel
		await Promise.all(
			parks.map(async (park) => {
				try {
					const attractions = await this.wikiService.fetchAttractions(park.externalId);
					const foundAttractionIds = attractions.map((a) => a.id);

					// Fetch live data to get current status
					let liveEntities: LiveEntityApiResponse[] = [];
					try {
						const liveData = await this.wikiService.fetchLiveData(park.externalId);
						liveEntities = liveData.entities;
					} catch (error) {
						this.logger.debug(
							`Failed to fetch live data for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
					}

					// Process attractions in parallel
					await Promise.all(
						attractions.map(async (attr) => {
							const existing = await this.attractionRepo.findOne({
								where: { externalId: attr.id },
							});
							const entity = new Attraction();
							entity.externalId = attr.id;
							entity.name = attr.name;
							entity.slug = ScraperService.toSlug(attr.name);
							entity.entityType = this.mapEntityType(attr.entityType);
							entity.parkId = park.id;
							entity.latitude = attr.location?.latitude || undefined;
							entity.longitude = attr.location?.longitude || undefined;
							entity.isActive = true;
							entity.lastSynced = new Date();

							// Try to get status from live data
							const liveEntity = liveEntities.find((live) => live.id === attr.id);
							if (liveEntity && liveEntity.status) {
								entity.status = liveEntity.status;
							}

							if (existing) {
								entity.id = existing.id;
							}
							await this.attractionRepo.save(entity);
						})
					);

					// Deactivate attractions not found in this scrape for this park
					if (foundAttractionIds.length > 0) {
						await this.attractionRepo
							.createQueryBuilder()
							.update(Attraction)
							.set({ isActive: false })
							.where('park_id = :parkId AND external_id NOT IN (:...ids)', {
								parkId: park.id,
								ids: foundAttractionIds,
							})
							.execute();
					}

					// Scrape show times for shows
					try {
						const showTimes = await this.wikiService.fetchShowTimes(park.externalId);

						// Process show times in parallel
						await Promise.all(
							showTimes.map(async (show) => {
								// Find the attraction/show by external ID
								let attraction = await this.attractionRepo.findOne({
									where: { externalId: show.id },
								});

								// If attraction doesn't exist, create it (it might be a show only in live data)
								if (!attraction) {
									this.logger.debug(`Creating new show entity for external ID: ${show.id}`);
									attraction = new Attraction();
									attraction.externalId = show.id;
									attraction.name = show.name;
									attraction.slug = ScraperService.toSlug(show.name);
									attraction.entityType = EntityType.SHOW;
									attraction.parkId = park.id;
									attraction.isActive = true;
									attraction.lastSynced = new Date();
									attraction = await this.attractionRepo.save(attraction);
								}

								// Remove old show times for this attraction
								await this.showTimeRepo.delete({ attractionId: attraction.id });

								// Add new show times in parallel
								await Promise.all(
									show.showtimes.map(async (showtime) => {
										const entity = this.showTimeRepo.create({
											attractionId: attraction.id,
											startTime: new Date(showtime.startTime),
											endTime: new Date(showtime.endTime),
											showType: this.mapShowType(showtime.type || 'REGULAR'),
											isActive: true,
											lastSynced: new Date(),
										});
										await this.showTimeRepo.save(entity);
									})
								);
							})
						);
					} catch (error) {
						this.logger.warn(
							`Failed to scrape show times for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
						);
					}
				} catch (error) {
					this.logger.warn(
						`Failed to scrape attractions for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
					);
				}
			})
		);

		this.logger.debug('--- Done attractions-shows scraping job ---');
	}

	private async scrapeSchedules() {
		this.logger.debug('--- Starting schedule scraping job ---');
		const parks = await this.parkRepo.find();

		// Process parks in parallel
		await Promise.all(
			parks.map(async (park) => {
				try {
					const schedules = await this.wikiService.fetchParkSchedule(park.externalId);

					// Process schedules sequentially within each park to avoid unique constraint violations
					// Since schedules for the same park+date could conflict, we process them one by one per park
					for (const sch of schedules) {
						try {
							// Extract date from opening time if available, otherwise use sch.date
							const scheduleDate = sch.openingTime
								? this.extractDateFromDatetime(sch.openingTime)
								: new Date(sch.date);

							const existing = await this.scheduleRepo.findOne({
								where: { parkId: park.id, date: scheduleDate },
							});

							const entity = this.scheduleRepo.create({
								parkId: park.id,
								date: scheduleDate,
								openingTime: this.extractTimeFromDatetime(sch.openingTime),
								closingTime: this.extractTimeFromDatetime(sch.closingTime),
								scheduleType: this.mapParkScheduleType(sch.type),
								isSpecial: false,
								lastSynced: new Date(),
							});

							if (existing) {
								entity.id = existing.id;
							}

							await this.scheduleRepo.save(entity);
						} catch (error) {
							// Skip duplicate key errors but log other errors
							if (
								error instanceof Error &&
								error.message.includes('duplicate key value violates unique constraint')
							) {
								this.logger.debug(
									`Skipping duplicate schedule for park ${park.name} on date ${sch.date || sch.openingTime}`
								);
							} else {
								this.logger.warn(
									`Failed to process schedule item for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
								);
							}
						}
					}
				} catch (error) {
					this.logger.warn(
						`Failed to scrape schedule for park ${park.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
					);
				}
			})
		);

		this.logger.debug('--- Done schedule scraping job ---');
	}

	// Helper methods
	private mapEntityType(type: string): EntityType {
		switch (type?.toUpperCase()) {
			case 'ATTRACTION':
				return EntityType.ATTRACTION;
			case 'SHOW':
				return EntityType.SHOW;
			case 'RESTAURANT':
				return EntityType.RESTAURANT;
			case 'SHOP':
				return EntityType.SHOP;
			case 'MEET_AND_GREET':
				return EntityType.MEET_AND_GREET;
			case 'EXPERIENCE':
				return EntityType.EXPERIENCE;
			default:
				return EntityType.OTHER;
		}
	}

	private mapShowType(type: string): ShowType {
		// Handle both API format and standard format
		const normalizedType = type?.toLowerCase();

		switch (normalizedType) {
			case 'fireworks':
				return ShowType.FIREWORKS;
			case 'parade':
				return ShowType.PARADE;
			case 'special':
				return ShowType.SPECIAL;
			case 'seasonal':
				return ShowType.SEASONAL;
			case 'performance time':
			case 'performance_time':
				return ShowType.SPECIAL; // Map Performance Time to SPECIAL
			case 'operating':
			case 'regular':
			default:
				return ShowType.REGULAR;
		}
	}

	private mapParkScheduleType(type: string): ParkScheduleType {
		switch (type?.toUpperCase()) {
			case 'OPERATING':
				return ParkScheduleType.OPERATING;
			case 'CLOSED':
				return ParkScheduleType.CLOSED;
			case 'SPECIAL_HOURS':
				return ParkScheduleType.SPECIAL_HOURS;
			case 'PRIVATE_EVENT':
				return ParkScheduleType.PRIVATE_EVENT;
			default:
				return ParkScheduleType.OPERATING;
		}
	} /**
	 * Extract date portion from a datetime string (e.g., "2025-06-27T09:30:00+08:00" -> Date object for 2025-06-27)
	 */
	private extractDateFromDatetime(datetimeString?: string): Date | undefined {
		if (!datetimeString) return undefined;

		try {
			// Extract date directly from the ISO string format (before time info)
			const match = datetimeString.match(/^(\d{4}-\d{2}-\d{2})/);
			if (match) {
				return new Date(match[1] + 'T00:00:00.000Z'); // Create date in UTC to avoid timezone issues
			}

			// Fallback: parse the datetime and extract just the date part
			const date = new Date(datetimeString);
			if (isNaN(date.getTime())) return undefined;

			// Create a new date with just the date portion (in UTC to avoid timezone shifts)
			const year = date.getUTCFullYear();
			const month = date.getUTCMonth();
			const day = date.getUTCDate();
			return new Date(Date.UTC(year, month, day));
		} catch (error) {
			this.logger.warn(
				`Failed to extract date from datetime string: ${datetimeString}, ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			return undefined;
		}
	}

	/**
	 * Extract time portion from a datetime string (e.g., "2025-06-27T09:30:00+08:00" -> "09:30:00")
	 */
	private extractTimeFromDatetime(datetimeString?: string): string | undefined {
		if (!datetimeString) return undefined;

		try {
			// Extract time directly from the ISO string format (before timezone info)
			const match = datetimeString.match(/T(\d{2}:\d{2}:\d{2})/);
			if (match) {
				return match[1];
			}

			// Fallback: try parsing as date and extracting time in UTC
			const date = new Date(datetimeString);
			if (isNaN(date.getTime())) return undefined;

			// Use UTC methods to avoid timezone conversion
			const hours = date.getUTCHours().toString().padStart(2, '0');
			const minutes = date.getUTCMinutes().toString().padStart(2, '0');
			const seconds = date.getUTCSeconds().toString().padStart(2, '0');
			return `${hours}:${minutes}:${seconds}`;
		} catch (error) {
			this.logger.warn(
				`Failed to extract time from datetime string: ${datetimeString}, ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			return undefined;
		}
	}
}
