import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScraperService } from './scraper.service';
import { ThemeParksWikiModule } from '../themeparks-wiki/themeparks-wiki.module';
import { GeocodingModule } from '../geocoding/geocoding.module';
import { ParkGroup } from '../../entities/park-group.entity';
import { Park } from '../../entities/park.entity';
import { Attraction } from '../../entities/attraction.entity';
import { ShowTime } from '../../entities/show-time.entity';
import { ParkSchedule } from '../../entities/park-schedule.entity';
import { WaitTime } from '../../entities/wait-time.entity';

@Module({
	imports: [
		ScheduleModule.forRoot(),
		TypeOrmModule.forFeature([ParkGroup, Park, Attraction, ShowTime, ParkSchedule, WaitTime]),
		ThemeParksWikiModule,
		GeocodingModule,
	],
	providers: [ScraperService],
})
export class ScraperModule {}
