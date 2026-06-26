import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
} from "../schemas";
import type { IAIService } from "./ai";
import { RuleBasedInvestigatorService } from "./rule-based-investigator.service";
import { createFallbackResponse } from "../utils/fallback-response";
import { SafetyGuard } from "../utils/safety-guard";

export class InvestigatorService {
  constructor(
    private readonly aiService?: IAIService,
    private readonly ruleBasedInvestigator = new RuleBasedInvestigatorService(),
    private readonly safetyGuard = new SafetyGuard(),
  ) {}

  async investigate(
    request: AnalyzeTicketRequest,
  ): Promise<AnalyzeTicketResponse> {
    try {
      const response = this.aiService
        ? await this.aiService.analyzeTicket(request)
        : this.ruleBasedInvestigator.investigate(request);

      return this.safetyGuard.sanitize(response);
    } catch {
      try {
        return this.safetyGuard.sanitize(
          this.ruleBasedInvestigator.investigate(request),
        );
      } catch {
        return this.safetyGuard.sanitize(
          createFallbackResponse(request.ticket_id),
        );
      }
    }
  }
}
