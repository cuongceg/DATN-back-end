# DATN Backend

Express + PostgreSQL backend implementing authentication, users, and class management APIs.

## Tech Stack

- Node.js
- Express.js
- PostgreSQL
- pg (raw parameterized queries)
- bcrypt
- jsonwebtoken

## Project Structure

- init.sql: Database schema and relationships
- src/config/db.js: PostgreSQL pool setup
- src/middleware/auth.middleware.js: JWT auth + RBAC middleware
- src/controllers: API controller logic
- src/routes: Route definitions
- src/app.js: Express app setup
- src/server.js: Server entrypoint

## Prerequisites

- Node.js 18+
- PostgreSQL 13+

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment config from .env.local values and set your real credentials.

3. Start PostgreSQL with Docker Compose (recommended):

```bash
docker compose up -d
```

This will create a PostgreSQL container and automatically execute init.sql on first startup.

4. Initialize database:

```bash
psql -d datn_backend -f init.sql
```

You can skip this manual step if you are using Docker Compose for PostgreSQL and the database is fresh.

5. Run server:

```bash
npm run dev
```

Or production mode:

```bash
npm start
```

## Environment Variables

- PORT: API server port
- DATABASE_URL: PostgreSQL connection string
- JWT_SECRET: Secret key for signing JWT
- JWT_EXPIRES_IN: JWT lifetime (example: 7d)

## API Base URL

- http://localhost:3000

## Docker Commands

Start PostgreSQL:

```bash
docker compose up -d
```

Stop PostgreSQL:

```bash
docker compose down
```

Reset PostgreSQL data volume and re-run init.sql:

```bash
docker compose down -v
docker compose up -d
```

## Endpoints

### Auth

- POST /api/auth/register
- POST /api/auth/login

### Users

- DELETE /api/users/:id (admin only)

### Classes

Teacher only:
- POST /api/classes
- GET /api/classes
- PUT /api/classes/:id
- DELETE /api/classes/:id
- POST /api/classes/:id/members

Student only:
- POST /api/classes/:id/join

## Authorization

Use bearer token in request header:

```http
Authorization: Bearer <jwt_token>
```

## Notes

- Passwords are stored using bcrypt hashes.
- JWT payload includes user id and role.
- Ownership checks are enforced for teacher class updates/deletes/member management.
- Duplicate email and duplicate class membership are handled gracefully.
