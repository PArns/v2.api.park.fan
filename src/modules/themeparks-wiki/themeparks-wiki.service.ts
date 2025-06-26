import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
	ParkGroupDto,
	ParkDto,
	AttractionDto,
	WaitTimeDto,
	ShowTimeDto,
	RestaurantDto,
	ParkScheduleDto,
	EntityDto,
	ThemeParksDestinationsResponse,
	ThemeParksEntityResponse,
	ThemeParksChildrenResponse,
	ThemeParksLiveDataResponse,
	ThemeParksScheduleResponse,
	EntityType,
	OperatingStatus,
	QueueType,
	ShowTimeType,
	ParkScheduleType,
	PurchaseType,
} from './dto/themeparks-wiki.dto';

@Injectable()
export class ThemeParksWikiService {
	private readonly logger = new Logger(ThemeParksWikiService.name);
	private readonly baseUrl = 'https://api.themeparks.wiki/v1';

	constructor(private readonly httpService: HttpService) {}

	/**
	 * Fetch all park groups (destinations) from ThemeParks Wiki API
	 */
	async fetchParkGroups(): Promise<ParkGroupDto[]> {
		try {
			this.logger.log('Fetching park groups from ThemeParks Wiki API');

			const response = await firstValueFrom(
				this.httpService.get<ThemeParksDestinationsResponse>(`${this.baseUrl}/destinations`)
			);

			return response.data.destinations.map((destination) => ({
				id: destination.id,
				name: destination.name,
				parks: destination.parks.map((park) => ({
					id: park.id,
					name: park.name,
					entityType: EntityType.PARK,
				})),
			}));
		} catch (error) {
			this.logger.error('Failed to fetch park groups', error);
			throw new Error('Failed to fetch park groups from ThemeParks Wiki API');
		}
	}

	/**
	 * Fetch detailed park information
	 */
	async fetchPark(parkId: string): Promise<ParkDto> {
		try {
			const response = await firstValueFrom(
				this.httpService.get<ThemeParksEntityResponse>(`${this.baseUrl}/entity/${parkId}`)
			);

			const park = response.data;
			return {
				id: park.id,
				name: park.name,
				timezone: park.timezone,
				location: park.location
					? {
							latitude: park.location.latitude || null,
							longitude: park.location.longitude || null,
						}
					: undefined,
				entityType: park.entityType || EntityType.PARK,
				parentId: park.parentId,
				destinationId: park.destinationId,
				externalId: park.externalId,
			};
		} catch (error) {
			this.logger.error(`Failed to fetch park details for ID: ${parkId}`, error);
			throw new Error(`Failed to fetch park details for ID: ${parkId}`);
		}
	}

	/**
	 * Fetch all attractions, restaurants, and other entities for a park
	 */
	async fetchParkEntities(parkId: string): Promise<EntityDto[]> {
		try {
			const response = await firstValueFrom(
				this.httpService.get<ThemeParksChildrenResponse>(`${this.baseUrl}/entity/${parkId}/children`)
			);

			return response.data.children.map((child) => ({
				id: child.id,
				name: child.name,
				entityType: this.mapEntityType(child.entityType),
				parkId: child.parentId,
				externalId: child.externalId,
				location: child.location
					? {
							latitude: child.location.latitude || null,
							longitude: child.location.longitude || null,
						}
					: undefined,
			}));
		} catch (error) {
			this.logger.error(`Failed to fetch entities for park ID: ${parkId}`, error);
			throw new Error(`Failed to fetch entities for park ID: ${parkId}`);
		}
	}

	/**
	 * Fetch attractions specifically for a park
	 */
	async fetchAttractions(parkId: string): Promise<AttractionDto[]> {
		const entities = await this.fetchParkEntities(parkId);
		return entities
			.filter((entity) => entity.entityType === EntityType.ATTRACTION)
			.map((entity) => ({
				id: entity.id,
				name: entity.name,
				entityType: entity.entityType,
				parkId: entity.parkId!,
				externalId: entity.externalId,
				location: entity.location,
			}));
	}

	/**
	 * Fetch restaurants specifically for a park
	 */
	async fetchRestaurants(parkId: string): Promise<RestaurantDto[]> {
		const entities = await this.fetchParkEntities(parkId);
		return entities
			.filter((entity) => entity.entityType === EntityType.RESTAURANT)
			.map((entity) => ({
				id: entity.id,
				name: entity.name,
				entityType: entity.entityType,
				parkId: entity.parkId!,
				externalId: entity.externalId,
				location: entity.location,
			}));
	}

	/**
	 * Fetch live data (wait times, show times, etc.) for a park
	 */
	async fetchLiveData(parkId: string): Promise<{
		waitTimes: WaitTimeDto[];
		showTimes: ShowTimeDto[];
		entities: EntityDto[];
	}> {
		try {
			const response = await firstValueFrom(
				this.httpService.get<ThemeParksLiveDataResponse>(`${this.baseUrl}/entity/${parkId}/live`)
			);

			const waitTimes: WaitTimeDto[] = [];
			const showTimes: ShowTimeDto[] = [];
			const entities: EntityDto[] = [];

			response.data.liveData.forEach((item) => {
				// Add to entities array
				const entity: EntityDto = {
					id: item.id,
					name: item.name,
					entityType: this.mapEntityType(item.entityType),
					parkId: item.parkId,
					externalId: item.externalId,
					lastUpdated: item.lastUpdated,
				};

				// Process queue data for wait times
				if (item.queue) {
					Object.entries(item.queue).forEach(([queueTypeStr, queueData]) => {
						const queueType = this.mapQueueType(queueTypeStr);
						if (queueData.waitTime !== undefined) {
							waitTimes.push({
								id: `${item.id}-${queueType}`,
								waitTime: queueData.waitTime,
								status: item.status ? this.mapOperatingStatus(item.status) : OperatingStatus.OPERATING,
								lastUpdated: item.lastUpdated,
								queueType,
								attractionId: item.id,
							});
						}
					});
					entity.queue = item.queue as Record<QueueType, { waitTime?: number | null }>;
				}

				// Process show times
				if (item.showtimes && item.showtimes.length > 0) {
					showTimes.push({
						id: item.id,
						name: item.name,
						showtimes: item.showtimes.map((showtime) => ({
							startTime: showtime.startTime,
							endTime: showtime.endTime,
							type: showtime.type ? this.mapShowTimeType(showtime.type) : ShowTimeType.OPERATING,
						})),
						lastUpdated: item.lastUpdated,
					});
					entity.showtimes = item.showtimes.map((showtime) => ({
						startTime: showtime.startTime,
						endTime: showtime.endTime,
						type: showtime.type ? this.mapShowTimeType(showtime.type) : ShowTimeType.OPERATING,
					}));
				}

				// Add status and wait time for attractions
				if (item.status) {
					entity.status = this.mapOperatingStatus(item.status);
				}

				entities.push(entity);
			});

			return { waitTimes, showTimes, entities };
		} catch (error) {
			this.logger.error(`Failed to fetch live data for park ID: ${parkId}`, error);
			throw new Error(`Failed to fetch live data for park ID: ${parkId}`);
		}
	}

	/**
	 * Fetch wait times specifically for a park
	 */
	async fetchWaitTimes(parkId: string): Promise<WaitTimeDto[]> {
		const { waitTimes } = await this.fetchLiveData(parkId);
		return waitTimes;
	}

	/**
	 * Fetch show times specifically for a park
	 */
	async fetchShowTimes(parkId: string): Promise<ShowTimeDto[]> {
		const { showTimes } = await this.fetchLiveData(parkId);
		return showTimes;
	}

	/**
	 * Fetch park schedule
	 */
	async fetchParkSchedule(parkId: string): Promise<ParkScheduleDto[]> {
		try {
			const response = await firstValueFrom(
				this.httpService.get<ThemeParksScheduleResponse>(`${this.baseUrl}/entity/${parkId}/schedule`)
			);

			return response.data.schedule.map((scheduleItem) => ({
				date: scheduleItem.date,
				type: this.mapParkScheduleType(scheduleItem.type),
				openingTime: scheduleItem.openingTime,
				closingTime: scheduleItem.closingTime,
				description: scheduleItem.description,
				purchases: scheduleItem.purchases?.map((purchase) => ({
					id: purchase.id,
					name: purchase.name,
					type: this.mapPurchaseType(purchase.type),
					price: purchase.price,
					available: purchase.available,
				})),
			}));
		} catch (error) {
			this.logger.error(`Failed to fetch schedule for park ID: ${parkId}`, error);
			throw new Error(`Failed to fetch schedule for park ID: ${parkId}`);
		}
	}

	/**
	 * Fetch schedule data for a park to determine current operating status
	 */
	async fetchSchedule(parkId: string): Promise<ParkScheduleDto[]> {
		try {
			const response = await firstValueFrom(
				this.httpService.get<ThemeParksScheduleResponse>(`${this.baseUrl}/entity/${parkId}/schedule`)
			);

			return response.data.schedule.map((scheduleItem) => ({
				id: `${response.data.id}-${scheduleItem.date}`,
				date: scheduleItem.date,
				type: this.mapParkScheduleType(scheduleItem.type),
				openingTime: scheduleItem.openingTime,
				closingTime: scheduleItem.closingTime,
				purchases:
					scheduleItem.purchases?.map((purchase) => ({
						id: purchase.id,
						name: purchase.name,
						type: this.mapPurchaseType(purchase.type),
						price: purchase.price,
						available: purchase.available,
					})) || [],
			}));
		} catch (error) {
			this.logger.error(`Failed to fetch schedule for park ID: ${parkId}`, error);
			throw new Error(`Failed to fetch schedule for park ID: ${parkId}`);
		}
	}

	/**
	 * Get current operating status for a park based on today's schedule
	 */
	async fetchCurrentParkStatus(parkId: string): Promise<string | undefined> {
		try {
			const schedule = await this.fetchSchedule(parkId);
			const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

			// Find today's schedule entry
			const todaySchedule = schedule.find((item) => item.date === today);
			if (todaySchedule) {
				return todaySchedule.type;
			}

			// If no exact match, find the most recent schedule entry
			const sortedSchedule = schedule
				.filter((item) => item.date <= today)
				.sort((a, b) => b.date.localeCompare(a.date));

			return sortedSchedule[0]?.type;
		} catch (error) {
			this.logger.debug(
				`Could not determine current status for park ${parkId}: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
			return undefined;
		}
	}

	/**
	 * Generic entity fetch method
	 */
	async fetchEntity(entityId: string): Promise<EntityDto> {
		try {
			const response = await firstValueFrom(
				this.httpService.get<ThemeParksEntityResponse>(`${this.baseUrl}/entity/${entityId}`)
			);

			const entity = response.data;
			return {
				id: entity.id,
				name: entity.name,
				entityType: entity.entityType ? this.mapEntityType(entity.entityType) : EntityType.OTHER,
				parkId: entity.parentId,
				externalId: entity.externalId,
				location: entity.location
					? {
							latitude: entity.location.latitude || null,
							longitude: entity.location.longitude || null,
						}
					: undefined,
			};
		} catch (error) {
			this.logger.error(`Failed to fetch entity details for ID: ${entityId}`, error);
			throw new Error(`Failed to fetch entity details for ID: ${entityId}`);
		}
	}

	// Mapping helper methods
	private mapEntityType(type: string): EntityType {
		const upperType = type.toUpperCase();
		if (Object.values(EntityType).includes(upperType as EntityType)) {
			return upperType as EntityType;
		}
		return EntityType.OTHER;
	}

	private mapOperatingStatus(status: string): OperatingStatus {
		const upperStatus = status.toUpperCase();
		if (Object.values(OperatingStatus).includes(upperStatus as OperatingStatus)) {
			return upperStatus as OperatingStatus;
		}
		return OperatingStatus.OPERATING;
	}

	private mapQueueType(type: string): QueueType {
		const upperType = type.toUpperCase();
		if (Object.values(QueueType).includes(upperType as QueueType)) {
			return upperType as QueueType;
		}
		return QueueType.STANDBY;
	}

	private mapShowTimeType(type: string): ShowTimeType {
		// Map various possible show time types
		const typeMap: Record<string, ShowTimeType> = {
			Operating: ShowTimeType.OPERATING,
			'Performance Time': ShowTimeType.PERFORMANCE_TIME,
			Special: ShowTimeType.SPECIAL,
			Parade: ShowTimeType.PARADE,
			Fireworks: ShowTimeType.FIREWORKS,
		};

		return typeMap[type] || ShowTimeType.OPERATING;
	}

	private mapParkScheduleType(type: string): ParkScheduleType {
		const upperType = type.toUpperCase();
		if (Object.values(ParkScheduleType).includes(upperType as ParkScheduleType)) {
			return upperType as ParkScheduleType;
		}
		return ParkScheduleType.OPERATING;
	}

	private mapPurchaseType(type: string): PurchaseType {
		const upperType = type.toUpperCase();
		if (Object.values(PurchaseType).includes(upperType as PurchaseType)) {
			return upperType as PurchaseType;
		}
		return PurchaseType.PACKAGE;
	}
}
