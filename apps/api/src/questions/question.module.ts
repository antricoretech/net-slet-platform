import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { QuestionController } from './question.controller';
import { QuestionService } from './question.service';
import { QuestionReviewService } from './question-review.service';
import { QuestionChallengeService } from './question-challenge.service';
import { QuestionTrustController } from './question-trust.controller';
import { QuestionPublicController } from './question-public.controller';

@Module({ imports: [DatabaseModule, AuthModule], controllers: [QuestionTrustController, QuestionController, QuestionPublicController], providers: [QuestionService, QuestionReviewService, QuestionChallengeService] })
export class QuestionModule {}
