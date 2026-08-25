import { badRequest, notFound } from "../../shared/http/errors.js";
import type { CategoryRepository } from "../categories/repository.js";
import type { ListTransactionsQuery, CreateTransactionInput, UpdateTransactionInput } from "./schemas.js";
import type { TransactionRepository, TransactionSort } from "./repository.js";
import { serializeTransaction, serializeTransactions } from "./serializer.js";
import { paginate, toSkipTake } from "../../shared/http/pagination.js";

function parseSort(sort: string): TransactionSort {
  const [, direction] = sort.split(":") as [string, "asc" | "desc"];
  return { field: "occurredAt", direction };
}

export function createTransactionService(repo: TransactionRepository, categoryRepo: CategoryRepository) {
  async function assertCategoryMatchesType(userId: string, categoryId: string, type: "INCOME" | "EXPENSE") {
    const category = await categoryRepo.findByIdForUser(categoryId, userId);
    if (!category) {
      throw badRequest("Categoria não encontrada");
    }
    if (category.type !== type) {
      throw badRequest("O tipo da transação deve ser igual ao tipo da categoria");
    }
  }

  return {
    async list(userId: string, query: ListTransactionsQuery) {
      const { skip, take } = toSkipTake(query.page, query.pageSize);
      const sort = parseSort(query.sort);

      const { data, total } = await repo.list(
        userId,
        {
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
          ...(query.categoryId ? { categoryId: query.categoryId } : {}),
          ...(query.type ? { type: query.type } : {}),
        },
        sort,
        skip,
        take,
      );

      return paginate(serializeTransactions(data), query.page, query.pageSize, total);
    },

    async getById(userId: string, id: string) {
      const transaction = await repo.findByIdForUser(id, userId);
      if (!transaction) {
        throw notFound("Transação não encontrada");
      }
      return serializeTransaction(transaction);
    },

    async create(userId: string, input: CreateTransactionInput) {
      await assertCategoryMatchesType(userId, input.categoryId, input.type);

      const transaction = await repo.create({
        userId,
        categoryId: input.categoryId,
        type: input.type,
        amountCents: BigInt(input.amountCents),
        ...(input.description !== undefined ? { description: input.description } : {}),
        occurredAt: input.occurredAt,
      });

      return serializeTransaction(transaction);
    },

    async update(userId: string, id: string, input: UpdateTransactionInput) {
      const existing = await repo.findByIdForUser(id, userId);
      if (!existing) {
        throw notFound("Transação não encontrada");
      }

      const nextType = input.type ?? existing.type;
      const nextCategoryId = input.categoryId ?? existing.categoryId;

      if (input.type !== undefined || input.categoryId !== undefined) {
        await assertCategoryMatchesType(userId, nextCategoryId, nextType);
      }

      const transaction = await repo.update(id, {
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.amountCents !== undefined ? { amountCents: BigInt(input.amountCents) } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.occurredAt !== undefined ? { occurredAt: input.occurredAt } : {}),
      });

      return serializeTransaction(transaction);
    },

    async delete(userId: string, id: string) {
      const existing = await repo.findByIdForUser(id, userId);
      if (!existing) {
        throw notFound("Transação não encontrada");
      }
      await repo.softDelete(id);
    },
  };
}

export type TransactionService = ReturnType<typeof createTransactionService>;
