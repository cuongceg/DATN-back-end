# DATN Backend

Express + PostgreSQL backend for a live-class platform with real-time video sessions, file storage, transcripts, and subtitle preferences.

## Tech Stack

- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: PostgreSQL 16 (raw parameterized queries via `pg`)
- **Object Storage**: MinIO
- **Real-time Video**: LiveKit
- **Auth**: bcrypt + jsonwebtoken
- **Validation**: express-validator
- **Search**: Fuse.js
- **Docs**: Swagger UI (swagger-ui-express)

## Project Structure

```
src/
├── app.js                        # Express app setup
├── server.js                     # Server entrypoint
├── config/
│   ├── db.js                     # PostgreSQL pool
│   └── livekit.js                # LiveKit client config
├── controllers/                  # Route handlers
├── middleware/
│   ├── auth.middleware.js        # JWT auth + RBAC
│   └── validate.middleware.js   # Request validation
├── models/
│   └── reaction.model.js
├── routes/                       # Route definitions
├── services/                     # Business logic + external integrations
│   ├── files.service.js
│   ├── livekit.service.js
│   ├── minio.client.js
│   ├── posts.service.js
│   ├── reaction.service.js
│   ├── recording.service.js
│   ├── session.service.js
│   ├── subtitlePreferences.service.js
│   └── transcript.service.js
├── suggestion/
│   ├── loader.js
│   └── search.js
└── docs/
    └── openapi.js                # OpenAPI spec
```

## Prerequisites

- Node.js 18+
- Docker + Docker Compose (recommended)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Copy `.env.local` to `.env` and fill in your credentials:

```bash
cp .env.local .env
```

Required variables — see [Environment Variables](#environment-variables) below.

### 3. Start all services (backend + PostgreSQL + MinIO)

```bash
docker compose up -d
```

This builds the backend image and starts PostgreSQL (with `init.sql` auto-applied) and MinIO.

### 4. Run in development mode (without Docker for the app)

```bash
docker compose up -d postgres minio   # start only dependencies
npm run dev                           # start backend with nodemon
```

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | API server port (default: `3000`) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret key for signing JWTs |
| `JWT_EXPIRES_IN` | JWT lifetime (e.g. `7d`) |
| `LIVEKIT_URL` | LiveKit server WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `MINIO_ENDPOINT` | MinIO host |
| `MINIO_PORT` | MinIO port (default: `9000`) |
| `MINIO_ACCESS_KEY` | MinIO access key |
| `MINIO_SECRET_KEY` | MinIO secret key |
| `MINIO_USE_SSL` | Use SSL for MinIO (`true`/`false`) |
| `POSTGRES_USER` | PostgreSQL username (Docker only) |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker only) |
| `POSTGRES_DB` | PostgreSQL database name (Docker only) |

## API Base URL

```
http://localhost:3000
```

## API Documentation (Swagger)

- Swagger UI: `http://localhost:3000/api-docs`
- OpenAPI JSON: `http://localhost:3000/api-docs.json`

## Authorization

All protected endpoints require a Bearer token in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

JWT payload includes `id` and `role` (`teacher`, `student`, or `admin`).

## Endpoints

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive JWT |

### Users

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users/search?query=<keyword>` | Any | Search users by full name |
| DELETE | `/api/users/:id` | Admin | Delete a user |

### Classes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/classes` | Teacher | Create a class |
| GET | `/api/classes` | Any | List classes for the caller |
| GET | `/api/classes/:id` | Any | Get class details |
| PUT | `/api/classes/:id` | Teacher | Update class info |
| PATCH | `/api/classes/:id/archive` | Teacher | Archive a class |
| PATCH | `/api/classes/:id/activate` | Teacher | Re-activate a class |
| DELETE | `/api/classes/:id` | Teacher | Delete a class |
| POST | `/api/classes/join` | Student | Join a class by code |
| POST | `/api/classes/:id/members` | Teacher | Add a student |
| POST | `/api/classes/:id/members/bulk` | Teacher | Bulk-add students |
| PATCH | `/api/classes/:id/members/:userId/role` | Teacher | Update member role |
| DELETE | `/api/classes/:id/members/:userId` | Teacher | Remove a member |

### Sessions (Live Video)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/sessions` | Any | Create a session |
| GET | `/api/sessions/my` | Any | List my sessions |
| GET | `/api/sessions/class/:classId` | Any | Sessions for a class |
| GET | `/api/sessions/:sessionId` | Any | Get session details |
| PATCH | `/api/sessions/:sessionId` | Any | Update session |
| DELETE | `/api/sessions/:sessionId` | Any | Delete session |
| PATCH | `/api/sessions/:sessionId/start` | Any | Start a session |
| PATCH | `/api/sessions/:sessionId/end` | Any | End a session |
| PATCH | `/api/sessions/:sessionId/leave` | Any | Leave a session |
| POST | `/api/sessions/:sessionId/token` | Any | Join session (get LiveKit token) |
| GET | `/api/sessions/:sessionId/participants` | Any | List participants |
| GET | `/api/sessions/:sessionId/messages` | Any | Get chat messages |
| POST | `/api/sessions/:sessionId/messages` | Any | Send a chat message |

### Recordings & Transcripts

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/sessions/:sessionId/recordings/start` | Teacher | Start recording |
| POST | `/api/sessions/:sessionId/recordings/stop` | Teacher | Stop recording |
| GET | `/api/classes/:classId/recordings` | Teacher, Student | List recordings for a class |
| POST | `/api/sessions/:sessionId/recordings/:egressId/transcript` | Teacher | Save transcript |
| GET | `/api/sessions/:sessionId/recordings/:egressId/transcript` | Teacher, Student | Get transcript |

### Posts

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/posts` | Teacher, Student | Create a post |
| GET | `/api/posts/class/:classId` | Teacher, Student | List posts in a class |
| GET | `/api/posts/:postId` | Teacher, Student | Get a post |
| PATCH | `/api/posts/:postId` | Teacher, Student | Update a post |
| DELETE | `/api/posts/:postId` | Teacher, Student | Delete a post |

### Reactions

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/sessions/:sessionId/reactions` | Any | Set a reaction |
| DELETE | `/api/sessions/:sessionId/reactions` | Any | Clear a reaction |
| GET | `/api/sessions/:sessionId/reactions` | Any | List reactions |

### Files

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/files/class/:classId/content` | Teacher | Create folder or upload file (max 50 MB) |
| GET | `/api/files/class/:classId/content` | Teacher, Student | List files/folders under a path |
| GET | `/api/files/class/:classId/download` | Teacher, Student | Download file by path |
| DELETE | `/api/files/class/:classId/content` | Teacher, Student | Delete file or folder |

### Subtitle Preferences (Student only)

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/me/subtitle-preferences` | Get my subtitle preferences |
| PUT | `/api/users/me/subtitle-preferences` | Create or update subtitle preferences |
| GET | `/api/users/me/subtitle-presets` | List my subtitle presets |
| POST | `/api/users/me/subtitle-presets` | Create a subtitle preset |
| DELETE | `/api/users/me/subtitle-presets/:presetId` | Delete a subtitle preset |

### Suggestions

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/suggestions` | Any | Get search suggestions |

### Webhooks

| Method | Path | Description |
|---|---|---|
| POST | `/api/webhooks/livekit` | LiveKit event webhook (no auth) |

## Docker Commands

```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# Reset data volumes and re-initialize
docker compose down -v && docker compose up -d

# View logs
docker compose logs -f backend
```

## Notes

- Passwords are stored as bcrypt hashes.
- JWT payload contains `id` and `role`.
- Teachers own their classes; ownership is enforced for updates, deletes, and member management.
- Duplicate email registration and duplicate class membership are handled gracefully.
- `class_members.permission` allows values: `Member`, `Owner`.
- Files are stored in MinIO; paths are organized per class.
- LiveKit is used for real-time video sessions; the backend issues access tokens on join.
