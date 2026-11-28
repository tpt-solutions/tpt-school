# TPT School Platform — Build Tracker

## Phase 1: Foundation
- [x] Initialize Next.js 16 project (TypeScript, Tailwind, App Router, shadcn/ui)
- [x] Install and configure Prisma 7 with SQLite
- [x] Design full database schema (all 8 modules + behaviour/exit)
- [x] Custom credential auth system (bcrypt + session cookies, role-based guards)
- [x] Build first-run setup wizard (school name, admin account, config)
- [x] Build base layout with role-based navigation sidebar

## Phase 2: People Management
- [x] Student enrolment & profiles (guardians, medical info, documents, attendance summary)
- [x] Staff & HR management (records, roles, leave requests, approve/decline workflow)

## Phase 3: Academic
- [x] Classes (enrolment, teacher assignment, room booking)
- [x] Timetabling / scheduling (weekly grid, period management)
- [x] Attendance tracking (roll call per class, daily summary, reports)
- [x] Gradebook & assessments (grade entry, letter grades, class averages)

## Phase 4: Communication & Finance
- [x] Parent & student portal (attendance %, recent grades, outstanding fees)
- [x] Communication module (notices board, direct messaging, role/year targeting)
- [x] Finance & fees (fee types, invoicing, payment recording, status tracking)

## Phase 5: Behaviour & Wellbeing
- [x] Behaviour incident log (severity levels, parent notification, follow-up tracking)
- [x] Suspensions (in-school / out-of-school, linked to incidents)
- [x] Student exit processing (withdrawal, transfer, expulsion, graduation)
- [x] Truancy alerts (auto-flag after 3 consecutive or 10+ unexcused absences)

## Phase 6: Reports & Settings
- [x] Attendance reports (date range filter, per-student breakdown, % rates)
- [x] Grade summary reports (class/term filter, averages)
- [x] Settings (school info, academic years & terms, SMTP email config)

## Phase 7: Polish & Packaging (TODO)
- [x] Fix TypeScript compilation errors (asChild, Select.onValueChange, Prisma 7 types) — `npx tsc --noEmit` passes clean
- [x] Add Behaviour nav item to sidebar (admin + teacher)
- [x] Trigger truancy check automatically when attendance is saved
- [x] Incident detail page (`/behaviour/[id]`) — view/edit incident, add suspension
- [x] Transfer-In UI on student profile page (new tab + upsert action)
- [x] Report card PDF generation (`/api/report-card/[studentId]` + Download button on student profile + `/reports/report-cards` batch page)
- [x] Docker Compose setup for self-hosting (`tpt-school/Dockerfile`, `docker-compose.yml`, `.dockerignore`, `docker-entrypoint.sh`)
- [x] Electron installer wrapper (Windows .exe / Mac .dmg) (`electron/` wrapper with `electron-builder`)
- [x] End-to-end test (setup wizard → login → all modules) (`tests/e2e/` with Playwright, 10 test files)

## Phase 8: Security & Correctness (from 2026-11-26 review)
- [x] `src/lib/auth.ts` has `"use server"` — every export is a public endpoint (`createSession` can mint sessions). Remove the directive, add `server-only`
- [x] Add authorization to `staff/actions.ts` (create/update, leave approve — `approvedBy` from session)
- [x] Add authorization to `students/actions.ts` (create/update/delete/search)
- [x] Add authorization to `behaviour/actions.ts` (`checkTruancyAction` is unauthenticated, `resolveTruancyAlertAction`)
- [x] Add authorization to `communication/actions.ts` (who may message whom, who may post notices)
- [x] Teacher-must-teach-class checks in `grades/actions.ts`, `attendance/actions.ts`, and `api/report-card/[studentId]` (helper `assertTeachesClass`)
- [x] Untrack `dev.db`, add to `.gitignore`, purge history, rotate seeded credentials — _done locally: dev.db and seeded passwords removed from all commits; live accounts rotated (credentials kept outside the repo). Remote `origin/master` NOT yet force-pushed: needs approval, and collaborators must re-clone_
- [x] `api/cron/fee-reminders` fails open when `CRON_SECRET` is unset — return 401
- [x] `src/lib/crypto.ts` falls back to a hardcoded key — throw in production when `AUTH_SECRET` is missing
- [x] Password reset: hash the token, rate-limit requests, stop storing reset URL in `EmailLog.body`, escape HTML, revoke sessions
- [x] Setup wizard: make first-admin creation atomic
- [x] Rate limiting: stop trusting `x-forwarded-for`; add limits to attendance-code entry and reset requests
- [x] Races: transactions for payments, enrolment capacity, waitlist position, ID generation (`count()+1`)
- [ ] Validation: zod schemas for actions; reject invalid dates, NaN, `javascript:` URLs; enforce `score <= maxScore`; integer-cents money — _partial: shared helper `src/lib/form.ts`. Covered: staff, payments, notes, guardians, fee types, invoices, assignments, SIS and report exports (invalid dates now return 400 or are ignored), enrolment and waitlist class checks, and all new modules. `score <= maxScore` verified on single and bulk grade entry. Not yet: a full re-audit of every action after the new modules._
- [x] Middleware (`src/proxy.ts`): fix path prefix matching; add security headers and `serverActions.allowedOrigins`
- [ ] Schema indexes on Session, Attendance, Grade, FeeInvoice, FeePayment, BehaviourIncident, ClassEnrolment, MessageRecipient, EmailLog; add pagination to large lists — _partial: every index listed here is present in the schema and migrations (`20261126000000_add_hot_path_indexes`), verified 2026-11-27; students list paginated; other large lists still open_
- [ ] Audit logging for logins, role changes, grade edits, payments, settings — _partial: logins, grade edits, payments, settings, student deactivation logged; no role-change code path exists to audit yet_
- [x] Teacher dashboard `myStudents` / `todayAttendance` hardcoded to 0 (`dashboard/page.tsx:46`)
- [x] Delete stale `TODO copy.md`

## Phase 9: Adoption
- [x] Add `.env.example`, `docker-compose.yml` (DB volume + cron), Dockerfile `HEALTHCHECK` — compose uses the `tpt-data` volume; cron is covered by the in-process scheduler, so no sidecar is needed
- [x] Fix README (Vercel claim is wrong — SQLite only; add backup guidance; document all env vars)
- [x] In-process scheduler for fee reminders (`src/instrumentation.ts`; uses `setInterval`, not node-cron, to avoid a new dependency; `DISABLE_SCHEDULER=true` turns it off)
- [x] Setup wizard: academic year/terms step, generated admin password (no fixed seed passwords), school year presets. SMTP test and demo data live in Settings, not the wizard: an unauthenticated SMTP test would let anyone send mail through the server, so it is kept behind login. Demo data is in Settings → Demo data and refuses to run on a school with students or staff.
- [ ] Downloadable CSV templates + example preview on each importer; `/templates` sample files (now also guardians and timetable) — _partial: samples for students, staff, classes, fee types, enrolments, guardians and timetable; previews are on the `/templates` page only, not inline on the importers_
- [x] School year presets (NZ, AU, UK, CA, other): the setup wizard fills in typical term names and dates, stored as `SchoolSettings.country`. Presets set starting dates only and are not applied to later years.
- [x] Importers for classes, enrolments, guardians, fee types, timetable: guardians (`/students/guardians/import`, links existing students, new parents get no password and use Forgot password) and timetable (`/timetable/import`, reuses the room, teacher and class-period conflict checks in `bulkCreateSlotsAction`) added. Student import still creates accounts with no password set, the same as guardians, and has no way to sign in until a reset.
- [ ] Admin dashboard onboarding checklist; empty states with call-to-action — _partial: checklist on admin dashboard (hidden once required steps are done); CTAs on invoices, classes, class assessments, behaviour, staff, students, grades and fee types; other empty states not done_
- [x] `docs/` quick-start, admin and teacher guides

## Phase 10: Usability & Automation (roadmap)
- [x] `loading.tsx`, `error.tsx`, `not-found.tsx` (dashboard-group `loading.tsx`; root `error.tsx` and `not-found.tsx`)
- [ ] Sort/filter/paginate lists; bulk actions with row checkboxes — _partial: pagination on invoices, students, staff, classes, gradebooks, behaviour incidents, notices and inbox (50 per page). Sorting and filters on students, staff, classes, gradebooks, invoices and behaviour. Bulk actions: students only (deactivate or reactivate, audited). Bulk actions are not planned for the other lists: none has a bulk operation that is safe to offer yet._
- [ ] Mobile card layout for wide tables; dark-mode toggle (mount `next-themes` provider) — _partial: card layout on every data table in the dashboard. Checked at 390px on 42 admin and parent pages: no page scrolls sideways. Wide tables that remain (timetable grid, some reports) scroll inside their own box. Not yet checked on a real phone. Dark-mode toggle done. Mobile is PWA only (no native Android or Apple apps). Installable PWA done._

- [ ] Accessibility pass (skip link, table captions, focus management) — _partial: skip link; sr-only captions on every data table; accessible names on icon-only, search and date controls (automated scan of 40 admin pages: none unnamed); every dialog has a title; keyboard test passes: skip link moves focus into the page, the edit dialog opens and closes with the keyboard and returns focus to its trigger, and the account menu opens with the keyboard. Not yet: a screen-reader test and a full keyboard walkthrough of every form._
- [x] Command palette (Ctrl+K)
- [x] Parent portal: grades, invoices, report cards (`/portal/grades`, `/portal/invoices`, `/portal/report-cards`; PDF route allows families for published cards only)
- [x] Same-day absence emails to guardians; email queue with retry — opt-in absence emails (Settings → Messaging), once per guardian, student and day; persistent queue (`EmailQueueItem`, drained every 5 minutes, retries at 2/4/8/16 minutes, 5 attempts)
- [x] Academic-year rollover and class promotion (Settings → Academic Years; shifts terms, optionally copies classes and teachers, promotes students one level, top level left for exit)
- [x] Recurring invoices and overdue escalation; scheduled backups — term fees generated from a preview (Finance → Term fees, no double billing via `billingKey`); overdue invoices marked daily with an admin digest; daily backups (`VACUUM INTO`, `BACKUP_DIR`, `BACKUP_RETENTION`, `DISABLE_BACKUPS`)
- [x] iCal feed for calendar (per-user subscribe link on the calendar page); timetable auto-generation (already in `timetable/generator-algorithm.ts`)
- [x] Missing modules: all nine built. Substitutes, transport, canteen, library, health room (admin only, every entry logged), merit awards, pay records (`/payroll`, entered by hand, no tax calculation), parent-teacher interviews (admin books slots; parents now book and cancel their own children's times at `/portal/interviews`), and online card payments for parents through Stripe Checkout (needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`; recorded only from the signed webhook, once per session, overpayments flagged). Verified: signed webhook recorded once on repeat delivery and rejected bad signatures. Not verified against live Stripe or through a signed-in browser session._
- [x] AI report-card comment drafting (already in the report-card editor); early-warning risk scoring (`lib/risk.ts`, shown on the admin dashboard)

---

_Last updated: 2026-11-28 — tenth pass: notices and inbox paginated, with the active tab kept across pages. Earlier passes below._
