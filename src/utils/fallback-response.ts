import type { AnalyzeTicketResponse } from "../schemas";

export const createFallbackResponse = (
  ticketId: string,
): AnalyzeTicketResponse => ({
  ticket_id: ticketId,
  relevant_transaction_id: null,
  evidence_verdict: "insufficient_data",
  case_type: "other",
  severity: "medium",
  department: "customer_support",
  agent_summary:
    "The ticket could not be analyzed confidently from the available data.",
  recommended_next_action:
    "Route to a human support agent for manual review before taking any financial action.",
  customer_reply:
    "Thank you for reaching out. We are reviewing your concern and will contact you through official support channels. Please do not share your PIN, OTP, password, or full card number with anyone.",
  human_review_required: true,
  confidence: 0,
  reason_codes: ["safe_fallback", "insufficient_data"],
});
