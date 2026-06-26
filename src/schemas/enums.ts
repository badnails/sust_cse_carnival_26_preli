import { z } from "zod";

export const languageSchema = z.enum(["en", "bn", "mixed"]);

export const channelSchema = z.enum([
  "in_app_chat",
  "call_center",
  "email",
  "merchant_portal",
  "field_agent",
]);

export const userTypeSchema = z.enum([
  "customer",
  "merchant",
  "agent",
  "unknown",
]);

export const transactionTypeSchema = z.enum([
  "transfer",
  "payment",
  "cash_in",
  "cash_out",
  "settlement",
  "refund",
]);

export const transactionStatusSchema = z.enum([
  "completed",
  "failed",
  "pending",
  "reversed",
]);

export const evidenceVerdictSchema = z.enum([
  "consistent",
  "inconsistent",
  "insufficient_data",
]);

export const caseTypeSchema = z.enum([
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "duplicate_payment",
  "merchant_settlement_delay",
  "agent_cash_in_issue",
  "phishing_or_social_engineering",
  "other",
]);

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const departmentSchema = z.enum([
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "merchant_operations",
  "agent_operations",
  "fraud_risk",
]);

export type Language = z.infer<typeof languageSchema>;
export type Channel = z.infer<typeof channelSchema>;
export type UserType = z.infer<typeof userTypeSchema>;
export type TransactionType = z.infer<typeof transactionTypeSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type EvidenceVerdict = z.infer<typeof evidenceVerdictSchema>;
export type CaseType = z.infer<typeof caseTypeSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Department = z.infer<typeof departmentSchema>;
