interface TransactionLike {
  amountCents: bigint;
  [key: string]: unknown;
}

export function serializeTransaction<T extends TransactionLike>(transaction: T) {
  return { ...transaction, amountCents: Number(transaction.amountCents) };
}

export function serializeTransactions<T extends TransactionLike>(transactions: T[]) {
  return transactions.map(serializeTransaction);
}
