import type { AnalyzeTicketResponse } from "../schemas";
import { reasonCodes } from "../constants/reason-codes";

const credentialRequestPattern =
  /\b(share|send|provide|tell|give|enter|submit|confirm|verify)\b.{0,40}\b(pin|otp|password|full card number|card number|cvv)\b/gi;

const unsafeFinancialPromisePattern =
  /\b(we will|we'll|will|guarantee|confirmed|confirming|approved|successfully)\b.{0,50}\b(refund|reverse|reversal|unblock|recover|return your money|money back)\b/i;

const thirdPartyDirectionPattern =
  /\b(contact|call|message|reach out to)\b.{0,30}\b(third[- ]party|that person|recipient|caller|unknown number|outside)\b/i;

const safeCustomerReply =
  "Thank you for reaching out. We are reviewing your concern and will contact you through official support channels. Please do not share your PIN, OTP, password, or full card number with anyone.";

const safeNextAction =
  "Route to a human support agent for manual review before taking any financial action.";

export class SafetyGuard {
  sanitize(response: AnalyzeTicketResponse): AnalyzeTicketResponse {
    const unsafeReply = this.hasUnsafeCustomerReply(response.customer_reply);
    const unsafeAction = this.hasUnsafeFinancialPromise(
      response.recommended_next_action,
    );

    if (!unsafeReply && !unsafeAction) {
      return response;
    }

    return {
      ...response,
      recommended_next_action: unsafeAction
        ? safeNextAction
        : response.recommended_next_action,
      customer_reply: unsafeReply ? safeCustomerReply : response.customer_reply,
      human_review_required: true,
      reason_codes: [
        ...(response.reason_codes ?? []),
        reasonCodes.safetyGuardApplied,
      ],
    };
  }

  private hasUnsafeCustomerReply(text: string): boolean {
    return (
      this.hasUnsafeCredentialRequest(text) ||
      unsafeFinancialPromisePattern.test(text) ||
      thirdPartyDirectionPattern.test(text)
    );
  }

  private hasUnsafeCredentialRequest(text: string): boolean {
    for (const match of text.matchAll(credentialRequestPattern)) {
      const prefix = text
        .slice(Math.max(0, match.index - 24), match.index)
        .toLowerCase();

      if (!/\b(do not|don't|never|not)\s+$/.test(prefix)) {
        return true;
      }
    }

    return false;
  }

  private hasUnsafeFinancialPromise(text: string): boolean {
    return unsafeFinancialPromisePattern.test(text);
  }
}
