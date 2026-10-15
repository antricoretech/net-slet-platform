# L0.E.0 security and privacy review

## Findings

- All five learning previews use server-side `isPreviewRequestAllowed`; production denies direct routes unless the explicit development flag is enabled.
- Client fixtures contain synthetic IDs, prompts and labels only. No answer keys, private SME metadata, unpublished explanations or real learner records were found in the learning preview sources.
- Learning UI uses native text, buttons, labels and selects. No `dangerouslySetInnerHTML` or unsafe HTML rendering is used by these routes.
- L0.B.1 authorization and consent contracts are reused by PrepPilot action generation. Consent withdrawal produces a non-personalized coverage/fresh-content fallback and suppresses evidence-derived remediation.
- Analytics minimization removes learner identity by default.

## Limitations

This is a source and isolated-bundle review, not a penetration test, legal privacy assessment or production authorization review. Browser console warnings from the existing test harness include TLS-verification development configuration; no application secret was disclosed. Durable ownership, deletion and concurrency enforcement remain future persistence responsibilities.

Accessibility review confirms labelled controls, native keyboard interaction, focusable buttons, headings and explicit empty/blocked states. A full screen-reader/mobile audit remains required before production release.
