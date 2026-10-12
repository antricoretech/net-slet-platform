import { isPreviewRequestAllowed } from '../../../practice/preview/preview-guard';
import { MistakesPreview } from './mistakes-preview';

export default function MistakesPreviewPage() {
  if (!isPreviewRequestAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_CBT_PREVIEW)) return <main className="page-wrap"><section className="auth-card"><h1>Mistake Mine preview unavailable</h1><p>This development-only revision preview is disabled outside an explicitly enabled local environment.</p></section></main>;
  return <MistakesPreview />;
}
