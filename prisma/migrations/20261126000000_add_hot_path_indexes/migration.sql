-- Indexes on hot query paths (Phase 8: schema indexes)
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expires_idx" ON "Session"("expires");
CREATE INDEX "Attendance_termId_idx" ON "Attendance"("termId");
CREATE INDEX "Grade_studentId_idx" ON "Grade"("studentId");
CREATE INDEX "ClassEnrolment_studentId_status_idx" ON "ClassEnrolment"("studentId", "status");
CREATE INDEX "FeeInvoice_studentId_idx" ON "FeeInvoice"("studentId");
CREATE INDEX "FeeInvoice_status_idx" ON "FeeInvoice"("status");
CREATE INDEX "FeePayment_invoiceId_idx" ON "FeePayment"("invoiceId");
CREATE INDEX "BehaviourIncident_studentId_date_idx" ON "BehaviourIncident"("studentId", "date");
CREATE INDEX "MessageRecipient_userId_readAt_idx" ON "MessageRecipient"("userId", "readAt");
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");
