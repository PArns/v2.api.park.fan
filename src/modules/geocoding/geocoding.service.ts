import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface GeolocationData {
	country?: string;
	city?: string;
	continent?: string;
	countryCode?: string;
}

export interface BigDataCloudResponse {
	latitude: number;
	longitude: number;
	continent: string;
	continentCode: string;
	countryName: string;
	countryCode: string;
	principalSubdivision: string;
	principalSubdivisionCode: string;
	city: string;
	locality: string;
	postcode: string;
	plusCode: string;
	localityLanguageRequested: string;
	localityInfo?: {
		administrative?: Array<{
			name: string;
			description: string;
			isoName: string;
			order: number;
			adminLevel: number;
			isoCode: string;
			wikidataId: string;
			geonameId: number;
		}>;
		informative?: Array<{
			name: string;
			description: string;
			isoName: string;
			order: number;
			isoCode: string;
			wikidataId: string;
			geonameId: number;
		}>;
	};
}

export interface NominatimResponse {
	display_name: string;
	address: {
		city?: string;
		town?: string;
		village?: string;
		municipality?: string;
		county?: string;
		state?: string;
		country?: string;
		country_code?: string;
		continent?: string;
	};
}

@Injectable()
export class GeocodingService {
	private readonly logger = new Logger(GeocodingService.name);

	constructor(private readonly httpService: HttpService) {}

	/**
	 * Primary geocoding method using BigDataCloud API for consistent English names
	 * Falls back to Nominatim if BigDataCloud fails
	 */
	async reverseGeocode(latitude: number, longitude: number): Promise<GeolocationData> {
		try {
			// Try BigDataCloud first - provides consistent English names
			const result = await this.reverseGeocodeWithBigDataCloud(latitude, longitude);
			if (result) {
				return result;
			}
		} catch (error) {
			this.logger.warn('BigDataCloud geocoding failed, falling back to Nominatim', error);
		}

		try {
			// Fallback to Nominatim
			const result = await this.reverseGeocodeWithNominatim(latitude, longitude);
			if (result) {
				return result;
			}
		} catch (error) {
			this.logger.error('All geocoding services failed', error);
		}

		// Return empty result if all services fail
		return {};
	}

	/**
	 * Reverse geocoding using BigDataCloud API
	 * Free tier: 50,000 requests/month
	 * Provides consistent English names for countries and cities
	 */
	private async reverseGeocodeWithBigDataCloud(
		latitude: number,
		longitude: number
	): Promise<GeolocationData | null> {
		const url = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
		const params = {
			latitude: latitude.toString(),
			longitude: longitude.toString(),
			localityLanguage: 'en', // Force English names
		};

		try {
			const response = await firstValueFrom(
				this.httpService.get<BigDataCloudResponse>(url, { params })
			);

			const data = response.data;

			return {
				country: this.cleanCountryName(data.countryName),
				city: data.city || data.locality || undefined,
				continent: data.continent || undefined,
				countryCode: data.countryCode || undefined,
			};
		} catch (error) {
			this.logger.warn('BigDataCloud API request failed', error);
			return null;
		}
	}

	/**
	 * Fallback reverse geocoding using Nominatim (OpenStreetMap)
	 * Uses accept-language header to request English names
	 */
	private async reverseGeocodeWithNominatim(
		latitude: number,
		longitude: number
	): Promise<GeolocationData | null> {
		const url = 'https://nominatim.openstreetmap.org/reverse';
		const params = {
			lat: latitude.toString(),
			lon: longitude.toString(),
			format: 'json',
			addressdetails: '1',
			zoom: '10',
		};

		const headers = {
			'User-Agent': 'park.fan-api/2.0.0',
			'Accept-Language': 'en', // Request English names
		};

		try {
			const response = await firstValueFrom(
				this.httpService.get<NominatimResponse>(url, { params, headers })
			);

			const address = response.data.address;

			// Extract city name from various possible fields
			const city = address.city || address.town || address.village || address.municipality;

			// Extract continent (Nominatim doesn't provide this directly)
			const continent = this.getContinentFromCountryCode(address.country_code);

			return {
				country: this.cleanCountryName(address.country),
				city: city || undefined,
				continent: continent || undefined,
				countryCode: address.country_code?.toUpperCase() || undefined,
			};
		} catch (error) {
			this.logger.warn('Nominatim API request failed', error);
			return null;
		}
	}

	/**
	 * Simple continent mapping based on country code
	 * Used as fallback when BigDataCloud is not available
	 */
	private getContinentFromCountryCode(countryCode?: string): string | undefined {
		if (!countryCode) return undefined;

		const continentMap: Record<string, string> = {
			// Europe
			de: 'Europe',
			fr: 'Europe',
			es: 'Europe',
			it: 'Europe',
			gb: 'Europe',
			nl: 'Europe',
			be: 'Europe',
			at: 'Europe',
			ch: 'Europe',
			pt: 'Europe',
			pl: 'Europe',
			cz: 'Europe',
			sk: 'Europe',
			hu: 'Europe',
			ro: 'Europe',
			bg: 'Europe',
			gr: 'Europe',
			hr: 'Europe',
			si: 'Europe',
			rs: 'Europe',
			ba: 'Europe',
			me: 'Europe',
			mk: 'Europe',
			al: 'Europe',
			tr: 'Europe',
			ru: 'Europe',
			ua: 'Europe',
			by: 'Europe',
			lt: 'Europe',
			lv: 'Europe',
			ee: 'Europe',
			fi: 'Europe',
			se: 'Europe',
			no: 'Europe',
			dk: 'Europe',
			is: 'Europe',
			ie: 'Europe',

			// Asia
			jp: 'Asia',
			cn: 'Asia',
			tw: 'Asia',
			kr: 'Asia',
			kp: 'Asia',
			th: 'Asia',
			vn: 'Asia',
			ph: 'Asia',
			id: 'Asia',
			my: 'Asia',
			sg: 'Asia',
			in: 'Asia',
			pk: 'Asia',
			bd: 'Asia',
			lk: 'Asia',
			mm: 'Asia',
			kh: 'Asia',
			la: 'Asia',
			mn: 'Asia',
			uz: 'Asia',
			kz: 'Asia',
			kg: 'Asia',
			tj: 'Asia',
			tm: 'Asia',
			af: 'Asia',
			ir: 'Asia',
			iq: 'Asia',
			sa: 'Asia',
			ae: 'Asia',
			qa: 'Asia',
			kw: 'Asia',
			bh: 'Asia',
			om: 'Asia',
			ye: 'Asia',
			jo: 'Asia',
			lb: 'Asia',
			sy: 'Asia',
			il: 'Asia',
			ps: 'Asia',

			// North America
			us: 'North America',
			ca: 'North America',
			mx: 'North America',
			gt: 'North America',
			bz: 'North America',
			sv: 'North America',
			hn: 'North America',
			ni: 'North America',
			cr: 'North America',
			pa: 'North America',
			cu: 'North America',
			jm: 'North America',
			ht: 'North America',
			do: 'North America',

			// South America
			br: 'South America',
			ar: 'South America',
			cl: 'South America',
			co: 'South America',
			ve: 'South America',
			pe: 'South America',
			ec: 'South America',
			uy: 'South America',
			py: 'South America',
			bo: 'South America',
			gy: 'South America',
			sr: 'South America',
			gf: 'South America',

			// Africa
			eg: 'Africa',
			ma: 'Africa',
			dz: 'Africa',
			tn: 'Africa',
			ly: 'Africa',
			sd: 'Africa',
			za: 'Africa',
			ng: 'Africa',
			ke: 'Africa',
			gh: 'Africa',
			et: 'Africa',
			ug: 'Africa',
			tz: 'Africa',
			mz: 'Africa',
			mg: 'Africa',
			cm: 'Africa',
			ci: 'Africa',
			ne: 'Africa',
			bf: 'Africa',
			ml: 'Africa',
			mw: 'Africa',
			zm: 'Africa',
			sn: 'Africa',
			td: 'Africa',
			so: 'Africa',
			rw: 'Africa',
			bi: 'Africa',
			dj: 'Africa',
			cf: 'Africa',
			sl: 'Africa',
			tg: 'Africa',
			er: 'Africa',
			lr: 'Africa',
			mr: 'Africa',

			// Oceania
			au: 'Oceania',
			nz: 'Oceania',
			pg: 'Oceania',
			fj: 'Oceania',
			nc: 'Oceania',
			sb: 'Oceania',
			vu: 'Oceania',
			pf: 'Oceania',
			ws: 'Oceania',
			ki: 'Oceania',
			to: 'Oceania',
			fm: 'Oceania',
			mh: 'Oceania',
			pw: 'Oceania',
			nr: 'Oceania',
			tv: 'Oceania',
		};

		return continentMap[countryCode.toLowerCase()];
	}

	/**
	 * Reverse geocode multiple coordinates with parallel processing and rate limiting
	 * @param coordinates Array of coordinate objects with latitude and longitude
	 * @param delayMs Delay between API calls in milliseconds (for rate limiting)
	 * @param batchSize Number of parallel requests (default: 5)
	 */
	async reverseGeocodeMultiple(
		coordinates: Array<{ latitude: number; longitude: number }>,
		delayMs: number = 1000,
		batchSize: number = 5
	): Promise<GeolocationData[]> {
		const results: GeolocationData[] = new Array<GeolocationData>(coordinates.length);

		// Process coordinates in parallel batches
		for (let i = 0; i < coordinates.length; i += batchSize) {
			const batch = coordinates.slice(i, i + batchSize);
			const batchStartTime = Date.now();

			// Execute batch in parallel
			const batchPromises = batch.map(async (coord, batchIndex) => {
				const actualIndex = i + batchIndex;
				try {
					const result = await this.reverseGeocode(coord.latitude, coord.longitude);
					results[actualIndex] = result;
				} catch (error) {
					this.logger.error(
						`Failed to geocode coordinates ${coord.latitude}, ${coord.longitude}`,
						error
					);
					results[actualIndex] = {}; // Add empty result for failed requests
				}
			});

			// Wait for all requests in the batch to complete
			await Promise.allSettled(batchPromises);

			// Rate limiting: ensure minimum delay between batches
			if (i + batchSize < coordinates.length && delayMs > 0) {
				const batchDuration = Date.now() - batchStartTime;
				const remainingDelay = Math.max(0, delayMs - batchDuration);

				if (remainingDelay > 0) {
					await new Promise((resolve) => setTimeout(resolve, remainingDelay));
				}
			}
		}

		return results;
	}

	/**
	 * Reverse geocode multiple coordinates with maximum parallelization (use with caution)
	 * This method processes all coordinates simultaneously - only use for small batches
	 * @param coordinates Array of coordinate objects with latitude and longitude
	 */
	async reverseGeocodeParallel(
		coordinates: Array<{ latitude: number; longitude: number }>
	): Promise<GeolocationData[]> {
		this.logger.debug(`Processing ${coordinates.length} coordinates in full parallel mode`);

		const promises = coordinates.map(async (coord, index) => {
			try {
				const result = await this.reverseGeocode(coord.latitude, coord.longitude);
				this.logger.debug(`Geocoded coordinate ${index + 1}/${coordinates.length}`);
				return result;
			} catch (error) {
				this.logger.error(`Failed to geocode coordinates ${coord.latitude}, ${coord.longitude}`, error);
				return {}; // Return empty result for failed requests
			}
		});

		return Promise.all(promises);
	}

	/**
	 * Clean country name by removing parentheses and their content, then trimming
	 * Examples:
	 * - "United States of America (the)" -> "United States of America"
	 * - "Korea (Republic of)" -> "Korea"
	 * - "Iran (Islamic Republic of)" -> "Iran"
	 */
	private cleanCountryName(countryName?: string): string | undefined {
		if (!countryName || countryName.trim() === '') return countryName || undefined;

		// Remove parentheses and their content, then trim whitespace
		return countryName.replace(/\s*\([^)]*\)\s*/g, '').trim();
	}
}
