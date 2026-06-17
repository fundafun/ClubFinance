/**
 * Expense Splitting
 *
 * Computes per-user share amounts given a split type and input data.
 */

export type SplitType = 'EQUAL' | 'CUSTOM' | 'PERCENTAGE';

export interface SplitInput {
  splitType: SplitType;
  amount: number;
  // For EQUAL: just userIds. For CUSTOM: userId -> amount. For PERCENTAGE: userId -> percentage.
  participants: string[];
  customAmounts?: Record<string, number>;
  percentages?: Record<string, number>;
}

export interface ShareResult {
  userId: string;
  amount: number;
  percentage?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeShares(input: SplitInput): ShareResult[] {
  const { splitType, amount, participants, customAmounts, percentages } = input;

  if (participants.length === 0) {
    throw new Error('At least one participant is required');
  }

  switch (splitType) {
    case 'EQUAL': {
      const base = Math.floor((amount / participants.length) * 100) / 100;
      let shares = participants.map((userId) => ({ userId, amount: base }));

      // Distribute remaining cents to make total exactly match
      const distributed = round2(base * participants.length);
      let remainder = round2(amount - distributed);
      let idx = 0;
      while (remainder >= 0.01) {
        shares[idx % shares.length].amount = round2(shares[idx % shares.length].amount + 0.01);
        remainder = round2(remainder - 0.01);
        idx++;
      }

      return shares;
    }

    case 'CUSTOM': {
      if (!customAmounts) throw new Error('customAmounts required for CUSTOM split');

      const shares = participants.map((userId) => ({
        userId,
        amount: round2(customAmounts[userId] ?? 0),
      }));

      const total = round2(shares.reduce((sum, s) => sum + s.amount, 0));
      if (Math.abs(total - amount) > 0.01) {
        throw new Error(`Custom amounts (${total}) must sum to expense total (${amount})`);
      }

      return shares;
    }

    case 'PERCENTAGE': {
      if (!percentages) throw new Error('percentages required for PERCENTAGE split');

      const totalPct = round2(
        participants.reduce((sum, userId) => sum + (percentages[userId] ?? 0), 0)
      );
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100 (got ${totalPct})`);
      }

      let shares = participants.map((userId) => {
        const pct = percentages[userId] ?? 0;
        return { userId, amount: round2((amount * pct) / 100), percentage: pct };
      });

      // Fix rounding remainder
      const distributed = round2(shares.reduce((sum, s) => sum + s.amount, 0));
      let remainder = round2(amount - distributed);
      let idx = 0;
      while (Math.abs(remainder) >= 0.01) {
        const delta = remainder > 0 ? 0.01 : -0.01;
        shares[idx % shares.length].amount = round2(shares[idx % shares.length].amount + delta);
        remainder = round2(remainder - delta);
        idx++;
      }

      return shares;
    }

    default:
      throw new Error(`Unknown split type: ${splitType}`);
  }
}
