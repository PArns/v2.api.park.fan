import { Test, TestingModule } from '@nestjs/testing';
import { HttpModule } from '@nestjs/axios';
import { GeocodingService } from './geocoding.service';
import { ParkLocationService } from './park-location.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Park } from '../../entities/park.entity';

describe('GeocodingModule', () => {
	let geocodingService: GeocodingService;
	let parkLocationService: ParkLocationService;

	const mockParkRepository = {
		findOne: jest.fn(),
		save: jest.fn(),
		count: jest.fn(),
		createQueryBuilder: jest.fn(() => ({
			where: jest.fn().mockReturnThis(),
			andWhere: jest.fn().mockReturnThis(),
			getMany: jest.fn(),
			getCount: jest.fn(),
		})),
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			imports: [HttpModule],
			providers: [
				GeocodingService,
				ParkLocationService,
				{
					provide: getRepositoryToken(Park),
					useValue: mockParkRepository,
				},
			],
		}).compile();

		geocodingService = module.get<GeocodingService>(GeocodingService);
		parkLocationService = module.get<ParkLocationService>(ParkLocationService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('GeocodingService', () => {
		it('should be defined', () => {
			expect(geocodingService).toBeDefined();
		});

		describe('reverseGeocode', () => {
			it('should return location data for valid coordinates', async () => {
				// Test with Paris coordinates
				const result = await geocodingService.reverseGeocode(48.8566, 2.3522);

				expect(result).toBeDefined();
				// Note: This is an integration test that actually calls the API
				// For unit tests, we would mock the HTTP service
			}, 10000); // Extended timeout for API call

			it('should handle invalid coordinates gracefully', async () => {
				const result = await geocodingService.reverseGeocode(999, 999);

				expect(result).toEqual({});
			}, 10000);
		});

		describe('reverseGeocodeMultiple', () => {
			it('should process multiple coordinates with parallel batching', async () => {
				const coordinates = [
					{ latitude: 48.8566, longitude: 2.3522 }, // Paris
					{ latitude: 40.7128, longitude: -74.006 }, // New York
				];

				const results = await geocodingService.reverseGeocodeMultiple(coordinates, 500, 2);

				expect(results).toHaveLength(2);
				expect(Array.isArray(results)).toBe(true);
			}, 10000); // Reduced timeout due to parallelization

			it('should process coordinates faster with larger batch sizes', async () => {
				const coordinates = [
					{ latitude: 48.8566, longitude: 2.3522 },
					{ latitude: 40.7128, longitude: -74.006 },
					{ latitude: 51.5074, longitude: -0.1278 },
					{ latitude: 35.6762, longitude: 139.6503 },
				];

				const startTime = Date.now();
				const results = await geocodingService.reverseGeocodeMultiple(coordinates, 200, 4);
				const duration = Date.now() - startTime;

				expect(results).toHaveLength(4);
				expect(duration).toBeLessThan(5000); // Should be much faster than sequential
			}, 8000);
		});

		describe('reverseGeocodeParallel', () => {
			it('should process coordinates in full parallel', async () => {
				const coordinates = [
					{ latitude: 48.8566, longitude: 2.3522 },
					{ latitude: 40.7128, longitude: -74.006 },
				];

				const startTime = Date.now();
				const results = await geocodingService.reverseGeocodeParallel(coordinates);
				const duration = Date.now() - startTime;

				expect(results).toHaveLength(2);
				expect(duration).toBeLessThan(3000); // Should be very fast
			}, 5000);
		});

		describe('getContinentFromCountryCode', () => {
			it('should correctly map continent from country code', () => {
				// Access private method for testing
				const service = geocodingService as any;

				expect(service.getContinentFromCountryCode('fr')).toBe('Europe');
				expect(service.getContinentFromCountryCode('de')).toBe('Europe');
				expect(service.getContinentFromCountryCode('us')).toBe('North America');
				expect(service.getContinentFromCountryCode('jp')).toBe('Asia');
				expect(service.getContinentFromCountryCode('br')).toBe('South America');
				expect(service.getContinentFromCountryCode('au')).toBe('Oceania');
				expect(service.getContinentFromCountryCode('eg')).toBe('Africa');
				expect(service.getContinentFromCountryCode('unknown')).toBeUndefined();
				expect(service.getContinentFromCountryCode()).toBeUndefined();
			});
		});

		describe('cleanCountryName', () => {
			it('should remove parentheses and their content', () => {
				const service = geocodingService as any;

				expect(service.cleanCountryName('United States of America (the)')).toBe(
					'United States of America'
				);
				expect(service.cleanCountryName('Korea (Republic of)')).toBe('Korea');
				expect(service.cleanCountryName('Iran (Islamic Republic of)')).toBe('Iran');
				expect(
					service.cleanCountryName('United Kingdom of Great Britain and Northern Ireland (the)')
				).toBe('United Kingdom of Great Britain and Northern Ireland');
				expect(service.cleanCountryName('Germany')).toBe('Germany');
				expect(service.cleanCountryName('')).toBeUndefined();
				expect(service.cleanCountryName()).toBeUndefined();
				expect(service.cleanCountryName('France (test) (test2)')).toBe('France');
			});
		});
	});

	describe('ParkLocationService', () => {
		it('should be defined', () => {
			expect(parkLocationService).toBeDefined();
		});

		describe('updateParkLocation', () => {
			it('should update park with location data when coordinates are available', async () => {
				const mockPark = {
					id: 'test-id',
					name: 'Test Park',
					latitude: 48.8566,
					longitude: 2.3522,
					country: null,
					city: null,
					continent: null,
				};

				mockParkRepository.findOne.mockResolvedValue(mockPark);
				mockParkRepository.save.mockResolvedValue(mockPark);

				jest.spyOn(geocodingService, 'reverseGeocode').mockResolvedValue({
					country: 'France',
					city: 'Paris',
					continent: 'Europe',
				});

				const result = await parkLocationService.updateParkLocation('test-id');

				expect(result).toBeDefined();
				expect(mockParkRepository.findOne).toHaveBeenCalledWith({ where: { id: 'test-id' } });
				expect(geocodingService.reverseGeocode).toHaveBeenCalledWith(48.8566, 2.3522);
			});

			it('should return null when park is not found', async () => {
				mockParkRepository.findOne.mockResolvedValue(null);

				const result = await parkLocationService.updateParkLocation('non-existent-id');

				expect(result).toBeNull();
			});

			it('should return park without geocoding when coordinates are missing', async () => {
				const mockPark = {
					id: 'test-id',
					name: 'Test Park',
					latitude: null,
					longitude: null,
				};

				mockParkRepository.findOne.mockResolvedValue(mockPark);

				// Spy on the geocoding service to ensure it's not called
				const reverseGeocodeSpy = jest.spyOn(geocodingService, 'reverseGeocode');

				const result = await parkLocationService.updateParkLocation('test-id');

				expect(result).toBe(mockPark);
				expect(reverseGeocodeSpy).not.toHaveBeenCalled();

				// Clean up spy
				reverseGeocodeSpy.mockRestore();
			});
		});

		describe('getLocationStats', () => {
			it('should return correct statistics', async () => {
				mockParkRepository.count.mockResolvedValue(100);

				const mockQueryBuilder = {
					where: jest.fn().mockReturnThis(),
					andWhere: jest.fn().mockReturnThis(),
					getMany: jest.fn(),
					getCount: jest.fn(),
				};

				mockParkRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);
				mockQueryBuilder.getCount
					.mockResolvedValueOnce(80) // withCoordinates
					.mockResolvedValueOnce(60) // withFullLocation
					.mockResolvedValueOnce(20); // needingUpdate

				const result = await parkLocationService.getLocationStats();

				expect(result).toEqual({
					total: 100,
					withCoordinates: 80,
					withFullLocation: 60,
					needingUpdate: 20,
				});
			});
		});
	});

	describe('Integration Tests', () => {
		describe('Real API calls', () => {
			it('should work with known theme park coordinates', async () => {
				// Disneyland Paris coordinates
				const result = await geocodingService.reverseGeocode(48.8674, 2.7834);

				expect(result.country).toBeDefined();
				expect(result.continent).toBeDefined();
				// Paris area might return various city names, so we're flexible
			}, 10000);

			it('should handle batch processing correctly', async () => {
				const coordinates = [
					{ latitude: 48.8674, longitude: 2.7834 }, // Disneyland Paris
					{ latitude: 28.4177, longitude: -81.5812 }, // Walt Disney World
				];

				const results = await geocodingService.reverseGeocodeMultiple(coordinates, 1200, 2);

				expect(results).toHaveLength(2);
				expect(results[0]).toBeDefined();
				expect(results[1]).toBeDefined();
			}, 15000);
		});
	});
});
