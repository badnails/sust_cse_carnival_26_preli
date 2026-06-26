import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
} from "../../schemas";

export interface IAIService {
  analyzeTicket(
    request: AnalyzeTicketRequest,
  ): Promise<AnalyzeTicketResponse>;
}
