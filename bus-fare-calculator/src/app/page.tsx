"use client";

import { useMemo, useState } from "react";
import { computeFare, formatINR, formatKm, formatRate } from "@/lib/fare";
import {
  Field,
  Footer,
  Header,
  LineItem,
  NumberInput,
  focusRing,
  inputClass,
} from "./ui";
import { CheckIcon, CopyIcon, PrintIcon, RouteIcon, Spinner } from "./icons";

type DistanceStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; from: string; to: string }
  | { state: "error"; message: string };

type CopyStatus = "idle" | "ok" | "error";

export default function Home() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [distanceKm, setDistanceKm] = useState("");
  const [ratePerKm, setRatePerKm] = useState("");
  const [toll, setToll] = useState("");
  const [distance, setDistance] = useState<DistanceStatus>({ state: "idle" });
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");

  const fare = useMemo(
    () =>
      computeFare({
        distanceKm: Number(distanceKm),
        ratePerKm: Number(ratePerKm),
        tollAmount: Number(toll),
      }),
    [distanceKm, ratePerKm, toll],
  );

  const hasQuote = fare.distanceKm > 0 && fare.ratePerKm > 0;

  // Editing the route invalidates any previously auto-filled distance banner,
  // so we drop back to the idle state (the number stays, still editable).
  function clearDistanceBanner() {
    setDistance((d) => (d.state === "idle" ? d : { state: "idle" }));
  }

  async function fetchDistance() {
    if (!from.trim() || !to.trim()) {
      setDistance({
        state: "error",
        message: "Enter both the starting point and the destination first.",
      });
      return;
    }
    setDistance({ state: "loading" });
    setCopyStatus("idle");
    try {
      const res = await fetch(
        `/api/distance?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
          to,
        )}`,
      );
      const data = await res.json();
      if (!res.ok) {
        setDistance({
          state: "error",
          message: data?.error ?? "Could not calculate the distance.",
        });
        return;
      }
      setDistanceKm(String(data.distanceKm));
      setDistance({ state: "ok", from: data.from, to: data.to });
    } catch {
      setDistance({
        state: "error",
        message:
          "Network problem reaching the distance service. Enter the distance manually.",
      });
    }
  }

  function resetAll() {
    setFrom("");
    setTo("");
    setDistanceKm("");
    setRatePerKm("");
    setToll("");
    setDistance({ state: "idle" });
    setCopyStatus("idle");
  }

  async function copyQuote() {
    const routeLine =
      from.trim() && to.trim() ? `Route: ${from.trim()} → ${to.trim()}\n` : "";
    const text =
      `Bus trip quote\n` +
      routeLine +
      `Distance: ${formatKm(fare.distanceKm)}\n` +
      `Rate: ${formatRate(fare.ratePerKm)}/km\n` +
      `Distance charge: ${formatINR(fare.distanceCost)}\n` +
      (fare.tollAmount > 0
        ? `Toll & extras: ${formatINR(fare.tollAmount)}\n`
        : "") +
      `Total fare: ${formatINR(fare.total)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("ok");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
    }
  }

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <Header />

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          {/* ---- Inputs ---- */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7 no-print">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Trip details
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                fetchDistance();
              }}
            >
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="From" htmlFor="from">
                  <input
                    id="from"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder="e.g. Jaipur"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      clearDistanceBanner();
                    }}
                    className={inputClass}
                  />
                </Field>
                <Field label="To" htmlFor="to">
                  <input
                    id="to"
                    type="text"
                    autoComplete="off"
                    placeholder="e.g. Udaipur"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      clearDistanceBanner();
                    }}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-3">
                <button
                  type="submit"
                  aria-busy={distance.state === "loading"}
                  disabled={distance.state === "loading"}
                  className={`inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted px-3.5 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
                >
                  {distance.state === "loading" ? (
                    <>
                      <Spinner /> Calculating…
                    </>
                  ) : (
                    <>
                      <RouteIcon /> Auto-calculate distance
                    </>
                  )}
                </button>

                {/* Announced to screen readers when it changes. */}
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="mt-2 empty:mt-0"
                >
                  {distance.state === "loading" && (
                    <span className="sr-only">Calculating distance…</span>
                  )}
                  {distance.state === "ok" && (
                    <p className="text-xs text-[var(--success-text)]">
                      Road distance filled in from the map. You can edit it
                      below.
                    </p>
                  )}
                  {distance.state === "error" && (
                    <p className="text-xs text-[var(--danger)]">
                      {distance.message}
                    </p>
                  )}
                </div>
              </div>
            </form>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field
                label="Distance"
                htmlFor="distance"
                hint="kilometres — auto-filled or type it"
              >
                <NumberInput
                  id="distance"
                  value={distanceKm}
                  onChange={setDistanceKm}
                  suffix="km"
                  placeholder="0"
                />
              </Field>
              <Field label="Rate per km" htmlFor="rate" hint="your preferred rate">
                <NumberInput
                  id="rate"
                  value={ratePerKm}
                  onChange={setRatePerKm}
                  prefix="₹"
                  placeholder="0"
                />
              </Field>
            </div>

            <div className="mt-4">
              <Field
                label="Toll & extra charges"
                htmlFor="toll"
                hint="toll tax, parking, permits — optional"
              >
                <NumberInput
                  id="toll"
                  value={toll}
                  onChange={setToll}
                  prefix="₹"
                  placeholder="0"
                />
              </Field>
            </div>

            <button
              type="button"
              onClick={resetAll}
              className={`mt-6 rounded text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline ${focusRing}`}
            >
              Clear all
            </button>
          </section>

          {/* ---- Quote ---- */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7 lg:sticky lg:top-8">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Fare quote
              </h2>
              {(from.trim() || to.trim()) && (
                <span className="max-w-[55%] truncate text-right text-sm font-medium text-foreground">
                  {from.trim() || "—"} → {to.trim() || "—"}
                </span>
              )}
            </div>

            <div className="mt-5 space-y-3">
              <LineItem
                label="Distance × rate"
                detail={
                  hasQuote
                    ? `${formatKm(fare.distanceKm)} × ${formatRate(
                        fare.ratePerKm,
                      )}/km`
                    : "enter distance and rate"
                }
                value={formatINR(fare.distanceCost)}
              />
              <LineItem
                label="Toll & extra charges"
                detail={fare.tollAmount > 0 ? "added to fare" : "none"}
                value={formatINR(fare.tollAmount)}
              />
            </div>

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex items-end justify-between">
                <span className="text-sm font-medium text-muted">Total fare</span>
                <span
                  className={`font-mono text-3xl font-bold tracking-tight sm:text-4xl ${
                    hasQuote ? "text-foreground" : "text-muted"
                  }`}
                >
                  {formatINR(fare.total)}
                </span>
              </div>
              <p className="mt-1 text-right text-xs text-muted">
                amount to charge the customer
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 no-print">
              <button
                type="button"
                onClick={copyQuote}
                disabled={!hasQuote}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                {copyStatus === "ok" ? <CheckIcon /> : <CopyIcon />}
                {copyStatus === "ok" ? "Copied!" : "Copy quote"}
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={!hasQuote}
                className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                <PrintIcon /> Print
              </button>
            </div>

            {copyStatus === "error" && (
              <p className="mt-3 text-xs text-[var(--danger)] no-print">
                Couldn&apos;t copy automatically — select the quote text and copy
                it manually.
              </p>
            )}

            {/* SR-only confirmation for the copy action. */}
            <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
              {copyStatus === "ok"
                ? "Quote copied to clipboard."
                : copyStatus === "error"
                  ? "Could not copy the quote."
                  : ""}
            </div>

            {!hasQuote && (
              <p className="mt-4 text-center text-xs text-muted no-print">
                Fill in the distance and your rate per km to see the total.
              </p>
            )}
          </section>
        </div>

        <Footer />
      </div>
    </main>
  );
}
