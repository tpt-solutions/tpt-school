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
- [ ] Validation: zod schemas for actions; reject invalid dates, NaN, `javascript:` URLs; enforce `score <= maxScore`; integer-cents money — _partial: shared helper `src/lib/form.ts` (calendar-checked dates, whole-number ranges, http(s)-only URLs, enums). Applied to behaviour incidents/suspensions/exits, notices, school info, academic years, terms (create and update), rooms, SMTP, fee types (incl. frequency), invoice due dates, classes, calendar events, timetable slots, attendance status and window, enrolment message length. Also covered: timetable bulk create and requirements, assignment submission links (http/https only), parent enrolment message, student and staff CSV imports (per-row server checks, 1000-row cap). Also fixed: class create/update swallowed `redirect()` inside `try` (now redirects correctly). Audited 2026-11-27: `staff/[id]` (single admin-only boolean toggle) and `reports` query params (attendance report now ignores invalid dates and non-integer year levels via `queryDate`/`queryInt` in `form.ts`). Remaining: zod schemas for the other actions per the original spec_
- [x] Middleware (`src/proxy.ts`): fix path prefix matching; add security headers and `serverActions.allowedOrigins`
- [ ] Schema indexes on Session, Attendance, Grade, FeeInvoice, FeePayment, BehaviourIncident, ClassEnrolment, MessageRecipient, EmailLog; add pagination to large lists — _partial: every index listed here is present in the schema and migrations (`20261126000000_add_hot_path_indexes`), verified 2026-11-27; students list paginated; other large lists still open_
- [ ] Audit logging for logins, role changes, grade edits, payments, settings — _partial: logins, grade edits, payments, settings, student deactivation logged; no role-change code path exists to audit yet_
- [x] Teacher dashboard `myStudents` / `todayAttendance` hardcoded to 0 (`dashboard/page.tsx:46`)
- [x] Delete stale `TODO copy.md`

## Phase 9: Adoption
- [x] Add `.env.example`, `docker-compose.yml` (DB volume + cron), Dockerfile `HEALTHCHECK` — compose uses the `tpt-data` volume; cron is covered by the in-process scheduler, so no sidecar is needed
- [x] Fix README (Vercel claim is wrong — SQLite only; add backup guidance; document all env vars)
- [x] In-process scheduler for fee reminders (`src/instrumentation.ts`; uses `setInterval`, not node-cron, to avoid a new dependency; `DISABLE_SCHEDULER=true` turns it off)
- [ ] Setup wizard: academic year/terms step, SMTP test, optional demo data, generated admin password (no fixed seed passwords) — _partial: academic-year step added (year dates + up to 4 terms, validated server-side, created atomically with setup); e2e helper updated to the new steps but not run (it uses the live dev.db); generated admin password (Generate button) added; SMTP test and demo data not done_
- [ ] Downloadable CSV templates + example preview on each importer; `/templates` sample files (now also classes, fee types and enrolments) — _partial: `public/templates/` samples for students and staff, download links on both importers, `/templates` page with previews; previews are not inline on the importer pages_
- [ ] School-type presets (primary/secondary, NZ/AU/UK/CA)
- [ ] Importers for classes, enrolments, guardians, fee types, timetable — _partial: classes, fee types and enrolments done (`/classes/import`, `/finance/fee-types/import`, `/classes/enrolments/import`, shared `csv-import-panel` and `lib/csv.ts`); guardians (creates accounts, needs its own review) and timetable not done_
- [ ] Admin dashboard onboarding checklist; empty states with call-to-action — _partial: checklist on admin dashboard (hidden once required steps are done); CTAs added to invoices, classes and behaviour empty states; other empty states not done_
- [x] `docs/` quick-start, admin and teacher guides

## Phase 10: Usability & Automation (roadmap)
- [x] `loading.tsx`, `error.tsx`, `not-found.tsx` (dashboard-group `loading.tsx`; root `error.tsx` and `not-found.tsx`)
- [ ] Sort/filter/paginate lists; bulk actions with row checkboxes — _partial: Finance invoices paginated (50 per page); sorting, filters and bulk actions not done_
- [ ] Mobile card layout for wide tables; dark-mode toggle (mount `next-themes` provider) — _partial: mobile is PWA only (no native Android or Apple apps). Installable PWA done (`public/sw.js` caches only the offline page, icons and build assets, never pages or data; `/offline`; manifest with shortcuts; install button where the browser offers it). Dark-mode toggle done (`next-themes` provider, header toggle, `.dark` overrides for hardcoded colours in `globals.css`). Phone card layout done for students, finance invoices, portal invoices and portal grades (`table-stack` + `data-label`); other wide tables still scroll sideways_

- [ ] Accessibility pass (skip link, table captions, focus management) — _partial: skip link added to dashboard shell; captions on the `/templates` tables only_
- [x] Command palette (Ctrl+K)
- [x] Parent portal: grades, invoices, report cards (`/portal/grades`, `/portal/invoices`, `/portal/report-cards`; PDF route allows families for published cards only)
- [x] Same-day absence emails to guardians; email queue with retry — opt-in absence emails (Settings → Messaging), once per guardian, student and day; persistent queue (`EmailQueueItem`, drained every 5 minutes, retries at 2/4/8/16 minutes, 5 attempts)
- [x] Academic-year rollover and class promotion (Settings → Academic Years; shifts terms, optionally copies classes and teachers, promotes students one level, top level left for exit)
- [x] Recurring invoices and overdue escalation; scheduled backups — term fees generated from a preview (Finance → Term fees, no double billing via `billingKey`); overdue invoices marked daily with an admin digest; daily backups (`VACUUM INTO`, `BACKUP_DIR`, `BACKUP_RETENTION`, `DISABLE_BACKUPS`)
- [x] iCal feed for calendar (per-user subscribe link on the calendar page); timetable auto-generation (already in `timetable/generator-algorithm.ts`)
- [ ] Missing modules: interview booking, health log, substitutes, library, transport, canteen, payroll, online payments, merit awards
- [x] AI report-card comment drafting (already in the report-card editor); early-warning risk scoring (`lib/risk.ts`, shown on the admin dashboard)

---

_Last updated: 2026-11-27 — second pass: escaped older email templates, setup password generator, persistent email queue, overdue escalation, term-fee generation, enrolment importer, invoice pagination. First pass: attendance report validation, empty-state CTAs, setup academic-year step, command palette, parent portal, iCal feed, early-warning scoring, email retry, class and fee-type importers, academic-year rollover, absence emails, scheduled backups, nav link fixes. Phase 7 complete_
