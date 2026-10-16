import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PreparationController } from './preparation.controller';
import { PreparationService } from './preparation.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [PreparationController], providers: [PreparationService] })
export class PreparationModule {}
