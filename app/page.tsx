"use client";

import { useMemo, useState } from "react";
import {
  dollarsStringToCents,
  formatCents,
  settle,
  type PlayerInput,
  type Transfer,
} from "@/lib/settle";

type Row = { id: string; name: string; buyin: string; cashout: string };

function newRow(defaultBuyin?: string): Row {
  return {
    id: crypto.randomUUID(),
    name: "",
    buyin: defaultBuyin ?? "",
    cashout: "",
  };
}

type BuyinMode = "uniform" | "custom";

function buildPlayers(
  rows: Row[],
  mode: BuyinMode,
  uniformBuyinCents: number,
): { players: PlayerInput[]; parseError: string | null } {
  const players: PlayerInput[] = [];
  for (const row of rows) {
    const name = row.name.trim();
    const cashout = dollarsStringToCents(row.cashout);
    const rowHasData =
      name !== "" ||
      row.cashout.trim() !== "" ||
      (mode === "custom" && row.buyin.trim() !== "");
    if (!rowHasData) continue;

    if (name === "") {
      return { players: [], parseError: "Each filled row needs a player name." };
    }
    if (cashout === null) {
      return {
        players: [],
        parseError: `Invalid cash-out amount for "${name}". Use dollars (e.g. 120 or 120.50).`,
      };
    }

    let buyinCents: number;
    if (mode === "uniform") {
      buyinCents = uniformBuyinCents;
    } else {
      const parsed = dollarsStringToCents(row.buyin);
      if (parsed === null) {
        return {
          players: [],
          parseError: `Invalid buy-in amount for "${name}". Use dollars (e.g. 10 or 15.00).`,
        };
      }
      buyinCents = parsed;
    }

    players.push({ id: row.id, name, buyinCents, cashoutCents: cashout });
  }
  return { players, parseError: null };
}

function transfersSummary(transfers: Transfer[]): string {
  return transfers
    .map((t) => `${t.fromName} pays ${t.toName} ${formatCents(t.cents)}`)
    .join("\n");
}

export default function Home() {
  const [buyinMode, setBuyinMode] = useState<BuyinMode>("uniform");
  const [buyin, setBuyin] = useState("20");
  const [rows, setRows] = useState<Row[]>(() => [newRow(), newRow()]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ReturnType<typeof settle> | null>(null);

  const buyinCents = useMemo(() => dollarsStringToCents(buyin), [buyin]);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow(buyinMode === "custom" ? buyin : undefined)]);
  }

  function removeRow(id: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.id !== id)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParseError(null);
    setResult(null);

    if (buyinMode === "uniform" && buyinCents === null) {
      setParseError("Enter a valid buy-in amount (e.g. 20 or 20.00).");
      return;
    }

    const uniform = buyinMode === "uniform" ? (buyinCents as number) : 0;
    const { players, parseError: pe } = buildPlayers(rows, buyinMode, uniform);
    if (pe) {
      setParseError(pe);
      return;
    }

    setResult(settle(players));
  }

  const summary =
    result?.ok === true ? transfersSummary(result.transfers) : "";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Poker buy-in settlement
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Enter buy-ins and each player&apos;s cash-out (same buy-in for everyone, or
          custom per player). You get the fewest Venmo-style transfers so everyone nets
          out correctly.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-lg"
      >
        <fieldset className="border-0 p-0">
          <legend className="text-sm font-medium text-slate-300">Buy-in</legend>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="radio"
                name="buyinMode"
                className="accent-blue-500"
                checked={buyinMode === "uniform"}
                onChange={() => setBuyinMode("uniform")}
              />
              Same for everyone
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
              <input
                type="radio"
                name="buyinMode"
                className="accent-blue-500"
                checked={buyinMode === "custom"}
                onChange={() => setBuyinMode("custom")}
              />
              Custom per player
            </label>
          </div>
        </fieldset>

        {buyinMode === "uniform" && (
          <label className="mt-4 block">
            <span className="text-sm font-medium text-slate-300">Buy-in per player ($)</span>
            <input
              type="text"
              inputMode="decimal"
              value={buyin}
              onChange={(e) => setBuyin(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-white outline-none ring-blue-500 focus:ring-2"
              autoComplete="off"
            />
          </label>
        )}

        <div className="mt-8">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-300">
              Players{buyinMode === "custom" ? ", buy-ins, & cash-outs" : " & cash-outs"}
            </span>
            <button
              type="button"
              onClick={addRow}
              className="text-sm font-medium text-blue-400 hover:text-blue-300"
            >
              + Add player
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {rows.map((row, i) => (
              <div key={row.id} className="flex flex-wrap items-end gap-3">
                <label className="min-w-[120px] flex-1">
                  <span className="text-xs text-slate-500">Name</span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, { name: e.target.value })}
                    placeholder={`Player ${i + 1}`}
                    className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />
                </label>
                {buyinMode === "custom" && (
                  <label className="min-w-[100px] w-[110px]">
                    <span className="text-xs text-slate-500">Buy-in ($)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.buyin}
                      onChange={(e) => updateRow(row.id, { buyin: e.target.value })}
                      placeholder={buyin || "10"}
                      className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                      autoComplete="off"
                    />
                  </label>
                )}
                <label className="min-w-[100px] flex-1">
                  <span className="text-xs text-slate-500">Cash-out ($)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={row.cashout}
                    onChange={(e) => updateRow(row.id, { cashout: e.target.value })}
                    placeholder="0.00"
                    className="mt-0.5 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                    autoComplete="off"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  className="rounded-lg px-2 py-2 text-sm text-slate-500 hover:bg-white/5 hover:text-slate-300"
                  aria-label="Remove row"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Calculate transfers
          </button>
        </div>
      </form>

      {parseError && (
        <div
          className="mt-6 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          {parseError}
        </div>
      )}

      {result && !result.ok && (
        <div
          className="mt-6 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <p className="font-medium">{result.message}</p>
          <p className="mt-1 text-red-300/90">
            Imbalance: {formatCents(result.imbalanceCents)} (sum of cash-outs minus sum of
            buy-ins should equal zero).
          </p>
        </div>
      )}

      {result?.ok === true && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold text-white">Transfers</h2>
          <p className="mt-1 text-sm text-slate-400">
            {result.transfers.length} transaction
            {result.transfers.length === 1 ? "" : "s"} (minimum for this table).
          </p>

          {result.transfers.length === 0 ? (
            <p className="mt-4 text-slate-400">Everyone broke even — no payments needed.</p>
          ) : (
            <>
              <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border)] bg-black/20 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">From</th>
                      <th className="px-4 py-3 font-medium">To</th>
                      <th className="px-4 py-3 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.transfers.map((t, idx) => (
                      <tr
                        key={`${t.fromId}-${t.toId}-${idx}`}
                        className="border-b border-[var(--border)]/60 last:border-0"
                      >
                        <td className="px-4 py-3 text-white">{t.fromName}</td>
                        <td className="px-4 py-3 text-white">{t.toName}</td>
                        <td className="px-4 py-3 font-mono text-emerald-300">
                          {formatCents(t.cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Copy for Venmo / text
                </p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-black/30 p-4 font-sans text-sm text-slate-200">
                  {summary}
                </pre>
                <button
                  type="button"
                  onClick={() => void navigator.clipboard.writeText(summary)}
                  className="mt-2 text-sm font-medium text-blue-400 hover:text-blue-300"
                >
                  Copy to clipboard
                </button>
              </div>
            </>
          )}

          <details className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--surface)]/50 px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-slate-400">
              Net by player
            </summary>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              {result.nets.map((n) => (
                <li
                  key={n.id}
                  className="flex flex-col gap-0.5 border-b border-[var(--border)]/40 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="font-medium text-white">{n.name}</span>
                  <span className="font-mono text-xs text-slate-400 sm:text-right">
                    buy-in {formatCents(n.buyinCents)} · cash-out {formatCents(n.cashoutCents)}{" "}
                    · net{" "}
                    <span className="text-slate-200">
                      {n.netCents === 0 ? "even" : formatCents(n.netCents)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </main>
  );
}
