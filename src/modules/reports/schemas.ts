import { z } from "zod";
import { isValidMonth, isValidTimeZone } from "../../shared/time/monthRange.js";

export const monthlyReportQuerySchema = z.object({
  month: z.string().refine(isValidMonth, { message: "month deve estar no formato YYYY-MM" }),
  timezone: z
    .string()
    .refine(isValidTimeZone, { message: "timezone inválido" })
    .default("America/Sao_Paulo"),
});
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
