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
import { GeocodingModule } from '../src/modules/geocoding/geocoding.module';

import { ParkGroup, Park, Attraction, ShowTime, ParkSchedule, WaitTime } from '../src/entities';

describe('Park Status E2E Tests', () => {
	let app: INestApplication;
	let themeParksService: ThemeParksWikiService;
	let scraperService: ScraperService;
	let parkRepo: Repository<Park>;

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
					entities: [ParkGroup, Park, Attraction, ShowTime, ParkSchedule, WaitTime],
					synchronize: true,
					dropSchema: false,
				}),
				ThemeParksWikiModule,
				ScraperModule,
				GeocodingModule,
			],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		themeParksService = moduleFixture.get<ThemeParksWikiService>(ThemeParksWikiService);
		scraperService = moduleFixture.get<ScraperService>(ScraperService);
		parkRepo = moduleFixture.get<Repository<Park>>(getRepositoryToken(Park));
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Park Operating Status', () => {
		it('should fetch current park status from schedule API', async () => {
			const parkId = '7340550b-c14d-4def-80bb-acdb51d49a66';

			const status = await themeParksService.fetchCurrentParkStatus(parkId);

			expect(status).toBeDefined();
			expect(typeof status).toBe('string');
			console.log(`Park status for ${parkId}: ${status}`);
		});

		it('should fetch schedule data for a park', async () => {
			const parkId = '7340550b-c14d-4def-80bb-acdb51d49a66';

			const schedule = await themeParksService.fetchSchedule(parkId);

			expect(schedule).toBeDefined();
			expect(Array.isArray(schedule)).toBe(true);
			expect(schedule.length).toBeGreaterThan(0);

			const firstItem = schedule[0];
			expect(firstItem.date).toBeDefined();
			expect(firstItem.type).toBeDefined();

			console.log(`Found ${schedule.length} schedule items for park ${parkId}`);
		});

		it('should update park operating status during park scraping', async () => {
			const parksWithStatusBefore = await parkRepo
				.createQueryBuilder()
				.select('COUNT(*)', 'count')
				.where('operating_status IS NOT NULL')
				.getRawOne();

			console.log(`Parks with operating status before: ${parksWithStatusBefore.count}`);

			await scraperService.scrapeParkStatus();

			const parksWithStatusAfter = await parkRepo
				.createQueryBuilder()
				.select('COUNT(*)', 'count')
				.where('operating_status IS NOT NULL')
				.getRawOne();

			console.log(`Parks with operating status after: ${parksWithStatusAfter.count}`);

			expect(parseInt(parksWithStatusAfter.count)).toBeGreaterThanOrEqual(
				parseInt(parksWithStatusBefore.count)
			);
			const parksWithStatus = await parkRepo
				.createQueryBuilder('park')
				.where('park.operating_status IS NOT NULL')
				.orderBy('park.last_synced', 'DESC')
				.take(5)
				.getMany();

			console.log('Recently updated parks with status:');
			parksWithStatus.forEach((park) => {
				console.log(`- ${park.name}: ${park.operatingStatus}`);
			});

			expect(parksWithStatus.length).toBeGreaterThan(0);
		});

		it('should show status distribution across parks', async () => {
			const allParks = await parkRepo.find();
			const parksWithStatus = allParks.filter((p) => p.operatingStatus);
			const parksWithoutStatus = allParks.filter((p) => !p.operatingStatus);

			console.log(`\nPark Status Distribution:`);
			console.log(`Total parks: ${allParks.length}`);
			console.log(
				`Parks with status: ${parksWithStatus.length} (${((parksWithStatus.length / allParks.length) * 100).toFixed(1)}%)`
			);
			console.log(
				`Parks without status: ${parksWithoutStatus.length} (${((parksWithoutStatus.length / allParks.length) * 100).toFixed(1)}%)`
			);

			const statusGroups = parksWithStatus.reduce(
				(acc, park) => {
					const status = park.operatingStatus!;
					if (!acc[status]) acc[status] = [];
					acc[status].push(park);
					return acc;
				},
				{} as Record<string, Park[]>
			);

			console.log(`\nStatus breakdown:`);
			Object.entries(statusGroups).forEach(([status, parks]) => {
				console.log(`- ${status}: ${parks.length} parks`);
			});

			if (parksWithoutStatus.length > 0) {
				console.log(`\nSample parks without status:`);
				parksWithoutStatus.slice(0, 5).forEach((park) => {
					console.log(`- ${park.name} (${park.externalId})`);
				});
			}

			expect(parksWithStatus.length).toBeGreaterThan(0);
		});
	});
});
