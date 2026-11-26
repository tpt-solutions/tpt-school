Written for: the person installing TPT School for the first time.

# Quick start

This guide gets a new school from an empty server to a working site in about 30 minutes.

## 1. Install

Pick one:

- **Docker (recommended):** see [README → Docker](../README.md#docker).
- **VPS with the deploy script:** see [README → One-step wizard](../README.md#one-step-wizard-recommended).
- **Manual:** see [README → Manual](../README.md#manual-any-machine).

## 2. Configure `.env`

Copy `.env.example` to `.env` and set at least:

- `AUTH_SECRET`: generate with `openssl rand -base64 32`. Keep it safe; you need it for backups.
- `NEXT_PUBLIC_BASE_URL`: the address people will type in, e.g. `https://school.example.com`.

Everything else is optional. Full list: [README → Environment variables](../README.md#environment-variables).

## 3. Run the setup wizard

Open the site in a browser. You will be sent to `/setup`. It has two steps:

1. **School information:** school name and the details shown on reports and emails.
2. **Admin account:** the first administrator's name, email and password.

When the wizard finishes, you are signed in as the admin and the dashboard appears. The wizard can only be completed once.

## 4. Set up the school

In order:

1. **Settings:** check school info, create academic years and terms, and configure SMTP if you want email (invoices, reminders, password resets).
2. **Staff:** add teachers, either one at a time or with a CSV import.
3. **Classes:** create classes and assign a teacher to each.
4. **Timetable:** build the weekly grid for the classes.
5. **Students:** add students, or import them. Link parents or guardians where relevant.
6. **Finance (optional):** create fee types, then invoices.

For CSV imports, download the sample files from **Import templates** in the sidebar. The admin guide covers the import steps in detail.

## 5. Back up

Copy the database file regularly. See [README → Backups](../README.md#backups). Do this before you go live.

## Next

- [Admin guide](admin-guide.md): day-to-day administration.
- [Teacher guide](teacher-guide.md): what teachers use each day.
