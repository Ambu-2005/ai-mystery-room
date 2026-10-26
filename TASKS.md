# AI Mystery Room implementation plan

`spec.md` remains the product source of truth. Phases 1–3 are implemented; MongoDB persistence was verified against the local database with the deterministic mock provider. A live Gemini request remains untested. The generation failure diagnostics and bounded validation-feedback retry have also been implemented and verified with deterministic provider tests.

## Phase 1 — Foundation

- [x] React + Vite + Tailwind, React Router, TanStack Query, Express, Mongoose, Zod configuration, health/readiness, centralized errors, API client, and landing page.
- [x] Environment examples, Git ignore rules, Windows setup instructions, and baseline tests/build.
- [x] Verify live MongoDB connectivity and case persistence with an opt-in integration test using a deterministic mock provider.

## Phase 2 — Accounts and private workspace

- [x] Normalized unique User email, bcrypt-compatible password hashes, HTTP-only JWT cookies, register/login/logout/current-user endpoints.
- [x] Auth throttling, origin checks, protected routes, and reusable resource ownership middleware.
- [x] Sign-in/register UI, private dashboard, and validated case-brief form.
- [x] Endpoint tests for input, duplicates, credentials, cookies, sessions, authorization, and ownership.

## Phase 3 — Gemini generation and case persistence (implemented)

- [x] Integrate the official `@google/genai` SDK through a server-side `TextGenerationProvider`, configured by `GEMINI_API_KEY` and `GEMINI_MODEL`.
- [x] Add versioned instructions, structured JSON response mode, timeout, bounded retry, and usage metadata.
- [x] Validate generated structures with Zod, including requested counts, globally unique IDs, references, ordered timeline and time consistency, culprit existence, essential decisive clues, red herrings, and an evidence-based exclusion for every alternative suspect.
- [x] Persist public facts in `Mystery` and private solution/reasoning in separate `MysterySolution`; only publish a safe allow-listed case projection.
- [x] Connect authenticated `POST /api/v1/mysteries` and owner-scoped `GET /api/v1/mysteries/:id`.
- [x] Add loading/progress, validation and provider/database errors, retry controls, and navigation to the generated case overview.
- [x] Add deterministic mocked-provider tests for success, invalid output, bounded retry, unavailable services, storage failure, ownership, and solution secrecy.
- [x] Log safe validation stage/code/path diagnostics; return specific schema/consistency error codes and a request reference without exposing detailed validator errors to clients.
- [x] Retry invalid generated cases only within the configured bound, passing sanitized validation feedback to Gemini. Do not persist until the complete case passes validation.
- [x] Run all server tests (43 passed), all client tests (5 passed), and the production client build successfully.
- [x] Run the opt-in local MongoDB persistence/ownership integration test; it passed and cleaned up its temporary records.
- [ ] Run credential-gated real Gemini generation when deliberately configured; no paid provider call was made for this increment.

### Generation failure debugging

- The previous service collapsed Zod and consistency failures into `GENERATED_CASE_INVALID` and discarded their field diagnostics. That is why the historical browser message cannot be tied to a specific failed field after the fact.
- The deterministic regression reproduces a schema failure caused by missing `evidence[0].timelineEventId` (`invalid_type`, expected `string`). The service logs that safe field-level diagnostic, sends the path/code/rule as bounded retry feedback, and only saves after a valid response.
- Gemini's configured structured response schema and the application's Zod schema both require `timelineEventId`; this mismatch was not the cause. No reference, culprit, clue-sufficiency, red-herring, or timeline checks were removed.
- The exact error from the user's earlier live request is unrecoverable because it was never logged, and no live Gemini call was made for this fix.

### Gemini malformed structured-output follow-up

- The installed `@google/genai` SDK's `GenerateContentResponse.text` getter is the documented way to read the first candidate's text. The existing extraction method was correct; parsing now separately checks candidate finish reason and response/block metadata.
- The supplied browser reference ID was not found in repository files. Runtime logs are process-console output and were not available for retrospective lookup, so the original request's finish reason cannot be confirmed.
- The configured `gemini-2.5-flash` model supports structured outputs and a 65,536-token output budget per Google's model documentation. The previous request limit of 8,192 could truncate a full case. The generation limit is now 16,384, and prompts ask for concise but complete evidence.
- Empty, blocked, truncated (`MAX_TOKENS`), malformed JSON, JSON-but-invalid schema, and unsupported-model/configuration responses now have separate stages/codes. Logs include the request reference, stage, safe code, model, finish reason, and provider response ID when available.
- Retry configuration is capped at one regeneration; invalid JSON/schema and consistency feedback remain bounded. Persistence still occurs only after all Zod and consistency validation succeeds.
- Verification: server test suite passes (39 tests), client suite passes (5 tests), and production client build succeeds. No live Gemini call was made.

### Consistency-validation failure follow-up

- Confirmed validator defect: timeline ordering compared HH:mm values as if all events occurred on the same date. A valid chronological overnight case (for example, 23:50 followed by 00:05) was rejected at `timeline[n].timestamp`. The validator now unwraps one midnight rollover and still rejects a second rollover/out-of-order sequence.
- Prompt/validator contract mismatch: the prompt asked for evidence-based links semantically but did not state the validator's exact bidirectional requirements. It now explicitly requires suspect `evidenceIds` to agree with evidence `relatedSuspectIds`, exclusion clues to relate to the excluded suspect, decisive evidence to be essential and culprit-linked, red-herring evidence to be existing/non-essential/non-decisive with an explanation, and all references/IDs to resolve uniquely.
- The current browser message alone does not identify a field. No server stdout or persisted log artifact for that specific request was available in the workspace, so its exact `timeline[n].timestamp` or reference-field issue cannot be asserted. The service logs `stage=consistency`, `errorCode=CASE_CONSISTENCY_FAILED`, and sanitized diagnostic paths for each failed attempt; deterministic tests verify the exact paths and feedback.
- Failed output is still not persisted. A consistency failure gets at most one regeneration, and tests verify only the corrected result and private solution are saved. Existing public/private solution boundaries remain tested.
- Verification: all server tests pass (43), all client tests pass (5), and the production client build succeeds. No live Gemini request was made.

## Phase 4 — Investigation experience (implemented)

- [x] Add owner-scoped playable case archive summaries and persisted investigations with unique user/case identity.
- [x] Build responsive investigation navigation for overview, suspects, timeline, evidence, board, notes, hints, and final verdict.
- [x] Persist inspected/bookmarked evidence, user evidence-to-suspect associations, case/suspect/evidence notes, theory, and progressive hint history.
- [x] Build a visual board linking case evidence, its timeline event and related evidence, with private suspect associations.
- [x] Add server-side ID/ownership validation and safe allow-listed investigation responses; private solution fields remain unavailable before submission.
- [x] Add tests for API authentication/ownership, persisted progress and notes, hint progression, ID validation, and solution isolation.
- [x] Show each selected evidence item’s own timestamp and linked timeline event description; add regression coverage for six distinct item-to-event mappings.
- [x] Verify inspection state, suspect association, case/evidence/suspect notes, theory, and revealed hints after a fresh API read; MongoDB integration covers reload persistence.
- [x] Audit the configured local playable case: all 6 evidence-event links match and the case passes current consistency validation.

## Phase 5 — Verdict and scoring (implemented; replay remains)

- [x] Add a final accusation form with a valid suspect, 20-character explanation minimum, optional supporting evidence, and server-side ID validation.
- [x] Evaluate the saved culprit deterministically on the server; compute culprit, explanation-length, and decisive-evidence score components (60/25/15).
- [x] Atomically complete an active investigation once; reject repeated verdicts and prevent progress edits after submission.
- [x] Reveal the correct suspect and full saved explanation only through the authorized result endpoint after submission.
- [x] Test correct and incorrect verdicts, scoring, solution visibility, and duplicate-submission handling.
- [ ] Add replay as a separate investigation attempt.
- [x] Verify persisted progress, notes, and verdict against local MongoDB using the deterministic fixture provider; temporary records were cleaned up.
- [x] Run full server/client suites (52 server, 8 client) and the production frontend build.

## Phase 6 — Media workflow and polish

- [x] Connect independent image/video providers to saved cases with ownership-checked routes, status, storage, retry, deduplication, and usage/cost controls.
- [x] Validate generated images against saved facts; accurately label mock, simulated, or unavailable media.
- [x] Add UI controls, media status polling, secure content delivery, and playback without representing simulations as generated video.
- [ ] Run live image/video generation tests with configured Google API credentials; provider eligibility, quota, and real account behavior remain unverified.

## Phase 7 — End-to-end verification and release

- [ ] Complete end-to-end browser coverage for the complete account-to-verdict journey.
- [ ] Document credential-gated real-provider tests and run only when configured.
- [ ] Verify deployment security, accessibility, production build, and operational documentation.

## Existing media scaffolding

Separate image/video interfaces, Google adapters, owned-case API routes, media metadata and local file storage, image consistency validation, status polling, and an evidence viewer are wired into the investigation workspace. Default configuration remains IMAGE_PROVIDER=mock and VIDEO_PROVIDER=simulation; real generation requires deliberate server-side configuration and a live provider test.
