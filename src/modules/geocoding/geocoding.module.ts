import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GeocodingService } from './geocoding.service';
import { ParkLocationService } from './park-location.service';
import { Park } from '../../entities/park.entity';

@Module({
	imports: [
		HttpModule.register({
			timeout: 10000,
			maxRedirects: 5,
		}),
		TypeOrmModule.forFeature([Park]),
	],
	providers: [GeocodingService, ParkLocationService],
	exports: [GeocodingService, ParkLocationService],
})
export class GeocodingModule {}
