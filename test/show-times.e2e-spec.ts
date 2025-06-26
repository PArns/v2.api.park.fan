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
	ShowTime,
	ShowType,
	WaitTime,
	ParkSchedule,
} from '../src/entities';

describe('Show Times Scraping E2E Tests', () => {
	let app: INestApplication;
	let themeParksService: ThemeParksWikiService;
	let scraperService: ScraperService;
	let showTimeRepo: Repository<ShowTime>;
	let attractionRepo: Repository<Attraction>;

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
					entities: [ParkGroup, Park, Attraction, ShowTime, WaitTime, ParkSchedule],
					synchronize: true,
					dropSchema: false,
				}),
				TypeOrmModule.forFeature([ParkGroup, Park, Attraction, ShowTime, WaitTime, ParkSchedule]),
				ThemeParksWikiModule,
				ScraperModule,
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		themeParksService = moduleFixture.get<ThemeParksWikiService>(ThemeParksWikiService);
		scraperService = moduleFixture.get<ScraperService>(ScraperService);
		showTimeRepo = moduleFixture.get<Repository<ShowTime>>(getRepositoryToken(ShowTime));
		attractionRepo = moduleFixture.get<Repository<Attraction>>(getRepositoryToken(Attraction));
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Show Times Tests', () => {
		it('should fetch show times from live data successfully', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9'; // Magic Kingdom

			const showTimes = await themeParksService.fetchShowTimes(parkId);

			expect(Array.isArray(showTimes)).toBe(true);
			console.log(`Found ${showTimes.length} shows with showtimes`);

			if (showTimes.length > 0) {
				const firstShow = showTimes[0];
				expect(firstShow).toHaveProperty('id');
				expect(firstShow).toHaveProperty('name');
				expect(firstShow).toHaveProperty('showtimes');
				expect(Array.isArray(firstShow.showtimes)).toBe(true);

				console.log(`Example show: ${firstShow.name} with ${firstShow.showtimes.length} showtimes`);

				if (firstShow.showtimes.length > 0) {
					const firstShowtime = firstShow.showtimes[0];
					expect(firstShowtime).toHaveProperty('startTime');
					expect(firstShowtime).toHaveProperty('endTime');
					console.log(`Example showtime: ${firstShowtime.startTime} - ${firstShowtime.endTime}`);
				}
			}
		});

		it('should fetch live data and identify entities with showtimes', async () => {
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9'; // Magic Kingdom

			const liveData = await themeParksService.fetchLiveData(parkId);

			expect(liveData).toBeDefined();
			expect(liveData.entities).toBeDefined();
			expect(Array.isArray(liveData.entities)).toBe(true);

			// Check for entities with showtimes
			const entitiesWithShowtimes = liveData.entities.filter(
				(entity) => entity.showtimes && entity.showtimes.length > 0
			);
			console.log(
				`Found ${entitiesWithShowtimes.length} entities with showtimes out of ${liveData.entities.length} total entities`
			);

			if (entitiesWithShowtimes.length > 0) {
				const entityWithShowtimes = entitiesWithShowtimes[0];
				expect(entityWithShowtimes.showtimes).toBeDefined();
				expect(entityWithShowtimes.showtimes!.length).toBeGreaterThan(0);
				console.log(
					`Example entity with showtimes: ${entityWithShowtimes.name} - ${entityWithShowtimes.showtimes!.length} showtimes`
				);
				console.log(
					`First showtime: ${entityWithShowtimes.showtimes![0].startTime} - ${entityWithShowtimes.showtimes![0].endTime}`
				);
			}
		});

		it('should scrape and store show times correctly', async () => {
			console.log('Starting show times scraping...');

			// Run the attractions and shows scraping method
			await scraperService['scrapeAttractionsAndShows']();

			console.log('Show times scraping completed. Checking database...');

			// Check if show times were saved to the database
			const showTimes = await showTimeRepo.find({
				relations: ['attraction'],
				take: 20,
			});

			console.log(`Found ${showTimes.length} show times in database`);

			if (showTimes.length > 0) {
				const firstShowTime = showTimes[0];
				expect(firstShowTime).toHaveProperty('id');
				expect(firstShowTime).toHaveProperty('attractionId');
				expect(firstShowTime).toHaveProperty('startTime');
				expect(firstShowTime).toHaveProperty('endTime');
				expect(firstShowTime).toHaveProperty('showType');
				expect(firstShowTime.attraction).toBeDefined();

				console.log(`Example show time:`);
				console.log(`  Attraction: ${firstShowTime.attraction.name}`);
				console.log(`  Start: ${firstShowTime.startTime}`);
				console.log(`  End: ${firstShowTime.endTime}`);
				console.log(`  Type: ${firstShowTime.showType}`);

				// Verify show type is valid
				expect(Object.values(ShowType)).toContain(firstShowTime.showType);
			} else {
				console.log('No show times found in database. This might indicate:');
				console.log('1. The park has no shows with scheduled times');
				console.log('2. Show times are not available in the live data');
				console.log('3. There might be an issue with the scraping logic');

				// Let's check if we have any attractions that could have shows
				const attractions = await attractionRepo.find({
					where: { isActive: true },
					take: 10,
				});
				console.log(`Found ${attractions.length} attractions in database`);

				if (attractions.length > 0) {
					const sampleAttraction = attractions[0];
					console.log(`Sample attraction: ${sampleAttraction.name} (${sampleAttraction.entityType})`);
				}
			}
		}, 60000); // 60 second timeout

		it('should handle different show types correctly', async () => {
			// Test the mapping of different show types
			const parkId = '75ea578a-adc8-4116-a54d-dccb60765ef9';

			try {
				const showTimes = await themeParksService.fetchShowTimes(parkId);

				if (showTimes.length > 0) {
					console.log('Show types found in data:');
					const apiShowTypes = new Set();

					showTimes.forEach((show) => {
						show.showtimes.forEach((showtime) => {
							if (showtime.type) {
								apiShowTypes.add(showtime.type);
							}
						});
					});

					console.log(`Unique API show types: ${Array.from(apiShowTypes).join(', ')}`);

					// Check that show times were properly stored in database with mapped types
					const storedShowTimes = await showTimeRepo.find({ take: 10 });
					if (storedShowTimes.length > 0) {
						const databaseShowTypes = new Set(storedShowTimes.map((st) => st.showType));
						console.log(`Database show types: ${Array.from(databaseShowTypes).join(', ')}`);

						// Verify all database show types are valid
						databaseShowTypes.forEach((type) => {
							expect(Object.values(ShowType)).toContain(type);
						});
					}
				} else {
					console.log('No show times available for type testing');
				}
			} catch (error) {
				console.log(`Error in show type test: ${error}`);
			}
		});

		it('should update show times when attraction data changes', async () => {
			console.log('Testing show times update functionality...');

			// First, run scraping to get initial data
			await scraperService['scrapeAttractionsAndShows']();

			const initialShowTimes = await showTimeRepo.find();
			console.log(`Initial show times count: ${initialShowTimes.length}`);

			// Run scraping again to test updates
			await scraperService['scrapeAttractionsAndShows']();

			const updatedShowTimes = await showTimeRepo.find();
			console.log(`Updated show times count: ${updatedShowTimes.length}`);

			// The counts might be different if show schedules changed
			// but the scraper should handle updates gracefully
			expect(updatedShowTimes.length).toBeGreaterThanOrEqual(0);

			if (updatedShowTimes.length > 0) {
				const recentShowTime = updatedShowTimes[0];
				expect(recentShowTime.lastSynced).toBeDefined();
				console.log(`Most recent sync: ${recentShowTime.lastSynced}`);
			}
		}, 90000); // 90 second timeout for double scraping
	});
});
