import { Elysia } from "elysia";
import { env } from "./config";
import { AnalyzeTicketController } from "./controllers/analyze-ticket.controller";
import { registerAnalyzeTicketRoute } from "./routes/analyze-ticket.route";
import { registerHealthRoute } from "./routes/health.route";
import { GeminiService, type IAIService } from "./services/ai";
import { InvestigatorService } from "./services/investigator.service";

const createAIService = (): IAIService | undefined => {
  if (!env.geminiApiKey) {
    return undefined;
  }

  try {
    return new GeminiService(
      env.geminiApiKey,
      env.geminiModel,
      env.geminiTimeoutMs,
    );
  } catch {
    return undefined;
  }
};

const investigatorService = new InvestigatorService(createAIService());
const analyzeTicketController = new AnalyzeTicketController(
  investigatorService,
);

const app = new Elysia();

registerHealthRoute(app);
registerAnalyzeTicketRoute(app, analyzeTicketController);

app.onError(({ code, set }) => {
  set.status = code === "VALIDATION" ? 400 : 500;

  return {
    error:
      code === "VALIDATION"
        ? "Invalid request."
        : "Internal server error.",
  };
});

if (import.meta.main) {
  app.listen(env.port);

  console.log(`QueueStorm Investigator API listening on ${app.server?.url}`);
}

export { app };
