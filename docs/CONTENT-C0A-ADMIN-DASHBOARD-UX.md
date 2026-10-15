# Content Track C0.A — Administrative readiness dashboard

The development-only route `/workspace/examination-readiness/preview` displays synthetic cycle readiness, six-family research-only compatibility, strict-mock publication state and explicit publication-disabled messaging.

The route is server-gated by the existing development preview guard. It does not call the production API, load active records, reveal reviewer metadata or provide a publish action. Native headings, articles, status text and focusable controls are used; the dashboard is a readiness view rather than an administrative authorization boundary.
