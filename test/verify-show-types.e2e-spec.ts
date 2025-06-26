import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShowTime } from '../src/entities/show-time.entity';
import { ScraperService } from '../src/modules/scraper/scraper.service';

describe('Show Types Verification E2E Tests', () => {
	let app: INestApplication;
	let showTimeRepo: Repository<ShowTime>;
	let scraperService: ScraperService;

	beforeAll(async () => {
		const moduleFixture: TestingModule = await Test.createTestingModule({
			imports: [AppModule],
		}).compile();

		app = moduleFixture.createNestApplication();
		await app.init();

		showTimeRepo = moduleFixture.get<Repository<ShowTime>>(getRepositoryToken(ShowTime));
		scraperService = moduleFixture.get<ScraperService>(ScraperService);
	});

	afterAll(async () => {
		await app.close();
	});

	describe('Show Time Types', () => {
		it('should verify show_time_type is not null in database', async () => {
			// First scrape some data to ensure we have show times
			console.log('Starting show times scraping...');
			await scraperService['scrapeAttractionsAndShows']();
			console.log('Show times scraping completed.');

			// Get all show times from database
			const showTimes = await showTimeRepo.find({
				take: 100, // Limit for performance
				relations: ['attraction'],
			});

			console.log(`Found ${showTimes.length} show times in database`);
			expect(showTimes.length).toBeGreaterThan(0);

			// Check that all show times have a valid showType (not null)
			for (const showTime of showTimes) {
				expect(showTime.showType).toBeDefined();
				expect(showTime.showType).not.toBeNull();
				console.log(
					`Show time for ${showTime.attraction?.name || 'Unknown'}: Type = ${showTime.showType}`
				);
			}

			// Count by show type
			const typeCount = showTimes.reduce(
				(acc, st) => {
					acc[st.showType] = (acc[st.showType] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			console.log('Show types distribution:', typeCount);

			// Verify we have expected types
			const validTypes = ['REGULAR', 'SPECIAL', 'FIREWORKS', 'PARADE', 'SEASONAL'];
			for (const showTime of showTimes) {
				expect(validTypes).toContain(showTime.showType);
			}
		}, 120000);

		it('should run raw SQL query to verify show_type column', async () => {
			// Use raw query to check the database directly
			const result = await showTimeRepo.query(`
				SELECT 
					st.id,
					st.show_type,
					a.name as attraction_name,
					st.start_time,
					st.end_time
				FROM show_times st
				LEFT JOIN attractions a ON st.attraction_id = a.id
				WHERE st.show_type IS NULL
				LIMIT 10
			`);

			console.log(`Found ${result.length} show times with NULL show_type`);

			if (result.length > 0) {
				console.log('Show times with NULL type:', result);
			}

			// Should be 0 NULL show_type entries
			expect(result.length).toBe(0);
		});

		it('should verify show type mapping works correctly', async () => {
			// Get some show times with their types
			const showTimes = await showTimeRepo.query(`
				SELECT 
					st.show_type,
					COUNT(*) as count
				FROM show_times st
				GROUP BY st.show_type
				ORDER BY count DESC
			`);

			console.log('Show type distribution:', showTimes);

			// Should have some show times
			expect(showTimes.length).toBeGreaterThan(0);

			// All types should be valid enum values
			const validTypes = ['REGULAR', 'SPECIAL', 'FIREWORKS', 'PARADE', 'SEASONAL'];
			for (const row of showTimes) {
				expect(validTypes).toContain(row.show_type);
				expect(row.show_type).not.toBeNull();
			}
		});
	});
});
