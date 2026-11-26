Written for: school administrators who run the system day to day.

# Admin guide

Admins see every module in the sidebar. This guide covers the main areas in the order you are likely to need them.

## Students

- **Students** lists everyone, with search and pagination.
- **New** adds one student. Each new student gets a random temporary password, which is shown once when the account is created. Give it to the family and ask them to change it.
- **Import** creates many students from a CSV file. The page shows a preview and flags rows with errors before anything is saved. Rows with an email that already exists are skipped.
- A student profile holds guardians, medical information, documents and an attendance summary. Transfers in are recorded from the profile.

Deactivating a student is logged in the audit trail.

## Staff

- Create staff records with a job title, department and employment type (full-time, part-time, casual or contract).
- Staff can request leave. Admins approve or decline it, and the approver is recorded from the signed-in session.
- **Import** works like the student import, with its own template.

## Classes and timetable

- Create classes, assign a teacher and a room, and manage enrolments from the class page.
- The timetable is a weekly grid of periods. The scheduler checks for clashes, and the timetable page is where you review them.

## Attendance and behaviour

- Attendance is marked per class on the roll page. The daily summary and attendance reports show rates by date range and by student.
- Truancy alerts are raised automatically after 3 consecutive or 10 or more unexcused absences. Resolve them from the alert list.
- Behaviour incidents record severity and parent notification, and can lead to suspensions or follow-up tasks.
- Student exits (withdrawal, transfer, expulsion, graduation) are processed from the student profile.

## Grades and reports

- Gradebooks belong to classes. Scores cannot exceed the assessment's maximum.
- **Reports** includes attendance reports, grade summaries, report-card PDFs (single or batch) and the parent-engagement report.

## Finance

1. **Fee types:** define each charge (name and amount).
2. **Invoices:** create invoices for students. Money is stored in whole cents, so amounts never round.
3. **Payments:** record payments against invoices. Each payment is recorded in a transaction and the invoice status updates.
4. **Fee reminders** are sent automatically once a day to guardians of overdue invoices. Each invoice gets at most one reminder every 7 days. You can also send them now from the Finance page.

## Communication

- **Notices** are posted to the notice board and can target roles or year levels.
- **Messages** are direct messages. Users can only message people the rules allow.

## Settings

- **School info:** name, currency symbol and other details used across the site.
- **Academic years and terms:** create them before you take attendance or grades for a new year.
- **SMTP:** configure outgoing email, then use the test option to confirm it works. The SMTP password is encrypted using `AUTH_SECRET`.

## Security checklist

- Use strong, unique passwords for admin accounts. Remove accounts for staff who leave.
- Keep `AUTH_SECRET` and `CRON_SECRET` private and out of version control.
- Behind a reverse proxy, set `TRUST_PROXY=true` only if the proxy overwrites `X-Forwarded-For`.
- Check the audit log after unusual activity. It records logins, grade edits, payments and settings changes.

## Routine tasks

| When | Task |
|------|------|
| Start of year | Create the academic year and terms; roll classes over |
| Weekly | Review truancy alerts and open behaviour follow-ups |
| Monthly | Review overdue invoices; check that fee reminders are going out |
| Regularly | Back up the database and test a restore ([README → Backups](../README.md#backups)) |
