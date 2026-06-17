# Club Finance

Club Finance is a full-stack expense-splitting platform built for student organizations, robotics teams, clubs, and volunteer groups. Members can create groups, log shared expenses, split costs equally or by custom amounts, and see exactly who owes whom — with automatic debt simplification to minimize the number of payments needed to settle up.

---

## Features

- **Authentication** — register, log in, update your profile; sessions secured with JWT
- **Groups** — create a group, share its ID for others to join, or invite members by email; three roles: Owner, Treasurer, Member
- **Expenses** — add expenses with a description, amount, and category (Food, Travel, Equipment, Events, Other)
- **Splitting** — choose Equal, Custom dollar amounts, or Percentage splits per expense
- **Balance engine** — calculates each member's net balance in real time
- **Debt simplification** — converts complex multi-person debts into the minimum set of payments
- **Settlements** — record payments and mark debts as paid

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma |
| Database | PostgreSQL |
| Validation | Zod |
| Auth | JWT + bcryptjs |
| Frontend | React, TypeScript, Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Routing | React Router v6 |
| HTTP client | Axios |

---

## Prerequisites

Make sure you have the following installed before starting:

- [Node.js](https://nodejs.org/) v18 or higher
- [npm](https://www.npmjs.com/) v9 or higher
- [Docker](https://www.docker.com/) (for running Postgres locally)
- [Git](https://git-scm.com/)

---

## Getting started

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-username/club-finance.git
cd club-finance
```

---

### Step 2 — Start the database

The project ships with a `docker-compose.yml` that starts a local Postgres instance. From the project root:

```bash
docker compose up -d
```

This starts Postgres on port `5432` with:

- **Database**: `club_finance`
- **Username**: `clubfinance`
- **Password**: `clubfinance`

To verify it's running:

```bash
docker compose ps
```

To stop it later:

```bash
docker compose down
```

---

### Step 3 — Configure the backend

```bash
cd backend
cp .env.example .env
```

Open `.env` and fill in the values:

```env
DATABASE_URL="postgresql://clubfinance:clubfinance@localhost:5432/club_finance?schema=public"
JWT_SECRET="replace-this-with-a-long-random-string"
PORT=4000
```

> **Tip:** generate a strong `JWT_SECRET` with `openssl rand -base64 48`

---

### Step 4 — Install backend dependencies and run migrations

```bash
npm install
npx prisma migrate dev --name init
```

`prisma migrate dev` does three things automatically:
1. Reads `prisma/schema.prisma` and creates all database tables
2. Runs `prisma generate` to produce the typed Prisma client
3. Seeds the migration history

You should see output like:

```
Your database is now in sync with your schema.
✔ Generated Prisma Client
```

---

### Step 5 — Start the backend dev server

```bash
npm run dev
```

The API will be running at `http://localhost:4000`. You can verify it with:

```bash
curl http://localhost:4000/health
# {"status":"ok"}
```

---

### Step 6 — Install and start the frontend

Open a new terminal, then:

```bash
cd ../frontend
npm install
npm run dev
```

The app will open at `http://localhost:5173`.

> By default, the frontend expects the API at `http://localhost:4000/api`. To use a different URL, create a `.env` file in the `frontend/` folder:
>
> ```env
> VITE_API_URL=https://your-api-domain.com/api
> ```

---

## Project structure

```
club-finance/
├── docker-compose.yml          # Local Postgres
├── README.md
│
├── backend/
│   ├── prisma/
│   │   └── schema.prisma       # Database schema (User, Group, Expense, Settlement…)
│   └── src/
│       ├── index.ts            # Express app entry point
│       ├── prisma.ts           # Prisma client singleton
│       ├── middleware/
│       │   ├── auth.ts         # JWT verification
│       │   └── group.ts        # Group membership + role checks
│       ├── routes/
│       │   ├── auth.ts         # /api/auth/*
│       │   ├── groups.ts       # /api/groups/*
│       │   ├── expenses.ts     # /api/groups/:id/expenses/*
│       │   └── balances.ts     # /api/groups/:id/balances + settlements
│       └── utils/
│           ├── split.ts        # Equal / custom / percentage split logic
│           └── balance.ts      # Balance engine + debt simplification
│
└── frontend/
    └── src/
        ├── App.tsx             # Routes
        ├── api/client.ts       # Axios instance with auth header
        ├── store/auth.ts       # Zustand auth store (persisted to localStorage)
        ├── components/
        │   ├── Navbar.tsx
        │   └── ProtectedRoute.tsx
        └── pages/
            ├── LoginPage.tsx
            ├── RegisterPage.tsx
            ├── ProfilePage.tsx
            ├── GroupsPage.tsx       # Create / join / list groups
            └── GroupDetailPage.tsx  # Expenses, splits, balances, settlements
```

---

## API reference

All endpoints except `POST /api/auth/register` and `POST /api/auth/login` require:

```
Authorization: Bearer <token>
```

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | Create a new account |
| POST | `/api/auth/login` | Log in and receive a token |
| GET | `/api/auth/me` | Get the current user |
| PATCH | `/api/auth/me` | Update name or password |

### Groups

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups` | Create a group (you become OWNER) |
| GET | `/api/groups` | List groups you belong to |
| GET | `/api/groups/:groupId` | Group details with member list |
| POST | `/api/groups/:groupId/join` | Join a group by ID |
| POST | `/api/groups/:groupId/invite` | Add a user by email (Treasurer+) |
| PATCH | `/api/groups/:groupId/members/:memberId` | Change a member's role (Treasurer+) |
| DELETE | `/api/groups/:groupId/members/:memberId` | Remove a member (Treasurer+) |

### Expenses

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/groups/:groupId/expenses` | Add an expense |
| GET | `/api/groups/:groupId/expenses` | List all expenses |
| GET | `/api/groups/:groupId/expenses/:id` | Get a single expense |
| PUT | `/api/groups/:groupId/expenses/:id` | Edit an expense (recomputes shares) |
| DELETE | `/api/groups/:groupId/expenses/:id` | Delete an expense |

**Example request body for a new expense:**

```json
{
  "description": "Pizza Night",
  "amount": 60,
  "category": "Food",
  "paidById": "<user-uuid>",
  "splitType": "EQUAL",
  "participants": ["<user-a-uuid>", "<user-b-uuid>", "<user-c-uuid>"]
}
```

For `CUSTOM` split, add `"customAmounts": { "<uuid>": 30, "<uuid>": 20, "<uuid>": 10 }`.
For `PERCENTAGE` split, add `"percentages": { "<uuid>": 50, "<uuid>": 25, "<uuid>": 25 }`.

### Balances & Settlements

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/groups/:groupId/balances` | Net balance per member |
| GET | `/api/groups/:groupId/settlements/suggested` | Minimum payments to settle all debts |
| GET | `/api/groups/:groupId/settlements` | Settlement history |
| POST | `/api/groups/:groupId/settlements` | Record a payment |
| PATCH | `/api/groups/:groupId/settlements/:id` | Mark a settlement as paid |

---

## How the balance engine works

Given this example:

- Aryaa paid $60 for pizza, split equally between Aryaa, Anastasiia, and Seb ($20 each)

The engine calculates:

```
Aryaa:  +60 (paid) − 20 (her share) = +40   ← is owed
Sebastian:   −20                            ← owes
Anastasiia:  −20                            ← owes
```

Debt simplification then produces:

```
Anastasiia → Aryaa  $20
Sebastian  → Aryaa  $20
```

With multiple expenses and people, the algorithm collapses all debts into the fewest possible payments using a greedy max-creditor / max-debtor approach.

---

## Deployment

The project is ready to deploy on the following recommended services:

| Part | Service | Notes |
|---|---|---|
| Frontend | [Vercel](https://vercel.com) | Connect the `frontend/` folder; set `VITE_API_URL` in environment variables |
| Backend | [Railway](https://railway.app) | Connect the `backend/` folder; set `DATABASE_URL`, `JWT_SECRET`, `PORT` |
| Database | [Neon](https://neon.tech) | Copy the connection string into `DATABASE_URL`; run `npx prisma migrate deploy` |

---

## Troubleshooting

**`prisma generate` fails with a network error**
Prisma needs to download engine binaries from `binaries.prisma.sh`. If you're in a restricted network environment, ensure that domain is reachable, or use the `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` env variable as a last resort.

**Port already in use**
Change `PORT` in `backend/.env` or kill the conflicting process with `lsof -ti:4000 | xargs kill`.

**CORS errors in the browser**
The backend allows all origins in development. If you deploy and see CORS errors, set the `CORS_ORIGIN` environment variable to your frontend URL and update `src/index.ts` accordingly.

**Database connection refused**
Make sure Docker is running and the Postgres container is healthy: `docker compose ps`. If the port is already taken by a local Postgres install, change the host port in `docker-compose.yml` (e.g. `"5433:5432"`) and update `DATABASE_URL` to match.

---

## Roadmap

Future features planned for subsequent versions:

- Receipt upload and OCR auto-parsing (Cloudinary + Tesseract)
- Email notifications (invitations, debt reminders, monthly reports)
- Real-time updates via WebSockets
- Analytics dashboard with charts (Recharts)
- Budget tracking and projected spend
- Expense approval workflow for treasurers
- Activity feed
- CSV / Excel / PDF export
- Full-text search across expenses and members
- Organization layer (e.g. a university containing multiple clubs)
- Progressive Web App (installable on mobile)
- AI assistant ("how much did we spend on robot parts?")
- Admin dashboard

---
