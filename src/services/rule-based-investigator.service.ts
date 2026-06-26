import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
  CaseType,
  Department,
  Severity,
  Transaction,
} from "../schemas";
import { reasonCodes, type ReasonCode } from "../constants/reason-codes";

const englishAndBanglaDigits: Record<string, string> = {
  "০": "0",
  "১": "1",
  "২": "2",
  "৩": "3",
  "৪": "4",
  "৫": "5",
  "৬": "6",
  "৭": "7",
  "৮": "8",
  "৯": "9",
};

type CaseProfile = {
  caseType: CaseType;
  department: Department;
  severity: Severity;
};

export class RuleBasedInvestigatorService {
  investigate(request: AnalyzeTicketRequest): AnalyzeTicketResponse {
    const complaint = normalizeText(request.complaint);
    const amount = extractAmount(complaint);
    const transactions = request.transaction_history ?? [];

    if (isPhishing(complaint)) {
      return this.buildPhishingResponse(request);
    }

    const duplicateProfile = classifyDuplicateCase(complaint);
    const duplicate = findDuplicatePayment(transactions, amount);
    if (duplicateProfile && duplicate?.verdict === "consistent") {
      return this.buildResponse(request, {
        transaction: duplicate.transaction,
        evidenceVerdict: duplicate.verdict,
        profile: {
          caseType: "duplicate_payment",
          department: "payments_ops",
          severity: "high",
        },
        summary:
          `Customer reports a duplicate payment. ${duplicate.transaction.transaction_id} appears to be the suspected duplicate transaction.`,
        nextAction:
          `Verify ${duplicate.transaction.transaction_id} with payments operations and the biller before taking any financial action.`,
        reply:
          `We have noted the possible duplicate payment for transaction ${duplicate.transaction.transaction_id}. Our payments team will verify it and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`,
        humanReviewRequired: true,
        confidence: 0.9,
        reasonCodes: [
          reasonCodes.duplicatePayment,
          reasonCodes.billerVerificationRequired,
        ],
      });
    }

    const profile = duplicateProfile ?? classifyCase(complaint, request.user_type);
    const candidates = findCandidateTransactions(
      transactions,
      profile.caseType,
      amount,
    );

    if (profile.caseType === "other" && candidates.length === 0) {
      return this.buildVagueResponse(request);
    }

    if (profile.caseType === "duplicate_payment" && duplicate) {
      return this.buildDuplicateUnclearResponse(request, duplicate.verdict);
    }

    if (candidates.length !== 1) {
      return this.buildAmbiguousResponse(request, profile, candidates.length);
    }

    const transaction = candidates[0];
    const evidenceVerdict = determineEvidenceVerdict(
      profile.caseType,
      transaction,
      transactions,
    );
    const severity = determineSeverity(profile, evidenceVerdict, transaction);

    return this.buildResponse(request, {
      transaction,
      evidenceVerdict,
      profile: { ...profile, severity },
      summary: buildSummary(
        request,
        profile.caseType,
        transaction,
        evidenceVerdict,
      ),
      nextAction: buildNextAction(profile.caseType, transaction),
      reply: buildReply(request, profile.caseType, transaction),
      humanReviewRequired: shouldHumanReview(profile, evidenceVerdict, transaction),
      confidence: evidenceVerdict === "consistent" ? 0.82 : 0.7,
      reasonCodes: buildReasonCodes(profile.caseType, evidenceVerdict, transaction),
    });
  }

  private buildPhishingResponse(
    request: AnalyzeTicketRequest,
  ): AnalyzeTicketResponse {
    return {
      ticket_id: request.ticket_id,
      relevant_transaction_id: null,
      evidence_verdict: "insufficient_data",
      case_type: "phishing_or_social_engineering",
      severity: "critical",
      department: "fraud_risk",
      agent_summary:
        "Customer reports a suspicious contact or credential request. Treat as a likely social engineering attempt.",
      recommended_next_action:
        "Escalate to fraud_risk immediately and remind the customer that official support never asks for PIN, OTP, password, or full card number.",
      customer_reply:
        "Thank you for reaching out. We never ask for your PIN, OTP, password, or full card number under any circumstances. Please do not share these with anyone. Our fraud team will review this through official support channels.",
      human_review_required: true,
      confidence: 0.92,
      reason_codes: [
        reasonCodes.phishing,
        reasonCodes.credentialProtection,
        reasonCodes.criticalEscalation,
      ],
    };
  }

  private buildVagueResponse(
    request: AnalyzeTicketRequest,
  ): AnalyzeTicketResponse {
    return {
      ticket_id: request.ticket_id,
      relevant_transaction_id: null,
      evidence_verdict: "insufficient_data",
      case_type: "other",
      severity: "low",
      department: "customer_support",
      agent_summary:
        "Customer reported a vague issue without enough detail to identify a specific transaction.",
      recommended_next_action:
        "Ask for the transaction ID, amount, issue type, and approximate time before routing further.",
      customer_reply:
        "Thank you for reaching out. To help you faster, please share the transaction ID, amount, and a short description of what went wrong. Please do not share your PIN or OTP with anyone.",
      human_review_required: false,
      confidence: 0.6,
      reason_codes: [reasonCodes.vagueComplaint, reasonCodes.needsClarification],
    };
  }

  private buildAmbiguousResponse(
    request: AnalyzeTicketRequest,
    profile: CaseProfile,
    candidateCount: number,
  ): AnalyzeTicketResponse {
    return {
      ticket_id: request.ticket_id,
      relevant_transaction_id: null,
      evidence_verdict: "insufficient_data",
      case_type: profile.caseType,
      severity: candidateCount > 1 ? "medium" : profile.severity,
      department: profile.department,
      agent_summary:
        candidateCount > 1
          ? "Multiple transactions plausibly match the complaint, so the relevant transaction cannot be identified safely."
          : "No transaction in the provided history clearly matches the complaint.",
      recommended_next_action:
        "Ask the customer for the transaction ID, counterparty, amount, and approximate time before taking further action.",
      customer_reply:
        "Thank you for reaching out. We need a few more details to identify the right transaction safely. Please share the transaction ID, amount, and approximate time. Please do not share your PIN or OTP with anyone.",
      human_review_required: shouldReviewAmbiguous(
        profile,
        candidateCount,
        request.complaint,
      ),
      confidence: 0.55,
      reason_codes: [
        candidateCount > 1
          ? reasonCodes.ambiguousMatch
          : reasonCodes.insufficientData,
        reasonCodes.needsClarification,
      ],
    };
  }

  private buildDuplicateUnclearResponse(
    request: AnalyzeTicketRequest,
    verdict: AnalyzeTicketResponse["evidence_verdict"],
  ): AnalyzeTicketResponse {
    return {
      ticket_id: request.ticket_id,
      relevant_transaction_id: null,
      evidence_verdict: verdict,
      case_type: "duplicate_payment",
      severity: "medium",
      department: "payments_ops",
      agent_summary:
        verdict === "inconsistent"
          ? "Customer reports a duplicate payment, but the transaction statuses do not support two successful charges."
          : "Customer reports a duplicate payment, but the available transactions are too far apart or unclear to identify a duplicate safely.",
      recommended_next_action:
        "Route to payments operations to verify the charge pattern before taking any financial action.",
      customer_reply:
        "We have noted your duplicate payment concern. Our payments team will review the available transactions and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.",
      human_review_required: true,
      confidence: 0.68,
      reason_codes: [
        reasonCodes.duplicatePayment,
        verdict === "inconsistent"
          ? reasonCodes.evidenceInconsistent
          : reasonCodes.ambiguousMatch,
      ],
    };
  }

  private buildResponse(
    request: AnalyzeTicketRequest,
    input: {
      transaction: Transaction;
      evidenceVerdict: AnalyzeTicketResponse["evidence_verdict"];
      profile: CaseProfile;
      summary: string;
      nextAction: string;
      reply: string;
      humanReviewRequired: boolean;
      confidence: number;
      reasonCodes: ReasonCode[];
    },
  ): AnalyzeTicketResponse {
    return {
      ticket_id: request.ticket_id,
      relevant_transaction_id: input.transaction.transaction_id,
      evidence_verdict: input.evidenceVerdict,
      case_type: input.profile.caseType,
      severity: input.profile.severity,
      department: input.profile.department,
      agent_summary: input.summary,
      recommended_next_action: input.nextAction,
      customer_reply: input.reply,
      human_review_required: input.humanReviewRequired,
      confidence: input.confidence,
      reason_codes: input.reasonCodes,
    };
  }
}

const normalizeText = (text: string): string =>
  text
    .replace(/[০-৯]/g, (digit) => englishAndBanglaDigits[digit] ?? digit)
    .toLowerCase();

const extractAmount = (text: string): number | undefined => {
  const match = text.match(/\b\d{2,7}\b/);
  return match ? Number(match[0]) : undefined;
};

const isPhishing = (text: string): boolean =>
  /\b(otp|pin|password|blocked|scam|fraud|phishing|cvv|card number|impostor|unknown person|suspicious|link)\b/.test(text) ||
  /(ওটিপি|পিন|পাসওয়ার্ড|পাসওয়ার্ড|ব্লক)/.test(text);

const classifyDuplicateCase = (text: string): CaseProfile | undefined => {
  if (
    /\b(duplicate|twice|double|deducted twice|charged twice|charged me twice|two charges|two .*charges|paid twice|charged twice)\b/.test(
      text,
    )
  ) {
    return {
      caseType: "duplicate_payment",
      department: "payments_ops",
      severity: "high",
    };
  }

  return undefined;
};

const classifyCase = (
  text: string,
  userType: AnalyzeTicketRequest["user_type"],
): CaseProfile => {
  if (/\b(refund|changed my mind|return my money|non-delivery|did not deliver)\b/.test(text)) {
    return {
      caseType: "refund_request",
      department:
        /\b(did not deliver|non-delivery|not deliver)\b/.test(text)
          ? "dispute_resolution"
          : "customer_support",
      severity:
        /\b(did not deliver|non-delivery|not deliver)\b/.test(text)
          ? "medium"
          : "low",
    };
  }

  if (/\b(settlement|settled|sales)\b/.test(text)) {
    return {
      caseType: "merchant_settlement_delay",
      department: "merchant_operations",
      severity: "medium",
    };
  }

  if (
    /\b(cash in|cash-in|agent)\b/.test(text) ||
    /(ক্যাশ ইন|এজেন্ট)/.test(text)
  ) {
    return {
      caseType: "agent_cash_in_issue",
      department: "agent_operations",
      severity: "high",
    };
  }

  if (
    /\b(failed|fail|stuck|balance deducted|deducted|payment.*gone|money is gone)\b/.test(
      text,
    ) ||
    /(পেমেন্ট|payment).{0,40}(ফেল|fail|কাটা|kete)/.test(text)
  ) {
    return {
      caseType: "payment_failed",
      department: "payments_ops",
      severity: "high",
    };
  }

  if (
    /\b(wrong number|wrong person|wrong recipient|mistake|reverse)\b/.test(
      text,
    ) ||
    /\b(accidentally sent|sent accidentally|accidental transfer)\b/.test(
      text,
    ) ||
    (/\b(sent|send|transfer|transferred)\b/.test(text) &&
      /\b(wrong|mistake)\b/.test(text)) ||
    (/\b(sent|send|transfer|transferred)\b/.test(text) &&
      /\b(did not get|didn't get|not received|not get|recipient)\b/.test(text))
  ) {
    return {
      caseType: "wrong_transfer",
      department: "dispute_resolution",
      severity: "high",
    };
  }

  return {
    caseType: "other",
    department: "customer_support",
    severity: "low",
  };
};

const findCandidateTransactions = (
  transactions: Transaction[],
  caseType: CaseType,
  amount?: number,
): Transaction[] => {
  const typeByCase: Partial<Record<CaseType, Transaction["type"]>> = {
    wrong_transfer: "transfer",
    payment_failed: "payment",
    refund_request: "payment",
    duplicate_payment: "payment",
    merchant_settlement_delay: "settlement",
    agent_cash_in_issue: "cash_in",
  };
  const expectedType = typeByCase[caseType];

  if (caseType === "refund_request") {
    const refunds = transactions.filter(
      (transaction) =>
        transaction.type === "refund" &&
        (!amount || transaction.amount === amount),
    );

    if (refunds.length > 0) {
      return refunds;
    }
  }

  if (caseType === "other") {
    const amountMatches = transactions.filter((transaction) =>
      amount ? transaction.amount === amount : true,
    );

    return amountMatches.length === 1 ? amountMatches : [];
  }

  return transactions.filter((transaction) => {
    const typeMatches = expectedType ? transaction.type === expectedType : true;
    const amountMatches = amount ? transaction.amount === amount : true;
    return typeMatches && amountMatches;
  });
};

const findDuplicatePayment = (
  transactions: Transaction[],
  amount?: number,
):
  | {
      transaction: Transaction;
      verdict: AnalyzeTicketResponse["evidence_verdict"];
    }
  | undefined => {
  const payments = transactions
    .filter(
    (transaction) =>
      transaction.type === "payment" &&
      (!amount || transaction.amount === amount),
  )
    .sort(
      (left, right) =>
        new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime(),
    );

  for (let index = 1; index < payments.length; index += 1) {
    const previous = payments[index - 1];
    const current = payments[index];

    if (
      previous.amount === current.amount
    ) {
      if (previous.counterparty !== current.counterparty) {
        return { transaction: current, verdict: "insufficient_data" };
      }

      const gapSeconds =
        Math.abs(
          new Date(current.timestamp).getTime() -
            new Date(previous.timestamp).getTime(),
        ) / 1000;

      if (previous.status !== "completed" || current.status !== "completed") {
        return { transaction: current, verdict: "inconsistent" };
      }

      return {
        transaction: current,
        verdict: gapSeconds <= 60 ? "consistent" : "insufficient_data",
      };
    }
  }

  return undefined;
};

const hasEstablishedRecipientPattern = (
  transactions: Transaction[],
  transaction: Transaction,
): boolean =>
  transactions.filter(
    (item) =>
      item.type === "transfer" &&
      item.counterparty === transaction.counterparty,
  ).length >= 3;

const determineEvidenceVerdict = (
  caseType: CaseType,
  transaction: Transaction,
  transactions: Transaction[],
): AnalyzeTicketResponse["evidence_verdict"] => {
  switch (caseType) {
    case "wrong_transfer":
      if (hasEstablishedRecipientPattern(transactions, transaction)) {
        return "inconsistent";
      }

      if (transaction.status === "failed" || transaction.status === "reversed") {
        return "inconsistent";
      }

      if (transaction.status === "pending") {
        return "insufficient_data";
      }

      return "consistent";
    case "payment_failed":
      if (transaction.status === "failed") {
        return "consistent";
      }

      if (transaction.status === "pending") {
        return "insufficient_data";
      }

      return "inconsistent";
    case "refund_request":
      if (transaction.type === "refund" || transaction.status === "failed" || transaction.status === "reversed") {
        return "inconsistent";
      }

      if (transaction.status === "pending") {
        return "insufficient_data";
      }

      return "consistent";
    case "merchant_settlement_delay":
      if (transaction.status === "completed" || transaction.status === "reversed") {
        return "inconsistent";
      }

      return "consistent";
    case "agent_cash_in_issue":
      if (transaction.status === "completed" || transaction.status === "reversed") {
        return "inconsistent";
      }

      return "consistent";
    default:
      return "consistent";
  }
};

const determineSeverity = (
  profile: CaseProfile,
  verdict: AnalyzeTicketResponse["evidence_verdict"],
  transaction: Transaction,
): Severity => {
  if (profile.caseType === "wrong_transfer" && transaction.status === "reversed") {
    return "low";
  }

  if (
    verdict === "inconsistent" &&
    (profile.caseType === "wrong_transfer" ||
      profile.caseType === "payment_failed" ||
      profile.caseType === "agent_cash_in_issue")
  ) {
    return "medium";
  }

  if (verdict === "insufficient_data" && profile.caseType !== "refund_request") {
    return "medium";
  }

  if (
    profile.caseType === "merchant_settlement_delay" &&
    transaction.status === "failed"
  ) {
    return "high";
  }

  if (
    profile.caseType === "merchant_settlement_delay" &&
    transaction.status === "completed"
  ) {
    return "low";
  }

  return profile.severity;
};

const shouldReviewAmbiguous = (
  profile: CaseProfile,
  candidateCount: number,
  complaint: string,
): boolean => {
  if (profile.caseType === "merchant_settlement_delay") {
    return candidateCount > 1;
  }

  if (profile.caseType === "refund_request") {
    return candidateCount > 1 || profile.department === "dispute_resolution";
  }

  if (profile.caseType === "other") {
    return false;
  }

  if (
    profile.caseType === "wrong_transfer" &&
    /\b(brother|sister|father|mother|family)\b/i.test(complaint) &&
    !/\b(wrong|mistake|accident)\b/i.test(complaint)
  ) {
    return false;
  }

  return true;
};

const shouldHumanReview = (
  profile: CaseProfile,
  verdict: AnalyzeTicketResponse["evidence_verdict"],
  transaction: Transaction,
): boolean =>
  profile.caseType === "duplicate_payment" ||
  profile.caseType === "agent_cash_in_issue" ||
  (profile.caseType === "wrong_transfer" && transaction.status !== "reversed") ||
  (profile.caseType === "payment_failed" && transaction.status !== "failed") ||
  (profile.caseType === "refund_request" &&
    profile.department === "dispute_resolution") ||
  (profile.caseType === "merchant_settlement_delay" &&
    (transaction.status === "failed" || transaction.status === "reversed")) ||
  (profile.caseType !== "merchant_settlement_delay" &&
    profile.caseType !== "refund_request" &&
    transaction.amount >= 5000 &&
    verdict === "consistent");

const buildReasonCodes = (
  caseType: CaseType,
  verdict: AnalyzeTicketResponse["evidence_verdict"],
  transaction: Transaction,
): ReasonCode[] => {
  if (verdict === "inconsistent") {
    return [
      caseType === "wrong_transfer"
        ? reasonCodes.wrongTransferClaim
        : reasonCodes.evidenceInconsistent,
      reasonCodes.establishedRecipientPattern,
      reasonCodes.evidenceInconsistent,
    ];
  }

  switch (caseType) {
    case "wrong_transfer":
      return [
        reasonCodes.wrongTransfer,
        reasonCodes.transactionMatch,
        reasonCodes.disputeInitiated,
      ];
    case "payment_failed":
      return [
        reasonCodes.paymentFailed,
        reasonCodes.potentialBalanceDeduction,
      ];
    case "refund_request":
      return [
        reasonCodes.refundRequest,
        reasonCodes.merchantPolicyDependent,
      ];
    case "merchant_settlement_delay":
      return [
        reasonCodes.merchantSettlement,
        transaction.status === "pending"
          ? reasonCodes.pending
          : reasonCodes.delay,
      ];
    case "agent_cash_in_issue":
      return [
        reasonCodes.agentCashIn,
        transaction.status === "pending"
          ? reasonCodes.pendingTransaction
          : reasonCodes.agentOps,
        reasonCodes.agentOps,
      ];
    case "duplicate_payment":
      return [
        reasonCodes.duplicatePayment,
        reasonCodes.billerVerificationRequired,
      ];
    default:
      return [reasonCodes.ruleBased, reasonCodes.transactionMatch];
  }
};

const buildSummary = (
  request: AnalyzeTicketRequest,
  caseType: CaseType,
  transaction: Transaction,
  verdict: AnalyzeTicketResponse["evidence_verdict"],
): string => {
  const base =
    `Customer complaint appears related to ${transaction.transaction_id}, a ${transaction.amount} BDT ${transaction.type} transaction with status ${transaction.status}.`;

  if (verdict === "inconsistent") {
    return `${base} Transaction history suggests the claim may conflict with prior activity.`;
  }

  if (caseType === "merchant_settlement_delay") {
    return `${base} Merchant reports settlement delay beyond the expected window.`;
  }

  if (request.language === "bn") {
    return `${base} Bangla complaint was mapped to the matching transaction.`;
  }

  return base;
};

const buildNextAction = (
  caseType: CaseType,
  transaction: Transaction,
): string => {
  const id = transaction.transaction_id;

  switch (caseType) {
    case "wrong_transfer":
      return `Verify ${id} with the customer and initiate the wrong-transfer dispute workflow per policy.`;
    case "payment_failed":
      return `Investigate ${id} ledger status and verify whether the failed payment caused a balance deduction.`;
    case "refund_request":
      return `Review ${id} and explain that refund eligibility depends on policy and merchant confirmation.`;
    case "merchant_settlement_delay":
      return `Route ${id} to merchant operations to verify settlement batch status.`;
    case "agent_cash_in_issue":
      return `Route ${id} to agent operations to verify pending cash-in status and agent settlement state.`;
    default:
      return `Review ${id} before taking any financial action.`;
  }
};

const buildReply = (
  request: AnalyzeTicketRequest,
  caseType: CaseType,
  transaction: Transaction,
): string => {
  const id = transaction.transaction_id;

  if (request.language === "bn") {
    return `আপনার লেনদেন ${id} এর বিষয়ে আমরা অবগত হয়েছি। আমাদের দল এটি যাচাই করবে এবং অফিসিয়াল চ্যানেলে আপনাকে জানাবে। অনুগ্রহ করে কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`;
  }

  switch (caseType) {
    case "payment_failed":
    case "duplicate_payment":
      return `We have noted your concern about transaction ${id}. Our payments team will review it and any eligible amount will be returned through official channels. Please do not share your PIN or OTP with anyone.`;
    case "refund_request":
      return `Thank you for reaching out about transaction ${id}. Refund eligibility depends on the applicable policy and merchant confirmation. Please do not share your PIN or OTP with anyone.`;
    case "merchant_settlement_delay":
      return `We have noted your concern about settlement ${id}. Our merchant operations team will check the batch status and update you through official channels.`;
    default:
      return `We have noted your concern about transaction ${id}. Our team will review the case and contact you through official support channels. Please do not share your PIN or OTP with anyone.`;
  }
};
