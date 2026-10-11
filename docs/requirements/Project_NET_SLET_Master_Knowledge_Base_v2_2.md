# Project NET/SLET — Master Knowledge Base and Source of Truth (through v2.2)

**Prepared:** 11 October 2026  
**Status:** Project reference / working baseline, not official examination authority approval  
**Coverage:** Original consolidated BRD v2.0, exam-family and exam-pattern research v2.1, student-value/USP strategy v2.2, accumulated technical recommendations from this Project NET/SLET conversation.  
**Intended use:** Attach to ChatGPT Project Sources and place in `docs/requirements/` of the VS Code / Codex monorepo. Keep this document and the linked machine-readable catalog under version control.  

> **Source-integrity note:** Sections A–F are a consolidated decision and discussion record; appendices contain the full available BRD and full previously generated v2.1/v2.2 Markdown source documents. This is NOT a verbatim export of every ChatGPT message. Historical exams and proposed features require exam-authority verification and product-owner approval before publication. Detailed source references reside in the research appendices.

## A. Current project mission and product promise

Build an India-wide preparation and assessment platform for UGC NET, Joint CSIR-UGC NET, and regional/state SET/SLET examinations. Student-facing product is a responsive, web-first PWA with accurate examination simulations, curated practice, instructor-quality explanations, syllabus-guided learning, analytics, repeat-error remediation and efficient revision. Suggested positioning: **“Practice the Right Exam. Master Every Concept. Track Real Progress.”**

The core idea is not merely another mock-test catalogue: a student selects an authentic exam, practices with reviewed questions, sees *what went wrong and why*, receives a short next-best study action, and proves improvement with fresh questions and spaced follow-up. Never promise qualification, official percentiles or guaranteed results.

## B. Architectural decisions accumulated from research

- **Product categories:** (1) UGC NET, (2) Joint CSIR-UGC NET, (3) State / Regional SET/SLET. State selection maps to actual examination authority/jurisdiction rather than creating a fake exam per state.
- **Business entity != technical template:** An examination identity has published cycles, subjects, syllabus, jurisdictions, and an official verification status. A reusable pattern engine handles UI mode, timers, papers/parts, permitted attempts, marks, question types, navigation and languages.
- **Six indicative engineering pattern families:** P1 continuous dual-section CBT (UGC NET, TG-SET); P2 subject-specific CSIR Parts A/B/C CBT; P3 single-sitting/staged OMR (e.g. GSET, KSET subject to verification); P4 independent 60/120-minute OMR papers (e.g. MH-SET, WB-SET, regional SLET); P5 Kerala-specific 120/120-minute papers and exceptional question counts; P6 per-cycle exceptional or pending-verification formats (e.g. APSET, CG, MP, Rajasthan, TN). These are flexible classification aids; official rules override family defaults.
- **Regional examination register (14 identities):** MH-SET (Maharashtra/Goa), GSET (Gujarat), WB-SET, TG-SET, APSET, KSET, Kerala SET, North-East SLET (eight NE states), JKSET/LASET (J&K/Ladakh), HP SET, MP SET, CG SET, Rajasthan SET, Tamil Nadu SET. Kerala SET concerns higher-secondary teaching eligibility; label separately. A state without a confirmed independent SET can still access UGC NET/CSIR NET.
- **Official-rule compliance:** Published strict mocks reference *immutable, admin-approved, source-backed* `ExamPatternVersion` and `QuestionVersion`, scoped by exam/cycle/subject. Versioned answer keys and scoring runs support authorized corrections and rescoring. If exam details are only historically known or based on secondary sources, display RESEARCH/TO_VERIFY—not `Verified official pattern`.
- **No globally hardcoded 150 questions / 180 minutes:** UGC NET is 50 Paper I + 100 Paper II, 180 continuous minutes, +2 correct / 0 incorrect under its relevant rules. CSIR NET is subject-specific 3-part with per-part attempt ceilings, diverse marks/penalties and question-type constraints. Some SETs split papers and use offline OMR with independently configured deadlines. Validate latest cycle bulletin per exam.
- **Stack:** Next.js + TypeScript + React, NestJS modular monolith, PostgreSQL + Prisma, Redis + BullMQ, object storage, Tailwind CSS / accessible UI, Docker. Keep domain scoring in independently tested shared `exam-rules` package. Implement in VS Code using Codex with specification-first coding and automated tests.
- **Scale:** 25,000 concurrent sessions is a later tested target, not an unmeasured promise. Scale from smaller representative workloads and synchronized exam start/finish spikes.
- **Answer/data integrity:** Store server-authoritative deadlines in durable storage, commit every acknowledged answer to PostgreSQL, support idempotency and stale-write control, preserve audit history, enforce exam ownership/authorization, expire and finalize independently of worker availability, prevent duplicate scores, and recover after browser/network disruptions without resetting timers. Redis is a cache/coordination mechanism, not the only source of truth.
- **Content quality:** SME moderation, language review, rights/provenance tracking, LaTeX, complex question formats, complaints/challenges, immutable published form and corrections. PYQ copies require permission/rights assessment; public links do not automatically confer reproduction rights.
- **Accessibility, privacy and security:** WCAG-friendly color-independent palette, accessible response workflows, least-privilege admin roles, encrypted transport/backups, reasonable retention, privacy notices and compliance review for Indian DPDP requirements; do not treat browser anti-cheat measures as reliable proof of misconduct.

## C. Core student, content and admin functionality

1. Account, target exam, subject and language onboarding and student profile.
2. Exam catalogue, authority/jurisdiction mapping, verified cycle/version status and exam modes.
3. Strict CBT/OMR simulations: real server clock, 5-state palette where applicable, question navigation, save and resume, auto-expiry/finalization, accommodations, authoritative results.
4. QBMS: subject/unit/topic taxonomy per syllabus version; SME review; assertion/reason, matching, ordering, comprehension/DI, multiple-select and math rendering; translations and challenge workflow.
5. Practice: custom untimed/timed quizzes, micro-mocks, PYQ reading/test modes where licensed, bookmarks, mistakes, spaced revision and tutor explanations.
6. LMS: syllabus completion tracker, concept notes, downloadable resources, curated methodologies and exam-specific plans.
7. Analytics: raw marks, accuracy, attempt rate, per-topic strength/weakness, time efficiency, traps, repeated misconceptions, peer comparisons with explicit cohort, official cutoff historical context clearly distinct from official percentile.
8. Faculty/admin operations: content review, exam pattern official-source verification, version approvals, test form compilation/publishing, learner support, audits, subscription controls and reporting.
9. Expansion: verified notice hub, institutional dashboards, moderated Q&A communities, subject pods and career/fellowship information; delay live audio/community until moderation and core reliability are mature.

## D. Competitor findings and USP portfolio (proposal, NOT exclusive feature claims)

Publicly advertised features from Testbook, Adda247, Physics Wallah, Unacademy and EduRev already include mock tests, PYQs, subject quizzes, bilingual practice, rankings, analytics, and various AI doubt/study-plan/memory tools. Market differentiators must not assert a competitor lacks something merely because marketing pages do not list it. Validate with a hands-on competitor benchmark and student interviews.

**Top integrated differentiated capabilities:**

- **ExamDNA — verified exam fidelity:** display provenance of specific exam-cycle rules, accurate sectional timers/CBT/OMR formats, review-controlled `strict official-pattern` labels.
- **MasteryLoop — weakness-to-mastery:** identify errors, guide to short reviewed conceptual explanations, schedule fresh related questions and spaced retrieval, verify evidence before declaring mastery.
- **ConceptBridge — NET/SET syllabus overlap:** SME-approved canonical concept mappings across exam subject/unit/syllabus versions; reuse learning evidence without reusing scores or faking exam equivalence.
- **AnswerTrust — evidence and challenge:** option-by-option explanations, SME/source attribution, reviewed dates, student challenges, official answer-key edits, audited rescoring.
- **PrepPilot — next-best-action planning:** onboarding diagnostics, exam target date and available daily minutes, adaptive ranked tasks with durations and reasons.
- **ReadinessLens — transparent evidence-based readiness:** stability of comparable mock performance, syllabus coverage, uncertainty/small sample disclosure, historic cutoff context, no unsupported pass prediction.
- **RecallLab — practice-only confidence-aware checking:** Sure/Unsure/Guess; identify confident misconceptions and guessed-correct fragile knowledge, without disrupting strict exam modes.
- **Exam-specific strategy labs:** CSIR attempt strategy and section penalties, Paper I reasoning/DI/research aptitude skill labs, OMR bubble/section rehearsal for SETs.
- **Verified exam intelligence:** official notices with source URLs, verification dates, relevant event changes, and opt-in reminders.
- **Accessibility and student practicality:** low-data mode, regional language review, 10–45-minute actions, 30/7/1-day revision schedules, honest all-India peer benchmarking.

**Student need hypotheses to validate:** memory retrieval challenges; unreliable perceived mock realism; unclear next study action; recurring errors; multiple concurrent exam goals; mismatch between score and confidence; limited daily study time; affordable access and low bandwidth. Qualitative forum complaints are not statistically representative.

**Example learning loop:** Diagnostic -> analyze answer/time/confidence -> misconception/topic mapping -> short reviewed intervention -> fresh analogous practice -> spaced review -> evidence threshold -> updated mastery -> adjusted plan. Never mark a misconception resolved after merely rereading its answer.

## E. Implementation phases and quality gates

**Release 1 (trustworthy UGC NET MVP):** Next.js/NestJS repo, auth, PostgreSQL models, catalog, approved pattern definitions, SME question bank, real timed UGC NET mock, persistent answer operations, scoring/results/explanations, initial diagnostic, basic questions issue reporting, core monitoring.

**Release 2 (personalized improvement):** mistake bank, spaced revision, confidence-aware practice, misconception clustering, next best activity, mastery verification, retention measurements and student dashboard.

**Release 3 (multiple formats):** CSIR section/attempt/penalty types, state SET exam templates and OMR UX, exams/cycle/subject-specific content, ConceptBridge (only verified mappings).

**Release 4 (advanced maturity):** more state subjects, multi-language depth, calibrated mock difficulty, transparent readiness evidence, official notice centre, institutional tools, accessibility and large-scale load qualification, optional community features.

**Gate checks:** (1) official pattern verified; (2) no acknowledged answer lost on tested failures; (3) deadlines/idempotent finalization correct; (4) scoring uses versioned per-part rules; (5) admin can correct keys with complete audit and authorized rescore; (6) students cannot access other users’ results or test keys early; (7) SME content provenance and rights recorded; (8) localization/accessibility; (9) reproducible deployment, backups, representative concurrency tests.

**Proposed impact KPIs:** diagnostic-to-followup improvement on unseen items, 7/21-day recall, reduction in misconception recurrence, mock-to-revision conversion, validated question explanation coverage, trust/challenge resolution time, exam overlap reuse, student retention and paid conversion. Pilot before asserting causal educational benefits.

## F. Governance, provenance and future-agent instructions

1. Keep `docs/requirements/` and `docs/exam-patterns/` as canonical tracked source folders. Revision numbers, effective dates, rationale and approvals are required.
2. A new official bulletin supersedes a template only for the relevant examination/cycle/subject; preserve historical attempt reproducibility.
3. Keep a machine-readable manifest labelled *RESEARCH ONLY* until an authorized reviewer verifies each live exam configuration against an official bulletin. Do not seed provisional data as verified.
4. Before coding: read this file, BRD v2.1, USP strategy v2.2 and JSON manifest; present a prioritized work plan, identify contradictions, then implement increments with tests and migrations. Never overwrite work or invent missing official rules.
5. Proposed features in v2.2 are product concepts pending approval; existing BRD v2.0/v2.1 scope remains unless explicitly changed.
6. Maintain decisions and open verification issues in repository `docs/decisions/` and `docs/exam-patterns/`.
7. Maintain clear separation between reference data from uploaded BRDs, external research, technical recommendations and final approved business requirements.
8. For complete detailed requirements and provenance see the full-text appendices below and the JSON catalogue in the archive.

## G. Source inventory

- `Project_NET_SLET_BRD_v2_0_Original.txt` — original user-provided 11 October BRD (from this conversation).
- `Project_NET_SLET_BRD_v2_1_Revised_Exam_Categories.md` — full exam categorization research, rule differences, jurisdictions, data model and testing expectations.
- `NET_SLET_v2_1_Exam_Catalog_Research_Manifest.json` — research-only structured exam-category and pattern definitions.
- `Project_NET_SLET_v2_2_USP_Feature_Strategy.md` — full competitor and student-value research, 25 feature proposals, acceptance criteria, priorities.
- `Project_NET_SLET_BRD_v2_1_Revised_Exam_Categories.docx/.pdf` — alternate presentation formats for v2.1.
- Current project conversation — extended narrative and discussion context; not fully duplicated verbatim in this file.

---



---

# Appendix I — Original Project BRD v2.0 (user-provided complete text)

# Business Requirements Document (BRD)

**Project Name:** Project NET/SLET - Unified CBT Practice & Assessment Platform
**Target Examination:** UGC NET, CSIR NET, and State Level Eligibility Tests (MH-SET, WB-SET, KSET, APSET, etc.)
**Document Version:** 2.0 (Final Consolidated)
**Status:** Approved for Technical Architecture & Engineering

---

## 1. Executive Summary & Project Background

The objective of Project NET/SLET is to build an enterprise-grade, high-concurrency online examination and learning ecosystem engineered to prepare postgraduate candidates for the National Eligibility Test (NET) and State Level Eligibility Tests (SLET/SET). The platform replicates the authentic National Testing Agency (NTA) Computer-Based Test (CBT) user interface, time constraints, and marking rules, while providing an end-to-end preparation ecosystem featuring AI-driven analytics, peer community tools, and extensive study resources.

### 1.1 Domain Context & Exam Distinctions

The platform must seamlessly support two distinct tiers of higher-education eligibility examinations:

* **National Eligibility Test (NET):** Organized by the NTA for UGC and CSIR, qualifying candidates for Assistant Professorships pan-India and awarding the Junior Research Fellowship (JRF). Conducted in English and Hindi.
* **State Level Eligibility Test (SLET/SET):** Organized by state-level universities accredited by the UGC, qualifying candidates for Assistant Professorships strictly within the conducting state. Conducted in English and the respective regional language.

### 1.2 Exam Structure & Delivery Rules

Both examinations utilize an identical, continuous dual-paper structure.

| Parameter | Specification | Platform Rule |
| --- | --- | --- |
| **Duration** | 180 Minutes (3 hours) | Single uninterrupted session; no scheduled break between papers. |
| **Paper 1 (General)** | 50 Questions (100 Marks) | Covers 10 mandatory units (Teaching/Research Aptitude, ICT, etc.). |
| **Paper 2 (Domain)** | 100 Questions (200 Marks) | Subject-specific questions based on the candidate’s postgraduate discipline. |
| **Marking Scheme** | +2 for correct; 0 for unattempted | Zero negative marking for UGC NET & SET; configurable negative marks for CSIR NET. |
| **Navigation** | Open sectional switching | Candidates may freely switch between Paper 1 and Paper 2 tabs at any point. |

---

## 2. Stakeholder & User Personas

* **Student / Candidate:** Enrolls in test series, engages in daily practice, takes simulated mocks under NTA conditions, and utilizes AI analytics to bridge knowledge gaps.
* **Subject Matter Expert (SME) / Content Creator:** Drafts multilingual questions, formats complex datasets (Match the Following, DI), writes pedagogical explanations, and authors syllabus notes.
* **Platform Administrator:** Manages exam schedules, publishes All-India Mock Tests, configures cut-off thresholds, and monitors active exam sessions.

---

## 3. Module 1: CBT Exam Engine (Student Front-End)

The core candidate interface must replicate the NTA CBT environment to build familiarity and stamina for official exam conditions.

* **Master Session Clock:** A central, server-synchronized 180-minute countdown timer visible at the top-right header. The timer triggers automated test submission at 00:00:00.
* **NTA-Standard Question Palette:** A dedicated grid panel on the right side displaying all 150 question states via regulatory color codes:
* *Grey:* Not visited.
* *Red:* Visited, not answered.
* *Green:* Answered.
* *Purple:* Marked for review without an answer.
* *Purple with Tick:* Answered and marked for review (evaluated for marks upon final scoring).


* **Action Footers:** Standardized NTA buttons: "Save & Next", "Clear Response", "Mark for Review & Next", and "Previous".
* **Free Section Navigation:** Top-level tabs for "Paper 1" and "Paper 2" allowing seamless transitions without prematurely submitting the session.
* **Split-Screen Reading Comprehension & DI:** For passages and data interpretation sets, the UI must lock a scrollable reading pane on the left half while five linked questions cycle sequentially on the right half.
* **In-Flight Multilingual Switcher:** Dropdown menu allowing instantaneous language toggling per question (English $\leftrightarrow$ Hindi for NET; English $\leftrightarrow$ Regional Language for SET).

---

## 4. Module 2: Question Bank Management System (QBMS)

The backend content system must accommodate the specific question archetypes and taxonomies common to higher-education postgraduate tests.

* **Syllabus Taxonomy Ingestion:** Support for 80+ subjects, mapped strictly via the hierarchy: Subject $\rightarrow$ Core Units (1 to 10) $\rightarrow$ Sub-Topics $\rightarrow$ Question Entities.
* **Advanced Question Archetypes:**
* *Match the Following:* Rendering side-by-side tables with combination radio options.
* *Assertion and Reasoning:* Standardized fields for Statement (A) and Reason (R).
* *Sequential Ordering:* Arranging chronologies in correct sequence.


* **LaTeX & Equation Rendering:** Native MathJax/KaTeX integration for mathematical, statistical, and scientific subjects.
* **Dynamic Evaluation Engine:** Calculates final scores using configurable logic for specific exams:

$$\text{Final Score} = \sum (\text{Correct Responses} \times 2) - \sum (\text{Incorrect Responses} \times N_{\text{penalty}})$$



*(Where $N_{\text{penalty}} = 0$ for UGC NET and $N_{\text{penalty}} = 0.5$ or similar for CSIR NET).*

---

## 5. Module 3: Learning Management & Digital Resource Hub (LMS)

This module acts as the central knowledge repository for candidates, accessible outside the active 180-minute exam window.

* **Interactive Syllabus Tracker:** A visual, expandable tree of the official syllabus where users can manually check off completed sub-topics. A global progress bar displays percentage completion for both papers.
* **Unit-Wise Study Material Library:** Downloadable e-notes and PDFs covering foundational concepts, organized strictly by the NTA 10-unit taxonomy.
* **Previous Year Question (PYQ) Vault:** Archives of past NET and SET papers categorized by year and shift. Can be attempted in "Test Mode" (timed mock) or "Reading Mode" (scrollable document with immediate answers).
* **Research & Methodology Primers:** A dedicated sub-section for Unit II (Research Aptitude) containing real research proposal templates, synopsis guidelines, and thesis structures.

---

## 6. Module 4: Advanced Practice Modalities & "Mistake Mine"

Moving beyond intimidating 3-hour mocks, the platform must support daily, granular practice tools.

* **Daily Momentum Builders (Micro-Mocks):** 10-question daily streaks taking 15 minutes, pulled from PYQs to build a daily habit loop.
* **Custom Quiz Builder & Tutor Mode:** Untimed practice where users generate custom quizzes by selecting specific subjects, units, and difficulty levels. "Tutor Mode" reveals answers and explanations immediately upon selection.
* **Automated "Mistake Mine":** Every incorrect answer across the platform is automatically routed into a personalized Mistake Bank. Users can generate spaced-repetition "Revision Quizzes" comprised exclusively of their past mistakes.
* **AI-Powered Explanation Engine:** An AI tutor integration that explains specifically *why* the user's chosen distractor option was logically or factually incorrect, rather than just providing the right answer.

---

## 7. Module 5: Post-Exam Analytics & Career Hub

Post-mock analytics must provide strategic behavioral insights and connect candidates with their post-exam career goals.

* **Risk vs. Reward Analytics:** Calculates a "Negative Marking Impact Score" (for CSIR NET) demonstrating points lost to blind guessing, and flags "Time Traps" (questions where users spent >3 minutes but answered incorrectly).
* **Unit-Wise Diagnostic Radar:** Radar graph depicting accuracy percentages across all 10 Paper 1 units. The algorithm categorizes units into Strong, Medium, and Weak (SMW) buckets to dynamically suggest the next study focus.
* **Cut-Off Benchmarking:** Compares candidate mock scores against historical, category-wise cut-offs for both Assistant Professor and JRF in their specific Paper 2 subject.
* **Subject-Specific Study Pods:** Virtual, moderated text and audio lounges isolated by Paper 2 subjects (e.g., "Economics Pod") for peer-to-peer discussions, doubt resolution, and SME-led Ask-Me-Anythings (AMAs).
* **Ph.D. & Fellowship Wiki:** A continually updated resource tracking NTA exam dates, state-wise fellowship stipend differences, and Assistant Professor interview guidelines.

---

## 8. Non-Functional Requirements (NFR) & Architecture

| Component | Specification | Description |
| --- | --- | --- |
| **Concurrency** | 25,000 Active Sessions | Auto-scaling backend (Node.js/FastAPI) deployed on AWS/GCP to sustain high traffic during scheduled All-India live mocks. |
| **Fault Tolerance** | Redis Session Recovery | Answers and timers save to server cache every 30 seconds. In the event of a browser crash or internet drop, candidates resume at the exact second with zero data loss. |
| **Integrity & Security** | Anti-Cheating Guardrails | Forced fullscreen mode; tab-switch detection (auto-submit on 3rd violation); right-click, copy, paste, and print functionalities disabled. |
| **Frontend Rendering** | React.js / Vue.js SPA | Single Page Application architecture ensures seamless tab switching and palette updates without page reloads, mimicking desktop software. |
| **Localization** | UTF-8 Universal Encoding | Ensures flawless typography and prevents font distortion for Devanagari script (Hindi, Marathi) and other regional Indic fonts. |

---

## 9. Implementation Roadmap & Acceptance Criteria

### 9.1 Phased Implementation Rollout

* **Phase 1 (Months 1-2):** Core CBT Engine development, timer synchronization, palette states, and dual-paper NTA layout validation.
* **Phase 2 (Months 3-4):** QBMS deployment, bulk content ingestion, LaTeX rendering, and multilingual dual-screen support.
* **Phase 3 (Month 5):** LMS integration, Interactive Syllabus Tracker, AI Mistake Mine, and diagnostic analytics engines.
* **Phase 4 (Month 6):** Community Study Pods, Load/Stress testing for concurrency, and Public Go-Live.

### 9.2 Critical Acceptance Criteria

* **Dual-Paper Operation:** Users must be able to switch between Paper 1 and Paper 2 instantly without any page reloads or interruption to the master 180-minute countdown.
* **Palette Integrity:** Selecting an option and clicking "Mark for Review & Next" must correctly alter the palette state to "Purple with a Tick" and accurately score the question upon submission.
* **Resilience & Recovery:** Simulating a network failure or hard browser kill during minute 72 must allow the candidate to log back in and resume exactly from minute 72 with all previous inputs intact.
* **Marking Validation:** The scoring engine must successfully validate a scenario where unattempted questions yield 0 marks, and correctly apply negative penalty values for CSIR NET subjects based on backend configurations.


---

# Appendix II — Generated BRD v2.1 revised examination categories (complete Markdown)

# Project NET/SLET v2.1 — Revised Consolidated BRD: Examination Categories & Multi-Pattern Engine
**Status:** Technical proposal / research consolidation (requires product-owner approval)  
**As of:** 11 October 2026  
**Baseline:** Project NET/SLET BRD v2.0, superseding affected examination-specific assumptions  
**Development stack:** Next.js + TypeScript, NestJS, PostgreSQL + Prisma, Redis + BullMQ

## Executive decision

Retain one platform with three top-level student-facing examination categories: (1) UGC NET, (2) Joint CSIR-UGC NET, (3) State/Regional SET/SLET. Within the third category, list official examination names and governing jurisdictions. Each examination-cycle and subject points to a versioned examination blueprint.


Separate the BUSINESS examination identity from the TECHNICAL pattern engine. Do not create one monolithic 150-question timer or duplicate frontend/backend projects for each state.


Research cut-off: 11 October 2026. Evidence status must be tracked per exam cycle. This is a v2.1 replacement of BRD v2.0 sections 1.1-1.2, 3, 4, 8, 9, with necessary new rules and data entities; unaffected student-practice, LMS, analytics and study-pod objectives carry forward.


## What changes from the original BRD
- Replace the claim that NET and SET/SLET all have an identical uninterrupted dual-paper model.
- Create ExamFamily, Examination, Jurisdiction, ExamCycle, ExamPatternVersion, Session, Section, SubjectPatternOverride, LanguagePolicy and ScoringPolicy.
- Support CBT and OMR *simulation* UX; browser-based mock tests need not physically use printed OMR sheets.
- Support continuous, sequential locked, and independent multi-session timers, including breaks.
- Support subject-specific attempts, question-count, option multiplicity and scoring (especially CSIR and Kerala).
- Subject and medium lists must be tied to a cycle, not globally copied from UGC NET.
- Introduce research confidence and administrative sign-off before a test is branded as strict official simulation.

## Carry-forward scope from BRD v2.0

The original student and faculty product remains in scope. The examination-category revision changes exam delivery, rule configuration and exam-specific content mapping; it does not remove the learning and preparation ecosystem.

- Student experience: registration/profile, exam enrollment, personalized dashboard, mock test catalogue, session-based test taking, results and explanations.
- Question Bank Management: subject -> unit -> topic taxonomy (exam-cycle overrides allowed); assertion-reasoning, match-the-following, sequencing, passages/data interpretation, LaTeX, SME workflow, and multilingual reviews.
- Learning Management: syllabus tracker, study notes and PDFs, licensed previous-year question library, research methodology resources.
- Practice: daily micro-quizzes, custom unit/difficulty quizzes, tutor mode, bookmarked questions, persistent mistake bank and spaced repetition.
- Analytics: section/unit accuracy, time traps, personalized revision, historical cutoff context, rank/peer benchmark with clear methodology.
- Community/Career: moderated subject-specific study pods, SME Q&A, verified career/Ph.D./fellowship information; deferred until core delivery reliability.
- Operations: role permissions for admin/SME, test schedule management, user support, load monitoring, localization and accessible responsive PWA.

Inherited capacity objective remains 25,000 simultaneous active exam sessions as a tested growth target rather than an unproven MVP promise.


## 1. Student-facing examination taxonomy
- Category A — UGC NET: cycle -> Paper II subject -> Paper I + Paper II -> Full mock / sectional / topic practice / PYQ.
- Category B — Joint CSIR-UGC NET: cycle -> science subject -> Part A, B, C -> full mock / section practice / unit practice / PYQ.
- Category C — State/Regional SET/SLET: select examination name/jurisdiction, then cycle -> subject -> exam-specific papers and modes.
- Region mapping: MH-SET covers Maharashtra and Goa; NE SLET covers eight northeast states through one agency; JKSET/LASET covers Jammu & Kashmir and Ladakh. Do not create separate exam instances for each covered state.
- Kerala SET must have a distinctive credential goal label: higher-secondary teachers rather than university Assistant Professors.
- State/UT picker should always offer UGC NET and CSIR NET nationwide, then show confirmed state/regional exam options; unknown independent exam status must not hide national options.

## 2. Reusable pattern families

| ID | Technical template | Timer and UI | Typical examinations |
| --- | --- | --- | --- |
| P1 | Continuous dual-section CBT | One 180-minute deadline | UGC NET, TG-SET |
| P2 | Three-part science CBT | One 180-minute deadline | CSIR NET |
| P3 | Single-sitting OMR | One sitting, paper-specific restrictions allowed | KSET, GSET |
| P4 | Separated 60/120 papers | Two independent deadlines plus break | MH-SET, WB-SET, NE-SLET, JKSET, HPSET |
| P5 | Kerala 120/120 special | Two 120-minute deadlines plus break | Kerala SET |
| P6 | Versioned custom | Full rules from approved bulletin | CG-SET, APSET, Rajasthan, MP, TN pending |

These are application-engineering classifications. Official exam rules remain stored at Examination + Cycle + Subject + Section level. Examinations can inherit defaults and override specific attributes.


## 3. Pan-India examination register

| Code / exam | Jurisdiction | 2026 reference / delivery | Session structure | Evidence |
| --- | --- | --- | --- | --- |
| UGC_NET / UGC NET | Pan-India | CBT • Dec 2026 | 1 continuous session, 180 min | Official current |
| CSIR_NET / Joint CSIR-UGC NET | Pan-India | CBT • Dec 2026 | 1 continuous session, 180 min | Official current |
| MH_SET / Maharashtra SET (MH-SET) | Maharashtra + Goa | OMR • 2026 | 2 sessions: 60 + 120 min (with interval) | Official current |
| GSET / Gujarat SET | Gujarat | OMR • 2026 | One 3-hour attendance period; Paper I 60 min, Paper II 120 min | Official current |
| WB_SET / West Bengal SET | West Bengal | OMR • 27th 2025 / 28th 2026 announced | 2 sessions: 60 + 120 min | Verified 2025; 2026 cycle review |
| TG_SET / Telangana SET (TG-SET) | Telangana | CBT • 2026 | 1 continuous session, 180 min | Official current |
| APSET / Andhra Pradesh SET | Andhra Pradesh | TO_VERIFY • 2025 cycle held Mar 2026 | Paper I 60 min; Paper II 120 min; exact navigation to verify | Cycle and structure verified; mode pending |
| KSET / Karnataka SET | Karnataka | OMR • 2026 | 1 continuous 180 min sitting | 2026 secondary corroboration |
| KERALA_SET / Kerala SET (Higher Secondary) | Kerala | OMR • Jan/Jul 2026 | 2 sessions: 120 + 120 min | Authority official; details from 2026 prospectus mirror |
| NE_SLET / North-East SLET (Assam Commission) | Assam, Arunachal Pradesh, Manipur, Meghalaya, Mizoram, Nagaland, Sikkim, Tripura | TO_VERIFY • 2025-26 | 2 separate sessions: 60 + 120 min | Official brochure; OMR mode to reconfirm |
| JKSET_LASET / JKSET / LASET | Jammu & Kashmir + Ladakh | OFFLINE • 2026 | 2 separate sessions: 60 + 120 min | Official current |
| HP_SET / Himachal Pradesh SET | Himachal Pradesh | OMR • 2026 result records; bulletin cycle check | 2 separate sessions: 60 + 120 min | Historical scheme official; revalidate cycle |
| MP_SET / Madhya Pradesh SET | Madhya Pradesh | OMR • SET-2025 held 2026 | ~180 min total; precise paper locking to verify | MPPSC 2025 bulletin located; operational detail check |
| CG_SET / Chhattisgarh SET | Chhattisgarh | OFFLINE_TO_VERIFY • SET26 in Oct 2026 | 2 sessions: 75 + 135 min | 2026 timings published; source bulletin pending |
| RJ_SET / Rajasthan SET | Rajasthan | TO_VERIFY • 2026 | 180 min, no break; paper durations 60 + 120 described | Official University of Kota notification |
| TN_SET / Tamil Nadu SET | Tamil Nadu | TO_VERIFY • 2024 historical; 2026 pending validation | Not certified for 2026 | Historical / pending active-cycle validation |

National coverage: all 28 states can access UGC NET and CSIR NET; a subset have a distinct verified or historically established state/regional SET. The list above covers those identified in this research. Separate recruitment exams, school TET/STET, Symbiosis SET, or obsolete schemes must not be auto-added to this product category.


No current independent SET scheme was established in this research for: Bihar, Haryana, Jharkhand, Odisha, Punjab, Uttar Pradesh, Uttarakhand. For other UTs (besides J&K and Ladakh), no current independent scheme was established: Andaman & Nicobar Islands, Chandigarh, Dadra & Nagar Haveli and Daman & Diu, Delhi (NCT), Lakshadweep, Puducherry. Status: WATCHLIST—not a claim of permanent nonexistence.


Operational details lacking an independently accessible current bulletin remain review-required. This is especially important for TN-SET, APSET delivery modality, KSET publication verification, and the 2026 CG-SET schedule.


## 4. CSIR-specific scoring and attempts

| Science subject | Questions A/B/C | Max attempts A/B/C | Marks/correct A/B/C | Penalty/wrong A/B/C |
| --- | --- | --- | --- | --- |
| Chemical Sciences | 20/40/60 | 15/35/25 | 2 / 2 / 4 | 0.5 / 0.5 / 1 |
| Earth Sciences | 20/50/80 | 15/35/25 | 2 / 2 / 4 | 0.5 / 0.5 / 1.32 |
| Life Sciences & Biotechnology | 20/50/75 | 15/35/25 | 2 / 2 / 4 | 0.5 / 0.5 / 1 |
| Mathematical Sciences | 20/40/60 | 15/25/20 | 2 / 3 / 4.75 | 0.5 / 0.75 / 0 |
| Physical Sciences | 20/25/30 | 15/20/20 | 2 / 3.5 / 5 | 0.5 / 0.875 / 1.25 |

Maximum marks for each of these legacy/current structural patterns is 200. Mathematical Sciences Part C is exact-match multiple-select and has no negative penalty; Earth Sciences Part C uses approximately 33% penalty as specified in published schemes; verify rounding in the cycle bulletin.


For December 2026, Life Sciences and Biotechnology is a revised joint domain. Version syllabus units separately from the earlier Life Sciences content and do not mix PYQs into the new pattern without explicit compatibility tagging.


Attempt overflow: store the full answer chronology and apply the selected cycle's published counting policy. Never assume all responses beyond the maximum are scored. Do not silently prevent additional selections without confirming the official candidate interaction rules.


## 5. Special national/state exceptions
- UGC NET: continuous 180 minutes, 50+100 questions, +2 correct, zero negative; one session; freely switch paper tabs in practice engine.
- MH-SET: offline OMR in two 60/120 sessions; mathematical sciences paper II permits special section pairing; the OMR UI must distinguish strict-finalized bubbles from flexible practice mode.
- GSET: 3-hour on-site sitting with first paper 60 min and second 120 min; implement a stage clock and paper lock rather than unconstrained navigation.
- WB-SET and North-East SLET: paper sessions with separate duration and interval; same 50/100 counts are not a sufficient basis for sharing timer logic.
- Karnataka KSET: continuous 3-hour OMR mock according to 2026 published pattern; require final KEA notification verification prior to cycle publication.
- Kerala SET: separate 120/120-minute sessions; Paper I 120 questions; Paper II 120 except mathematics/statistics 80 x 1.5; dedicated higher-secondary teacher objective.
- CG-SET 2026: reported Paper I 75 min, Paper II 135 min, with long session interval; preserve these as provisional cycle data until official organizer bulletin checked.
- APSET: Paper I and Paper II specified as 60/120 minutes; Paper II language options depend on subject. Do not infer physical CBT/OMR mode from the fact that applications were online.
- Rajasthan SET 2026: official notification says no break and 180 min while mentioning paper durations 60/120; store navigation details as pending rather than invent a mode.
- TNTET and similar school-level teacher eligibility tests do not belong in SET/SLET Assistant Professor category. TNSET itself remains a separate historical/pending-validation entry.

## 6. Core functional requirements for architecture

### FR-EXM-001: Exam and regional catalog

Admin registers exam identities, jurisdiction links, purpose, agency, supported subjects and public status. Student search by exam or state; jurisdictions are not hardcoded into exam IDs.


### FR-EXM-002: Cycle and immutable pattern versions

Each examination year/cycle maintains a source-referenced config snapshot and approval state: DISCOVERED -> RESEARCHED -> DRAFT -> SME_REVIEWED -> APPROVED -> PUBLISHED -> SUPERSEDED. Published exams/attempts retain their exact version forever.


### FR-EXM-003: Session and section engine

Session clocks may be continuous, independent or sequential locked. Paper-level clock, availability windows, break policies, reopening and accommodations are configuration fields. Browser closure does not reset clocks.


### FR-EXM-004: OMR simulation modes

Strict OMR mock offers answer-bubble interface with finality warnings, booklet-code metadata, per-paper response grid and optional printable sheet for practice. Flexible drill mode permits editing. An online simulator is not an actual scanned OMR examination.


### FR-EXM-005: Subject / section scoring

Engine evaluates question type, maximum attempts, question-selection order, variable positive/negative marks, exact-match multi-select, dropped questions, accepted multiple keys and key revision. It creates auditable scoring runs.


### FR-EXM-006: Medium and localization

Configure allowed languages by examination, cycle, section and subject. Never assume all state papers are available in regional languages. Question translations are reviewed versions with fallback behavior in preparation mode only.


### FR-EXM-007: Shared learning data

Use one student profile, learning ledger, review bank and analytics store. Question content can be referenced from multiple exam mappings only when syllabus relevance and rights are reviewed.


### FR-EXM-008: Approval guardrail

No exam can be published as OFFICIAL_PATTERN until the authoritative bulletin URL and effective cycle, rule checksum, SME approval, question bank coverage and regression test report are recorded.


## 7. Data architecture change

Add ExamFamily, Examination, ExaminationJurisdiction, Organizer, ExamCycle, ExamPatternVersion, ExamSessionConfig, ExamSectionConfig, ExamSubject, SubjectPatternOverride, AllowedMedium, ExamRuleSource, ExamPatternReview, and AnswerSelectionEvent.


Retain Student, Role, Question, QuestionRevision, Test, TestForm, Attempt, AttemptAnswer, ScoreRun, Result, Mistake, Revision, StudyResource and AuditLog.


Recommended relational keys: Examination.code unique; ExamCycle unique(examinationId,cycleCode); ExamPatternVersion unique(examCycleId,version); ExamSessionConfig unique(patternVersionId,sessionKey); ExamSectionConfig unique(sessionId,sectionKey). ExamSubject join uses exam-specific code.


An ExamPatternVersion must be frozen at first publication. Later changes create a new version with an explicit effective date and migration notes. Historical student marks remain replayable.


## 8. Configuration contract for Codex

```json
{
  "examCode": "MH_SET",
  "examCycle": "2026",
  "patternVersion": 1,
  "deliveryMode": "OMR_SIMULATION",
  "sessions": [
    {
      "id": "P1",
      "durationSeconds": 3600,
      "questionCount": 50,
      "marksCorrect": "2.0",
      "marksWrong": "0",
      "submitSeparately": true
    },
    {
      "id": "P2",
      "durationSeconds": 7200,
      "questionCount": 100,
      "marksCorrect": "2.0",
      "marksWrong": "0",
      "submitSeparately": true
    }
  ],
  "allowReturnToPreviousSession": false,
  "answerMutationPolicy": "BUBBLE_FINAL_ON_CONFIRM",
  "publicationStatus": "DRAFT_NEEDS_VALIDATION"
}
```


This is a proposed implementation example, not an official interoperable schema. Store all scoring decimals precisely using decimal/numeric arithmetic, not IEEE floating point. The companion JSON manifest also includes research status and references, and must NOT be imported as production-approved policy.


## 9. API and user-interface changes
- GET /exam-families -> top-level categories; GET /exams?jurisdiction=... -> available named examinations; GET /exams/:code/cycles -> historic/active cycles.
- GET /exam-cycles/:id/pattern -> approved blueprint with safe public exam rules only; question answers never exposed pre-submission.
- POST /attempts -> snapshot approved pattern version; GET /attempts/:id/state -> server-authoritative session and paper clocks.
- PUT /attempts/:id/answers/:questionId -> idempotent answer-save and optimistic version conflict handling.
- POST /attempts/:id/sessions/:sessionId/submit -> close paper; POST /attempts/:id/submit -> finalize permitted final attempt state.
- Student navigation: Category -> Exam -> Target cycle -> Subject -> Mode (Official pattern / Flexible practice) -> Test -> Result.
- New OMR component: bubble grid with a deliberate confirmation rule; new separate-paper shell; multi-part science shell with per-part attempted/allowed counters.

## 10. Technical non-functional and testing revisions
- Preserve every acknowledged answer durably in PostgreSQL (transactional); Redis is coordination/cache, not the only answer store.
- Timer deadlines are server-authoritative, persisted per session, and account for official/accommodation-specific approved adjustments.
- A lost connection must not reopen an already closed session or add lost time without a formally approved pause rule.
- Implement canonical unit tests for all five CSIR science subjects and all pattern families, including max-attempt overflow and multi-correct rules.
- Simulate 25,000 active exams with bursty autosave and simultaneous submission before claiming production capacity.
- Use role-based publication approvals and tamper-evident audit records for pattern and answer-key revisions.
- Responsive mobile practice is available; desktop recommended for faithful full mocks. OMR is a browser simulation, not physical scanning.
- Support keyboard and screen-reader access to response palettes, with non-color status text.

## 11. Acceptance criteria by pattern
- AC-01 UGC NET: 150 questions, 180-minute server countdown, +2/0, paper switching and complete analytics.
- AC-02 CSIR Chemistry: 20/40/60 offered, 15/35/25 eligible responses, 2/2/4 marks and correct negative penalties.
- AC-03 CSIR Math: Part C 20 eligible selections scored at 4.75 and no negative marking; exact-match multi-select.
- AC-04 MH-SET: 60-min Paper I locks after submission/expiry; later 120-min Paper II; no revisiting earlier OMR responses.
- AC-05 GSET: Paper I and II use approved 60/120 sequential timing in the same 180-min attendance period.
- AC-06 Kerala: Paper I 120×1 and Maths/Stats Paper II 80×1.5; two 120-minute sessions; total 240 marks.
- AC-07 CG-SET 2026: 75/135 separate session config can be loaded without code changes (pending official sign-off).
- AC-08 Exam catalog: one NE SLET shown for eight states; one MH-SET for Maharashtra + Goa; one JKSET/LASET for J&K + Ladakh.
- AC-09 No exam can be labeled strict official-pattern without APPROVED state, verified source URL, reviewer, effective cycle and completed test matrix.
- AC-10 Historical attempt remains reproducible after next-cycle exam pattern updates.

## 12. Revised rollout plan
- Sprint 0-1: Research rule evidence, official exam registry, approved UGC NET and CSIR subject configurations.
- Sprint 2-3: Schema, rule evaluation library, test blueprint validation, baseline NestJS APIs.
- Sprint 4-5: UGC NET continuous CBT engine with robust answer persistence, recovery, and results.
- Sprint 6-7: CSIR 3-part template, answer caps, multiple-correct questions and per-part marks/penalties.
- Sprint 8-9: OMR and independent paper sessions, start with verified MH-SET + GSET + WB/North-East/JK.
- Sprint 10-11: Kerala special examination, subject overrides, multilingual question-bank workflows.
- Sprint 12+: TG-SET, KSET, APSET, CG-SET, Rajasthan, MP, HP and TN when official-cycle approvals are complete; analytics and content scale in parallel.

## 13. Mandatory operations and sign-off

Each official source is independently checked at the time of test series publication and again when the organizer issues a corrigendum. Admin must capture the source URL, document name/date, verified-by, official evidence excerpt, attached normalized PDF (subject to rights), cycle, config version hash, test evidence and approval timestamp.


Unverified active-cycle details must appear only as “Preparation Practice — Pattern Under Review”, not “Official Pattern Mock”. Automatic bulk ingestion of online coaching-site claims is prohibited for production approval.


The platform is independent educational preparation software and should not imply affiliation with NTA, UGC, CSIR, or state organizing agencies.


## 14. Research provenance and official sources

| Reference | Name / owner | URL |
| --- | --- | --- |
| UGC2026 | UGC NET December 2026 Bulletin | https://ugcnet.nta.nic.in/information-bulletin/ |
| CSIR2026 | Joint CSIR UGC NET 2026 Bulletin | https://csirnet.nta.nic.in/information-bulletin/ |
| CSIRHRDG | CSIR HRDG Exam Scheme | https://www.csirhrdg.res.in/Home/Index/1/Default/3485/78 |
| CSIRMATH | CSIR Mathematical Sciences Exam Scheme | https://www.csirhrdg.res.in/Home/Index/1/InPage/38/26 |
| CSIRLIFE | CSIR Life Sciences and Biotechnology Exam Scheme | https://csirhrdg.res.in/Home/Index/1/InPage/37/26 |
| MH2026 | MH-SET Official Examination Scheme | https://setexam.unipune.ac.in/Examination_Scheme.aspx |
| GJ2026 | GSET 2026 Bulletin | https://gujaratset.ac.in/assets/download/info-bulletin-gset-2026-1.0.pdf |
| WB2025 | WB 27th SET Official Advertisement | https://wbcsc.org.in/wbcsc/PDFDOC/27thSET_ADVT_01082025.pdf |
| TG2026 | TG-SET 2026 Official Scheme | https://telanganaset.org/examination-scheme.html |
| AP2025 | APSET Official Paper and Language Information | https://www.apset.net.in/subjects |
| KA2026 | KSET 2026 Examination Information (secondary verification) | https://www.collegeadmission.in/notice/exam/kset-2026-769 |
| KL2026 | Kerala SET LBS Authority and Prospectus Directory | https://lbsapplications.kerala.gov.in/home/edp_home |
| KL2026PAT | Kerala SET January 2026 Prospectus (secondary mirror) | https://www.scribd.com/document/1039418303/Set2026-Jan-Prospectus |
| NE2026 | SLET Commission Assam NE 2025-26 Information Brochure | https://sletne.org/pdf/Information_Brochure_of_2025-2026.pdf |
| JK2026 | JKSET/LASET Examination Pattern | https://jujkset.in/exam-pattern.html |
| JK2026EVENT | JKSET/LASET Official 2026 Agency | https://jujkset.in/ |
| HP | HPPSC State Eligibility Test Scheme | https://hppsc.hp.gov.in/hppsc/WriteReadData/LINKS/SET21c4227a5b-2e16-4c6e-9f26-4189f4815ce9.pdf |
| MP2025 | MPPSC SET-2025 Notification | https://images.bhaskarassets.com/web2images/521/2025/10/mp-set_1760785167.pdf |
| CG2026 | CG-SET 2026 timings published by Careers360 | https://competition.careers360.com/hi/articles/cg-set-2026 |
| RJ2026 | Rajasthan SET 2026 University of Kota Notification | https://uok.ac.in/notifications/NOTIFICATION-01%20WEBSITE%20NEW.pdf |
| TN2024 | TNSET 2024 Notification (historical) | https://padasalai.info/wp-content/uploads/2024/03/TNSET2024_Notifications-padasalai.net_.pdf |

Evidence grades: Official current = direct organizer or regulator 2026 scheme; Official historical = older organizer scheme; Secondary = corroborative report or mirror, awaiting official-source sign-off; Unknown = do not default. This distinction is deliberate to avoid false precision.




---

# Appendix III — Generated v2.2 unique features and differentiators research (complete Markdown)

# Project NET/SLET v2.2 — Differentiation & Student Learning Feature Strategy

**Status:** Research-backed product proposal for approval; not an automatically approved change to BRD v2.1  
**Research date:** 11 October 2026  
**Baseline:** Project NET/SLET v2.1 (UGC NET, Joint CSIR-UGC NET, State/Regional SET/SLET; examination-cycle-specific rules)  
**Technology baseline:** Next.js / TypeScript; NestJS; PostgreSQL / Prisma; Redis / BullMQ  
**Research method:** Public competitor product pages, selected student discussions, learning-science literature; no private competitor accounts or hands-on feature audit.

## Executive conclusion

Build a **NET/SET Preparation Intelligence Platform**, not merely a test bank. The differentiation thesis combines:

1. **Verified exam fidelity:** auditable exam-cycle-specific CBT/OMR rules covering national and state exams.
2. **Weakness-to-mastery loop:** baseline test → misconception identification → guided study → spaced practice → unseen-item verification.
3. **Question Trust Layer:** SME-verified keys, source provenance, content-quality flags, answer challenges and corrections.
4. **Cross-examination learning graph:** share transferable concept mastery while respecting exam-specific syllabi and scoring.
5. **Explainable readiness:** make recommendations and benchmark outputs understandable; never promise qualification.
6. **Accessible short-session learning:** plan for students with demanding jobs, low connectivity, and mixed-language needs.

Novelty is **not proven** merely because public competitor pages do not advertise a particular feature. Run a hands-on benchmark and student research before asserting exclusivity.

## Market benchmark — public evidence

| Provider | Verified advertised capabilities | Strategic lesson |
|---|---|---|
| Testbook | Large mock/PYQ catalogue, bilingual tests, rank analysis, detailed solutions, AI doubts, unlimited reattempts | Volume, leaderboard, AI chat are baseline |
| Adda247 | Paper I/II mocks, chapter/unit and question-pattern tests, rankings, explanations, video/coaching | Specialized practice types already exist |
| Physics Wallah | Live/recorded lessons, DPPs, tests, PYQ, doubt engine, Infinite Practice | Content/teacher ecosystem is established |
| Unacademy | Adaptive practice, peer speed/accuracy comparison, live tests, coaching, doubts, mentorship, proctored test offerings | Neither adaptive practice nor mentoring alone is exclusive |
| EduRev | Mocks, detailed solutions, structured study schedules, flashcards, mind maps, audio notes, printable OMR samples | Plans, memory tools, and OMR sheets are also baseline |

Sources: https://testbook.com/ugc-net/test-series ; https://www.adda247.com/ugc-net/mock-test ; https://www.pw.live/ugc-net/exams/pw-mission-jrf-1-0-and-mission-jrf-pro-dec-2026 ; https://unacademy.com/goal/nta-ugc-net-set-exams/TEWDQ/practice/topics ; https://edurev.in/ugc-net-exam ; https://edurev.in/courses/61790_UGC-NET

**Scope limitation:** Public descriptions do not establish feature absence, actual feature quality, content accuracy, prices applicable to every user, or actual retention/conversion performance.

## User pain hypotheses to validate

- Difficulty retrieving learned material during PYQs despite rereading notes.
- Confusion about realistic test difficulty and quality of solutions.
- Difficulty choosing where to spend the next 30–90 minutes.
- Repetition of the same conceptual error across different questions.
- Need to balance national and state exams, which overlap but have different official rules.
- Low trust in generic ranks or predictions without methodology.
- Affordability and low-bandwidth access.

Qualitative examples (not representative sampling): https://www.reddit.com/r/UGCNETEnglish/comments/1wngfoz/ ; https://www.reddit.com/r/Indian_Academia/comments/1ihmqg4 ; https://www.reddit.com/r/Indian_Academia/comments/1iw8l4w

Learning evidence: https://doi.org/10.1177/1529100612453266 ; https://pmc.ncbi.nlm.nih.gov/articles/PMC11544060/ ; https://pmc.ncbi.nlm.nih.gov/articles/PMC7881024/

## A. Differentiating product features and requirements

### USP-01: Official Exam Fidelity & Certification
**Priority:** P0 | **Effort:** Medium-High | **BRD:** Extend existing exam versioning

Display an explicit “Pattern verified for [exam cycle]” badge only after admin verification of authoritative bulletin, applicable subject overrides, timer/nav/marking test coverage, and publication approval. Label drafts, historical patterns, and learning-mode variations differently. Every attempt retains its immutable exam pattern ID. No misuse of NTA/UGC endorsement.

**Student benefit:** confidence that the simulation matches the relevant exam format.  
**Acceptance:** all published strict-mode tests are linked to one approved pattern snapshot with source URLs and passing regression tests.

### USP-02: Multi-Exam Concept Overlap Navigator
**Priority:** P1 | **Effort:** High | **BRD:** New learning graph

A student selects UGC NET + MH-SET, or other permitted target combinations. Map canonical concepts to distinct exam subject-unit codes and syllabus versions. Show three categories: common tested concepts, exam-specific concepts, and unconfirmed overlap. Propagate mastery observations only where an SME-approved semantic mapping exists; no marks/rank transfer.

**Student benefit:** avoid redundant preparation while preserving state-specific coverage.  
**Acceptance:** a topic shared by two approved exam mappings appears once in study planning and twice (correctly) in each syllabus view; exams retain their own simulation/scoring.

### USP-03: Baseline Diagnostic & Readiness Interview
**Priority:** P0 | **Effort:** Medium | **BRD:** Expand onboarding

During onboarding collect target exams, available study time, exam date, preferred language, prior attempts and self-assessed strengths. Offer a brief paper/subject diagnostic across key topics using balanced unseen items. Show initial coverage and evidence limitations. Never require diagnostic completion for basic access.

**Acceptance:** generate topic-level baseline with sample size and a first-week preparation plan; no numerical readiness estimate is shown when data are insufficient.

### USP-04: Next Best Study Action
**Priority:** P1 | **Effort:** Medium | **BRD:** Replace passive analytics with actionable queue

Dashboard answers “What should I do now?” Rank tasks by weakness, retrieval due date, exam proximity, importance, item coverage and available time. Provide alternatives such as 10, 20 and 45 minutes. Explain each recommendation and permit postponement.

**Acceptance:** every recommendation names the topic, rationale, target minutes, question count and next verification date.

### USP-05: Misconception & Error-Cause Analyzer
**Priority:** P1 | **Effort:** High | **BRD:** Extend Mistake Mine

After incorrect attempts, optionally ask the learner to categorize the cause: concept gap, misreading, calculation, recall, option confusion, time pressure, careless response, or guessed answer. Combine learner input with SME-tagged distractors; AI may propose tags, never override reviewed keys. Show recurring misconception clusters.

**Acceptance:** remediation tasks link to recurring concept/error patterns, not simply recycled question IDs.

### USP-06: Confidence-Aware Practice
**Priority:** P1 | **Effort:** Medium | **BRD:** New metacognition feature

In **practice mode only**, ask confidence (Sure / Unsure / Guess) after selecting an answer. Incorrect + sure enters high-priority misconception queue; correct + guess enters uncertain-knowledge queue. Never inject this interaction into strict official simulations.

**Acceptance:** learner can see a confusion matrix by confidence and correctness; privacy and analytics use are explained.

### USP-07: Explain Every Option + Evidence Card
**Priority:** P0/P1 | **Effort:** High (content-driven) | **BRD:** Expand answer review

For each reviewed item supply: correct rationale, why each distractor fails, necessary concept/mini-lesson, source/provenance, publication or verification date, SME reviewer, and related revision questions. Use layered view: 30-second explanation → detailed solution → cited reference. AI may rephrase or tutor from approved content; hallucinated citations forbidden.

**Acceptance:** published practice questions have an approved correct answer and explanation; when a source is unavailable, display that explicitly rather than generating fictitious evidence.

### USP-08: Question Trust & Challenge Centre
**Priority:** P0/P1 | **Effort:** Medium | **BRD:** Extend QBMS workflow

Let students flag wrong keys, stale facts, translation issues, ambiguity, poor difficulty fit or typos. Triage by SME; record resolution SLA, status and question revision. Quarantine disputed questions in new scored live tests where appropriate. Versioned re-scoring must be authorized and auditable.

**Acceptance:** every challenge creates a trackable case; corrections never silently alter historic question snapshots.

### USP-09: Remediation-to-Mastery Verification
**Priority:** P1 | **Effort:** High | **BRD:** Extend mistake bank and spaced repetition

A mistake is not “mastered” just because a student sees the answer. Require subsequent successful retrieval, preferably on new or parallel items, at increasing intervals; adjust pacing when errors recur. Mastery status includes evidence count, recency, item difficulty and topic coverage.

**Acceptance:** a single repeated correct answer is not automatically enough for mastery; users can inspect supporting attempts.

### USP-10: Exam-Realistic Difficulty Calibration
**Priority:** P1/P2 | **Effort:** High, data dependent | **BRD:** Expand item bank and mocks

Use expert blueprinting and item performance data to classify and review questions. Track solution time, discrimination and distractor selection; compare with verified official papers where rights permit. Avoid describing questions as “exact NTA difficulty” without evidence.

**Acceptance:** each published strict mock passes subject/unit weight review, item exposure checks and difficulty-distribution QA.

### USP-11: Honest Exam Readiness & Cutoff Context
**Priority:** P1/P2 | **Effort:** High | **BRD:** Upgrade cutoff analytics

Show rolling score bands from multiple fresh comparable mocks, topic coverage, stability and historical published cutoffs. Label population basis and sample size; separate private-mock percentile from official NTA percentiles. Do not imply that crossing an old cutoff ensures JRF/NET qualification.

**Acceptance:** the UI explains the calculation and refuses to show overconfident predictions from inadequate data.

### USP-12: Attempt Strategy Simulator
**Priority:** P1 | **Effort:** Medium-High | **BRD:** CSIR enhancement

In a learning-only simulator, let students compare hypothetical response strategies for negatively marked CSIR sections and maximum-attempt rules. UGC NET zero-negative-marking advice must be separate and acknowledge official rules. Never change strict examination scoring based on the student’s preference.

**Acceptance:** side-by-side “actual score” and “hypothetical strategy” are labeled distinctly and use approved subject-specific scoring rules.

### USP-13: Time-Budget Preparation Scheduler
**Priority:** P1 | **Effort:** Medium | **BRD:** Upgrade study planner

Plans for 30/60/90/120 minutes per day, weekdays only, weekend catch-up, shift workers and students with variable schedules. Automatically reschedule missed tasks without penalizing users. Protect minimum intervals for revisions and reserve buffer before the exam.

**Acceptance:** changing weekly study availability recomputes a feasible plan and highlights unreachable coverage goals.

### USP-14: Last-30 / Last-7 / Last-1-Day Revision
**Priority:** P1 | **Effort:** Medium | **BRD:** New exam countdown feature

Create phase-specific plans: consolidate weak concepts, use appropriate mock cadence, retrieve previously learned content, and avoid overloading the final 24 hours with unreviewed new material. Generated “last mile” sheets use reviewed content and cite sources.

### USP-15: Paper I Skill Labs & CSIR Section Labs
**Priority:** P1 | **Effort:** Medium | **BRD:** New focused practice UX

Interactive reading-comprehension/DI split view, numerical reasoning workspace, research-methodology drill, logic error analysis; CSIR Part C exact-multiple-select practice, section attempt-budget drills. Scratchpads in preparation mode must not imply official exam tools are available.

### USP-16: OMR Rehearsal Centre
**Priority:** P1/P2 | **Effort:** Medium-High | **BRD:** Enhance state exam formats

Digital answer-bubble practice, booklet code tracking, finality warnings, paper-wise timing, printable template where authorized. Optional scanned OMR upload and grading is a later research/prototype item requiring accuracy and privacy validation. EduRev already offers a printable sample OMR: that alone is not unique.

### USP-17: Regional Language Quality Layer
**Priority:** P1 | **Effort:** High, translation dependent | **BRD:** Extend multilingual policy

Review original and translated variants for technical accuracy, math symbol fidelity and domain terminology. Let learners flag translation ambiguity. In practice mode offer bilingual side-by-side display where licensed; in strict mode follow the official language policy for the exam/subject/cycle.

### USP-18: Low-Data and Interrupted-Connectivity Practice
**Priority:** P1/P2 | **Effort:** Medium-High | **BRD:** Extend PWA reliability

Use light pages, accessible fonts, resumable content downloads, and offline-capable **practice only** with clear local/unsynced status; reconcile on reconnect. Strict timed live rankings remain server-authoritative and require appropriate connectivity policies. Cached question material must obey content rights.

### USP-19: Knowledge Source Library and Learning Paths
**Priority:** P1/P2 | **Effort:** Content-heavy | **BRD:** LMS extension

Map each syllabus concept to approved notes, brief worked examples, permitted official references and practice items; annotate resource freshness and coverage. Avoid dumping unrelated PDFs and calling that a learning path.

### USP-20: Official Notice / Syllabus / Key Change Tracker
**Priority:** P1 | **Effort:** Medium | **BRD:** New exam intelligence service

Maintain organizer notices, pattern changes, application windows, eligibility updates, answer-key notices and source URLs; every alert is verified and dated. Clearly separate official notices from internal predictions or commentary. Avoid scraping in violation of terms.

### USP-21: Learning Evidence Portfolio
**Priority:** P2 | **Effort:** Medium | **BRD:** New longitudinal reporting

Track concept mastery, fresh vs repeated question performance, successful retention after revision, coverage and score stability. Let students export their progress in PDF/CSV, without turning an internal report into a fictional certification.

### USP-22: Transparent Peer Benchmarking
**Priority:** P1/P2 | **Effort:** Medium | **BRD:** Analytics enhancement

Compare only candidates who attempted the same locked test form during a clearly defined window; show cohort size and scoring date. Prevent reattempt leakage, filter obvious abuse, and apply privacy thresholds for narrow demographic filters.

### USP-23: Community Doubt Clinic with Reviewed Answers
**Priority:** P2 | **Effort:** High moderation | **BRD:** Upgrade study pods

Replace noisy generic chat with question-linked discussions and expert-answer status. User-generated explanations are not automatically accepted as verified. Limit spam, protect contact details, and avoid open audio communities until moderation is resourced.

### USP-24: Faculty and Content Quality Intelligence
**Priority:** P0/P1 | **Effort:** Medium | **BRD:** New administrative analytics

SMEs see unanswered challenges, outdated syllabus references, distractor anomalies, questions with high wrong/ambiguous rates, and language-review gaps. Admin dashboards show time-to-resolution, review backlog and question exposure.

### USP-25: High-Integrity Exam-Day Rehearsal
**Priority:** P2 | **Effort:** Medium | **BRD:** Enhance mock scheduling

Provide device readiness checks, keyboard-accessibility tutorial, exam navigation onboarding, interruption simulation, authorized accommodations and printable exam checklist. Explain that the platform is an independent preparation service and not an official exam delivery provider.

## B. Recommended release sequence

| Release | Themes | Student outcome | Dependencies |
|---|---|---|---|
| Release 1 — Trusted Practice MVP | USP-01, 03, 07 (minimum), 08 (core), 15 (basic), 24 (core) + existing v2.1 examination engine | A student can take an accurate mock and trust the result | Approved exam patterns, SME-reviewed questions, durable exam attempts |
| Release 2 — Improvement Engine | USP-04, 05, 06, 09, 13, 14, 22 | A student knows what to revise and verifies improvement | Stable item taxonomy, sufficient unseen question inventory, clean telemetry |
| Release 3 — Cross-Exam Differentiation | USP-02, 12, 16, 17, 20 | National + state preparation in one learning model | Verified mappings, regional SMEs, cycle-specific rules |
| Release 4 — Advanced Intelligence | USP-10, 11, 18, 19, 21, 23, 25 | Robust evidence, broad access and community | Larger data sample, content rights, moderation, accessibility review |

Prioritize **quality and outcome verification** above nonessential visual gamification, public chat, or generic AI-generated question volume.

## C. Proposed UX navigation

- Dashboard: Today's best next action, exam countdown, upcoming reviews, score trend, coverage, notices.
- My Exams: national/state targets, cycle selector, format verification and mode chooser.
- Practice: unit/subtopic quiz, confidence-aware drill, CSIR section labs, mock schedules.
- Revision: Mistake Mine, misconceptions, due reviews, mastery verification, last-mile packs.
- Results: answer review, option-level reasoning, audit trail, peer cohort and historical context.
- Syllabus: cycle-specific coverage, overlap map, approved resources and study tracker.
- Notifications: verified official notices, planned revision prompts, challenge resolutions.
- Faculty/Admin: content triage, exam certification, blueprint verification, analytics and support.

### Illustration — after a wrong answer

1. Save original choice and server-authoritative attempt event.
2. Ask optional practice-only confidence and error cause.
3. Display approved explanation and evidence card after permitted reveal time.
4. Map error to concept and misconception; create remediation task.
5. Recommend a short lesson and a new practice item, not the identical question.
6. Schedule follow-up retrieval at a suitable interval.
7. Update mastery only after independent evidence; show exactly what changed.

## D. Proposed domain entities (additional to v2.1)

- `Concept`, `ConceptPrerequisite`, `ConceptExamMapping`, `MappingReview`
- `StudentTargetExam`, `StudentStudyAvailability`, `StudyPlan`, `StudyTask`, `StudyTaskEvidence`
- `DiagnosticAssessment`, `ConceptMasteryEvidence`, `MasteryEstimate`, `RemediationPlan`
- `QuestionExplanationVersion`, `OptionRationale`, `ContentProvenance`, `ContentLicence`
- `QuestionChallenge`, `ChallengeResolution`, `ContentQualitySignal`
- `AttemptConfidence`, `SelfReportedErrorCause`, `MisconceptionTag`, `QuestionConceptTag`
- `RetrievalSchedule`, `RetrievalEvent`, `ParallelItemGroup`
- `ExamNotice`, `NoticeSource`, `NoticeVerification`
- `CohortSnapshot`, `RankingRun`, `ReadinessReport`, `ReadinessMethodologyVersion`

Use immutable published question/pattern/answer-key versions for scoring; separate diagnostic and coaching metadata from strict exam scoring. Privacy-sensitive inferences should have defined retention and opt-out rules.

## E. Objective measurement of differentiation

**North-star:** verified learning improvement, measured on unseen, syllabus-matched questions at defined intervals; do not merely count questions attempted.

Track:

- Diagnostic-to-follow-up gain (compare comparable item difficulty; report sample sizes).
- 7-/21-day retention rate on unseen or sufficiently distinct questions.
- Rate of high-confidence wrong responses and subsequent correction.
- Percentage of error clusters resolved with independently observed evidence.
- Time to first completed mock; mock-to-remediation conversion.
- Weekly active learners returning to planned revisions (without streak coercion).
- Question challenge frequency and median review resolution time.
- Reviewed explanation coverage and known erroneous key rate.
- Multi-exam concept reuse rate and mapping dispute rate.
- Strict-mode exam attempt integrity, no acknowledged answer loss.
- Free-to-paid conversion and 30-/90-day retention, balanced with learning metrics.

Avoid fake “selection probability,” fabricated predicted rank or statements that practice guarantees qualification.

## F. Student research to run before major differentiated investment

**Interview 30–40 students** across at least: UGC NET Paper I/Paper II, CSIR, a state SET, a working aspirant, a Hindi/regional-medium aspirant, repeat attempters. These are suggested research sample targets, not measured populations.

Conduct five concept tests:

1. Which is more valuable: 100 extra mocks, or next-best-action remediation after a single mock?
2. Can a student distinguish verified exam-pattern status from general practice mode?
3. Can students understand why a weakness is labeled and whether evidence is sufficient?
4. Does concept overlap help real dual-exam candidates without causing false confidence?
5. Are students willing to pay for reviewed explanations and mastery diagnostics over larger question volume?

Run a controlled pilot with students using baseline and follow-up unseen tests, and inspect correctness, retention, satisfaction, time spent and support incidents. Assess willingness to pay using real offer experiments, not just stated intent.

## G. Key architecture guardrails

1. The test engine is authoritative for exam state and scoring; no AI-generated answers during strict assessment.
2. The AI tutor should retrieve only permitted, approved content and disclose uncertainty.
3. A question's content provenance and correction history must be audit-ready.
4. Analytics pipelines must not modify immutable exam results.
5. Source-based cutoff comparisons distinguish exam cycle, eligibility route, subject, category and official percentile methods.
6. Mixed-language behavior must never override official strict-mode language rules.
7. Offline practice is not equivalent to a live proctored or ranked CBT.
8. Security, consent, accessibility and student privacy are release criteria, not add-ons.

## H. Recommended positioning and communication

**Primary:** “Practice the right exam. Find your weak concepts. Prove your progress.”

**Support messages:** “One preparation plan for your NET and state SET goals”; “Expert-reviewed solutions you can challenge”; “Revision scheduled from what you actually forget”; “Exam-pattern simulations clearly marked by verified cycle.”

Do not use “India's first”, “only platform”, “100% accurate score predictor”, or “official NTA partner” unless independently substantiated.

## Research references and limitations

- Testbook UGC NET 2026 test series: https://testbook.com/ugc-net/test-series
- Adda247 UGC NET 2026 mocks: https://www.adda247.com/ugc-net/mock-test
- Physics Wallah Mission JRF: https://www.pw.live/ugc-net/exams/pw-mission-jrf-1-0-and-mission-jrf-pro-dec-2026
- Unacademy UGC NET adaptive practice: https://unacademy.com/goal/nta-ugc-net-set-exams/TEWDQ/practice/topics
- Unacademy test series: https://unacademy.com/goal/TEWDQ/TEWDQ/test_series
- EduRev UGC NET resources: https://edurev.in/ugc-net-exam
- EduRev 2026 test course with printable OMR: https://edurev.in/courses/61790_UGC-NET
- Student NET-English September 2026 discussion: https://www.reddit.com/r/UGCNETEnglish/comments/1wngfoz/
- Student constraints: https://www.reddit.com/r/Indian_Academia/comments/1ihmqg4/
- Dunlosky et al. effective learning techniques: https://doi.org/10.1177/1529100612453266
- Personalized adaptive learning review: https://pmc.ncbi.nlm.nih.gov/articles/PMC11544060/
- Confidence and correctness research: https://pmc.ncbi.nlm.nih.gov/articles/PMC7881024/
- UNESCO guidance on generative AI in education: https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research

**Evidence limitations:** competitor marketing copy is a claim by providers, not a rigorous product audit; Reddit posts are qualitative and may be biased; learning-science evidence supports underlying approaches but does not establish outcome improvements for this particular platform; dates and exam schemes require continuous official verification.

