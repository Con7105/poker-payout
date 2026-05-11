import { describe, expect, it } from "vitest";
import {
  computeNets,
  dollarsStringToCents,
  formatCents,
  minTransactions,
  settle,
  sumNetCents,
} from "./settle";

function p(id: string, buyinCents: number, cashoutCents: number) {
  return { id, name: id, buyinCents, cashoutCents };
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
  it("nets sum to zero when uniform buy-ins and totals match", () => {
    const players = [
      p("A", 2000, 0),
      p("B", 2000, 4000),
      p("C", 2000, 2000),
      p("D", 2000, 2000),
    ];
    const nets = computeNets(players);
    expect(sumNetCents(nets)).toBe(0);
  });

  it("nets sum to zero with different buy-ins per player", () => {
    const players = [p("A", 1000, 0), p("B", 1500, 2500)];
    const nets = computeNets(players);
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
    const players = [
      p("A", 2000, 0),
      p("B", 2000, 4000),
      p("C", 2000, 2000),
      p("D", 2000, 2000),
    ];
    const r = settle(players);
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

  it("settles with mixed buy-ins", () => {
    const r = settle([p("A", 1000, 0), p("B", 1500, 2500)]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.transfers).toHaveLength(1);
      expect(r.transfers[0].fromName).toBe("A");
      expect(r.transfers[0].toName).toBe("B");
      expect(r.transfers[0].cents).toBe(1000);
    }
  });

  it("rejects imbalance", () => {
    const r = settle([p("A", 2000, 0), p("B", 2000, 1000)]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("imbalance");
      expect(r.imbalanceCents).not.toBe(0);
    }
  });

  it("handles no players", () => {
    const r = settle([]);
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
