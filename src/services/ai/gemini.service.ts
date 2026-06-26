import {
  GoogleGenerativeAI,
  type GenerationConfig,
} from "@google/generative-ai";
import {
  analyzeTicketResponseSchema,
  type AnalyzeTicketRequest,
  type AnalyzeTicketResponse,
} from "../../schemas";
import { AIServiceError } from "./ai-service-error";
import type { IAIService } from "./ai-service.interface";
import { buildQueueStormPrompt } from "./prompts/queuestorm.prompt";

export class GeminiService implements IAIService {
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;
  private readonly timeoutMs: number;
  private readonly generationConfig: GenerationConfig = {
    temperature: 0.1,
    responseMimeType: "application/json",
  };

  constructor(
    apiKey: string,
    modelName: string,
    timeoutMs: number,
  ) {
    if (!apiKey) {
      throw new AIServiceError("Gemini API key is not configured.");
    }

    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
    this.timeoutMs = timeoutMs;
  }

  async analyzeTicket(
    request: AnalyzeTicketRequest,
  ): Promise<AnalyzeTicketResponse> {
    const model = this.client.getGenerativeModel({
      model: this.modelName,
      generationConfig: this.generationConfig,
    });

    const result = await this.withTimeout(
      model.generateContent(buildQueueStormPrompt(request)),
    );
    const text = result.response.text();
    const parsedJson = this.parseJson(text);
    const parsedResponse = analyzeTicketResponseSchema.safeParse(parsedJson);

    if (!parsedResponse.success) {
      throw new AIServiceError("Gemini returned an invalid response shape.");
    }

    if (parsedResponse.data.ticket_id !== request.ticket_id) {
      throw new AIServiceError("Gemini returned a mismatched ticket_id.");
    }

    return parsedResponse.data;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new AIServiceError("Gemini request timed out."));
      }, this.timeoutMs);
    });

    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  private parseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      throw new AIServiceError("Gemini returned invalid JSON.");
    }
  }
}
