<p align="center">
  <img src="client/public/mystery-room-logo.png" alt="AI Mystery Room gold magnifying glass logo" width="280" />
</p>

<h1 align="center">AI Mystery Room</h1>
<p align="center"><strong>Solve • Investigate • Uncover</strong></p>

AI Mystery Room is a full-stack detective game for creating and solving fictional cases. Players inspect evidence, compare timelines and alibis, record private theories, submit an accusation, and review a scored verdict against the case’s saved solution.

## Features

- Account registration and sign-in with HTTP-only session cookies.
- Gemini-powered mystery generation with schema and consistency validation.
- Private case archive and investigation progress saved in MongoDB.
- Suspect profiles, chronological timeline, evidence inspection, bookmarks, notes, and clue-to-suspect associations.
- Progressive optional hints and server-scored final accusations.
- Final verdict review with culprit, motive, method, decisive and misleading clues, and suspect exclusions.
- Optional evidence media workflow with clearly identified mock, simulated, unavailable, and AI-generated states.
- Responsive dark detective-themed interface with gold accents.

## Screenshots

Screenshots are not included in this checkout yet. Before publishing, capture the application in a browser and add genuine screenshots under `docs/screenshots/` (for example, the case archive, an active investigation, and a final verdict). Embed those files here with relative Markdown image paths so GitHub renders them from the repository.

## Technology

| Area | Technology |
| --- | --- |
| Client | React 19, Vite 7, React Router, TanStack Query, Tailwind CSS 4 |
| Server | Node.js (ES modules), Express 5, Mongoose 9, Zod |
| Accounts | bcryptjs password hashing, JWT in HTTP-only cookies |
| AI | Google `@google/genai` SDK, configured server-side |
| Tests | Vitest, Supertest, Node test runner for opt-in provider checks |

## Project structure

```text
client/
  src/                 React app, routes, API client, and styles
  tests/               Client unit tests
server/
  src/routes/          Express API routes
  src/services/        Mystery, investigation, and media logic
  src/models/          MongoDB/Mongoose models
  src/providers/       Text and media provider adapters
  tests/               Server unit and opt-in integration tests
  storage/             Local generated media (ignored by Git)
package.json           Workspace commands
spec.md                Product specification
TASKS.md                Implementation checklist and verification notes
DECISIONS.md            Architecture and product decisions
```

## Prerequisites

- Windows 10/11 (instructions below), macOS, or Linux.
- Node.js **22.12 or newer** and npm.
- MongoDB running locally or a reachable MongoDB deployment.
- A Google AI Studio API key and a compatible Gemini model to generate mysteries. These are not needed just to install the project or run its deterministic unit tests.
- Visual Studio Code is optional.

## Windows and VS Code setup

Open PowerShell in the project folder. Create local environment files only if they do not already exist; this preserves any existing developer settings:

```powershell
if (-not (Test-Path server/.env)) { Copy-Item server/.env.example server/.env }
if (-not (Test-Path client/.env)) { Copy-Item client/.env.example client/.env }
code .
```

Edit `server/.env` locally. Set `MONGODB_URI` to your MongoDB connection string and replace the `JWT_SECRET` placeholder with a randomly generated secret of at least 32 characters (use a password manager or another trusted local generator). Set `GEMINI_API_KEY` and `GEMINI_MODEL` to enable mystery generation. Never paste real credentials into source files, this README, a `VITE_*` variable, or a public issue.

For a local MongoDB installation, the example URI uses the `ai_mystery_room` database on `127.0.0.1`. Start the MongoDB service before launching the app. For MongoDB Atlas or another hosted database, use its connection string, URL-encode special characters in credentials, and restrict network access to trusted addresses.

The client defaults to `http://localhost:5000/api/v1`. Change `VITE_API_BASE_URL` in `client/.env` only when the API is hosted at another URL. Client `VITE_*` values are public and become part of the browser bundle; secrets belong only in the server environment.

Install workspaces and run both development servers from the repository root:

```powershell
npm install
npm run dev
```

Open <http://localhost:5173>. The API defaults to <http://localhost:5000>. You can run either server separately with `npm run dev:client` or `npm run dev:server`.

## Environment variables

The tracked examples contain placeholders and safe local defaults only. The actual local `.env` files are ignored.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | Yes to start the server | MongoDB connection string. |
| `JWT_SECRET` | Yes to start the server | Session signing secret; minimum 32 characters. |
| `NODE_ENV` | Optional; `development` | Runtime mode. |
| `PORT` | Optional; `5000` | Express server port. |
| `CLIENT_URL` | Optional; `http://localhost:5173` | Allowed client origin for CORS and origin checks. |
| `COOKIE_NAME` | Optional; `mystery_session` | Session cookie name. |
| `GEMINI_API_KEY` | Needed for mystery generation and image validation; optional at startup | Server-side Google AI Studio key. |
| `GEMINI_MODEL` | Needed for mystery generation and image validation; optional at startup | Gemini model supporting the structured response used by the app. |
| `GEMINI_TIMEOUT_MS` | Optional; `120000` | Mystery generation timeout in milliseconds. |
| `GEMINI_MAX_RETRIES` | Optional; `1` | Bounded generation retry count. |
| `IMAGE_PROVIDER` | Optional; `mock` | `mock` or `google`. |
| `IMAGE_API_KEY` | Optional; blank | Google image key override; otherwise uses `GEMINI_API_KEY`. |
| `IMAGE_MODEL` | Optional; `gemini-nano-banana-2.1` | Google image model. |
| `IMAGE_RESOLUTION` | Optional; `1K` | `512`, `1K`, `2K`, or `4K`. |
| `VIDEO_PROVIDER` | Optional; `simulation` | `simulation`, `google`, or `disabled`. |
| `VIDEO_API_KEY` | Optional; blank | Google video key override; otherwise uses `GEMINI_API_KEY`. |
| `VIDEO_MODEL` | Optional; `gemini-omni-1.1-flash` | Google video model. |
| `VIDEO_RESOLUTION` | Optional; `720p` | Requested Google video resolution. |
| `VIDEO_MAX_DURATION_SECONDS` | Optional; `8` | Prompt duration constraint, 3–10 seconds. |
| `MEDIA_STORAGE_PROVIDER` | Optional; `local` | Currently supports local storage. |
| `MEDIA_STORAGE_DIR` | Optional; `./storage/media` | Local media directory, relative to the server working directory. |
| `MEDIA_MAX_RETRIES` | Optional; `2` | Media retry limit. |
| `MEDIA_PROVIDER_TIMEOUT_MS` | Optional; `600000` | Media provider timeout in milliseconds. |
| `MEDIA_MAX_ASSET_BYTES` | Optional; `52428800` | Maximum stored media size. |
| `MEDIA_MAX_IMAGES_PER_MYSTERY` | Optional; `3` | Per-case image request limit. |
| `MEDIA_VALIDATE_IMAGES` | Optional; `true` | Validate live generated images against case facts. |
| `VITE_API_BASE_URL` | Optional; `http://localhost:5000/api/v1` | Public client API URL; never store secrets here. |

`MONGODB_URI` and `JWT_SECRET` are validated at server startup. Gemini credentials are optional for server startup but case creation returns a configuration error until a key and model are set. With `IMAGE_PROVIDER=google`, supply `IMAGE_API_KEY` or `GEMINI_API_KEY`; if `MEDIA_VALIDATE_IMAGES=true`, image fact validation additionally needs `GEMINI_API_KEY` and `GEMINI_MODEL`. With `VIDEO_PROVIDER=google`, supply `VIDEO_API_KEY` or `GEMINI_API_KEY`.

Two test-only opt-in variables are also read by integration tests: `RUN_MONGO_INTEGRATION=true` enables MongoDB persistence integration tests, and `RUN_MEDIA_PROVIDER_INTEGRATION=true` enables live Google media tests when the matching provider configuration is selected. Both default to off.

## Available npm scripts

These commands are defined in the root and workspace `package.json` files:

| Command | Description |
| --- | --- |
| `npm run dev` | Run client and server together in development. |
| `npm run dev:client` | Start the Vite client only. |
| `npm run dev:server` | Start the Node server in watch mode. |
| `npm run build` | Build the client for production. |
| `npm test` | Run the server unit/API suite, then the client suite. |
| `npm run dev --workspace=client` | Client development server (workspace equivalent). |
| `npm run build --workspace=client` | Client production build. |
| `npm run preview --workspace=client` | Preview an existing client build. |
| `npm run test --workspace=client` | Run client tests. |
| `npm start --workspace=server` | Start the server without watch mode. |
| `npm run test --workspace=server` | Run server unit/API tests. |
| `npm run test:mongo:integration --workspace=server` | Run opt-in MongoDB persistence integration tests. |
| `npm run test:media:integration --workspace=server` | Run opt-in live Google media provider tests. |

The MongoDB integration test is opt-in with `RUN_MONGO_INTEGRATION=true` and performs cleanup of the test records it creates. Use a disposable/test database for integration tests. Live Google media tests require explicit opt-in, provider configuration, account access, and may incur provider charges.

## API overview

All routes are under `/api/v1`. Health routes are public; account, case, investigation, and media routes require the signed-in user’s HTTP-only session cookie unless noted otherwise.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Process liveness. |
| `GET /health/ready` | Database readiness. |
| `POST /auth/register` | Create an account. |
| `POST /auth/login` | Start a session. |
| `POST /auth/logout` | End the session. |
| `GET /auth/me` | Return the current account. |
| `POST /mysteries` | Generate and save a validated mystery. |
| `GET /mysteries` | List the signed-in user’s case archive and investigation summaries. |
| `GET /mysteries/:id` | Get an owned playable mystery’s public case facts. |
| `POST /mysteries/:mysteryId/investigations` | Start or resume the owner’s investigation for a mystery. |
| `GET /investigations/:id` | Read owned investigation progress and public case facts. |
| `PATCH /investigations/:id/progress` | Save inspection, bookmark, and clue/suspect association state. |
| `PUT /investigations/:id/notes` | Save private notes and theory. |
| `POST /investigations/:id/hints` | Request the next available hint. |
| `POST /investigations/:id/accusations` | Submit and score a final accusation. |
| `GET /investigations/:id/result` | Read the verdict and saved solution after submission. |
| `GET /mysteries/:mysteryId/media?evidenceId=...` | List generated media for an owned case, optionally filtered by evidence. |
| `POST /mysteries/:mysteryId/evidence/:evidenceId/media` | Request image or video evidence. |
| `POST /mysteries/:mysteryId/media/:assetId/retry` | Retry a failed media generation. |
| `GET /mysteries/:mysteryId/media/:assetId/content` | Stream ready media for an owned case. |

The private solution is stored separately from public case facts. Investigation routes check ownership, and the result endpoint withholds the solution until a final accusation has been submitted. API errors use a consistent JSON error envelope with a safe message/code and request reference where available.

## Media modes and limitations

The default free/local configuration is `IMAGE_PROVIDER=mock` and `VIDEO_PROVIDER=simulation`:

- Mock image mode produces a clearly labeled SVG fixture, not an AI-generated case photograph.
- Simulated video mode reports video unavailable. It does not create a video or present a slideshow as CCTV footage.
- `VIDEO_PROVIDER=disabled` disables video generation. Google image/video providers require deliberate server-side configuration and an eligible model/account. Check Google access, quota, and billing before enabling them.
- Local media files and metadata are stored under the configured server storage path (defaults to `server/storage/media`) and are excluded from Git. They are runtime artifacts, not portfolio source assets.

## Security

- Keep `server/.env` private. Never commit credentials or expose them via a `VITE_*` variable.
- Use a unique, strong `JWT_SECRET`; rotate any credential that may have been exposed.
- Restrict MongoDB network access and use a database account with appropriate permissions.
- Production deployments should use HTTPS and a correctly configured `CLIENT_URL`/cookie setup.
- Generated media and local database files are ignored by Git; back them up separately if you need to retain them.
- Review repository history and GitHub secret-scanning results before publishing. `.gitignore` prevents future additions but does not remove a secret already present in history.

## Troubleshooting

- **MongoDB connection error:** confirm the local service is running or the hosted URI/network access is correct; check that the database URI is only in `server/.env`.
- **Mystery generation is not configured:** set both `GEMINI_API_KEY` and a compatible `GEMINI_MODEL` in `server/.env`, then restart the server.
- **Browser cannot reach the API / CORS error:** verify the server port, `VITE_API_BASE_URL`, and that `CLIENT_URL` matches the client origin; restart Vite after editing its environment.
- **Port is already in use:** stop the existing process or change `PORT` and the client API URL consistently.
- **Media is labeled mock, simulated, or unavailable:** this is expected with the default provider settings. It does not indicate a live AI media result.
- **Build/test configuration error on Windows:** client Vite commands use Node's native config loader to avoid esbuild's config-bundling filesystem access issue. Use Node 22.12+ and run commands from the repository root.

## Implementation and verification status

Implemented: account flows, case generation and validation, private case storage, archive, investigation progress and notes, evidence board and timeline, hints, accusation scoring, verdict review, and the authenticated media workflow with explicit provider labels.

Still requiring environment-specific verification before a public release: live Gemini model/key access; live Google image/video generation, quota, and output behavior; MongoDB integration on the intended deployment; and browser end-to-end testing on the target browsers. Unit tests use mocks and do not prove live provider access. The implementation checklist and architecture notes are in [`TASKS.md`](TASKS.md) and [`DECISIONS.md`](DECISIONS.md).

The client Vite scripts use the native configuration loader because the default esbuild config bundler fails to resolve the config in this Windows workspace. Latest local verification: `npm test` passed all 54 server tests and all 12 client tests, and `npm run build` completed successfully. Live Google provider access, MongoDB integration, and browser end-to-end behavior still require environment-specific verification.
