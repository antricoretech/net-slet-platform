import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ContentPublicationController } from './content-publication.controller';
import { ContentPublicationService } from './content-publication.service';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [ContentPublicationController], providers: [ContentPublicationService] })
export class ContentPublicationModule {}
