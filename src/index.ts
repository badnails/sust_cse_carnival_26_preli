import { Elysia } from "elysia";
import { env } from "./config";
import { AnalyzeTicketController } from "./controllers/analyze-ticket.controller";
import { registerAnalyzeTicketRoute } from "./routes/analyze-ticket.route";
import { registerHealthRoute } from "./routes/health.route";
import { GeminiService, type IAIService } from "./services/ai";
import { InvestigatorService } from "./services/investigator.service";

const createAIService = (): IAIService | undefined => {
  if (env.geminiApiKeys.length === 0) {
    return undefined;
  }

  try {
    return new GeminiService(
      env.geminiApiKeys,
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
  if (code === "NOT_FOUND") {
    set.status = 404;
    return { error: "Not found." };
  }

  if (code === "VALIDATION") {
    set.status = 400;
    return { error: "Invalid request." };
  }

  set.status = 500;
  return { error: "Internal server error." };
});

if (import.meta.main) {
  app.listen(env.port);

  console.log(`QueueStorm Investigator API listening on ${app.server?.url}`);
}

export { app };
