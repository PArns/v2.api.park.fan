import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Park } from '../../entities/park.entity';
import { GeocodingService } from '../geocoding/geocoding.service';

@Injectable()
export class ParkLocationService {
	private readonly logger = new Logger(ParkLocationService.name);

	constructor(
		@InjectRepository(Park)
		private readonly parkRepository: Repository<Park>,
		private readonly geocodingService: GeocodingService
	) {}

	/**
	 * Updates a single park with location data
	 */
	async updateParkLocation(parkId: string): Promise<Park | null> {
		const park = await this.parkRepository.findOne({ where: { id: parkId } });

		if (!park) {
			this.logger.warn(`Park with ID ${parkId} not found`);
			return null;
		}

		if (!park.latitude || !park.longitude) {
			this.logger.warn(`Park ${park.name} has no coordinates`);
			return park;
		}

		this.logger.log(`Updating location data for park: ${park.name}`);

		try {
			const locationData = await this.geocodingService.reverseGeocode(
				Number(park.latitude),
				Number(park.longitude)
			);

			// Only update if new data is available
			let hasUpdates = false;

			if (locationData.country && locationData.country !== park.country) {
				park.country = locationData.country;
				hasUpdates = true;
			}

			if (locationData.city && locationData.city !== park.city) {
				park.city = locationData.city;
				hasUpdates = true;
			}

			if (locationData.continent && locationData.continent !== park.continent) {
				park.continent = locationData.continent;
				hasUpdates = true;
			}

			if (hasUpdates) {
				await this.parkRepository.save(park);
				this.logger.log(`Updated location data for park: ${park.name}`);
			} else {
				this.logger.debug(`No location updates needed for park: ${park.name}`);
			}

			return park;
		} catch (error) {
			this.logger.error(`Failed to update location for park ${park.name}:`, error);
			return park;
		}
	}

	/**
	 * Updates all parks without location data
	 */
	async updateAllParksWithoutLocation(): Promise<void> {
		this.logger.log('Starting batch update of parks without location data');

		// Find all parks with coordinates but without location data
		const parksWithoutLocation = await this.parkRepository
			.createQueryBuilder('park')
			.where('park.latitude IS NOT NULL')
			.andWhere('park.longitude IS NOT NULL')
			.andWhere('(park.country IS NULL OR park.city IS NULL OR park.continent IS NULL)')
			.getMany();

		this.logger.log(`Found ${parksWithoutLocation.length} parks needing location updates`);

		if (parksWithoutLocation.length === 0) {
			return;
		}

		// Batch update with rate limiting
		const coordinates = parksWithoutLocation.map((park) => ({
			latitude: Number(park.latitude),
			longitude: Number(park.longitude),
		}));

		try {
			const locationDataArray = await this.geocodingService.reverseGeocodeMultiple(
				coordinates,
				1200, // 1.2 seconds between batches for rate limiting
				3 // Process 3 parks in parallel per batch
			);

			// Update each park with corresponding data
			for (let i = 0; i < parksWithoutLocation.length; i++) {
				const park = parksWithoutLocation[i];
				const locationData = locationDataArray[i];

				let hasUpdates = false;

				if (locationData.country && !park.country) {
					park.country = locationData.country;
					hasUpdates = true;
				}

				if (locationData.city && !park.city) {
					park.city = locationData.city;
					hasUpdates = true;
				}

				if (locationData.continent && !park.continent) {
					park.continent = locationData.continent;
					hasUpdates = true;
				}

				if (locationData.countryCode && !park.countryCode) {
					park.countryCode = locationData.countryCode;
					hasUpdates = true;
				}

				if (hasUpdates) {
					await this.parkRepository.save(park);
					this.logger.debug(`Updated location for park: ${park.name}`);
				}
			}

			this.logger.log('Completed batch update of park locations');
		} catch (error) {
			this.logger.error('Batch update of park locations failed:', error);
		}
	}

	/**
	 * Updates specific parks based on a list of IDs
	 */
	async updateParkLocationsByIds(parkIds: string[]): Promise<void> {
		this.logger.log(`Updating location data for ${parkIds.length} parks`);

		for (const parkId of parkIds) {
			await this.updateParkLocation(parkId);
			// Small pause between requests
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		this.logger.log('Completed updating park locations by IDs');
	}

	/**
	 * Returns statistics about parks with/without location data
	 */
	async getLocationStats(): Promise<{
		total: number;
		withCoordinates: number;
		withFullLocation: number;
		needingUpdate: number;
	}> {
		const total = await this.parkRepository.count();

		const withCoordinates = await this.parkRepository
			.createQueryBuilder('park')
			.where('park.latitude IS NOT NULL')
			.andWhere('park.longitude IS NOT NULL')
			.getCount();

		const withFullLocation = await this.parkRepository
			.createQueryBuilder('park')
			.where('park.country IS NOT NULL')
			.andWhere('park.city IS NOT NULL')
			.andWhere('park.continent IS NOT NULL')
			.getCount();

		const needingUpdate = await this.parkRepository
			.createQueryBuilder('park')
			.where('park.latitude IS NOT NULL')
			.andWhere('park.longitude IS NOT NULL')
			.andWhere('(park.country IS NULL OR park.city IS NULL OR park.continent IS NULL)')
			.getCount();

		return {
			total,
			withCoordinates,
			withFullLocation,
			needingUpdate,
		};
	}
}
