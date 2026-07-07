# Smart Prompt: Shared Expense Tracker (Not a Loan Tracker)

Build a modern, production-ready, full-stack web application called
**Shared Expense Tracker**.

This application is **NOT** a loan management system. It is a personal
expense-sharing tracker where **I am usually the one paying first**,
and the application automatically computes how much each participant
owes me. Balances are receivables owed to me, not generic loans
between arbitrary parties.

## Tech Stack

### Frontend

- React.js (Vite)
- Tailwind CSS
- React Router
- Axios (with interceptors for auth refresh + centralized error handling)
- React Hook Form + Zod (schema validation)
- TanStack Table
- TanStack Query (server state / caching, avoids manual loading-state spaghetti)
- Chart.js

### Backend

- Django
- Django REST Framework
- SimpleJWT (access + refresh tokens, rotation, blacklist on logout)
- MySQL
- Celery + Redis (background jobs: reminder emails, report generation, receipt processing)
- drf-spectacular (OpenAPI/Swagger auto-generated docs)

### Infrastructure / DevOps

- Docker + docker-compose (frontend, backend, MySQL, Redis, Celery worker)
- `.env`-based configuration (never commit secrets)
- GitHub Actions CI (lint, test, build on PR)
- Pre-commit hooks (black, isort, flake8, eslint, prettier)

## Core Concept

I pay for purchases. The system computes how much each selected
participant owes me for that purchase. **My own share is always
excluded from receivables** — I never owe myself.

### Example

Expense: Date: July 7, 2026 — Paid By: Aaron

| Item    | Price | Participants      |
|---------|------:|--------------------|
| Tomato  |    30 | Aaron, Mac, Luis   |
| Eggs    |   180 | Aaron, Luis        |
| Chicken |   300 | Mac, Luis          |

Computed balances:
- Mac owes: Tomato (10) + Chicken (150) = **160**
- Luis owes: Tomato (10) + Eggs (90) + Chicken (150) = **250**

### Rounding rule (must be explicit)

Equal splits don't always divide evenly (e.g., ₱100 split 3 ways = 33.33...).
Define and implement a clear rule up front:
- Compute each share to 2 decimal places using standard rounding.
- Add/subtract the leftover centavo(s)/cent(s) to **my own share**
  (never to a participant's share) so the sum of all shares always
  equals the item price exactly.
- Store amounts as `DecimalField` (never `float`) to avoid floating-point
  drift in financial data.

## Features

### Authentication & Users
- Register / login / logout, JWT access + refresh, password reset via email
- Optional: Google OAuth login

### Friends
- CRUD for friends/contacts
- Soft delete (friends tied to historical expenses shouldn't disappear from past records)

### Expenses
- Multi-item expenses, each item with its own participant list
- Split types per item: **equal**, **custom amount**, **percentage**, **by quantity/units**
- Validation: for custom/percentage/quantity splits, shares must sum to exactly the item price / 100% / total quantity — reject and show a clear error otherwise
- Edit/delete an expense recalculates all affected receivables (and should be blocked or handled carefully if a related payment already exists — see below)
- Categories per expense (Food, Transport, Utilities, etc.)

### Receivables
- Auto-generated per participant per expense based on the split
- Outstanding balance dashboard per friend, and an overall total-owed-to-me figure

### Payments
- Record partial or full payments from a friend
- A single payment can be **allocated across multiple receivables** (oldest-first or manual allocation)
- Payment history per friend
- Prevent a payment allocation from exceeding the receivable balance

### Editing/Deleting Expenses with Existing Payments
- Define the policy explicitly: e.g., disallow deleting an expense that has payments applied without first reversing those payments, or cascade-adjust with an audit trail. This is a common gap — decide now, not during a bug report.

### Dashboard & Reports
- Total owed to me (overall + per friend)
- Trends over time (Chart.js: monthly spend, top categories, top debtors)
- Export to CSV/PDF

### Receipts
- Upload image/PDF per expense (stored in S3-compatible storage or local media in dev)
- Thumbnail preview in UI

### Notifications (recommended addition)
- Optional email/reminder to a friend when their balance crosses a threshold or on a schedule (via Celery beat)

### UI/UX
- Responsive, mobile-first
- Dark mode
- Empty states, loading skeletons, optimistic UI updates for payments/expenses
- Toast notifications for success/error feedback

## Database (expanded)

- **User** — id, email, password hash, name, created_at
- **Friend** — id, owner (User FK), name, email/phone (optional), is_active (soft delete), created_at
- **Category** — id, name, owner (User FK or global default set)
- **Expense** — id, owner (User FK), date, description, category (FK), paid_by (defaults to owner), total_amount, receipt (file FK/URL), created_at
- **ExpenseItem** — id, expense (FK), name, price, split_type (enum: equal/custom/percentage/quantity)
- **ExpenseParticipant** — id, expense_item (FK), friend (FK, nullable if it's the owner's own share), share_value (amount/percentage/quantity depending on split_type), computed_amount (Decimal)
- **Receivable** — id, expense (FK), friend (FK), amount_owed, amount_paid, status (unpaid/partial/paid), created_at
- **Payment** — id, friend (FK), amount, date, method (cash/bank/gcash/etc.), notes
- **PaymentAllocation** — id, payment (FK), receivable (FK), amount_allocated

Add appropriate `unique_together`, `on_delete` behavior (prefer `PROTECT`
or soft-delete over `CASCADE` for financial records), and DB indexes on
foreign keys and `date` fields used for filtering/reporting.

## API

RESTful, versioned under `/api/v1/`, paginated (limit/offset or cursor),
filterable/sortable where relevant (e.g., expenses by date range, friend,
category). Endpoints for:

- Authentication (login, refresh, logout, password reset)
- Friends (CRUD)
- Expenses (CRUD, nested items/participants in one payload)
- Receivables (list, filter by friend/status)
- Payments (create, list, allocate)
- Dashboard (summary aggregates)
- Reports (export)

Standardize error response shape (e.g., `{ "detail": "...", "code": "..." }`)
and use consistent HTTP status codes. Document everything via
drf-spectacular's auto-generated Swagger UI.

## Non-Functional Requirements

- **Security**: input validation/sanitization, rate limiting on auth
  endpoints, CORS locked to known origins, HTTPS in production, secrets
  via environment variables only
- **Testing**: pytest + DRF test client for backend (unit tests for split
  calculation logic are critical — this is the core business logic and
  the easiest place to introduce silent money-math bugs); Jest + React
  Testing Library for frontend; at least one end-to-end flow test (e.g.,
  Playwright/Cypress) covering "create expense → verify receivable →
  record payment → verify balance"
- **Performance**: dashboard aggregates should be computed via DB
  aggregation (not pulled into Python and summed), with caching for
  expensive report queries
- **Data integrity**: wrap expense + item + participant + receivable
  creation in a single DB transaction so a partial failure never leaves
  orphaned records

## Development Phases

1. Project setup, Docker environment, authentication
2. Friends and expense management (incl. split-calculation unit tests)
3. Automatic computations, receivables, and payments (incl. partial
   allocation logic)
4. Dashboard, reports, charts, notifications
5. UI polishing, full test coverage, CI pipeline, deployment

Build this as a production-ready SaaS with clean architecture, reusable
components, secure APIs, excellent UX, and scalable code — prioritizing
correctness of the money-splitting logic above all else, since that's
the core value of the app.
