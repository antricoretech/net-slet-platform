import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { RequestOriginGuard } from './request-origin.guard';
import { EmailDeliveryService } from './email-delivery.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RolesGuard, RequestOriginGuard, Reflector, EmailDeliveryService],
  exports: [AuthService, AuthGuard, RolesGuard],
})
export class AuthModule {}
