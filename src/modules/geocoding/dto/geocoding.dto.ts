import { IsNumber, IsOptional, Min, Max } from 'class-validator';

export class GeocodeRequestDto {
	@IsNumber()
	@Min(-90)
	@Max(90)
	latitude!: number;

	@IsNumber()
	@Min(-180)
	@Max(180)
	longitude!: number;
}

export class GeocodeResponseDto {
	@IsOptional()
	country?: string;

	@IsOptional()
	city?: string;

	@IsOptional()
	continent?: string;

	@IsOptional()
	countryCode?: string;
}

export class BatchGeocodeRequestDto {
	coordinates!: Array<{
		latitude: number;
		longitude: number;
	}>;

	@IsOptional()
	@IsNumber()
	@Min(0)
	delayMs?: number = 1000;

	@IsOptional()
	@IsNumber()
	@Min(1)
	@Max(10)
	batchSize?: number = 5;
}
