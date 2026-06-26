import { z } from "zod";
import {
  caseTypeSchema,
  channelSchema,
  departmentSchema,
  evidenceVerdictSchema,
  languageSchema,
  severitySchema,
  userTypeSchema,
} from "./enums";
import { transactionSchema } from "./transaction.schema";

export const analyzeTicketRequestSchema = z
  .object({
    ticket_id: z.string().trim().min(1),
    complaint: z.string().trim().min(1),
    language: languageSchema.optional(),
    channel: channelSchema.optional(),
    user_type: userTypeSchema.optional(),
    campaign_context: z.string().trim().min(1).optional(),
    transaction_history: z.array(transactionSchema).optional().default([]),
    metadata: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const analyzeTicketResponseSchema = z
  .object({
    ticket_id: z.string().trim().min(1),
    relevant_transaction_id: z.string().trim().min(1).nullable(),
    evidence_verdict: evidenceVerdictSchema,
    case_type: caseTypeSchema,
    severity: severitySchema,
    department: departmentSchema,
    agent_summary: z.string().trim().min(1),
    recommended_next_action: z.string().trim().min(1),
    customer_reply: z.string().trim().min(1),
    human_review_required: z.boolean(),
    confidence: z.number().finite().min(0).max(1).optional(),
    reason_codes: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export type AnalyzeTicketRequest = z.infer<
  typeof analyzeTicketRequestSchema
>;

export type AnalyzeTicketResponse = z.infer<
  typeof analyzeTicketResponseSchema
>;
