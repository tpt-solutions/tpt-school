# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Non-standard versions

This project uses **Next.js 16.2.6**, **Prisma 7**, and **shadcn v4 with Base UI** — all with breaking changes from their commonly-known APIs. Read `node_modules/next/dist/docs/` before writing Next.js code.

## Commands

```bash
npm run dev       # Start dev server on http://localhost:3000
npm run build     # Production build
npm run lint      # ESLint
npx tsc --noEmit  # Type-check without building
npx prisma generate           # Regenerate Prisma client after schema changes
npx prisma migrate dev        # Run migrations (reads prisma.config.ts)
npx prisma studio             # Browse database
```

## Architecture

### Stack
- **Next.js 16** App Router, `src/app/` directory
- **Prisma 7** ORM with SQLite (`prisma/schema.prisma`, config in `prisma.config.ts`)
- **shadcn v4** components (Base UI, not Radix) in `src/components/ui/`
- **Custom credential auth** — no NextAuth at runtime; bcrypt + session tokens in DB

### Key conventions broken from previous versions

**Prisma 7:**
- `DATABASE_URL` lives in `prisma.config.ts` (`datasource.url`), NOT in `schema.prisma`
- Generator: `provider = "prisma-client"` (not `prisma-client-js`)
- Client generated at `src/generated/prisma/client.ts`, imported as `@/generated/prisma/client`
- Requires a driver adapter — `new PrismaClient()` with no args throws at runtime. Use `PrismaBetterSqlite3` from `@prisma/adapter-better-sqlite3`:
  ```ts
  const adapter = new PrismaBetterSqlite3({ url: resolvedDbPath })
  new (PrismaClient as any)({ adapter }) as PrismaClient
  ```
  See `src/lib/db.ts` for the full singleton setup.

**shadcn v4 / Base UI:**
- `asChild` prop does NOT exist on `Button` — use `buttonVariants` instead:
  ```tsx
  // Wrong:  <Button asChild><Link href="...">text</Link></Button>
  // Right:  <Link href="..." className={buttonVariants({ variant: 'outline' })}>text</Link>
  ```
- `Select.onValueChange` is `(value: string | null, ...) => void`, not `(value: string) => void`:
  ```tsx
  // Always guard: onValueChange={(v) => { if (v !== null) setState(v) }}
  // Or:           onValueChange={(v) => setState(v ?? '')}
  ```

### Auth system (`src/lib/auth.ts`)
Custom session auth. Cookie name: `tpt_session` (httpOnly, 7-day). Key exports:
- `getSession()` → `SessionUser | null` — use in Server Components
- `requireSession()` → `SessionUser` — redirects to `/login` if unauthenticated
- `requireRole(roles[])` → `SessionUser` — redirects to `/unauthorized` if wrong role
- `signIn(email, password)`, `signOut()`

`SessionUser` type: `{ id, email, name, role, avatar }`. Roles: `admin | teacher | parent | student`.

Middleware (`src/middleware.ts`) protects all routes except `/login`, `/setup`, `/unauthorized`. Root `/` redirects to `/dashboard`.

### Route structure
```
src/app/
  (dashboard)/          # Route group — all authenticated pages share layout.tsx
    layout.tsx           # Sidebar + header shell
    dashboard/           # Home
    students/            # CRUD + [id] profile
    staff/               # CRUD + [id] profile + leave requests
    classes/             # CRUD + [id] detail (enrolments, timetable, gradebooks)
    attendance/          # Roll marking (/roll/[classId]) + reports
    grades/              # Gradebook list + [id] grade entry
    timetable/           # Weekly grid
    behaviour/           # Incidents, suspensions, exits, truancy alerts
    finance/             # Invoices + fee types + payments
    communication/       # Notices + messages
    reports/             # Attendance & grade reports
    portal/              # Parent/student self-service
    settings/            # School config + academic years + SMTP
    actions.ts           # Shared dashboard-level actions (e.g. signOut)
  login/
  setup/                 # First-run wizard
```

Each module follows the same pattern:
- `page.tsx` — Server Component (no `'use client'`), fetches data, renders layout
- `*-form.tsx` or `*-client.tsx` — `'use client'` component for interactive UI
- `actions.ts` — `'use server'` Server Actions for mutations (one file per module)

### Data layer
- `src/lib/db.ts` — Prisma singleton (`db`)
- All DB access via `db.*` from server components and server actions only
- `tsconfig.json` has `"noImplicitAny": false` to suppress Prisma 7 callback inference issues while keeping all other strict checks

### Database
SQLite at `./dev.db` (project root, per `DATABASE_URL=file:./dev.db` in `.env`). Schema at `prisma/schema.prisma`. Prisma 7 `datasource db` block has NO `url` field — that's in `prisma.config.ts`. The `db.ts` singleton resolves the path at startup using `process.cwd()`.
