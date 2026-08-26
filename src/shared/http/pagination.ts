export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export function paginate<T>(data: T[], page: number, pageSize: number, total: number): Paginated<T> {
  return { data, page, pageSize, total };
}

export function toSkipTake(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}
