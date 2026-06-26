import type { Elysia } from "elysia";

export const registerHealthRoute = (app: Elysia): void => {
  app.get("/health", () => ({ status: "ok" }));
};
