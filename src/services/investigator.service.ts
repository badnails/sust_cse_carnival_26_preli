import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
} from "../schemas";
import { createFallbackResponse } from "../utils/fallback-response";

export class InvestigatorService {
  async investigate(
    request: AnalyzeTicketRequest,
  ): Promise<AnalyzeTicketResponse> {
    return createFallbackResponse(request.ticket_id);
  }
}
