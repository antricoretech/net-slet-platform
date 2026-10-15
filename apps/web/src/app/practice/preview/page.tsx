import { PreviewPlayer } from './preview-player';
import { isPreviewRequestAllowed } from './preview-guard';

export default function CbtPreviewPage() {
  if (!isPreviewRequestAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_CBT_PREVIEW)) {
    return <main className="page-wrap"><section className="auth-card"><h1>CBT preview unavailable</h1><p>This development-only preview is disabled outside an explicitly enabled local environment.</p></section></main>;
  }
  return <PreviewPlayer />;
}
