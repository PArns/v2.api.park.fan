import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { Repository } from 'typeorm';
import { ScraperService } from '../src/modules/scraper/scraper.service';
import { ThemeParksWikiService } from '../src/modules/themeparks-wiki/themeparks-wiki.service';
import { Park } from '../src/entities/park.entity';
import { ParkGroup } from '../src/entities/park-group.entity';
import { Attraction, EntityType } from '../src/entities/attraction.entity';
import { ShowTime } from '../src/entities/show-time.entity';
import { ParkSchedule } from '../src/entities/park-schedule.entity';
import { WaitTime } from '../src/entities/wait-time.entity';
import { ParkLocationService } from '../src/modules/geocoding/park-location.service';
import { GeocodingService } from '../src/modules/geocoding/geocoding.service';
import { OperatingStatus } from '../src/modules/themeparks-wiki/dto/themeparks-wiki.dto';
import { ParkStatusHistory } from '../src/entities/park-status-history.entity';

describe('Park Status Fix (e2e)', () => {
	let app: INestApplication;
	let scraperService: ScraperService;
	let wikiService: ThemeParksWikiService;
	let parkRepo: Repository<Park>;
	let parkGroupRepo: Repository<ParkGroup>;
	let parkStatusHistoryRepo: Repository<ParkStatusHistory>;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [
				HttpModule,
				TypeOrmModule.forRoot({
					type: 'sqlite',
					database: ':memory:',
					entities: [Park, ParkGroup, Attraction, ShowTime, ParkSchedule, WaitTime, ParkStatusHistory],
					synchronize: true,
					logging: false,
				}),
				TypeOrmModule.forFeature([
					Park,
					ParkGroup,
					Attraction,
					ShowTime,
					ParkSchedule,
					WaitTime,
					ParkStatusHistory,
				]),
			],
			providers: [ScraperService, ThemeParksWikiService, ParkLocationService, GeocodingService],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		scraperService = moduleFixture.get<ScraperService>(ScraperService);
		wikiService = moduleFixture.get<ThemeParksWikiService>(ThemeParksWikiService);
		parkRepo = moduleFixture.get('ParkRepository');
		parkGroupRepo = moduleFixture.get('ParkGroupRepository');
		parkStatusHistoryRepo = moduleFixture.get('ParkStatusHistoryRepository');
	});

	afterAll(async () => {
		await app.close();
	});

	beforeEach(async () => {
		// Clean up database before each test
		await parkRepo.clear();
		await parkGroupRepo.clear();
		await parkStatusHistoryRepo.clear();
	});

	describe('Operating Status from Live Data', () => {
		it('should fetch and store operating status from live data', async () => {
			// Mock the wiki service to return test data
			jest.spyOn(wikiService, 'fetchParkGroups').mockResolvedValue([
				{
					id: 'test-group-1',
					name: 'Test Group',
					parks: [
						{
							id: 'test-park-1',
							name: 'Test Park',
							timezone: 'UTC',
							location: { latitude: 40.7128, longitude: -74.006 },
						},
					],
				},
			]);

			jest.spyOn(wikiService, 'fetchPark').mockResolvedValue({
				id: 'test-park-1',
				name: 'Test Park Detailed',
				timezone: 'America/New_York',
				location: { latitude: 40.7589, longitude: -73.9851 },
			});

			// Mock live data with operating status
			jest.spyOn(wikiService, 'fetchLiveData').mockResolvedValue({
				waitTimes: [],
				showTimes: [],
				entities: [
					{
						id: 'test-park-1',
						name: 'Test Park',
						entityType: EntityType.ATTRACTION, // Parks are treated as attractions in live data
						status: OperatingStatus.OPERATING,
						lastUpdated: new Date().toISOString(),
					},
					{
						id: 'test-attraction-1',
						name: 'Test Attraction',
						entityType: EntityType.ATTRACTION,
						status: OperatingStatus.OPERATING,
						waitTime: 30,
						lastUpdated: new Date().toISOString(),
					},
				],
			});

			// Run the scraper
			await scraperService['scrapeParkGroups']();
			await scraperService['scrapeParks']();

			// Verify the park was created with the correct operating status
			const parks = await parkRepo.find();
			expect(parks).toHaveLength(1);

			const park = parks[0];
			expect(park.name).toBe('Test Park Detailed');
			expect(park.timezone).toBe('America/New_York');
			expect(park.latitude).toBe(40.7589);
			expect(park.longitude).toBe(-73.9851);
			expect(park.operatingStatus).toBe('OPERATING'); // This should now be set!
		});

		it('should handle parks without live data gracefully', async () => {
			// Mock the wiki service to return test data
			jest.spyOn(wikiService, 'fetchParkGroups').mockResolvedValue([
				{
					id: 'test-group-2',
					name: 'Test Group 2',
					parks: [
						{
							id: 'test-park-2',
							name: 'Test Park 2',
							timezone: 'UTC',
							location: { latitude: 50.0, longitude: 8.0 },
						},
					],
				},
			]);

			jest.spyOn(wikiService, 'fetchPark').mockResolvedValue({
				id: 'test-park-2',
				name: 'Test Park 2 Detailed',
				timezone: 'Europe/Berlin',
				location: { latitude: 50.1109, longitude: 8.6821 },
			});

			// Mock live data fetch to throw error (simulating API failure)
			jest.spyOn(wikiService, 'fetchLiveData').mockRejectedValue(new Error('Live data not available'));

			// Run the scraper
			await scraperService['scrapeParkGroups']();
			await scraperService['scrapeParks']();

			// Verify the park was created but without operating status
			const parks = await parkRepo.find();
			expect(parks).toHaveLength(1);

			const park = parks[0];
			expect(park.name).toBe('Test Park 2 Detailed');
			expect(park.timezone).toBe('Europe/Berlin');
			expect(park.operatingStatus).toBeUndefined(); // Should be undefined when live data fails
		});

		it('should handle parks where live data does not contain park status', async () => {
			// Mock the wiki service to return test data
			jest.spyOn(wikiService, 'fetchParkGroups').mockResolvedValue([
				{
					id: 'test-group-3',
					name: 'Test Group 3',
					parks: [
						{
							id: 'test-park-3',
							name: 'Test Park 3',
							timezone: 'UTC',
							location: { latitude: 35.6762, longitude: 139.6503 },
						},
					],
				},
			]);

			jest.spyOn(wikiService, 'fetchPark').mockResolvedValue({
				id: 'test-park-3',
				name: 'Test Park 3 Detailed',
				timezone: 'Asia/Tokyo',
				location: { latitude: 35.6762, longitude: 139.6503 },
			});

			// Mock live data that contains attractions but no park status
			jest.spyOn(wikiService, 'fetchLiveData').mockResolvedValue({
				waitTimes: [],
				showTimes: [],
				entities: [
					{
						id: 'test-attraction-1',
						name: 'Test Attraction 1',
						entityType: EntityType.ATTRACTION,
						status: OperatingStatus.OPERATING,
						waitTime: 25,
						lastUpdated: new Date().toISOString(),
					},
					{
						id: 'test-attraction-2',
						name: 'Test Attraction 2',
						entityType: EntityType.ATTRACTION,
						status: OperatingStatus.CLOSED,
						waitTime: undefined,
						lastUpdated: new Date().toISOString(),
					},
					// Note: No park entity in live data
				],
			});

			// Run the scraper
			await scraperService['scrapeParkGroups']();
			await scraperService['scrapeParks']();

			// Verify the park was created but without operating status
			const parks = await parkRepo.find();
			expect(parks).toHaveLength(1);

			const park = parks[0];
			expect(park.name).toBe('Test Park 3 Detailed');
			expect(park.timezone).toBe('Asia/Tokyo');
			expect(park.operatingStatus).toBeUndefined(); // Should be undefined when park not in live data
		});

		it('should update existing park with new operating status', async () => {
			// First, create a park group and park manually
			const parkGroup = parkGroupRepo.create({
				externalId: 'test-group-4',
				name: 'Test Group 4',
				slug: 'test-group-4',
				isActive: true,
				lastSynced: new Date(),
			});
			await parkGroupRepo.save(parkGroup);

			const existingPark = parkRepo.create({
				externalId: 'test-park-4',
				name: 'Old Park Name',
				slug: 'old-park-name',
				timezone: 'UTC',
				parkGroupId: parkGroup.id,
				operatingStatus: 'CLOSED', // Old status
				isActive: true,
				lastSynced: new Date(),
			});
			await parkRepo.save(existingPark);

			// Mock the wiki service responses
			jest.spyOn(wikiService, 'fetchParkGroups').mockResolvedValue([
				{
					id: 'test-group-4',
					name: 'Test Group 4 Updated',
					parks: [
						{
							id: 'test-park-4',
							name: 'Updated Park Name',
							timezone: 'UTC',
							location: { latitude: 40.0, longitude: -75.0 },
						},
					],
				},
			]);

			jest.spyOn(wikiService, 'fetchPark').mockResolvedValue({
				id: 'test-park-4',
				name: 'Updated Park Name Detailed',
				timezone: 'America/New_York',
				location: { latitude: 40.0, longitude: -75.0 },
			});

			// Mock live data with new operating status
			jest.spyOn(wikiService, 'fetchLiveData').mockResolvedValue({
				waitTimes: [],
				showTimes: [],
				entities: [
					{
						id: 'test-park-4',
						name: 'Updated Park Name',
						entityType: EntityType.ATTRACTION, // Parks are treated as attractions in live data
						status: OperatingStatus.OPERATING, // New status
						lastUpdated: new Date().toISOString(),
					},
				],
			});

			// Run the scraper
			await scraperService['scrapeParkGroups']();
			await scraperService['scrapeParks']();

			// Verify the park was updated with new information
			const parks = await parkRepo.find();
			expect(parks).toHaveLength(1);

			const park = parks[0];
			expect(park.id).toBe(existingPark.id); // Same ID (updated, not recreated)
			expect(park.name).toBe('Updated Park Name Detailed');
			expect(park.timezone).toBe('America/New_York');
			expect(park.operatingStatus).toBe('OPERATING'); // Updated status!
		});
	});

	describe('Park Status History Tracking', () => {
		it('should create historical record when operating status changes', async () => {
			// First, create a park with initial status
			const parkGroup = parkGroupRepo.create({
				externalId: 'test-group-history',
				name: 'Test Group History',
				slug: 'test-group-history',
				isActive: true,
				lastSynced: new Date(),
			});
			await parkGroupRepo.save(parkGroup);

			const existingPark = parkRepo.create({
				externalId: 'test-park-history',
				name: 'Test Park History',
				slug: 'test-park-history',
				timezone: 'UTC',
				parkGroupId: parkGroup.id,
				operatingStatus: 'CLOSED', // Initial status
				isActive: true,
				lastSynced: new Date(),
			});
			await parkRepo.save(existingPark);

			// Create initial history record
			const initialHistory = parkStatusHistoryRepo.create({
				parkId: existingPark.id,
				operatingStatus: 'CLOSED',
				recordedAt: new Date(),
				isActive: true,
			});
			await parkStatusHistoryRepo.save(initialHistory);

			// Mock wiki service to return updated status
			jest.spyOn(wikiService, 'fetchParkGroups').mockResolvedValue([
				{
					id: 'test-group-history',
					name: 'Test Group History',
					parks: [
						{
							id: 'test-park-history',
							name: 'Test Park History',
							timezone: 'UTC',
							location: { latitude: 40.0, longitude: -75.0 },
						},
					],
				},
			]);

			jest.spyOn(wikiService, 'fetchPark').mockResolvedValue({
				id: 'test-park-history',
				name: 'Test Park History',
				timezone: 'UTC',
				location: { latitude: 40.0, longitude: -75.0 },
			});

			// Mock live data with new status
			jest.spyOn(wikiService, 'fetchLiveData').mockResolvedValue({
				waitTimes: [],
				showTimes: [],
				entities: [
					{
						id: 'test-park-history',
						name: 'Test Park History',
						entityType: EntityType.ATTRACTION,
						status: OperatingStatus.OPERATING, // Changed status
						lastUpdated: new Date().toISOString(),
					},
				],
			});

			// Run the scraper (this should update the status and create history)
			await scraperService['scrapeParkGroups']();
			await scraperService['scrapeParks']();

			// Verify the park status was updated
			const updatedPark = await parkRepo.findOne({ where: { externalId: 'test-park-history' } });
			expect(updatedPark?.operatingStatus).toBe('OPERATING');

			// Verify historical records were created correctly
			const historyRecords = await parkStatusHistoryRepo.find({
				where: { parkId: existingPark.id },
				order: { recordedAt: 'ASC' },
			});

			// Should have old record (marked inactive) and new record (active)
			expect(historyRecords).toHaveLength(2);

			// First record should be inactive (old status)
			expect(historyRecords[0].operatingStatus).toBe('CLOSED');
			expect(historyRecords[0].isActive).toBe(false);

			// Second record should be active (new status)
			expect(historyRecords[1].operatingStatus).toBe('OPERATING');
			expect(historyRecords[1].isActive).toBe(true);
		});

		it('should not create duplicate history record if status has not changed', async () => {
			// Create a park with status
			const parkGroup = parkGroupRepo.create({
				externalId: 'test-group-nochange',
				name: 'Test Group No Change',
				slug: 'test-group-nochange',
				isActive: true,
				lastSynced: new Date(),
			});
			await parkGroupRepo.save(parkGroup);

			const existingPark = parkRepo.create({
				externalId: 'test-park-nochange',
				name: 'Test Park No Change',
				slug: 'test-park-nochange',
				timezone: 'UTC',
				parkGroupId: parkGroup.id,
				operatingStatus: 'OPERATING', // Status that won't change
				isActive: true,
				lastSynced: new Date(),
			});
			await parkRepo.save(existingPark);

			// Create initial history record
			const initialHistory = parkStatusHistoryRepo.create({
				parkId: existingPark.id,
				operatingStatus: 'OPERATING',
				recordedAt: new Date(),
				isActive: true,
			});
			await parkStatusHistoryRepo.save(initialHistory);

			// Mock wiki service to return same status
			jest.spyOn(wikiService, 'fetchParkGroups').mockResolvedValue([
				{
					id: 'test-group-nochange',
					name: 'Test Group No Change',
					parks: [
						{
							id: 'test-park-nochange',
							name: 'Test Park No Change',
							timezone: 'UTC',
							location: { latitude: 40.0, longitude: -75.0 },
						},
					],
				},
			]);

			jest.spyOn(wikiService, 'fetchPark').mockResolvedValue({
				id: 'test-park-nochange',
				name: 'Test Park No Change',
				timezone: 'UTC',
				location: { latitude: 40.0, longitude: -75.0 },
			});

			// Mock live data with same status
			jest.spyOn(wikiService, 'fetchLiveData').mockResolvedValue({
				waitTimes: [],
				showTimes: [],
				entities: [
					{
						id: 'test-park-nochange',
						name: 'Test Park No Change',
						entityType: EntityType.ATTRACTION,
						status: OperatingStatus.OPERATING, // Same status
						lastUpdated: new Date().toISOString(),
					},
				],
			});

			// Run the scraper
			await scraperService['scrapeParkGroups']();
			await scraperService['scrapeParks']();

			// Verify the park status remains the same
			const updatedPark = await parkRepo.findOne({ where: { externalId: 'test-park-nochange' } });
			expect(updatedPark?.operatingStatus).toBe('OPERATING');

			// Verify no duplicate history record was created
			const historyRecords = await parkStatusHistoryRepo.find({
				where: { parkId: existingPark.id },
			});
			expect(historyRecords).toHaveLength(1); // Only the original record
			expect(historyRecords[0].isActive).toBe(true);
		});
	});
});
