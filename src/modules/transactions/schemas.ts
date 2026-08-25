import { z } from "zod";
import { transactionTypeSchema } from "../categories/schemas.js";

export const createTransactionSchema = z.object({
  categoryId: z.string().uuid(),
  type: transactionTypeSchema,
  amountCents: z.number().int().positive(),
  description: z.string().max(500).optional(),
  occurredAt: z.coerce.date(),
});
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    categoryId: z.string().uuid().optional(),
    type: transactionTypeSchema.optional(),
    amountCents: z.number().int().positive().optional(),
    description: z.string().max(500).nullable().optional(),
    occurredAt: z.coerce.date().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualizar",
  });
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const transactionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

const sortSchema = z
  .enum(["occurred_at:asc", "occurred_at:desc"])
  .default("occurred_at:desc");

export const listTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  sort: sortSchema,
});
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;
