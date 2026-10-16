import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PreparationController } from './preparation.controller';
import { PreparationReadinessController } from './preparation-readiness.controller';
import { HistoricalPyqIngestionController } from './historical-pyq-ingestion.controller';
import { HistoricalPyqIngestionService } from './historical-pyq-ingestion.service';
import { HistoricalPyqGovernanceController } from './historical-pyq-governance.controller';
import { HistoricalPyqGovernanceService } from './historical-pyq-governance.service';
import { PreparationService } from './preparation.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [PreparationController, PreparationReadinessController, HistoricalPyqIngestionController, HistoricalPyqGovernanceController], providers: [PreparationService, HistoricalPyqIngestionService, HistoricalPyqGovernanceService] })
export class PreparationModule {}
