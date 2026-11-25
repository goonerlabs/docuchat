# Defense notes

Short answers to the defense questions of each lesson, in my own words.

## Week 2, day 1: architecture and setup

**The architecture in one sentence.** A request goes down through four layers: the route finds the controller, the controller translates HTTP, the service makes the decisions, and the repository talks to the database.

**A Prisma query in a controller: what is the problem?** The controller then knows HTTP and the database. A change to one query means a search through all controllers. With a repository, I change one function in one file.

**Why does the service not get `req`?** With `req`, the service depends on Express. I could not call it from a test, a background job or a CLI without a false request. Plain data in, plain data out works from each of them.

**When is clean architecture better?** A large application that lives for years, with a team of 10 or more, where the framework or the database can change. The interfaces at each boundary then pay for themselves. For one developer and six weeks they only slow the work.

**Why `process.exit(1)` and not a warning?** Example: `DATABASE_URL` is missing. With a warning, the server starts, `/health` says "ok", and the first user gets an error 30 seconds later. A stop at the start shows the problem at once, to the developer and not to a user.

**What does `z.coerce.number()` do?** `process.env.PORT` is the string `"3000"`. `coerce` changes it to the number `3000` and refuses a value that is not a number. Without it, the config type is a string and each use needs `parseInt`.

**When does `OPENAI_API_KEY` become required?** In week 4, with the first LLM call. If I forget, the application starts without the key and fails at the first chat request of a user.

**Pino, not `console.log`: three differences.** JSON lines that tools can search. Levels, so production can drop `debug`. Asynchronous writes that do not block the event loop.

**Why not `pino-pretty` in production?** It runs in a worker thread, formats each line and adds colour codes. That costs CPU, and log tools cannot read coloured text. They read JSON.

**The error handler before the routes?** Express runs middleware in the order of `app.use`. An error goes to the next error handler after the point where it happened. A handler before the routes is never reached.

**What is `/health` for?** A load balancer, the deploy script and an uptime monitor call it to know if the instance can take traffic. In week 3 it gets a database check (`SELECT 1`) and a Redis check.

**Why `app.ts` and `server.ts`?** A test imports `app` and sends requests with Supertest. No port opens, so tests do not fight for a port.

## Week 2, day 2: database

**Normalization in one sentence.** Each fact is in one place. Example: if `Document` also held the user's email, a change of email would need an update in each document, and one missed row gives two emails for one user.

**Why `cuid()` and not auto-increment?** An ID like 1547 tells an attacker the number of rows and the next ID. A cuid is unique with no central counter. Auto-increment is fine for an internal table that nobody sees, where a small key and insert order help.

**`deletedAt`, not `isDeleted`.** The time says when the row was deleted, which helps an audit and a clean-up job. The filter: `WHERE "deletedAt" IS NULL`.

**SQL injection.** The input `' OR '1'='1` closes the string and adds a condition that is always true, so the query returns each user. Prisma sends `SELECT ... WHERE "email" = $1` and the value apart from it. The database never reads the value as SQL. `$queryRaw` with string concatenation loses this protection. The test `user-repository.test.ts` proves the safe behaviour.

**Why is `findByEmail` in the repository?** The service says what it needs; the repository knows how to get it. With Prisma in the services, a change of ORM touches each service.

**The N+1 problem.** 20 documents, then one query for the chunks of each document: 1 + 20 = 21 queries. `findMany({ include: { chunks: true } })` gets all of it in one step.

**The pool is full.** With 5 connections and 10 requests, 5 run and 5 wait. A request that waits longer than `pool_timeout` (10 s) fails with a timeout error.

**A required column on a table with 1,000 rows.** The old rows have no value, so the migration fails. Step 1: add the column as optional or with a default, and fill the old rows. Step 2: a second migration makes it required.

**What does a teammate run?** `npx prisma migrate dev` (or `migrate deploy`). Without it, their database does not have the new tables and the code fails at the first query.

**One PrismaClient.** One client = one pool. Two clients = two pools, and the total can go over the connection limit of the database.

**The database is down at the start.** Prisma connects at the first query, not at the start, so the application starts and the first query fails. In week 3, `/health` checks the database, so the instance gets no traffic while the database is down.

**Query logs.** In development I want to see the SQL. In production, each request writes several lines: more disk, more cost, and the real problems are harder to find.

## Week 2, day 3: authentication and events

**Why two tokens?** A JWT cannot be revoked. A short access token limits the damage of a stolen one to 15 minutes. The refresh token is in the database, so I can revoke it.

**Why 15 minutes and 7 days?** 15 minutes is the worst-case window for a stolen access token. 7 days is how long a user stays logged in without a password. Shorter is safer; longer is more comfortable.

**Why a hash of the refresh token?** A copy of the database then holds no usable token. SHA-256 is sufficient here because the token is long and random; bcrypt is for short passwords that a person chooses.

**Why bcrypt and not SHA-256 for passwords?** SHA-256 is fast: billions of tries a second on a GPU. bcrypt is slow on purpose and has a salt, so the same password gives a different hash for each user.

**Timing attack.** A normal string comparison stops at the first wrong character, so the response time leaks how much was correct. `bcrypt.compare` takes the same time. Login also runs a compare against a dummy hash for an unknown email, so the two cases take the same time.

**The same error for wrong email and wrong password.** Two messages tell an attacker which emails have an account.

**Why events?** `register()` does one thing. A failed side effect does not fail the registration. A new side effect is a new listener, with no change to `register()`. The user does not wait.

**A listener throws.** For an async listener, the rejected promise is unhandled and can stop the process. Each listener here runs in the `safeListener` wrapper, which catches the error and logs it.

**Events or a queue?** An event: under a second, and it is acceptable if it fails. A queue (BullMQ): slow work, or work that must retry, like a 100-page PDF or embeddings.
