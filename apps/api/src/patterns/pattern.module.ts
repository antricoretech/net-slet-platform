import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PatternController } from './pattern.controller';
import { PatternService } from './pattern.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [PatternController], providers: [PatternService] })
export class PatternModule {}
