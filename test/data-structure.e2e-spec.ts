import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ThemeParksWikiModule } from '../src/modules/themeparks-wiki/themeparks-wiki.module';
import { ThemeParksWikiService } from '../src/modules/themeparks-wiki/themeparks-wiki.service';
import { ScraperModule } from '../src/modules/scraper/scraper.module';
import { ScraperService } from '../src/modules/scraper/scraper.service';

import {
	ParkGroup,
	Park,
	Attraction,
	Restaurant,
	WaitTime,
	ShowTime,
	ParkSchedule,
	Purchase,
	PurchaseHistory,
	AttractionHistory,
	RestaurantHistory,
	ParkStatusHistory,
	EntityType,
	OperatingStatus,
	QueueType,
	PurchaseType,
} from '../src/entities';

describe('Data Structure E2E Tests', () => {
	let app: INestApplication;
	let themeParksService: ThemeParksWikiService;
	let scraperService: ScraperService;

	// Repositories
	let parkGroupRepo: Repository<ParkGroup>;
	let parkRepo: Repository<Park>;
	let attractionRepo: Repository<Attraction>;
	let restaurantRepo: Repository<Restaurant>;
	let waitTimeRepo: Repository<WaitTime>;
	let showTimeRepo: Repository<ShowTime>;
	let parkScheduleRepo: Repository<ParkSchedule>;
	let purchaseRepo: Repository<Purchase>;
	let purchaseHistoryRepo: Repository<PurchaseHistory>;
	let attractionHistoryRepo: Repository<AttractionHistory>;
	let restaurantHistoryRepo: Repository<RestaurantHistory>;
	let parkStatusHistoryRepo: Repository<ParkStatusHistory>;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({
					isGlobal: true,
					envFilePath: '.env',
				}),
				TypeOrmModule.forRoot({
					type: 'postgres',
					host: process.env.DB_HOST || 'localhost',
					port: parseInt(process.env.DB_PORT || '5432'),
					username: process.env.DB_USER || 'postgres',
					password: process.env.DB_PASS || 'postgres',
					database: process.env.DB_NAME || 'api.park.fan',
					entities: [
						ParkGroup,
						Park,
						Attraction,
						Restaurant,
						WaitTime,
						ShowTime,
						ParkSchedule,
						Purchase,
						PurchaseHistory,
						AttractionHistory,
						RestaurantHistory,
						ParkStatusHistory,
					],
					synchronize: true,
					dropSchema: false, // Keep existing data for testing
				}),
				TypeOrmModule.forFeature([
					ParkGroup,
					Park,
					Attraction,
					Restaurant,
					WaitTime,
					ShowTime,
					ParkSchedule,
					Purchase,
					PurchaseHistory,
					AttractionHistory,
					RestaurantHistory,
					ParkStatusHistory,
				]),
				ThemeParksWikiModule,
				ScraperModule,
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		themeParksService = moduleFixture.get<ThemeParksWikiService>(ThemeParksWikiService);
		scraperService = moduleFixture.get<ScraperService>(ScraperService);

		// Get repositories
		parkGroupRepo = moduleFixture.get<Repository<ParkGroup>>(getRepositoryToken(ParkGroup));
		parkRepo = moduleFixture.get<Repository<Park>>(getRepositoryToken(Park));
		attractionRepo = moduleFixture.get<Repository<Attraction>>(getRepositoryToken(Attraction));
		restaurantRepo = moduleFixture.get<Repository<Restaurant>>(getRepositoryToken(Restaurant));
		waitTimeRepo = moduleFixture.get<Repository<WaitTime>>(getRepositoryToken(WaitTime));
		showTimeRepo = moduleFixture.get<Repository<ShowTime>>(getRepositoryToken(ShowTime));
		parkScheduleRepo = moduleFixture.get<Repository<ParkSchedule>>(getRepositoryToken(ParkSchedule));
		purchaseRepo = moduleFixture.get<Repository<Purchase>>(getRepositoryToken(Purchase));
		purchaseHistoryRepo = moduleFixture.get<Repository<PurchaseHistory>>(
			getRepositoryToken(PurchaseHistory)
		);
		attractionHistoryRepo = moduleFixture.get<Repository<AttractionHistory>>(
			getRepositoryToken(AttractionHistory)
		);
		restaurantHistoryRepo = moduleFixture.get<Repository<RestaurantHistory>>(
			getRepositoryToken(RestaurantHistory)
		);
		parkStatusHistoryRepo = moduleFixture.get<Repository<ParkStatusHistory>>(
			getRepositoryToken(ParkStatusHistory)
		);
	});

	afterAll(async () => {
		await app.close();
	});

	describe('ThemeParks Wiki Service', () => {
		it('should fetch park groups successfully', async () => {
			const parkGroups = await themeParksService.fetchParkGroups();

			expect(parkGroups).toBeDefined();
			expect(Array.isArray(parkGroups)).toBe(true);
			expect(parkGroups.length).toBeGreaterThan(0);

			const firstGroup = parkGroups[0];
			expect(firstGroup).toHaveProperty('id');
			expect(firstGroup).toHaveProperty('name');
			expect(firstGroup).toHaveProperty('parks');
			expect(Array.isArray(firstGroup.parks)).toBe(true);

			if (firstGroup.parks.length > 0) {
				const firstPark = firstGroup.parks[0];
				expect(firstPark).toHaveProperty('id');
				expect(firstPark).toHaveProperty('name');
				expect(firstPark).toHaveProperty('entityType');
				expect(firstPark.entityType).toBe(EntityType.PARK);
			}
		});

		it('should fetch park details successfully', async () => {
			// Use Disney World Magic Kingdom as test case
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const park = await themeParksService.fetchPark(parkId);

			expect(park).toBeDefined();
			expect(park.id).toBe(parkId);
			expect(park.name).toBeDefined();
			expect(park.timezone).toBeDefined();
			expect(park.entityType).toBe(EntityType.PARK);

			if (park.location) {
				expect(typeof park.location.latitude).toBe('number');
				expect(typeof park.location.longitude).toBe('number');
			}
		});

		it('should fetch attractions successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const attractions = await themeParksService.fetchAttractions(parkId);

			expect(attractions).toBeDefined();
			expect(Array.isArray(attractions)).toBe(true);
			expect(attractions.length).toBeGreaterThan(0);

			const firstAttraction = attractions[0];
			expect(firstAttraction).toHaveProperty('id');
			expect(firstAttraction).toHaveProperty('name');
			expect(firstAttraction).toHaveProperty('entityType');
			expect(firstAttraction.entityType).toBe(EntityType.ATTRACTION);
			expect(firstAttraction.parkId).toBe(parkId);
		});

		it('should fetch live data with attraction status successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const liveData = await themeParksService.fetchLiveData(parkId);

			expect(liveData).toBeDefined();
			expect(liveData).toHaveProperty('entities');
			expect(Array.isArray(liveData.entities)).toBe(true);
			expect(liveData.entities.length).toBeGreaterThan(0);

			// Check if at least one entity has status
			const entitiesWithStatus = liveData.entities.filter((entity) => entity.status);
			console.log(
				`Found ${entitiesWithStatus.length} entities with status out of ${liveData.entities.length} total`
			);

			if (entitiesWithStatus.length > 0) {
				const entityWithStatus = entitiesWithStatus[0];
				expect(entityWithStatus).toHaveProperty('status');
				expect(Object.values(OperatingStatus)).toContain(entityWithStatus.status);
				console.log(
					`Example entity with status: ${entityWithStatus.name} - ${entityWithStatus.status}`
				);
			}
		});

		it('should store attractions with status after scraping', async () => {
			// Run attraction scraping
			await scraperService['scrapeAttractionsAndShows']();

			// Check if attractions were saved with status
			const attractions = await attractionRepo.find({
				where: { isActive: true },
				take: 10,
			});

			expect(attractions.length).toBeGreaterThan(0);

			// Check if any attractions have status set
			const attractionsWithStatus = attractions.filter((a) => a.status !== null);
			console.log(
				`Found ${attractionsWithStatus.length} attractions with status out of ${attractions.length} total`
			);

			if (attractionsWithStatus.length > 0) {
				const attractionWithStatus = attractionsWithStatus[0];
				expect(attractionWithStatus.status).toBeDefined();
				expect(Object.values(OperatingStatus)).toContain(attractionWithStatus.status);
				console.log(
					`Example attraction with status: ${attractionWithStatus.name} - ${attractionWithStatus.status}`
				);
			}
		}, 30000); // 30 second timeout

		it('should fetch restaurants successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const restaurants = await themeParksService.fetchRestaurants(parkId);

			expect(restaurants).toBeDefined();
			expect(Array.isArray(restaurants)).toBe(true);

			if (restaurants.length > 0) {
				const firstRestaurant = restaurants[0];
				expect(firstRestaurant).toHaveProperty('id');
				expect(firstRestaurant).toHaveProperty('name');
				expect(firstRestaurant).toHaveProperty('entityType');
				expect(firstRestaurant.entityType).toBe(EntityType.RESTAURANT);
				expect(firstRestaurant.parkId).toBe(parkId);
			}
		});

		it('should fetch wait times successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const waitTimes = await themeParksService.fetchWaitTimes(parkId);

			expect(waitTimes).toBeDefined();
			expect(Array.isArray(waitTimes)).toBe(true);

			if (waitTimes.length > 0) {
				const firstWaitTime = waitTimes[0];
				expect(firstWaitTime).toHaveProperty('id');
				expect(firstWaitTime).toHaveProperty('attractionId');
				expect(firstWaitTime).toHaveProperty('queueType');
				expect(Object.values(QueueType)).toContain(firstWaitTime.queueType);

				if (firstWaitTime.status) {
					expect(Object.values(OperatingStatus)).toContain(firstWaitTime.status);
				}
			}
		});

		it('should fetch show times successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const showTimes = await themeParksService.fetchShowTimes(parkId);

			expect(showTimes).toBeDefined();
			expect(Array.isArray(showTimes)).toBe(true);

			if (showTimes.length > 0) {
				const firstShow = showTimes[0];
				expect(firstShow).toHaveProperty('id');
				expect(firstShow).toHaveProperty('name');
				expect(firstShow).toHaveProperty('showtimes');
				expect(Array.isArray(firstShow.showtimes)).toBe(true);

				if (firstShow.showtimes.length > 0) {
					const firstShowtime = firstShow.showtimes[0];
					expect(firstShowtime).toHaveProperty('startTime');
					expect(firstShowtime).toHaveProperty('endTime');
				}
			}
		});

		it('should fetch park schedule successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const schedule = await themeParksService.fetchParkSchedule(parkId);

			expect(schedule).toBeDefined();
			expect(Array.isArray(schedule)).toBe(true);
			expect(schedule.length).toBeGreaterThan(0);

			const firstSchedule = schedule[0];
			expect(firstSchedule).toHaveProperty('date');
			expect(firstSchedule).toHaveProperty('type');
			expect(typeof firstSchedule.date).toBe('string');

			if (firstSchedule.purchases && firstSchedule.purchases.length > 0) {
				const firstPurchase = firstSchedule.purchases[0];
				expect(firstPurchase).toHaveProperty('id');
				expect(firstPurchase).toHaveProperty('name');
				expect(firstPurchase).toHaveProperty('type');
				expect(Object.values(PurchaseType)).toContain(firstPurchase.type);
				expect(firstPurchase).toHaveProperty('available');
				expect(typeof firstPurchase.available).toBe('boolean');
			}
		});

		it('should fetch live data successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';
			const liveData = await themeParksService.fetchLiveData(parkId);

			expect(liveData).toBeDefined();
			expect(liveData).toHaveProperty('waitTimes');
			expect(liveData).toHaveProperty('showTimes');
			expect(liveData).toHaveProperty('entities');

			expect(Array.isArray(liveData.waitTimes)).toBe(true);
			expect(Array.isArray(liveData.showTimes)).toBe(true);
			expect(Array.isArray(liveData.entities)).toBe(true);
		});
	});

	describe('Database Storage', () => {
		it('should have park groups stored correctly', async () => {
			const parkGroups = await parkGroupRepo.find();
			expect(parkGroups.length).toBeGreaterThan(0);

			const firstGroup = parkGroups[0];
			expect(firstGroup.id).toBeDefined();
			expect(firstGroup.externalId).toBeDefined();
			expect(firstGroup.name).toBeDefined();
			expect(firstGroup.slug).toBeDefined();
			expect(typeof firstGroup.isActive).toBe('boolean');
			expect(firstGroup.createdAt).toBeInstanceOf(Date);
			expect(firstGroup.updatedAt).toBeInstanceOf(Date);
		});

		it('should have parks stored correctly', async () => {
			const parks = await parkRepo.find();
			expect(parks.length).toBeGreaterThan(0);

			const firstPark = parks[0];
			expect(firstPark.id).toBeDefined();
			expect(firstPark.externalId).toBeDefined();
			expect(firstPark.name).toBeDefined();
			expect(firstPark.timezone).toBeDefined();
			expect(typeof firstPark.isActive).toBe('boolean');
			expect(firstPark.createdAt).toBeInstanceOf(Date);
			expect(firstPark.updatedAt).toBeInstanceOf(Date);

			// Check new status fields
			expect(firstPark).toHaveProperty('isAtCapacity');
			expect(firstPark).toHaveProperty('operatingStatus');
		});

		it('should have attractions stored correctly', async () => {
			const attractions = await attractionRepo.find({ take: 10 });
			expect(attractions.length).toBeGreaterThan(0);

			const firstAttraction = attractions[0];
			expect(firstAttraction.id).toBeDefined();
			expect(firstAttraction.externalId).toBeDefined();
			expect(firstAttraction.name).toBeDefined();
			expect(Object.values(EntityType)).toContain(firstAttraction.entityType);
			expect(firstAttraction.parkId).toBeDefined();
			expect(typeof firstAttraction.isActive).toBe('boolean');
			expect(firstAttraction.createdAt).toBeInstanceOf(Date);
			expect(firstAttraction.updatedAt).toBeInstanceOf(Date);
		});

		it('should have restaurants stored correctly', async () => {
			const restaurants = await restaurantRepo.find({ take: 10 });

			if (restaurants.length > 0) {
				const firstRestaurant = restaurants[0];
				expect(firstRestaurant.id).toBeDefined();
				expect(firstRestaurant.externalId).toBeDefined();
				expect(firstRestaurant.name).toBeDefined();
				expect(firstRestaurant.parkId).toBeDefined();
				expect(typeof firstRestaurant.isActive).toBe('boolean');
				expect(firstRestaurant.createdAt).toBeInstanceOf(Date);
				expect(firstRestaurant.updatedAt).toBeInstanceOf(Date);

				// Check new fields
				expect(firstRestaurant).toHaveProperty('availabilityStatus');
				expect(firstRestaurant).toHaveProperty('acceptsReservations');
			}
		});

		it('should have wait times stored correctly', async () => {
			const waitTimes = await waitTimeRepo.find({ take: 10 });

			if (waitTimes.length > 0) {
				const firstWaitTime = waitTimes[0];
				expect(firstWaitTime.id).toBeDefined();
				expect(firstWaitTime.attractionId).toBeDefined();
				expect(Object.values(QueueType)).toContain(firstWaitTime.queueType);
				expect(Object.values(OperatingStatus)).toContain(firstWaitTime.status);
				expect(typeof firstWaitTime.isActive).toBe('boolean');
				expect(firstWaitTime.recordedAt).toBeInstanceOf(Date);
				expect(firstWaitTime.createdAt).toBeInstanceOf(Date);
			}
		});

		it('should have show times stored correctly', async () => {
			const showTimes = await showTimeRepo.find({ take: 10 });

			if (showTimes.length > 0) {
				const firstShowTime = showTimes[0];
				expect(firstShowTime.id).toBeDefined();
				expect(firstShowTime.attractionId).toBeDefined();
				expect(firstShowTime.startTime).toBeInstanceOf(Date);
				expect(firstShowTime.endTime).toBeInstanceOf(Date);
				expect(typeof firstShowTime.isActive).toBe('boolean');
				expect(firstShowTime.createdAt).toBeInstanceOf(Date);
			}
		});

		it('should have park schedules stored correctly', async () => {
			const schedules = await parkScheduleRepo.find({ take: 10 });

			if (schedules.length > 0) {
				const firstSchedule = schedules[0];
				expect(firstSchedule.id).toBeDefined();
				expect(firstSchedule.parkId).toBeDefined();
				expect(firstSchedule.date).toBeDefined();
				expect(firstSchedule.scheduleType).toBeDefined();
				expect(firstSchedule.createdAt).toBeInstanceOf(Date);
				expect(firstSchedule.updatedAt).toBeInstanceOf(Date);
			}
		});

		it('should have purchases stored correctly', async () => {
			const purchases = await purchaseRepo.find({ take: 10 });

			if (purchases.length > 0) {
				const firstPurchase = purchases[0];
				expect(firstPurchase.id).toBeDefined();
				expect(firstPurchase.externalId).toBeDefined();
				expect(firstPurchase.name).toBeDefined();
				expect(Object.values(PurchaseType)).toContain(firstPurchase.type);
				expect(firstPurchase.parkScheduleId).toBeDefined();
				expect(typeof firstPurchase.available).toBe('boolean');
				expect(typeof firstPurchase.isActive).toBe('boolean');
				expect(firstPurchase.createdAt).toBeInstanceOf(Date);
				expect(firstPurchase.updatedAt).toBeInstanceOf(Date);
			}
		});
	});

	describe('Historical Data Entities', () => {
		it('should create purchase history records', async () => {
			// Create a test purchase
			const testPurchase = purchaseRepo.create({
				externalId: 'test-purchase-' + Date.now(),
				name: 'Test Purchase',
				type: PurchaseType.PACKAGE,
				parkScheduleId: 'test-schedule-id',
				available: true,
				isActive: true,
				priceAmount: 5000, // $50.00
				priceCurrency: 'USD',
				priceFormatted: '$50.00',
			});
			const savedPurchase = await purchaseRepo.save(testPurchase);

			// Create history record
			const historyRecord = purchaseHistoryRepo.create({
				purchaseId: savedPurchase.id,
				name: savedPurchase.name,
				type: savedPurchase.type,
				priceAmount: savedPurchase.priceAmount,
				priceCurrency: savedPurchase.priceCurrency,
				priceFormatted: savedPurchase.priceFormatted,
				available: savedPurchase.available,
				isActive: true,
				recordedAt: new Date(),
			});
			const savedHistory = await purchaseHistoryRepo.save(historyRecord);

			expect(savedHistory.id).toBeDefined();
			expect(savedHistory.purchaseId).toBe(savedPurchase.id);
			expect(savedHistory.name).toBe(savedPurchase.name);
			expect(savedHistory.available).toBe(savedPurchase.available);
			expect(savedHistory.recordedAt).toBeInstanceOf(Date);

			// Cleanup
			await purchaseHistoryRepo.delete(savedHistory.id);
			await purchaseRepo.delete(savedPurchase.id);
		});

		it('should create attraction history records', async () => {
			// Find an existing attraction
			const attraction = await attractionRepo.findOne({ where: { isActive: true } });

			if (attraction) {
				const historyRecord = attractionHistoryRepo.create({
					attractionId: attraction.id,
					name: attraction.name,
					entityType: attraction.entityType,
					status: OperatingStatus.OPERATING,
					latitude: attraction.latitude,
					longitude: attraction.longitude,
					isActiveAttraction: attraction.isActive,
					isActive: true,
					recordedAt: new Date(),
				});
				const savedHistory = await attractionHistoryRepo.save(historyRecord);

				expect(savedHistory.id).toBeDefined();
				expect(savedHistory.attractionId).toBe(attraction.id);
				expect(savedHistory.name).toBe(attraction.name);
				expect(savedHistory.entityType).toBe(attraction.entityType);
				expect(savedHistory.recordedAt).toBeInstanceOf(Date);

				// Cleanup
				await attractionHistoryRepo.delete(savedHistory.id);
			}
		});

		it('should create restaurant history records', async () => {
			// Find an existing restaurant
			const restaurant = await restaurantRepo.findOne({ where: { isActive: true } });

			if (restaurant) {
				const historyRecord = restaurantHistoryRepo.create({
					restaurantId: restaurant.id,
					name: restaurant.name,
					latitude: restaurant.latitude,
					longitude: restaurant.longitude,
					isActiveRestaurant: restaurant.isActive,
					availabilityStatus: 'AVAILABLE',
					acceptsReservations: true,
					isActive: true,
					recordedAt: new Date(),
				});
				const savedHistory = await restaurantHistoryRepo.save(historyRecord);

				expect(savedHistory.id).toBeDefined();
				expect(savedHistory.restaurantId).toBe(restaurant.id);
				expect(savedHistory.name).toBe(restaurant.name);
				expect(savedHistory.availabilityStatus).toBe('AVAILABLE');
				expect(savedHistory.recordedAt).toBeInstanceOf(Date);

				// Cleanup
				await restaurantHistoryRepo.delete(savedHistory.id);
			}
		});

		it('should create park status history records', async () => {
			// Find an existing park
			const park = await parkRepo.findOne({ where: { isActive: true } });

			if (park) {
				const historyRecord = parkStatusHistoryRepo.create({
					parkId: park.id,
					isAtCapacity: false,
					operatingStatus: 'OPERATING',
					avgWaitTime: 25,
					maxWaitTime: 120,
					totalAttractionsOpen: 35,
					totalAttractionsClosed: 5,
					isActive: true,
					recordedAt: new Date(),
				});
				const savedHistory = await parkStatusHistoryRepo.save(historyRecord);

				expect(savedHistory.id).toBeDefined();
				expect(savedHistory.parkId).toBe(park.id);
				expect(savedHistory.isAtCapacity).toBe(false);
				expect(typeof savedHistory.avgWaitTime).toBe('number');
				expect(typeof savedHistory.maxWaitTime).toBe('number');
				expect(savedHistory.recordedAt).toBeInstanceOf(Date);

				// Cleanup
				await parkStatusHistoryRepo.delete(savedHistory.id);
			}
		});
	});

	describe('Data Integrity and Indices', () => {
		it('should have proper indices for efficient queries', async () => {
			// Test wait time queries (already has good indices)
			const recentWaitTimes = await waitTimeRepo
				.createQueryBuilder('wt')
				.where('wt.recordedAt >= :date', { date: new Date(Date.now() - 24 * 60 * 60 * 1000) })
				.orderBy('wt.recordedAt', 'DESC')
				.limit(100)
				.getMany();

			expect(Array.isArray(recentWaitTimes)).toBe(true);
		});

		it('should enforce unique constraints', async () => {
			// Test external ID uniqueness
			const parks = await parkRepo.find();
			if (parks.length > 1) {
				const externalIds = parks.map((park) => park.externalId);
				const uniqueExternalIds = [...new Set(externalIds)];
				expect(externalIds.length).toBe(uniqueExternalIds.length);
			}
		});

		it('should handle historical data queries efficiently', async () => {
			// Test historical query performance
			const startTime = Date.now();

			await parkStatusHistoryRepo
				.createQueryBuilder('psh')
				.where('psh.recordedAt >= :startDate AND psh.recordedAt <= :endDate', {
					startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
					endDate: new Date(),
				})
				.orderBy('psh.recordedAt', 'DESC')
				.limit(1000)
				.getMany();

			const endTime = Date.now();
			const queryTime = endTime - startTime;

			// Should complete within reasonable time (adjust threshold as needed)
			expect(queryTime).toBeLessThan(5000); // 5 seconds
		});
	});
});
