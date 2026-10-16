import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PreparationController } from './preparation.controller';
import { PreparationReadinessController } from './preparation-readiness.controller';
import { PreparationService } from './preparation.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [PreparationController, PreparationReadinessController], providers: [PreparationService] })
export class PreparationModule {}
