import { Module } from '@nestjs/common';
import { IndexController } from './index.controller';
import { UtilsModule } from '../utils/utils.module';

@Module({
	imports: [UtilsModule],
	controllers: [IndexController],
})
export class IndexModule {}
