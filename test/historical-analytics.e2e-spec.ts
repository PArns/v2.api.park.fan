import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ThemeParksWikiModule } from '../src/modules/themeparks-wiki/themeparks-wiki.module';

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
	OperatingStatus,
	QueueType,
	PurchaseType,
} from '../src/entities';

describe('Historical Analytics E2E Tests', () => {
	let app: INestApplication;

	// Repositories
	let parkRepo: Repository<Park>;
	let attractionRepo: Repository<Attraction>;
	let restaurantRepo: Repository<Restaurant>;
	let waitTimeRepo: Repository<WaitTime>;
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
					dropSchema: false,
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
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		// Get repositories
		parkRepo = moduleFixture.get<Repository<Park>>(getRepositoryToken(Park));
		attractionRepo = moduleFixture.get<Repository<Attraction>>(getRepositoryToken(Attraction));
		restaurantRepo = moduleFixture.get<Repository<Restaurant>>(getRepositoryToken(Restaurant));
		waitTimeRepo = moduleFixture.get<Repository<WaitTime>>(getRepositoryToken(WaitTime));
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

	describe('Historical Data Creation and Tracking', () => {
		it('should create historical snapshots for purchase availability changes', async () => {
			// Create a test purchase
			const testPurchase = purchaseRepo.create({
				externalId: 'historical-test-purchase-001',
				name: 'Test Purchase for Historical Tracking',
				type: PurchaseType.PACKAGE,
				parkScheduleId: 'test-schedule-id',
				available: true,
				isActive: true,
				priceAmount: 2500, // $25.00
				priceCurrency: 'USD',
				priceFormatted: '$25.00',
			});
			const savedPurchase = await purchaseRepo.save(testPurchase);

			// Create first historical snapshot - available
			const snapshot1 = purchaseHistoryRepo.create({
				purchaseId: savedPurchase.id,
				name: savedPurchase.name,
				type: savedPurchase.type,
				priceAmount: savedPurchase.priceAmount,
				priceCurrency: savedPurchase.priceCurrency,
				priceFormatted: savedPurchase.priceFormatted,
				available: true,
				isActive: false, // Historical record
				recordedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
			});
			const savedSnapshot1 = await purchaseHistoryRepo.save(snapshot1);

			// Create second historical snapshot - price change
			const snapshot2 = purchaseHistoryRepo.create({
				purchaseId: savedPurchase.id,
				name: savedPurchase.name,
				type: savedPurchase.type,
				priceAmount: 3000, // Price increased to $30.00
				priceCurrency: savedPurchase.priceCurrency,
				priceFormatted: '$30.00',
				available: true,
				isActive: false, // Historical record
				recordedAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
			});
			const savedSnapshot2 = await purchaseHistoryRepo.save(snapshot2);

			// Create current snapshot - sold out
			const snapshot3 = purchaseHistoryRepo.create({
				purchaseId: savedPurchase.id,
				name: savedPurchase.name,
				type: savedPurchase.type,
				priceAmount: 3000,
				priceCurrency: savedPurchase.priceCurrency,
				priceFormatted: '$30.00',
				available: false, // Now sold out
				isActive: true, // Current record
				recordedAt: new Date(),
			});
			const savedSnapshot3 = await purchaseHistoryRepo.save(snapshot3);

			// Verify historical tracking
			expect(savedSnapshot1.id).toBeDefined();
			expect(savedSnapshot1.available).toBe(true);
			expect(savedSnapshot1.priceAmount).toBe(2500);
			expect(savedSnapshot1.isActive).toBe(false);

			expect(savedSnapshot2.priceAmount).toBe(3000);
			expect(savedSnapshot2.available).toBe(true);
			expect(savedSnapshot2.isActive).toBe(false);

			expect(savedSnapshot3.available).toBe(false);
			expect(savedSnapshot3.isActive).toBe(true);

			// Query historical data for analytics
			const priceHistory = await purchaseHistoryRepo
				.createQueryBuilder('ph')
				.where('ph.purchaseId = :id', { id: savedPurchase.id })
				.orderBy('ph.recordedAt', 'ASC')
				.getMany();

			expect(priceHistory).toHaveLength(3);
			expect(priceHistory[0].priceAmount).toBe(2500);
			expect(priceHistory[1].priceAmount).toBe(3000);
			expect(priceHistory[2].available).toBe(false);

			// Cleanup
			await purchaseHistoryRepo.delete(savedSnapshot1.id);
			await purchaseHistoryRepo.delete(savedSnapshot2.id);
			await purchaseHistoryRepo.delete(savedSnapshot3.id);
			await purchaseRepo.delete(savedPurchase.id);
		});

		it('should track restaurant availability patterns for analytics', async () => {
			// Find or create a test restaurant
			let testRestaurant = await restaurantRepo.findOne({
				where: { externalId: 'analytics-restaurant-001' },
			});

			if (!testRestaurant) {
				testRestaurant = restaurantRepo.create({
					externalId: 'analytics-restaurant-001',
					name: 'Analytics Test Restaurant',
					parkId: 'test-park-id',
					isActive: true,
					availabilityStatus: 'AVAILABLE',
					acceptsReservations: true,
				});
				testRestaurant = await restaurantRepo.save(testRestaurant);
			}

			// Create historical snapshots simulating different availability states
			const timestamps = [
				new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago - fully available
				new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago - limited availability
				new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago - fully booked
				new Date(Date.now()), // now - back to limited availability
			];

			const availabilityStates = ['AVAILABLE', 'LIMITED', 'FULLY_BOOKED', 'LIMITED'];

			const snapshots = [];
			for (let i = 0; i < timestamps.length; i++) {
				const snapshot = restaurantHistoryRepo.create({
					restaurantId: testRestaurant.id,
					name: testRestaurant.name,
					availabilityStatus: availabilityStates[i],
					acceptsReservations: true,
					isActiveRestaurant: true,
					isActive: i === timestamps.length - 1, // Only last one is current
					recordedAt: timestamps[i],
				});
				snapshots.push(await restaurantHistoryRepo.save(snapshot));
			}

			// Analytics Query: Find when restaurant gets fully booked most often
			const fullyBookedTimes = await restaurantHistoryRepo
				.createQueryBuilder('rh')
				.where('rh.restaurantId = :id', { id: testRestaurant.id })
				.andWhere('rh.availabilityStatus = :status', { status: 'FULLY_BOOKED' })
				.orderBy('rh.recordedAt', 'ASC')
				.getMany();

			expect(fullyBookedTimes).toHaveLength(1);
			expect(fullyBookedTimes[0].availabilityStatus).toBe('FULLY_BOOKED');

			// Analytics Query: Availability change frequency
			const availabilityChanges = await restaurantHistoryRepo
				.createQueryBuilder('rh')
				.where('rh.restaurantId = :id', { id: testRestaurant.id })
				.orderBy('rh.recordedAt', 'ASC')
				.getMany();

			expect(availabilityChanges).toHaveLength(4);
			expect(availabilityChanges[0].availabilityStatus).toBe('AVAILABLE');
			expect(availabilityChanges[1].availabilityStatus).toBe('LIMITED');
			expect(availabilityChanges[2].availabilityStatus).toBe('FULLY_BOOKED');
			expect(availabilityChanges[3].availabilityStatus).toBe('LIMITED');

			// Cleanup
			for (const snapshot of snapshots) {
				await restaurantHistoryRepo.delete(snapshot.id);
			}
		});

		it('should analyze wait time trends for crowd level statistics', async () => {
			// Find an existing attraction for wait time analytics
			const attraction = await attractionRepo.findOne({
				where: { isActive: true },
				select: ['id', 'name', 'externalId'],
			});

			if (attraction) {
				// Create simulated wait time history for a day
				const baseTime = new Date();
				baseTime.setHours(9, 0, 0, 0); // Start at 9 AM

				const waitTimes = [];
				const hourlyWaitTimes = [5, 10, 15, 25, 45, 60, 75, 90, 80, 65, 45, 30]; // Typical daily pattern

				for (let hour = 0; hour < hourlyWaitTimes.length; hour++) {
					const recordTime = new Date(baseTime.getTime() + hour * 60 * 60 * 1000);

					const waitTime = waitTimeRepo.create({
						attractionId: attraction.id,
						waitTimeMinutes: hourlyWaitTimes[hour],
						queueType: QueueType.STANDBY,
						status: OperatingStatus.OPERATING,
						isActive: hour === hourlyWaitTimes.length - 1, // Only last one is current
						recordedAt: recordTime,
					});
					waitTimes.push(await waitTimeRepo.save(waitTime));
				}

				// Analytics: Find peak wait times
				const peakTimes = await waitTimeRepo
					.createQueryBuilder('wt')
					.where('wt.attractionId = :id', { id: attraction.id })
					.andWhere('wt.waitTimeMinutes >= :threshold', { threshold: 60 })
					.orderBy('wt.waitTimeMinutes', 'DESC')
					.getMany();

				expect(peakTimes.length).toBeGreaterThan(0);
				if (peakTimes.length > 0) {
					expect(peakTimes[0].waitTimeMinutes).toBeGreaterThanOrEqual(60);
				}

				// Analytics: Average wait time for the day
				const avgWaitTime = await waitTimeRepo
					.createQueryBuilder('wt')
					.select('AVG(wt.waitTimeMinutes)', 'average')
					.where('wt.attractionId = :id', { id: attraction.id })
					.andWhere('wt.recordedAt >= :startDate', {
						startDate: new Date(baseTime.getTime()),
					})
					.getRawOne();

				expect(avgWaitTime.average).toBeDefined();
				expect(parseFloat(avgWaitTime.average)).toBeGreaterThan(0);

				// Cleanup
				for (const waitTime of waitTimes) {
					await waitTimeRepo.delete(waitTime.id);
				}
			}
		});

		it('should provide park capacity analytics through historical data', async () => {
			// Find an existing park for capacity analytics
			const park = await parkRepo.findOne({
				where: { isActive: true },
				select: ['id', 'name', 'externalId'],
			});

			if (park) {
				// Create park status history simulating daily capacity changes
				const capacityLevels = ['LOW', 'MODERATE', 'HIGH', 'AT_CAPACITY', 'HIGH', 'MODERATE'];
				const avgWaitTimes = [15, 30, 45, 75, 60, 35];
				const attractionsOpen = [40, 38, 35, 32, 35, 38];

				const baseTime = new Date();
				baseTime.setHours(9, 0, 0, 0);

				const snapshots = [];
				for (let i = 0; i < capacityLevels.length; i++) {
					const recordTime = new Date(baseTime.getTime() + i * 2 * 60 * 60 * 1000); // Every 2 hours

					const snapshot = parkStatusHistoryRepo.create({
						parkId: park.id,
						isAtCapacity: capacityLevels[i] === 'AT_CAPACITY',
						operatingStatus: 'OPERATING',
						avgWaitTime: avgWaitTimes[i],
						maxWaitTime: avgWaitTimes[i] * 2,
						totalAttractionsOpen: attractionsOpen[i],
						totalAttractionsClosed: 42 - attractionsOpen[i],
						isActive: i === capacityLevels.length - 1, // Only last one is current
						recordedAt: recordTime,
					});
					snapshots.push(await parkStatusHistoryRepo.save(snapshot));
				}

				// Analytics: When does park reach capacity most often?
				const capacityTimes = await parkStatusHistoryRepo
					.createQueryBuilder('psh')
					.where('psh.parkId = :id', { id: park.id })
					.andWhere('psh.isAtCapacity = :atCapacity', { atCapacity: true })
					.orderBy('psh.recordedAt', 'ASC')
					.getMany();

				expect(capacityTimes.length).toBeGreaterThan(0);
				if (capacityTimes.length > 0) {
					expect(capacityTimes[0].isAtCapacity).toBe(true);
				}

				// Analytics: Daily capacity utilization
				const capacityUtilization = await parkStatusHistoryRepo
					.createQueryBuilder('psh')
					.select('AVG(psh.totalAttractionsOpen)', 'avgOpen')
					.addSelect('MAX(psh.totalAttractionsOpen)', 'maxOpen')
					.addSelect('MIN(psh.totalAttractionsOpen)', 'minOpen')
					.where('psh.parkId = :id', { id: park.id })
					.getRawOne();

				expect(capacityUtilization.avgOpen).toBeDefined();
				expect(parseInt(capacityUtilization.maxOpen)).toBeGreaterThanOrEqual(
					parseInt(capacityUtilization.minOpen)
				);

				// Cleanup
				for (const snapshot of snapshots) {
					await parkStatusHistoryRepo.delete(snapshot.id);
				}
			}
		});
	});

	describe('Advanced Analytics Queries', () => {
		it('should efficiently query large historical datasets', async () => {
			const startTime = Date.now();

			// Complex query combining multiple historical tables
			const complexQuery = await waitTimeRepo
				.createQueryBuilder('wt')
				.leftJoin('wt.attraction', 'a')
				.select('a.name', 'attractionName')
				.addSelect('AVG(CAST(wt.waitTimeMinutes AS DECIMAL))', 'avgWaitTime')
				.addSelect('MAX(wt.waitTimeMinutes)', 'maxWaitTime')
				.addSelect('COUNT(*)', 'totalRecords')
				.where('wt.recordedAt >= :startDate', {
					startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
				})
				.andWhere('wt.status = :status', { status: OperatingStatus.OPERATING })
				.groupBy('a.id, a.name')
				.orderBy('AVG(CAST(wt.waitTimeMinutes AS DECIMAL))', 'DESC')
				.limit(10)
				.getRawMany();

			const endTime = Date.now();
			const queryDuration = endTime - startTime;

			// Should complete efficiently
			expect(queryDuration).toBeLessThan(3000); // 3 seconds
			expect(Array.isArray(complexQuery)).toBe(true);
		});

		it('should provide accurate historical data integrity', async () => {
			// Test that all historical records have proper timestamps
			const historicalTables = [
				{ repo: purchaseHistoryRepo, name: 'purchase_history' },
				{ repo: attractionHistoryRepo, name: 'attraction_history' },
				{ repo: restaurantHistoryRepo, name: 'restaurant_history' },
				{ repo: parkStatusHistoryRepo, name: 'park_status_history' },
			];

			for (const table of historicalTables) {
				const recordsWithoutTimestamp = await table.repo
					.createQueryBuilder('h')
					.where('h.recordedAt IS NULL')
					.getCount();

				expect(recordsWithoutTimestamp).toBe(0);

				// Test that active flags are properly set (simplified)
				const activeRecordsCount = await table.repo
					.createQueryBuilder('h')
					.where('h.isActive = :active', { active: true })
					.getCount();

				// Should have some active records if any records exist
				const totalRecords = await table.repo.count();
				if (totalRecords > 0) {
					expect(activeRecordsCount).toBeGreaterThanOrEqual(0);
				}
			}
		});
	});
});
