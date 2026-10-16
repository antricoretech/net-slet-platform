import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { ScoringService } from './scoring.service';
import { LearningService } from './learning.service';
import { ResultGovernanceController } from './result-governance.controller';
import { ResultGovernanceService } from './result-governance.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [AttemptsController, ResultGovernanceController], providers: [AttemptsService, ScoringService, LearningService, ResultGovernanceService] })
export class AttemptsModule {}
