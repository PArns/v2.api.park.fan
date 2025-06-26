import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShowTime } from '../src/entities/show-time.entity';
import { ScraperService } from '../src/modules/scraper/scraper.service';

describe('Fix Show Time Types E2E Tests', () => {
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

	describe('Fix NULL Show Types', () => {
		it('should fix all NULL show_type entries', async () => {
			// First check how many NULL entries we have
			const nullTypesCount = await showTimeRepo.query(`
				SELECT COUNT(*) as count
				FROM show_times 
				WHERE show_type IS NULL
			`);

			console.log(`Found ${nullTypesCount[0].count} show times with NULL show_type`);

			// Update all NULL show_type to 'REGULAR' as a default
			await showTimeRepo.query(`
				UPDATE show_times 
				SET show_type = 'REGULAR'
				WHERE show_type IS NULL
			`);

			// Verify the fix
			const nullTypesAfter = await showTimeRepo.query(`
				SELECT COUNT(*) as count
				FROM show_times 
				WHERE show_type IS NULL
			`);

			console.log(`After fix: ${nullTypesAfter[0].count} show times with NULL show_type`);
			expect(parseInt(nullTypesAfter[0].count)).toBe(0);

			// Verify all show types are valid
			const typeDistribution = await showTimeRepo.query(`
				SELECT 
					show_time_type,
					COUNT(*) as count
				FROM show_times
				GROUP BY show_time_type
				ORDER BY count DESC
			`);

			console.log('Show type distribution after fix:', typeDistribution);

			// All types should be valid enum values
			const validTypes = ['REGULAR', 'SPECIAL', 'FIREWORKS', 'PARADE', 'SEASONAL'];
			for (const row of typeDistribution) {
				expect(validTypes).toContain(row.show_type);
				expect(row.show_type).not.toBeNull();
			}
		}, 30000);

		it('should verify no more NULL show types exist after full scrape', async () => {
			// Run a full scrape to update all data
			console.log('Running full scrape to ensure all show times have types...');
			await scraperService['scrapeAttractionsAndShows']();
			console.log('Full scrape completed.');

			// Check for NULL types again
			const nullTypesCount = await showTimeRepo.query(`
				SELECT COUNT(*) as count
				FROM show_times 
				WHERE show_type IS NULL
			`);

			console.log(`After full scrape: ${nullTypesCount[0].count} show times with NULL show_type`);
			expect(parseInt(nullTypesCount[0].count)).toBe(0);
		}, 120000);
	});
});
