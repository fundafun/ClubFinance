/**
 * Balance Engine
 *
 * Given a list of expenses (each with a payer and a set of shares),
 * computes the net balance for each user: positive = owed money,
 * negative = owes money.
 */

export interface ExpenseForBalance {
  amount: number;
  paidById: string;
  shares: { userId: string; amount: number }[];
}

export interface Balance {
  userId: string;
  balance: number; // positive = is owed, negative = owes
}

export function computeBalances(expenses: ExpenseForBalance[]): Map<string, number> {
  const balances = new Map<string, number>();

  for (const expense of expenses) {
    // Payer gets credited the full amount they paid
    balances.set(expense.paidById, (balances.get(expense.paidById) || 0) + expense.amount);

    // Each participant is debited their share
    for (const share of expense.shares) {
      balances.set(share.userId, (balances.get(share.userId) || 0) - share.amount);
    }
  }

  return balances;
}

export interface Settlement {
  fromId: string;
  toId: string;
  amount: number;
}

/**
 * Debt Simplification
 *
 * Given net balances, produces the minimum set of payments needed
 * to settle all debts using a greedy max-debtor-to-max-creditor approach.
 */
export function simplifyDebts(balancesMap: Map<string, number>): Settlement[] {
  const EPSILON = 0.01;

  // Round to avoid floating point drift
  const balances: Balance[] = Array.from(balancesMap.entries())
    .map(([userId, balance]) => ({ userId, balance: Math.round(balance * 100) / 100 }))
    .filter((b) => Math.abs(b.balance) >= EPSILON);

  const settlements: Settlement[] = [];

  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b }));
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b }));

  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const debtor = debtors[i];
    const creditor = creditors[j];

    const amount = Math.min(-debtor.balance, creditor.balance);
    const rounded = Math.round(amount * 100) / 100;

    if (rounded >= EPSILON) {
      settlements.push({
        fromId: debtor.userId,
        toId: creditor.userId,
        amount: rounded,
      });
    }

    debtor.balance += rounded;
    creditor.balance -= rounded;

    if (Math.abs(debtor.balance) < EPSILON) i++;
    if (Math.abs(creditor.balance) < EPSILON) j++;
  }

  return settlements;
}
