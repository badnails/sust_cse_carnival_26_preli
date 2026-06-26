import { z } from "zod";
import {
  transactionStatusSchema,
  transactionTypeSchema,
} from "./enums";

export const transactionSchema = z
  .object({
    transaction_id: z.string().trim().min(1),
    timestamp: z.string().datetime(),
    type: transactionTypeSchema,
    amount: z.number().finite().nonnegative(),
    counterparty: z.string().trim().min(1),
    status: transactionStatusSchema,
  })
  .passthrough();

export type Transaction = z.infer<typeof transactionSchema>;
