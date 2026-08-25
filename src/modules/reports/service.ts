import { monthRange, previousMonth } from "../../shared/time/monthRange.js";
import type { ReportRepository } from "./repository.js";
import type { MonthlyReportQuery } from "./schemas.js";

const CURRENCY = "BRL";

export function createReportService(repo: ReportRepository) {
  return {
    async monthly(userId: string, query: MonthlyReportQuery) {
      const { month, timezone } = query;
      const { start, end } = monthRange(month, timezone);

      const groups = await repo.groupByCategory(userId, start, end);

      const incomeTotal = groups
        .filter((g) => g.type === "INCOME")
        .reduce((sum, g) => sum + g.total, 0n);
      const expenseTotal = groups
        .filter((g) => g.type === "EXPENSE")
        .reduce((sum, g) => sum + g.total, 0n);

      const byCategory = groups
        .map((g) => {
          const typeTotal = g.type === "INCOME" ? incomeTotal : expenseTotal;
          const share = typeTotal === 0n ? 0 : Number(g.total) / Number(typeTotal);
          return {
            categoryId: g.categoryId,
            name: g.name,
            type: g.type,
            total: Number(g.total),
            share: Math.round(share * 10_000) / 10_000,
            transactionCount: g.transactionCount,
          };
        })
        .sort((a, b) => b.total - a.total);

      const previousMonthStr = previousMonth(month);
      const { start: prevStart, end: prevEnd } = monthRange(previousMonthStr, timezone);
      const hasPreviousData = await repo.hasAnyTransaction(userId, prevStart, prevEnd);

      let comparison: {
        previousMonth: string;
        expenseDelta: number;
        expenseDeltaPct: number;
      } | null = null;

      if (hasPreviousData) {
        const previousExpenseTotal = await repo.sumByType(userId, prevStart, prevEnd, "EXPENSE");
        const expenseDelta = Number(expenseTotal) - Number(previousExpenseTotal);
        const expenseDeltaPct =
          previousExpenseTotal === 0n ? 0 : expenseDelta / Number(previousExpenseTotal);

        comparison = {
          previousMonth: previousMonthStr,
          expenseDelta,
          expenseDeltaPct: Math.round(expenseDeltaPct * 10_000) / 10_000,
        };
      }

      return {
        month,
        currency: CURRENCY,
        totals: {
          income: Number(incomeTotal),
          expense: Number(expenseTotal),
          net: Number(incomeTotal) - Number(expenseTotal),
        },
        byCategory,
        comparison,
        generatedAt: new Date().toISOString(),
      };
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
