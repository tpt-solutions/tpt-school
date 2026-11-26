-- Opt-in switch for same-day absence emails to guardians (off by default).
ALTER TABLE "SchoolSettings" ADD COLUMN "absenceEmailsEnabled" BOOLEAN NOT NULL DEFAULT false;
