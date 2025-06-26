import { Module } from '@nestjs/common';
import { ReadmeService } from './readme.service';

@Module({
	imports: [],
	providers: [ReadmeService],
	exports: [ReadmeService],
})
export class UtilsModule {}
