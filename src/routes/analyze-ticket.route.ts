import type { Elysia } from "elysia";
import { AnalyzeTicketController } from "../controllers/analyze-ticket.controller";

export const registerAnalyzeTicketRoute = (
  app: Elysia,
  controller: AnalyzeTicketController,
): void => {
  app.post("/analyze-ticket", ({ body, set }) =>
    controller.analyze(body, set),
  );
};
