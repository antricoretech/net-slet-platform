import { isPreviewRequestAllowed } from '../../practice/preview/preview-guard';
import { PrepPilotPreview } from './prep-pilot-preview';

export default function PrepPilotPreviewPage() {
  if (!isPreviewRequestAllowed(process.env.NODE_ENV, process.env.NEXT_PUBLIC_ENABLE_CBT_PREVIEW)) return <main className="page-wrap"><section className="auth-card"><h1>PrepPilot preview unavailable</h1><p>This development-only dashboard preview is disabled outside an explicitly enabled local environment.</p></section></main>;
  return <PrepPilotPreview />;
}
