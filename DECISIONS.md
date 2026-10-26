# Architecture decisions

## Phase 1 foundation

- `spec.md` is the single source of product and acceptance requirements. Implementation is phased; Phase 1 establishes the base only.
- Client and server are npm workspaces using JavaScript ES modules. Vite serves React and builds the static client; Express owns `/api/v1` routes.
- Tailwind CSS is configured through its Vite plugin. React Router provides client routes, and TanStack Query is configured for future server state.
- Zod validates server environment variables before server startup. MongoDB is accessed through Mongoose. `/health` is liveness; `/health/ready` checks the database.
- The client API base URL is public configuration. Gemini credentials, media provider credentials, and `JWT_SECRET` are server-only and must never use `VITE_*` variables.
- Express uses Helmet, configured credentialed CORS, a JSON body limit, rate limiting, a consistent error envelope, and centralized error handling.
- Vitest is used for client and server tests; Supertest exercises Express without a MongoDB service.

## Phase 2 accounts and brief UI

- Account passwords use `bcryptjs`, which writes bcrypt hashes without a native binary build requirement on Windows. JWTs use HS256 and a seven-day HTTP-only cookie; the signing key stays in server environment configuration.
- Email is trimmed and lowercased before persistence; a MongoDB unique index is authoritative for duplicate prevention. Public user responses are allow-listed and the password hash is excluded from ordinary model selection/serialization.
- Auth endpoints share a tighter rate limit than the general API. Mutating requests with an Origin header are restricted to the configured client origin. Protected resources use an owner-scoped database query, rather than loading a public row and checking it afterward.
- The creation form validates the case brief client-side and on the server. The protected generation endpoint now returns a case only after Gemini output validation and persistence succeed.
- Auth endpoint tests inject an isolated user model because a local MongoDB service is not assumed. Mongo-backed persistence and deployed cookie settings remain to be verified with a real database and HTTPS deployment.

## Phase 3 mystery generation

- Text generation uses a separate `TextGenerationProvider` implemented with the official `@google/genai` SDK. The configured key/model are server-side. Image/video providers are not reused for text and remain separate future integrations.
- Gemini is asked for structured JSON using a versioned prompt and JSON response schema. Zod validates it and deterministic checks verify IDs, references, timeline order/timestamps, suspect count, culprit existence, decisive clues, red herrings, and evidence-based exclusions for all alternative suspects. Invalid output is retried only within configured bounds and never saved as playable.
- Public case facts and private solution are stored in separate MongoDB collections. The case is initially saved as `generating`; the solution is written; only then is the case marked playable. On write failure, both records are cleaned up best-effort. Public APIs use an explicit allow-list and never query the solution collection.
- Generation is synchronous for the current MVP page. The UI reports the in-progress request; the server uses an SDK request timeout and bounded retry. An external durable job queue and progress polling are not implemented.
- Validation failures are separated into schema and consistency stages. Server logs contain request ID, safe error code, and allow-listed paths (never prompt text, generated content, or credentials); the API returns a specific safe code and request ID. Bounded regeneration receives only sanitized paths/codes/rules. Persistence begins only after all structural and consistency checks succeed.
- The legacy generic invalid-case response had discarded its validation errors, so the original browser failure cannot be retrospectively assigned to a field. A deterministic test reproduces a missing `evidence[0].timelineEventId` schema error. Both the Gemini structured response schema and Zod schema require that field; other consistency rules remain enabled.
- Gemini response extraction follows the installed SDK's documented `GenerateContentResponse.text` getter. The provider checks candidate finish reason before parsing so `MAX_TOKENS` is reported as truncation rather than malformed JSON. The configured `gemini-2.5-flash` supports structured output and up to 65,536 output tokens; the request now permits 16,384, and the prompt constrains unnecessary verbosity. Malformed JSON, empty/blocked/truncated output, schema errors, and model configuration errors are separately classified. At most one regeneration can run.
- The user's historical request ID was not present in project files, and the prior console output was unavailable. Its exact Gemini finish reason remains unconfirmed; current server attempt logs now include request ID, model, stage, code, finish reason, and provider response ID where available.
- Timeline consistency accepts a single midnight rollover because timestamps are stored as HH:mm without a date. A second rollover remains invalid. Prompt instructions explicitly describe the exact suspect/evidence/exclusion/decisive-clue/red-herring references enforced by validation, so semantically plausible but structurally unlinked clues are regenerated instead of accepted.
- Automated tests use a deterministic provider and fake repositories. An opt-in integration test against the configured local MongoDB passed, including cleanup. No live Gemini request was made; actual provider access and account/model eligibility remain unverified.

## Phases 4–5 investigation and verdict

- A unique `(userId, mysteryId)` Investigation record is created on demand and resumed idempotently. Every route retrieves it by authenticated owner and verifies the linked Mystery also belongs to that owner.
- Investigation routes return an allow-listed state and the existing `toPublicMystery` projection. Solution fields are fetched with explicit Mongoose `select` only inside hint/verdict services; result access requires completed submission.
- Progress and notes use strict Zod input schemas and validate all suspect/evidence IDs against the owned mystery. Evidence associations represent player hypotheses and do not mutate case facts.
- Hints are two progressive pointers selected from saved decisive evidence. Hint text/history is persisted, but no culprit ID, solution fields, or answer-bearing metadata is returned.
- Verdict scoring is deterministic (60 culprit, up to 25 explanation length, up to 15 decisive evidence references); one atomic `active`-status update records score and completion. Repeated submissions return conflict and cannot rescore.
- Tests cover the service/API path with deterministic fixtures. The opt-in local MongoDB integration now exercises progress, notes, and verdict persistence and cleanup. Replay attempts and automated browser E2E remain open.

## Boundaries and current limitations

- Landing page copy and any sample case are explicitly illustrative. User accounts, case generation, the saved case archive, investigation workspace, and verdict submission are implemented. Replay as a separate attempt and automated browser E2E remain open.
- Separate image and video provider interfaces plus storage/metadata utilities already exist as a scaffold. They are not connected to end-user mystery APIs, and no real image/video generation workflow is claimed.
- The private mystery solution must remain excluded from public API responses, user-facing prompts, and media prompts. Future mystery storage and serialization need an explicit public/private boundary.
- Mock and simulation modes must be labeled in future product UI. A simulation must not be described as a generated video.
- Live MongoDB behavior is not verified unless a database is available. Real provider integration tests must remain opt-in and credential-gated.
- Windows setup instructions copy `.env.example` files only when local `.env` files do not exist, to avoid overwriting developer configuration.
