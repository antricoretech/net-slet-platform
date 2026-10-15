import { isPreviewRequestAllowed } from '../../practice/preview/preview-guard';
import { ResultsPreview } from './results-preview';

export default function ResultsPreviewPage() {
  if (!isPreviewRequestAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_CBT_PREVIEW)) return <main className="page-wrap"><section className="auth-card"><h1>Results preview unavailable</h1><p>This illustrative results preview is disabled outside an explicitly enabled local environment.</p></section></main>;
  return <ResultsPreview />;
}
