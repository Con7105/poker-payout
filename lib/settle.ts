export type PlayerInput = {
  id: string;
  name: string;
  /** Amount this player put into the game (buy-in, including any top-up). */
  buyinCents: number;
  cashoutCents: number;
};

export type PlayerNet = {
  id: string;
  name: string;
  buyinCents: number;
  cashoutCents: number;
  netCents: number;
};

export type Transfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  cents: number;
};

/** Sum of nets must be within this many cents of zero (integer math → 0). */
export const CONSERVATION_TOLERANCE_CENTS = 0;

export function dollarsStringToCents(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(/,/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

export function computeNets(players: PlayerInput[]): PlayerNet[] {
  return players.map((p) => ({
    id: p.id,
    name: p.name,
    buyinCents: p.buyinCents,
    cashoutCents: p.cashoutCents,
    netCents: p.cashoutCents - p.buyinCents,
  }));
}

export function sumNetCents(nets: PlayerNet[]): number {
  return nets.reduce((s, p) => s + p.netCents, 0);
}

export function isConserved(
  nets: PlayerNet[],
  toleranceCents: number = CONSERVATION_TOLERANCE_CENTS,
): boolean {
  return Math.abs(sumNetCents(nets)) <= toleranceCents;
}

/**
 * Greedy debtor–creditor matching: each step pays min(|debt|, credit),
 * minimizing the number of non-zero transfers for a zero-sum settlement.
 */
export function minTransactions(nets: PlayerNet[]): Transfer[] {
  const balances = nets
    .filter((p) => p.netCents !== 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      remaining: p.netCents,
    }));

  const transfers: Transfer[] = [];

  while (true) {
    let debtorIdx = -1;
    let creditorIdx = -1;
    let minDebt = 0;
    let maxCredit = 0;

    for (let i = 0; i < balances.length; i++) {
      const r = balances[i].remaining;
      if (r < 0 && r < minDebt) {
        minDebt = r;
        debtorIdx = i;
      }
      if (r > 0 && r > maxCredit) {
        maxCredit = r;
        creditorIdx = i;
      }
    }

    if (debtorIdx < 0 || creditorIdx < 0) break;

    const debtor = balances[debtorIdx];
    const creditor = balances[creditorIdx];
    const pay = Math.min(-debtor.remaining, creditor.remaining);

    transfers.push({
      fromId: debtor.id,
      fromName: debtor.name,
      toId: creditor.id,
      toName: creditor.name,
      cents: pay,
    });

    debtor.remaining += pay;
    creditor.remaining -= pay;
  }

  return transfers;
}

export type SettleSuccess = {
  ok: true;
  nets: PlayerNet[];
  transfers: Transfer[];
};

export type SettleError = {
  ok: false;
  code: "imbalance" | "no_players";
  message: string;
  nets: PlayerNet[];
  imbalanceCents: number;
};

export type SettleResult = SettleSuccess | SettleError;

export function settle(players: PlayerInput[]): SettleResult {
  if (players.length === 0) {
    return {
      ok: false,
      code: "no_players",
      message: "Add at least one player with a name and cash-out amount.",
      nets: [],
      imbalanceCents: 0,
    };
  }

  const nets = computeNets(players);
  const imbalance = sumNetCents(nets);

  if (!isConserved(nets)) {
    return {
      ok: false,
      code: "imbalance",
      message:
        "Total cash-outs do not match total buy-ins. Check all buy-ins and cash-outs.",
      nets,
      imbalanceCents: imbalance,
    };
  }

  return {
    ok: true,
    nets,
    transfers: minTransactions(nets),
  };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const c = abs % 100;
  return `${sign}$${dollars.toLocaleString("en-US")}.${c.toString().padStart(2, "0")}`;
}
