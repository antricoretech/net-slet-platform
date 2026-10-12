import { isPreviewRequestAllowed } from '../preview/preview-guard';
import { LearningPracticePreview } from './learning-practice-preview';

export default function LearningPracticePage() {
  if (!isPreviewRequestAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_CBT_PREVIEW)) return <main className="page-wrap"><section className="auth-card"><h1>Practice preview unavailable</h1><p>This development-only practice preview is disabled outside an explicitly enabled local environment.</p></section></main>;
  return <LearningPracticePreview />;
}
