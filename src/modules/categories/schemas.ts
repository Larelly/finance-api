import { z } from "zod";

export const transactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const createCategorySchema = z.object({
  name: z.string().min(1).max(120),
  type: transactionTypeSchema,
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    type: transactionTypeSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.type !== undefined, {
    message: "Informe ao menos um campo para atualizar",
  });
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const categoryIdParamsSchema = z.object({
  id: z.string().uuid(),
});
