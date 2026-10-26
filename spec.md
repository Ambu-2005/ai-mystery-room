# AI MYSTERY ROOM
## Product Specification & Single Source of Truth

**Document:** `SPEC.md`  
**Project:** AI Mystery Room  
**Version:** 1.0.0  
**Status:** Ready for implementation  
**Development methodology:** Spec-Driven Development (SDD)  
**Primary coding agent:** OpenAI Codex  
**Frontend:** React.js  
**Backend:** Node.js + Express.js  
**Database:** MongoDB + Mongoose  
**AI provider:** Google Gemini API

---

# 1. Project Overview

## 1.1 Project Description

AI Mystery Room is an AI-powered interactive detective investigation platform where users can create and solve fictional mysteries generated from short stories or scenarios.

The user submits a story idea, such as a missing diamond, a suspicious college event, a stolen painting, or a mysterious disappearance. The backend uses the Gemini API to transform the idea into a structured fictional investigation containing suspects, motives, timelines, clues, and a hidden culprit.

Users enter the mystery room and investigate the case using AI-generated or AI-authored evidence, including:

- Fictional chat conversations.
- Witness statements.
- Suspect profiles and motives.
- Generated crime-scene or object images.
- Simulated CCTV recordings or CCTV-style evidence.
- Time-stamped activity logs.
- Physical clues and forensic-style reports.
- Contradictions between suspect statements.
- A final accusation and explanation.

The culprit is determined when the case is created and remains fixed throughout the investigation. The user must identify the correct culprit and provide a reasoning-based verdict.

The platform then evaluates the user's answer and presents the actual solution, evidence connections, and explanation.

## 1.2 Product Vision

Create an immersive, replayable detective experience that combines generative AI, interactive storytelling, logical reasoning, and evidence analysis.

## 1.3 Core User Journey

1. User opens the website.
2. User creates an account or continues in guest mode.
3. User enters a short story or scenario.
4. User configures difficulty, theme, and optional settings.
5. Backend generates and validates a complete mystery.
6. User enters an interactive mystery room.
7. User examines evidence, suspects, and timelines.
8. User identifies contradictions and develops a theory.
9. User selects a culprit and submits an accusation.
10. Backend evaluates the verdict against the saved solution.
11. User receives the result, explanation, score, and case summary.
12. User can replay, create another mystery, or view investigation history.

# 2. Product Goals and Non-Goals

## 2.1 Goals

- Generate coherent fictional mysteries from user-provided scenarios.
- Create an internally consistent investigation with one predetermined culprit.
- Provide several evidence types that users can inspect.
- Make the investigation interactive rather than a simple chatbot conversation.
- Support multiple difficulty levels.
- Evaluate accusations fairly and explain the solution.
- Persist cases and investigation progress in MongoDB.
- Provide a polished, responsive, professional interface.
- Keep AI generation secure, reliable, and cost-conscious.
- Support future expansion into multiplayer investigations and richer media.

## 2.2 Non-Goals for Version 1

The first release will not include:

- Real-world criminal investigation.
- Investigations involving real private individuals.
- Real police databases or external surveillance systems.
- Uploading or analyzing actual private WhatsApp conversations.
- Real CCTV camera integrations.
- Multiplayer live investigations.
- A public marketplace for user-created cases.
- Unrestricted AI conversations with suspects.
- A requirement for actual AI-generated video in every case.

The MVP must deliver a complete playable investigation before advanced media generation is added.

# 3. Target Users

### Primary users

- Mystery and detective-story enthusiasts.
- Students interested in logical reasoning.
- Casual gamers.
- Users who enjoy interactive storytelling.

### Secondary users

- Teachers creating fictional reasoning exercises.
- Content creators looking for interactive mystery experiences.
- Developers exploring generative AI applications.

# 4. Technology Stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React + Vite | User interface and interactions |
| Styling | Tailwind CSS | Responsive styling and design system |
| Routing | React Router | Navigation and protected routes |
| Server state | TanStack Query | API fetching, caching, and invalidation |
| Local UI state | React hooks | Modals, tabs, filters and temporary state |
| Backend | Node.js | Server runtime |
| API | Express.js | REST endpoints and middleware |
| Database | MongoDB | Persistent application data |
| ODM | Mongoose | Schemas, validation, queries |
| AI | Google Gemini API | Mystery generation and optional AI assistance |
| Authentication | JWT + bcrypt | User authentication |
| Validation | Zod | Request and AI-output validation |
| Security | Helmet, CORS, rate limiting | HTTP and API protection |
| Testing | Vitest, Supertest | Frontend and backend tests |
| Image generation | Configurable image provider | Fictional evidence images |
| Video evidence | Configurable media provider or simulation | CCTV-style evidence |

## 4.1 AI Integration Requirements

Use the official Google Gen AI SDK for Node.js and the Gemini API.

- All Gemini calls must occur on the backend.
- Read the model identifier from `GEMINI_MODEL`.
- Read the API key from `GEMINI_API_KEY`.
- Do not hardcode model identifiers throughout the application.
- Request structured JSON output when supported.
- Validate all model responses with Zod before saving them.
- Retry transient failures with a bounded retry policy.
- Enforce generation timeouts.
- Record token usage and generation status where available.
- Never assume that Gemini can directly generate every requested image or video format.

If a separate image or video provider is configured, integrate it through an abstraction layer. If it is unavailable, use an explicitly labeled simulated evidence representation.

# 5. Functional Requirements

## FR-01: Landing Page

The landing page must include:

- Application logo and name: AI Mystery Room.
- Hero section explaining the experience.
- Primary CTA: "Create a Mystery".
- Secondary CTA: "Explore Cases".
- Feature cards.
- Example mystery preview.
- How It Works section.
- Footer with About, Privacy, Terms, and Contact links.

## FR-02: Authentication

Users must be able to:

- Register using a name, email, and password.
- Log in using email and password.
- Log out.
- Access their own saved cases and history.

Requirements:

- Hash passwords using bcrypt.
- Never store plaintext passwords.
- Protect private API routes.
- Use secure cookie-based JWT authentication in production.
- Apply authentication and rate limits to relevant endpoints.

Guest mode may use a temporary anonymous session, with clearly defined persistence limitations.

## FR-03: Mystery Creation

The creation form must include:

| Field | Requirement |
|---|---|
| Scenario | Required, 50–2,000 characters |
| Mystery title | Optional |
| Genre | Required; default: Detective |
| Difficulty | Easy, Medium, Hard |
| Suspect count | 3–6 |
| Evidence richness | Standard or Detailed |
| Content rating | Teen-friendly by default |
| Preferred setting | Optional |
| Language | English for MVP |

Suggested genres:

- Classic detective.
- College mystery.
- Heist.
- Missing object.
- Locked-room mystery.
- Historical mystery.
- Corporate mystery.

The UI must show a generation progress state and prevent accidental duplicate submissions.

## FR-04: Mystery Generation

The backend must generate a complete case containing:

- Unique case ID.
- Title and description.
- Fictional setting and incident.
- Case objective.
- Suspects and character profiles.
- One predetermined culprit.
- Motives and opportunity.
- A complete event timeline.
- Evidence items.
- Evidence relationships.
- Red herrings.
- A private solution.
- A structured explanation of the solution.

Generation must be validated before the case becomes playable.

If validation fails, retry generation within configured limits or return a clear error. Never expose a partially generated case as a valid completed mystery.

## FR-05: Mystery Room

The mystery room must use a dashboard layout with:

- Case title and status.
- Case overview.
- Suspects panel.
- Evidence board.
- Timeline panel.
- Investigation notes.
- Evidence inspection modal or detail view.
- Accusation panel.
- Investigation progress indicator.

The interface should feel like a detective's investigation workspace, not a generic administration dashboard.

## FR-06: Suspect Profiles

Each suspect profile must contain:

- Name.
- Fictional portrait or avatar.
- Occupation or relationship to the incident.
- Short biography.
- Publicly available motive.
- Claimed alibi.
- Known relationships.
- Relevant evidence references.

Secret information about the culprit must remain server-side until the investigation is concluded.

The interface must not reveal the culprit through hidden text, API responses, HTML attributes, client bundles, or debug data.

## FR-07: Evidence System

Every evidence item must contain:

- Unique ID.
- Title.
- Type.
- Description.
- Content or media reference.
- Discovery location.
- Timestamp, where relevant.
- Related suspect IDs.
- Related evidence IDs.
- Reliability classification.
- Whether the evidence is essential.
- Whether the user has inspected it.
- Whether the evidence has been unlocked.

### Supported evidence types

| Type | Implementation |
|---|---|
| Chat transcript | Fictional message interface |
| Witness statement | Text document |
| CCTV | Real generated video from the configured video provider; otherwise clearly labeled simulated or unavailable |
| Photograph | Real AI-generated image from the configured image provider; explicitly labeled mock fixture in mock mode |
| Forensic report | Fictional report with internally consistent findings |
| Timeline | Event log |
| Physical clue | Image or textual description |
| Access record | Fictional time-stamped log |

All evidence must be fictional and clearly identified as AI-generated or simulated.

Do not create real-looking evidence intended to impersonate actual people, actual police records, or real private conversations.

## FR-08: Evidence Inspection

Users must be able to:

- Open and close evidence details.
- Zoom or expand supported images.
- Read message transcripts.
- Review event timestamps.
- Mark evidence as important.
- Add personal notes.
- Link evidence to a suspect.
- Track evidence they have inspected.

Evidence inspection progress must be persisted.

Optional future feature: allow users to connect evidence items on a visual deduction board.

## FR-09: Investigation Notes

Users can create, update, and delete their private notes.

Notes must be scoped to the authenticated user and case.

Notes are investigative hypotheses, not modifications to the official case facts.

## FR-10: Accusation

Before submitting the final accusation, users must:

- Select one suspect.
- Provide a written explanation of at least 20 characters.
- Optionally select supporting evidence.
- Review their accusation.
- Confirm submission.

The accusation is final for the initial MVP. Users may replay a completed case as a separate attempt if replay is enabled.

## FR-11: Verdict Evaluation

The backend compares the submitted culprit ID with the predetermined culprit ID.

The result must include:

- Correct or incorrect verdict.
- Score.
- Short feedback.
- Correct culprit's identity.
- Full case explanation.
- Relevant supporting evidence.
- Explanation of misleading clues.
- Final case status.

The verdict evaluator must not choose a new culprit using a fresh Gemini call.

The saved solution is authoritative. Gemini may generate the narrative explanation, but the backend must verify that the explanation agrees with the saved facts.

## FR-12: Dashboard and History

The user dashboard must show:

- Active investigations.
- Completed cases.
- Recent activity.
- Correct verdict rate.
- Average score.
- Case difficulty.
- Creation date.
- Continue Investigation action.
- Review Solution action.

Users must only see their own private cases unless public sharing is explicitly enabled.

## FR-13: Loading and Error States

All major workflows must have:

- Loading indicators.
- Empty states.
- Retry options.
- Validation messages.
- API failure handling.
- Timeout handling.
- Friendly notifications.
- Mobile-compatible layouts.

No page may remain indefinitely stuck in a loading state.

# 6. Mystery Generation and AI Rules

## 6.1 Canonical Mystery Structure

A mystery is generated as one complete structured object. The application must not generate suspects, clues, and the culprit independently without validating their relationships.

Use the following logical structure:

```json
{
  "title": "The Missing Prototype",
  "scenario": "A prototype disappeared after a college exhibition.",
  "genre": "college-mystery",
  "difficulty": "medium",
  "setting": {
    "location": "Fictional engineering college",
    "incidentTime": "18:30"
  },
  "incident": {
    "description": "A prototype vanished from a locked laboratory.",
    "objective": "Determine who took the prototype."
  },
  "suspects": [
    {
      "id": "suspect_1",
      "name": "Arun",
      "role": "Project team member",
      "motive": "Wanted recognition",
      "alibi": "Claims to have attended a seminar"
    }
  ],
  "timeline": [],
  "evidence": [],
  "solution": {
    "culpritId": "suspect_1",
    "motive": "The saved fictional motive",
    "method": "The saved fictional explanation",
    "reasoning": [],
    "evidenceIds": []
  }
}
```

This is an illustrative structure, not a complete valid case. Production generation must satisfy the full validation schema.

## 6.2 Gemini System Instructions

The backend must maintain a versioned prompt that instructs Gemini to:

1. Act as a fictional mystery writer and investigation designer.
2. Use the user's scenario as the foundation.
3. Create 3–6 distinct suspects.
4. Select exactly one culprit before the case becomes playable.
5. Design a consistent timeline.
6. Provide evidence that allows a careful player to infer the culprit.
7. Include plausible alternative suspects.
8. Include red herrings that can be disproved.
9. Ensure that the decisive evidence supports the actual solution.
10. Avoid contradictions that make the mystery impossible to solve.
11. Use fictional names, places, and events.
12. Avoid real accusations, actual private data, and graphic content.
13. Return only the requested structured output.
14. Never disclose the hidden solution in player-facing content.

## 6.3 Evidence Consistency Validation

Before publishing a generated case, validate:

- Every suspect ID is unique.
- Every evidence ID is unique.
- The culprit exists in the suspect list.
- Exactly one culprit is defined.
- All referenced suspects and evidence items exist.
- The timeline is logically ordered.
- Essential clues support the solution.
- The evidence is sufficient to distinguish the culprit.
- Red herrings have a plausible explanation.
- The solution does not depend on facts absent from the evidence.
- Player-facing descriptions do not reveal the culprit directly.
- All required fields are valid and within size limits.

Use deterministic backend checks for structural constraints and a bounded AI-assisted review for narrative consistency.

Reject or regenerate cases that cannot pass validation.

## 6.4 AI-Generated Media

Media generation must use separate, replaceable provider interfaces.

For example:

- `TextGenerationProvider`
- `ImageGenerationProvider`
- `VideoGenerationProvider`

The Gemini text-generation integration is mandatory. Image and video integrations are optional providers for the MVP.

For every media item, persist:

- Provider.
- Generation status.
- Prompt version.
- Storage reference.
- MIME type.
- Creation timestamp.
- Error information where appropriate.

Do not store large image or video binary files directly in MongoDB documents. Use object storage or another suitable media-storage service.

If video generation is unavailable, label the evidence as simulated or unavailable. Do not represent a slideshow as a real generated video.

### Media generation upgrade

- Use separate `ImageGenerationProvider` and `VideoGenerationProvider` contracts. Gemini remains the text provider; image and video providers are selected independently.
- The Google image adapter uses the current Gemini image-generation API. The Google video adapter uses Gemini Omni Flash via the Interactions API. Model IDs remain environment-configurable.
- Use only facts from a saved mystery and its evidence item when building media prompts. Never include the hidden solution or culprit ID. Validate AI images against those saved facts before storage; reject contradictions.
- Persist `pending`, `processing`, `ready`, `failed`, or `unavailable` state, provider/model, prompt version, storage reference, MIME type, timestamps, retry count, usage/cost when provided, and safe failure information.
- Persist media bytes in the configured storage provider, never in MongoDB. Phase 1 supports local disk storage through an abstraction; object storage can implement the same contract later.
- Queue provider calls asynchronously, retry bounded transient failures, resume pending jobs after server restart, deduplicate requests, and enforce configured per-case image count, video duration, resolution, provider timeout, and retry limits.
- Mock image output must carry a visible mock label. Simulated or unavailable video must never be returned as a real playable clip.
- Provider credentials are independent: `IMAGE_API_KEY` and `VIDEO_API_KEY` are required for their selected Google adapters. Never infer that a Gemini text key is enabled for media. `GEMINI_API_KEY` and `GEMINI_MODEL` are used separately for image fact validation when enabled.
- Provider cost may remain unknown. Record provider usage and any cost estimate returned by the provider; do not invent a cost figure.

# 7. Database Design

Use MongoDB with Mongoose.

## 7.1 User Collection

```text
User
- _id
- name
- email (unique, normalized)
- passwordHash
- role (user | admin)
- createdAt
- updatedAt
```

Never expose `passwordHash` through API responses.

## 7.2 Mystery Collection

```text
Mystery
- _id
- ownerId
- title
- scenario
- genre
- difficulty
- status (generating | playable | completed | failed)
- setting
- incident
- suspects[]
- timeline[]
- evidence[]
- solution (private)
- generationMetadata
- promptVersion
- createdAt
- updatedAt
```

The solution must be stored separately from player-facing case data at the API boundary. Prefer a separate `MysterySolution` collection with restricted access.

## 7.3 MysterySolution Collection

```text
MysterySolution
- _id
- mysteryId (unique)
- culpritId
- motive
- method
- reasoning[]
- decisiveEvidenceIds[]
- redHerringExplanations[]
- createdAt
```

Only authorized backend services may access this collection before verdict submission.

## 7.4 Investigation Collection

```text
Investigation
- _id
- userId
- mysteryId
- status (active | submitted | completed)
- inspectedEvidenceIds[]
- bookmarkedEvidenceIds[]
- suspectNotes[]
- userNotes[]
- accusation
- score
- startedAt
- submittedAt
- completedAt
- createdAt
- updatedAt
```

Enforce ownership checks for every read or mutation.

## 7.5 MediaAsset Collection

```text
MediaAsset
- _id
- mysteryId
- evidenceId
- mediaType
- provider
- model
- status (pending | processing | ready | failed | unavailable)
- mode (ai | mock | simulated | unavailable)
- dedupeKey (unique)
- storageKey
- mimeType
- sizeBytes
- durationSeconds
- eventTimestamp
- retryCount
- usage
- costUsd
- errorCode
- statusMessage
- promptVersion
- createdAt
- updatedAt
```

## 7.6 Database Indexes

Create indexes for:

- `User.email` — unique.
- `Mystery.ownerId + createdAt`.
- `Mystery.status + createdAt`.
- `MysterySolution.mysteryId` — unique.
- `Investigation.userId + updatedAt`.
- `Investigation.mysteryId + userId`.
- `MediaAsset.mysteryId + evidenceId`.

Use MongoDB transactions where supported and appropriate for operations that require atomic updates across collections.

# 8. REST API Specification

All endpoints use the `/api/v1` prefix.

Standard success response:

```json
{
  "success": true,
  "data": {}
}
```

Standard error response:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted information."
  }
}
```

Do not expose stack traces, API keys, prompts containing secrets, or internal solution data in production errors.

## 8.1 Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/auth/register` | Create account |
| POST | `/api/v1/auth/login` | Authenticate |
| POST | `/api/v1/auth/logout` | End session |
| GET | `/api/v1/auth/me` | Get current user |

## 8.2 Mystery Management

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/mysteries` | Generate a mystery |
| GET | `/api/v1/mysteries` | List the user's mysteries |
| GET | `/api/v1/mysteries/:id` | Get sanitized playable case |
| GET | `/api/v1/mysteries/:id/status` | Check generation status |
| DELETE | `/api/v1/mysteries/:id` | Delete an owned case |

The create endpoint may return HTTP `202 Accepted` and a case ID when generation runs asynchronously.

## 8.3 Investigation

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/mysteries/:id/investigations` | Start or resume an investigation |
| GET | `/api/v1/investigations/:id` | Retrieve progress |
| PATCH | `/api/v1/investigations/:id/progress` | Save inspected evidence |
| PUT | `/api/v1/investigations/:id/notes` | Save investigation notes |
| POST | `/api/v1/investigations/:id/accusations` | Submit verdict |
| GET | `/api/v1/investigations/:id/result` | Retrieve authorized result |

## 8.4 Media

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/v1/mysteries/:id/evidence/:evidenceId/media` | Queue image or video generation from saved case facts |
| GET | `/api/v1/mysteries/:id/media` | List generation status for an owned case |
| POST | `/api/v1/media/:assetId/retry` | Retry a failed asset within configured limits |
| GET | `/api/v1/media/:assetId/content` | Stream a ready asset after ownership verification |

The generation endpoint returns HTTP `202 Accepted` and an asset ID. Media endpoints require authentication and mystery ownership checks. Content is served from configured media storage; storage paths are never returned to clients.

## 8.5 API Rules

- Validate request bodies, query parameters, and route IDs.
- Enforce ownership on every private resource.
- Sanitize returned case objects.
- Never return the private solution during an active investigation.
- Reject verdict submission for an unplayable or already-submitted investigation.
- Prevent duplicate submissions and double scoring.
- Apply rate limits to generation and authentication endpoints.
- Return consistent HTTP status codes.
- Document request and response schemas.

# 9. Scoring System

Use a deterministic scoring algorithm for the MVP.

Suggested score out of 100:

| Criterion | Points |
|---|---:|
| Correct culprit | 60 |
| Evidence-based explanation | 25 |
| Appropriate supporting evidence | 15 |
| Total | 100 |

Scoring rules:

- An incorrect culprit receives zero points for culprit identification.
- The explanation score is computed from structured evidence references and a deterministic rubric where possible.
- If an AI-assisted explanation evaluator is introduced, constrain its output to a validated rubric and never allow it to change the correct culprit.
- The maximum score is 100.
- Each investigation receives one final score.
- The UI must explain how the score was calculated.

# 10. Frontend Design Specification

## 10.1 Visual Direction

Use a premium detective-investigation interface.

**Design characteristics:**

- Dark navy or charcoal backgrounds.
- Muted amber accents.
- Off-white text for readability.
- Subtle borders and shadows.
- Evidence cards resembling investigation folders.
- Timeline visualizations.
- Clean typography and clear hierarchy.
- Restrained animations.
- Responsive layouts for desktop, tablet, and mobile.

Avoid excessive neon, distracting animations, and cluttered dashboard layouts.

## 10.2 Required Pages

1. `/` — Landing page.
2. `/login` — Login.
3. `/register` — Registration.
4. `/dashboard` — User dashboard.
5. `/mysteries/new` — Mystery creation.
6. `/mysteries/:id` — Mystery overview.
7. `/mysteries/:id/investigate` — Investigation workspace.
8. `/investigations/:id/result` — Final verdict and solution.
9. `/profile` — User profile and preferences.
10. `/not-found` — Not-found experience.

## 10.3 UI Components

Create reusable components:

- `Navbar`
- `Footer`
- `MysteryCard`
- `SuspectCard`
- `SuspectProfile`
- `EvidenceCard`
- `EvidenceViewer`
- `ChatTranscript`
- `CCTVViewer`
- `Timeline`
- `InvestigationBoard`
- `NotesPanel`
- `AccusationForm`
- `VerdictResult`
- `GenerationProgress`
- `ConfirmDialog`
- `Toast`
- `LoadingSkeleton`
- `ErrorState`
- `EmptyState`

Each component must have a clear responsibility and appropriate loading, error, and empty states.

## 10.4 Accessibility and Responsiveness

- Use semantic HTML.
- Provide keyboard navigation.
- Label form controls.
- Use accessible dialog behavior.
- Provide text alternatives for images.
- Do not rely on color alone to convey evidence importance.
- Support narrow mobile screens.
- Respect reduced-motion preferences.
- Ensure sufficient text contrast.

# 11. Backend Architecture

Organize the backend by feature and responsibility.

```text
server/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── env.js
│   │   └── ai.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Mystery.js
│   │   ├── MysterySolution.js
│   │   ├── Investigation.js
│   │   └── MediaAsset.js
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── mystery.controller.js
│   │   └── investigation.controller.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── mystery.service.js
│   │   ├── generation.service.js
│   │   ├── evidence.service.js
│   │   ├── verdict.service.js
│   │   └── media.service.js
│   ├── providers/
│   │   ├── gemini.provider.js
│   │   ├── image.provider.js
│   │   └── video.provider.js
│   ├── validators/
│   │   ├── auth.schema.js
│   │   ├── mystery.schema.js
│   │   └── investigation.schema.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── error.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── validate.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── mystery.routes.js
│   │   └── investigation.routes.js
│   ├── utils/
│   ├── app.js
│   └── server.js
├── tests/
├── .env.example
└── package.json
```

Frontend structure:

```text
client/
├── src/
│   ├── api/
│   ├── assets/
│   ├── components/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── mystery/
│   │   └── investigation/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── utils/
│   ├── App.jsx
│   └── main.jsx
├── public/
├── tests/
└── package.json
```

# 12. Environment Configuration

Create `.env.example` files for the backend and frontend.

Backend configuration:

```dotenv
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb://127.0.0.1:27017/ai_mystery_room
GEMINI_API_KEY=
GEMINI_MODEL=
JWT_SECRET=
COOKIE_NAME=mystery_session
IMAGE_PROVIDER=mock
IMAGE_API_KEY=
IMAGE_MODEL=gemini-3.1-flash-image
IMAGE_RESOLUTION=1K
VIDEO_PROVIDER=simulation
VIDEO_API_KEY=
VIDEO_MODEL=gemini-omni-1.1-flash
VIDEO_RESOLUTION=720p
VIDEO_MAX_DURATION_SECONDS=8
MEDIA_STORAGE_PROVIDER=local
MEDIA_STORAGE_DIR=./storage/media
MEDIA_MAX_RETRIES=2
MEDIA_PROVIDER_TIMEOUT_MS=600000
MEDIA_MAX_IMAGES_PER_MYSTERY=3
MEDIA_VALIDATE_IMAGES=true
MEDIA_MAX_ASSET_BYTES=52428800
```

Frontend configuration:

```dotenv
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

Rules:

- Never commit real `.env` files.
- Add `.env` to `.gitignore`.
- Use a sufficiently strong, randomly generated JWT secret.
- Validate required environment variables at startup.
- Do not prefix private API keys with `VITE_`.
- Document provider-specific configuration.
- Do not assume a production database or media-storage provider is available without configuration.

# 13. Security, Privacy, and Reliability

Codex must implement the following requirements:

1. Password hashing and authentication.
2. Secure session handling.
3. Ownership checks on private resources.
4. Input validation and output sanitization.
5. Request-size limits.
6. Rate limiting and abuse protection.
7. CORS restricted to configured origins.
8. Helmet security headers.
9. Protection against NoSQL injection.
10. Safe handling of generated HTML and media URLs.
11. Timeouts and bounded retries for AI calls.
12. Protection against duplicate generation jobs.
13. Private solution isolation.
14. Safe logging without secrets or sensitive content.
15. Clear disclosure that investigations and evidence are fictional.
16. User-controlled deletion of private cases and investigation history.

Treat user scenarios and generated model output as untrusted data. Do not execute generated code, HTML, or scripts.

# 14. Error Handling

Use consistent error codes, including:

- `VALIDATION_ERROR`
- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `MYSTERY_GENERATION_FAILED`
- `MYSTERY_VALIDATION_FAILED`
- `AI_PROVIDER_UNAVAILABLE`
- `RATE_LIMIT_EXCEEDED`
- `INVESTIGATION_ALREADY_SUBMITTED`
- `INVALID_INVESTIGATION_STATE`
- `MEDIA_GENERATION_FAILED`
- `INTERNAL_SERVER_ERROR`

Errors must have clear user-facing messages and safe diagnostic details in server logs.

If Gemini is unavailable, do not fabricate a successful AI-generated case. Show a recoverable error or offer a clearly labeled demo case.

# 15. Testing Requirements

## 15.1 Unit Tests

Test:

- Request validation.
- Mystery schema validation.
- Culprit uniqueness.
- Evidence references.
- Timeline consistency.
- Solution isolation.
- Scoring calculations.
- Verdict evaluation.
- Ownership checks.
- Error formatting.

## 15.2 Integration Tests

Test:

- Registration and login.
- Mystery creation with a mocked Gemini provider.
- AI output validation.
- Persistence in MongoDB.
- Evidence retrieval.
- Progress and notes saving.
- Correct verdict submission.
- Incorrect verdict submission.
- Unauthorized access attempts.
- Duplicate submissions.
- Provider failure and timeout behavior.

## 15.3 End-to-End Tests

Verify the following user journey:

1. Open the website.
2. Create an account.
3. Create a mystery.
4. Wait for generation.
5. Open the investigation.
6. Inspect evidence.
7. Save notes.
8. Submit a culprit.
9. View the result.
10. Return to the dashboard.
11. Verify that the completed case remains available.

## 15.4 Mocking Policy

Tests must not depend on paid Gemini calls.

Use a deterministic mock provider with predefined mystery fixtures. Keep at least one optional integration test for a real Gemini API connection.

Media integration tests use mock providers by default. Real image/video tests are opt-in, require their respective provider credentials, may incur provider charges, and never run as part of the default test command.

# 16. Acceptance Criteria

The MVP is complete only when every critical criterion below passes.

- [ ] The project starts locally using documented Windows instructions.
- [ ] Frontend and backend run independently.
- [ ] MongoDB connection and health checks work.
- [ ] Registration, login, and logout work.
- [ ] A user can submit a scenario and generate a mystery.
- [ ] Generated cases pass structural validation.
- [ ] Every playable case has exactly one predetermined culprit.
- [ ] The case has 3–6 suspects.
- [ ] Evidence contains valid suspect and evidence references.
- [ ] The solution is not exposed by public case APIs.
- [ ] The investigation workspace displays all required panels.
- [ ] Evidence inspection progress is saved.
- [ ] User notes persist after refresh.
- [ ] The user can submit a final accusation.
- [ ] Correct and incorrect accusations are evaluated deterministically.
- [ ] The final solution includes evidence-based reasoning.
- [ ] Completed investigations appear in the dashboard.
- [ ] Users cannot access another user's private investigation.
- [ ] API keys and passwords are not exposed to the frontend.
- [ ] Loading, empty, and error states are implemented.
- [ ] Automated tests pass.
- [ ] The README includes complete setup instructions.
- [ ] The `.env.example` files are complete.
- [ ] No major button or navigation link is nonfunctional.

- A configured image provider can generate, fact-check, and store real fictional image evidence.
- A configured video provider can generate and store real video evidence; case event timestamps are shown in the evidence UI.
- Media generation state is persisted and reflected in the UI, including loading, failure, retry, simulated, and unavailable states.
- Provider failures leave the mystery and evidence available.
- Image and video keys are separate server-only settings and are never sent to the client.
- Mock images and simulated/unavailable video are clearly labeled; a simulation is never presented as real video.
- Duplicate valid assets are reused; per-case image count, clip duration, resolution, timeout, and retry limits are enforced.
- Provider usage and returned cost are stored when available.

Actual generation remains provider-dependent. If a provider is unconfigured, the MVP must clearly label its mock or unavailable state.

# 17. Definition of Done

A feature is considered done only when:

1. Its specification is satisfied.
2. Its implementation follows the project architecture.
3. Input and output validation are implemented.
4. Relevant automated tests pass.
5. Loading and error states are handled.
6. Security and ownership requirements are satisfied.
7. Documentation is updated.
8. The feature has been verified locally or its untested integrations are explicitly documented.

Codex must not claim that an external AI provider, media generator, or deployment integration works unless it has actually been tested.

# 18. Spec-Driven Development Rules for Codex

This document is the single source of truth for product requirements.

Codex must follow these rules:

1. Read `SPEC.md` before starting any implementation task.
2. Read `README.md` and existing project code before modifying files.
3. Convert the requirements into a phased implementation plan.
4. Maintain a `TASKS.md` checklist and update it as work is completed.
5. Implement one coherent feature at a time.
6. Write or update tests for every important feature.
7. Use the specified API contracts and database models.
8. Never expose the private solution to an active investigation.
9. Never replace the saved culprit during verdict evaluation.
10. Never silently substitute mock AI output for a real AI integration.
11. If a feature is mocked, label it clearly and document its limitations.
12. Do not introduce additional frameworks or services without a clear need.
13. Do not delete existing functionality without justification.
14. Run tests and relevant build checks after changes.
15. Fix regressions before marking tasks complete.
16. Update this specification when an approved requirement changes.
17. Record unresolved questions and technical limitations in `DECISIONS.md`.
18. Do not mark untested functionality as complete.

### Requirement change process

When a new feature is requested:

1. Identify the affected requirement.
2. Update `SPEC.md`.
3. Update the implementation plan.
4. Update database schemas and API contracts if necessary.
5. Implement the change.
6. Update tests and documentation.
7. Verify that existing acceptance criteria still pass.

Do not let the implementation silently diverge from the specification.

# 19. Required Repository Documentation

The repository must contain:

```text
AI-Mystery-Room/
├── SPEC.md
├── README.md
├── TASKS.md
├── DECISIONS.md
├── .gitignore
├── client/
└── server/
```

- `SPEC.md`: Authoritative product and technical requirements.
- `README.md`: Installation, environment setup, startup, and troubleshooting.
- `TASKS.md`: Implementation checklist and progress.
- `DECISIONS.md`: Approved architectural decisions and known limitations.
- `.gitignore`: Secrets, dependencies, generated files, and local configuration.

# 20. Recommended Implementation Phases

**Phase 1 — Foundation**

Set up React, Express, MongoDB, environment validation, health checks, shared error handling, and project documentation.

**Phase 2 — Authentication**

Implement registration, login, logout, secure session handling, and ownership middleware.

**Phase 3 — Mystery Generation**

Implement the Gemini provider, generation prompts, structured output validation, consistency checks, and persistence of private solutions.

**Phase 4 — Investigation UI**

Build the dashboard, suspect profiles, evidence viewer, timeline, notes, and progress persistence.

**Phase 5 — Verdict and Scoring**

Implement final accusations, deterministic culprit evaluation, scoring, and solution explanations.

**Phase 6 — Media and Polish**

Implement image/video provider interfaces, real generation where configured, fact validation, asynchronous status persistence, media storage and retry controls, explicit mock/simulation labels, responsive evidence playback, animations, and accessibility.

**Phase 7 — Testing and Release**

Run unit, integration, and end-to-end tests. Fix defects and finalize Windows setup instructions.

Each phase must be independently verifiable before proceeding to the next.

# 21. Initial Codex Execution Instruction

After saving this document as `SPEC.md`, use the following instruction in Codex:

> Read `SPEC.md` completely and treat it as the authoritative specification for AI Mystery Room. Inspect the existing repository before making changes. Create or update `TASKS.md`, `README.md`, and `DECISIONS.md` as needed. First produce a phased implementation plan, identify any blocking ambiguities, and list the files you intend to create or modify. Then implement Phase 1 only, including the React/Vite frontend foundation, Express backend foundation, MongoDB configuration, environment validation, health endpoint, error handling, and documentation. Use the exact stack and architectural boundaries in `SPEC.md`. Do not expose Gemini secrets in the frontend. Add appropriate tests, run the relevant checks, report their actual results, and update `TASKS.md`. Do not implement later phases until the current phase has been verified.

After Phase 1 passes, instruct Codex to implement each subsequent phase according to Section 20.

# 22. Final Product Principle

AI Mystery Room must deliver a fair, logically consistent, and engaging investigation—not simply a collection of AI-generated text.

**The backend owns the truth. The evidence supports the truth. The user discovers the truth.**

The generated culprit, timeline, evidence, and solution must remain consistent throughout the complete user journey. This principle takes precedence over decorative features, unnecessary complexity, and unverified AI capabilities.
