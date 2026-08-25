import type { Prisma, PrismaClient, TransactionType } from "@prisma/client";

export interface TransactionFilters {
  from?: Date;
  to?: Date;
  categoryId?: string;
  type?: TransactionType;
}

export interface TransactionSort {
  field: "occurredAt";
  direction: "asc" | "desc";
}

export function createTransactionRepository(db: PrismaClient) {
  function buildWhere(userId: string, filters: TransactionFilters): Prisma.TransactionWhereInput {
    const where: Prisma.TransactionWhereInput = { userId, deletedAt: null };

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.type) where.type = filters.type;

    if (filters.from || filters.to) {
      where.occurredAt = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lt: filters.to } : {}),
      };
    }

    return where;
  }

  return {
    async list(
      userId: string,
      filters: TransactionFilters,
      sort: TransactionSort,
      skip: number,
      take: number,
    ) {
      const where = buildWhere(userId, filters);

      const [data, total] = await Promise.all([
        db.transaction.findMany({
          where,
          orderBy: { [sort.field]: sort.direction },
          skip,
          take,
          include: { category: true },
        }),
        db.transaction.count({ where }),
      ]);

      return { data, total };
    },

    findByIdForUser(id: string, userId: string) {
      return db.transaction.findFirst({
        where: { id, userId, deletedAt: null },
        include: { category: true },
      });
    },

    create(data: {
      userId: string;
      categoryId: string;
      type: TransactionType;
      amountCents: bigint;
      description?: string | undefined;
      occurredAt: Date;
    }) {
      return db.transaction.create({ data, include: { category: true } });
    },

    update(
      id: string,
      data: Partial<{
        categoryId: string;
        type: TransactionType;
        amountCents: bigint;
        description: string | null;
        occurredAt: Date;
      }>,
    ) {
      return db.transaction.update({ where: { id }, data, include: { category: true } });
    },

    softDelete(id: string) {
      return db.transaction.update({ where: { id }, data: { deletedAt: new Date() } });
    },
  };
}

export type TransactionRepository = ReturnType<typeof createTransactionRepository>;
