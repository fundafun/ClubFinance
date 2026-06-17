# Club Finance — MVP

A Splitwise-style expense tracker for student clubs and organizations. This is the **core MVP** covering the heart of the original 28-feature spec: auth, groups, expenses, splitting, balances, debt simplification, and settlements.

## What's included

- **Auth**: register/login, JWT, bcrypt (via `bcryptjs`), protected routes, profile editing
- **Groups**: create/join, roles (`OWNER`, `TREASURER`, `MEMBER`), invite by email, role management
- **Expenses**: add/edit/delete, categories, notes
- **Splitting**: equal, custom amounts, percentage — with cent-accurate rounding
- **Balance engine**: net balance per member
- **Debt simplification**: greedy min-transactions algorithm
- **Settlements**: record payments, mark as paid, view history
- **Frontend**: React + TypeScript + Tailwind + Zustand + React Router, hitting the API above

## What's NOT included (future work)

Receipts/OCR, email notifications, real-time WebSocket updates, analytics/charts, budgets, approval workflows, activity feed, exports, search, organization hierarchy, PWA, AI features, admin dashboard, and full DevOps (a Postgres compose file is included for local dev only).

## Stack

- **Backend**: Node.js, Express, TypeScript, Prisma, PostgreSQL, Zod, JWT, bcryptjs
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, React Router, Zustand, Axios

## Setup

### 1. Database

```bash
docker compose up -d
```

Starts Postgres on `localhost:5432`, database `club_finance`, user/pass `clubfinance`/`clubfinance`.

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: DATABASE_URL to match docker-compose creds, JWT_SECRET to a random string
npm install
npx prisma migrate dev --name init
npm run dev
```

API runs on `http://localhost:4000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs on `http://localhost:5173`. Expects the API at `http://localhost:4000/api` (override with `VITE_API_URL`).

## API overview

All routes except `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in |
| GET | `/api/auth/me` | Current user |
| PATCH | `/api/auth/me` | Update name/password |
| POST | `/api/groups` | Create group (creator = OWNER) |
| GET | `/api/groups` | List my groups |
| GET | `/api/groups/:groupId` | Group details + members |
| POST | `/api/groups/:groupId/join` | Join a group by ID |
| POST | `/api/groups/:groupId/invite` | Invite by email (treasurer+) |
| PATCH | `/api/groups/:groupId/members/:memberId` | Change role (treasurer+) |
| DELETE | `/api/groups/:groupId/members/:memberId` | Remove member (treasurer+) |
| POST | `/api/groups/:groupId/expenses` | Add expense (with split) |
| GET | `/api/groups/:groupId/expenses` | List expenses |
| GET/PUT/DELETE | `/api/groups/:groupId/expenses/:id` | Get/edit/delete expense |
| GET | `/api/groups/:groupId/balances` | Net balance per member |
| GET | `/api/groups/:groupId/settlements/suggested` | Debt-simplified payment plan |
| GET | `/api/groups/:groupId/settlements` | Settlement history |
| POST | `/api/groups/:groupId/settlements` | Record a payment |
| PATCH | `/api/groups/:groupId/settlements/:id` | Mark settlement paid |

## Splitting logic (`src/utils/split.ts`)

- **EQUAL**: divides amount evenly, distributing leftover cents one at a time
- **CUSTOM**: per-user dollar amounts, validated to sum to the total
- **PERCENTAGE**: per-user percentages (must sum to 100), converted to amounts with cent-accurate rounding

## Balance & settlement logic (`src/utils/balance.ts`)

- `computeBalances`: payer is credited the full amount, each participant is debited their share
- `simplifyDebts`: greedy max-debtor-to-max-creditor matching, producing the minimum number of payments to settle all balances

## Notes on this environment

`prisma generate` requires downloading engine binaries from `binaries.prisma.sh`. This was unreachable in the sandbox used to build this project. Run `npx prisma generate` (or `npx prisma migrate dev`, which runs it automatically) once you have normal network access — this resolves Prisma's generated types for `Prisma.Decimal` and query results.
