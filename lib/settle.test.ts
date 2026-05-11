import { describe, expect, it } from "vitest";
import {
  computeNets,
  dollarsStringToCents,
  formatCents,
  minTransactions,
  settle,
  sumNetCents,
} from "./settle";

function pid(name: string, cashoutCents: number) {
  return { id: name, name, cashoutCents };
}

describe("dollarsStringToCents", () => {
  it("parses integers and decimals", () => {
    expect(dollarsStringToCents("20")).toBe(2000);
    expect(dollarsStringToCents("20.5")).toBe(2050);
    expect(dollarsStringToCents("  1,234.56  ")).toBe(123456);
  });
  it("returns null for invalid", () => {
    expect(dollarsStringToCents("")).toBeNull();
    expect(dollarsStringToCents("abc")).toBeNull();
  });
});

describe("computeNets & conservation", () => {
  it("nets sum to zero when totals match", () => {
    const buyin = 2000;
    const players = [pid("A", 0), pid("B", 4000), pid("C", 2000), pid("D", 2000)];
    const nets = computeNets(buyin, players);
    expect(sumNetCents(nets)).toBe(0);
  });
});

describe("minTransactions", () => {
  it("settles three players in two transfers", () => {
    const nets = [
      { id: "a", name: "A", netCents: -1000 },
      { id: "b", name: "B", netCents: -1000 },
      { id: "c", name: "C", netCents: 2000 },
    ];
    const t = minTransactions(nets);
    expect(t).toHaveLength(2);
    const totalPaid = t.reduce((s, x) => s + x.cents, 0);
    expect(totalPaid).toBe(2000);
  });

  it("ignores zero-net players", () => {
    const nets = [
      { id: "a", name: "A", netCents: -500 },
      { id: "b", name: "B", netCents: 0 },
      { id: "c", name: "C", netCents: 500 },
    ];
    const t = minTransactions(nets);
    expect(t).toHaveLength(1);
    expect(t[0].cents).toBe(500);
  });

  it("two debtors one creditor uses two edges", () => {
    const nets = [
      { id: "a", name: "A", netCents: -1000 },
      { id: "b", name: "B", netCents: -1000 },
      { id: "c", name: "C", netCents: 2000 },
    ];
    expect(minTransactions(nets)).toHaveLength(2);
  });
});

describe("settle", () => {
  it("returns transfers on balanced input", () => {
    const buyin = 2000;
    const players = [pid("A", 0), pid("B", 4000), pid("C", 2000), pid("D", 2000)];
    const r = settle(buyin, players);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.transfers.length).toBeLessThanOrEqual(3);
      const paid = new Map<string, number>();
      const received = new Map<string, number>();
      for (const t of r.transfers) {
        paid.set(t.fromId, (paid.get(t.fromId) ?? 0) + t.cents);
        received.set(t.toId, (received.get(t.toId) ?? 0) + t.cents);
      }
      for (const n of r.nets) {
        if (n.netCents < 0) {
          expect(paid.get(n.id)).toBe(-n.netCents);
        }
        if (n.netCents > 0) {
          expect(received.get(n.id)).toBe(n.netCents);
        }
      }
    }
  });

  it("rejects imbalance", () => {
    const r = settle(2000, [pid("A", 0), pid("B", 1000)]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("imbalance");
      expect(r.imbalanceCents).not.toBe(0);
    }
  });

  it("handles no players", () => {
    const r = settle(100, []);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_players");
  });
});

describe("formatCents", () => {
  it("formats USD", () => {
    expect(formatCents(123456)).toBe("$1,234.56");
    expect(formatCents(-50)).toBe("-$0.50");
  });
});
