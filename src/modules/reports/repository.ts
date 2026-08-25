import type { PrismaClient } from "@prisma/client";

export function createReportRepository(db: PrismaClient) {
  return {
    async groupByCategory(userId: string, start: Date, end: Date) {
      const groups = await db.transaction.groupBy({
        by: ["categoryId", "type"],
        where: { userId, deletedAt: null, occurredAt: { gte: start, lt: end } },
        _sum: { amountCents: true },
        _count: { _all: true },
      });

      const categoryIds = [...new Set(groups.map((g) => g.categoryId))];
      const categories = categoryIds.length
        ? await db.category.findMany({ where: { id: { in: categoryIds } } })
        : [];
      const categoryById = new Map(categories.map((c) => [c.id, c]));

      return groups.map((g) => ({
        categoryId: g.categoryId,
        name: categoryById.get(g.categoryId)?.name ?? "Categoria removida",
        type: g.type,
        total: g._sum.amountCents ?? 0n,
        transactionCount: g._count._all,
      }));
    },

    async sumByType(userId: string, start: Date, end: Date, type: "INCOME" | "EXPENSE") {
      const result = await db.transaction.aggregate({
        where: { userId, deletedAt: null, type, occurredAt: { gte: start, lt: end } },
        _sum: { amountCents: true },
      });
      return result._sum.amountCents ?? 0n;
    },

    async hasAnyTransaction(userId: string, start: Date, end: Date) {
      const count = await db.transaction.count({
        where: { userId, deletedAt: null, occurredAt: { gte: start, lt: end } },
      });
      return count > 0;
    },
  };
}

export type ReportRepository = ReturnType<typeof createReportRepository>;
