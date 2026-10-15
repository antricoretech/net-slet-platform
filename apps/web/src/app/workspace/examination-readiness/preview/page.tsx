import { isPreviewRequestAllowed } from '../../../practice/preview/preview-guard';
import { ExaminationReadinessPreview } from './examination-readiness-preview';

export default function ExaminationReadinessPreviewPage() {
  if (!isPreviewRequestAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_CBT_PREVIEW)) return <main className="page-wrap"><section className="auth-card"><h1>Examination readiness preview unavailable</h1><p>This development-only administrative preview is disabled outside an explicitly enabled local environment.</p></section></main>;
  return <ExaminationReadinessPreview />;
}
