import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { SyllabusController } from './syllabus.controller';
import { SyllabusService } from './syllabus.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [SyllabusController],
  providers: [SyllabusService],
})
export class SyllabusModule {}
