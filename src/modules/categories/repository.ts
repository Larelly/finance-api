import type { PrismaClient, TransactionType } from "@prisma/client";

export function createCategoryRepository(db: PrismaClient) {
  return {
    findAllByUser(userId: string) {
      return db.category.findMany({ where: { userId }, orderBy: { name: "asc" } });
    },

    findByIdForUser(id: string, userId: string) {
      return db.category.findFirst({ where: { id, userId } });
    },

    findByNameAndType(userId: string, name: string, type: TransactionType) {
      return db.category.findFirst({ where: { userId, name, type } });
    },

    create(data: { userId: string; name: string; type: TransactionType }) {
      return db.category.create({ data });
    },

    update(id: string, data: { name?: string; type?: TransactionType }) {
      return db.category.update({ where: { id }, data });
    },

    delete(id: string) {
      return db.category.delete({ where: { id } });
    },

    countTransactions(categoryId: string) {
      return db.transaction.count({ where: { categoryId, deletedAt: null } });
    },
  };
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
