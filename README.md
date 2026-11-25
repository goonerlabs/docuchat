# DocuChat

DocuChat is the capstone project of the Mastering Backend **AI Engineering bootcamp** (cohort 3).
At the end of the bootcamp, a user uploads documents and asks questions about them (RAG, an agent, an MCP server).

This repository grows week by week. Each week builds on the last one.

## Progress

| Week | Lesson | Contents | Status |
|---|---|---|---|
| 1 | Introduction to AI engineering | Concepts only (LLMs, tokens, context, sampling) | No code |
| 2, day 1 | Project architecture and setup | Layered architecture, Express, config with Zod, Pino logs | Done |
| 2, day 2 | Database layer and migrations | PostgreSQL, Prisma, User model, repository, migrations | Done |
| 2, day 3 | Authentication, authorization, events | JWT access and refresh tokens, bcrypt, middleware, EventEmitter | Done |
| 3 and later | API design, Redis, documents, RAG, agents | | Not started |

## The architecture

Layered architecture: four layers, and each layer calls only the layer below it.

```
HTTP request
   │
   ▼
routes/         Layer 1  Connects a URL and a method to a controller. No logic.
   │
   ▼
controllers/    Layer 2  The only layer that knows HTTP (req, res, status codes).
   │
   ▼
services/       Layer 3  Business logic. Plain data in, plain data out. No req, no Prisma.
   │
   ▼
repositories/   Layer 4  The only layer that talks to the database.
```

| Folder | Contents |
|---|---|
| `src/routes/` | `auth`, `user`, `admin` routes |
| `src/controllers/` | `auth`, `user` controllers |
| `src/services/` | `auth` (register, login, refresh, logout), `user` |
| `src/repositories/` | `user`, `refresh-token`, `usage-log`, `conversation` |
| `src/middleware/` | `authenticate`, `authorize`, `validate`, `error-handler` |
| `src/lib/` | `config` (Zod), `logger` (Pino), `prisma` (one client), `tokens`, `password`, `events`, `errors` |
| `src/events/` | `auth.events`: the event names and the listeners |
| `src/schemas/` | Zod schemas for the request bodies |
| `src/jobs/` | Background jobs (empty until week 3) |
| `prisma/` | `schema.prisma`, the migrations, `seed.ts` |
| `tests/` | Vitest and Supertest tests |

## How to run it

You need Node.js 22 or later, and Docker (for the database).

```bash
npm install                 # also runs "prisma generate"
cp .env.example .env        # then put two secrets in .env (see below)
npm run db:up               # starts PostgreSQL 18 in Docker, on port 5442
npm run db:deploy           # applies the migrations
npm run dev                 # starts the API on http://localhost:3000
```

Make each JWT secret with this command. The two secrets must be different.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If a variable in `.env` is missing or wrong, the application stops at the start and says which one.

Other commands:

| Command | What it does |
|---|---|
| `npm test` | Runs the tests against the database `docuchat_test` |
| `npm run typecheck` | Checks the types |
| `npm run db:migrate -- --name add_something` | Makes and applies a new migration after a schema change |
| `npm run db:studio` | Opens Prisma Studio in the browser |
| `npm run db:seed` | Makes an admin user from `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` |

## The API

| Method | Path | Access | What it does |
|---|---|---|---|
| GET | `/health` | Public | `{ status, timestamp, environment }` |
| POST | `/api/v1/auth/register` | Public | Makes a user. Body: `name`, `email`, `password` |
| POST | `/api/v1/auth/login` | Public | Returns `accessToken`, `refreshToken`, `user` |
| POST | `/api/v1/auth/refresh` | Public | Body: `refreshToken`. Returns two new tokens. The old refresh token stops |
| POST | `/api/v1/auth/logout` | Public | Body: `refreshToken`. Deletes it from the database |
| GET | `/api/v1/users/me` | Access token | The profile of the user |
| GET | `/api/v1/admin/users` | Access token, role `admin` | The list of users |

An error always has this format: `{ "error": "message", "code": "CODE" }`.

Try the full flow:

```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","password":"Test1234!"}'

# Login: returns { accessToken, refreshToken, user }
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test1234!"}'

# A protected route
curl http://localhost:3000/api/v1/users/me -H 'Authorization: Bearer ACCESS_TOKEN'

# Refresh
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H 'Content-Type: application/json' -d '{"refreshToken":"REFRESH_TOKEN"}'

# Logout
curl -X POST http://localhost:3000/api/v1/auth/logout \
  -H 'Content-Type: application/json' -d '{"refreshToken":"REFRESH_TOKEN"}'
```

## How authentication works

- **Two tokens.** The access token lives 15 minutes and goes with each request. The refresh token lives 7 days and has one job: to get a new access token.
- **Two secrets.** A refresh token cannot pass as an access token. The middleware also checks the `type` claim.
- **Rotation.** Each refresh deletes the old refresh token and stores a new one, in one transaction.
- **Reuse detection.** If a refresh token with a correct signature is not in the database, it was used before. All sessions of that user stop.
- **Hash, not token.** The database holds the SHA-256 hash of the refresh token.
- **Passwords.** bcrypt with 12 rounds. Login gives one message, "Invalid credentials", for an unknown email and for a wrong password.

## How events work

`auth.service` does the main work and then emits an event. The listeners in `src/events/auth.events.ts` do the side effects:

| Event | Listeners |
|---|---|
| `auth:user-registered` | A sign-up row in `UsageLog`; a "Welcome to DocuChat" conversation |
| `auth:user-logged-in` | A login row in `UsageLog` with the device |
| `auth:login-failed` | A warning in the log |
| `auth:token-refreshed`, `auth:user-logged-out` | A log line |

Each listener runs in a `try/catch` wrapper. A failed side effect never fails the registration or the login.

## Where this project differs from the lesson notes

| Lesson notes | This project | Why |
|---|---|---|
| `provider = "prisma-client-js"`, the URL in `schema.prisma` | Prisma 7: `prisma-client`, the URL in `prisma.config.ts`, the `pg` driver adapter | Prisma 7 changed the setup |
| SQLite in the checklist, PostgreSQL in the code | PostgreSQL in Docker | One database from development to production; week 4 needs pgvector |
| `JWT_SECRET` (day 1), then two secrets (day 3) | `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`, checked to be different | Day 3 replaces day 1 |
| The service calls Prisma | The service calls a repository | The day 1 layer rule: only repositories talk to the database |
| The token `role` holds the tier | The token holds `role` and `tier` | Role = what you may do. Tier = the plan you pay for |
| `console.error` in the listeners | The Pino logger | Day 1: structured logs, not `console.log` |
| Routes under `/api/auth` | `/api/v1/auth` | The day 1 app uses `/api/v1` |
| No random ID in the refresh token | A `jti` claim | Two logins in the same second gave the same token and broke the unique rule |
| Register takes `email`, `password` | Also `name` | The `User` model needs a name |

The answers to the defense questions are in [docs/DEFENSE.md](docs/DEFENSE.md).
