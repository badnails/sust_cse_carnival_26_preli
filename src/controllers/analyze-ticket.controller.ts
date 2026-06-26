import {
  analyzeTicketRequestSchema,
  analyzeTicketResponseSchema,
  type AnalyzeTicketResponse,
} from "../schemas";
import { InvestigatorService } from "../services/investigator.service";
import { createFallbackResponse } from "../utils/fallback-response";

type HttpStatusSetter = {
  status?: unknown;
};

type ErrorResponse = {
  error: string;
};

export class AnalyzeTicketController {
  constructor(private readonly investigatorService: InvestigatorService) {}

  async analyze(
    body: unknown,
    set: HttpStatusSetter,
  ): Promise<AnalyzeTicketResponse | ErrorResponse> {
    const parsedRequest = analyzeTicketRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
      set.status = 400;
      return { error: "Invalid analyze-ticket request body." };
    }

    try {
      const analysis = await this.investigatorService.investigate(
        parsedRequest.data,
      );
      const parsedResponse = analyzeTicketResponseSchema.safeParse(analysis);

      if (parsedResponse.success) {
        return parsedResponse.data;
      }

      return createFallbackResponse(parsedRequest.data.ticket_id);
    } catch {
      return createFallbackResponse(parsedRequest.data.ticket_id);
    }
  }
}
