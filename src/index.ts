import { Elysia } from "elysia";
import { AnalyzeTicketController } from "./controllers/analyze-ticket.controller";
import { registerAnalyzeTicketRoute } from "./routes/analyze-ticket.route";
import { registerHealthRoute } from "./routes/health.route";
import { InvestigatorService } from "./services/investigator.service";

const port = Number(Bun.env.PORT ?? 8000);

const investigatorService = new InvestigatorService();
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
  app.listen(port);

  console.log(`QueueStorm Investigator API listening on ${app.server?.url}`);
}

export { app };
