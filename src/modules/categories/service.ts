import { conflict, notFound } from "../../shared/http/errors.js";
import type { CategoryRepository } from "./repository.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "./schemas.js";

export function createCategoryService(repo: CategoryRepository) {
  return {
    list(userId: string) {
      return repo.findAllByUser(userId);
    },

    async create(userId: string, input: CreateCategoryInput) {
      const existing = await repo.findByNameAndType(userId, input.name, input.type);
      if (existing) {
        throw conflict("Já existe uma categoria com este nome e tipo");
      }
      return repo.create({ userId, name: input.name, type: input.type });
    },

    async update(userId: string, id: string, input: UpdateCategoryInput) {
      const category = await repo.findByIdForUser(id, userId);
      if (!category) {
        throw notFound("Categoria não encontrada");
      }

      const nextName = input.name ?? category.name;
      const nextType = input.type ?? category.type;

      if (nextName !== category.name || nextType !== category.type) {
        const clashing = await repo.findByNameAndType(userId, nextName, nextType);
        if (clashing && clashing.id !== id) {
          throw conflict("Já existe uma categoria com este nome e tipo");
        }
      }

      return repo.update(id, { name: nextName, type: nextType });
    },

    async delete(userId: string, id: string) {
      const category = await repo.findByIdForUser(id, userId);
      if (!category) {
        throw notFound("Categoria não encontrada");
      }

      const transactionCount = await repo.countTransactions(id);
      if (transactionCount > 0) {
        throw conflict("Categoria possui transações vinculadas e não pode ser removida");
      }

      await repo.delete(id);
    },
  };
}

export type CategoryService = ReturnType<typeof createCategoryService>;
