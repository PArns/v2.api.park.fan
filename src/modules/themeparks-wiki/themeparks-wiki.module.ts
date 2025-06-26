import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ThemeParksWikiService } from './themeparks-wiki.service';

@Module({
	imports: [HttpModule],
	providers: [ThemeParksWikiService],
	exports: [ThemeParksWikiService],
})
export class ThemeParksWikiModule {}
