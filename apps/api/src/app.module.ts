import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { AuthModule } from './auth/auth.module';
import { CatalogueModule } from './catalogue/catalogue.module';
import { PatternModule } from './patterns/pattern.module';
import { SyllabusModule } from './syllabus/syllabus.module';
import { QuestionModule } from './questions/question.module';
import { AttemptsModule } from './attempts/attempts.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }), DatabaseModule, AuthModule, CatalogueModule, PatternModule, SyllabusModule, QuestionModule, AttemptsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class AppModule {}
