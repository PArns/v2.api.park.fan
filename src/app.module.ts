import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { IndexModule } from './modules/index/index.module';
import { UtilsModule } from './modules/utils/utils.module';
import { ThemeParksWikiModule } from './modules/themeparks-wiki/themeparks-wiki.module';
import { ScraperModule } from './modules/scraper/scraper.module';
import { GeocodingModule } from './modules/geocoding/geocoding.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			envFilePath: '.env',
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				type: 'postgres',
				host: configService.get('DB_HOST', 'localhost'),
				port: configService.get<number>('DB_PORT', 5432),
				username: configService.get('DB_USER', 'postgres'),
				password: configService.get('DB_PASS', 'postgres'),
				database: configService.get('DB_NAME', 'api.park.fan'),
				// Automatically load all entities without explicit list
				autoLoadEntities: true,
				// Enable automatic synchronization of the database schema (no migrations required)
				synchronize: true,
				// Disable running any migrations (schema sync replaces migrations)
				migrationsRun: false,
			}),
		}),
		ScheduleModule.forRoot(),
		IndexModule,
		UtilsModule,
		ThemeParksWikiModule,
		ScraperModule,
		GeocodingModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
