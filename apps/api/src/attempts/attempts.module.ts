import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { ScoringService } from './scoring.service';
import { LearningService } from './learning.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [AttemptsController], providers: [AttemptsService, ScoringService, LearningService] })
export class AttemptsModule {}
