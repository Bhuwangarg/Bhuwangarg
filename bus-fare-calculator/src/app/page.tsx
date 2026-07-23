"use client";

import { useMemo, useState } from "react";
import { computeFare, formatINR, formatKm, formatRate } from "@/lib/fare";

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

/* ---------------------------------------------------------------- */
/* Small presentational helpers                                     */
/* ---------------------------------------------------------------- */

const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-foreground placeholder:text-muted/70 outline-none transition focus:border-primary focus:ring-4 focus:ring-[var(--ring)]";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 flex items-baseline justify-between gap-2"
      >
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function NumberInput({
  id,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          {prefix}
        </span>
      )}
      <input
        id={id}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} ${prefix ? "pl-8" : ""} ${
          suffix ? "pr-12" : ""
        }`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

function LineItem({
  label,
  detail,
  value,
}: {
  label: string;
  detail: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        <p className="truncate text-xs text-muted">{detail}</p>
      </div>
      <span className="shrink-0 font-mono text-base font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <BusIcon />
      </div>
      <div>
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
          Bus Fare Calculator
        </h1>
        <p className="text-sm text-muted">
          Instant trip quotes — distance × your rate, plus toll.
        </p>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-10 text-center text-xs text-muted no-print">
      Distances via OpenStreetMap &amp; OSRM. Always editable — you have the final
      say on the number.
    </footer>
  );
}

/* ---- Icons (inline SVG, no dependencies) ---- */

function BusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 16V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10M4 16h16M4 16v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2m10 0v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2M4 9h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
      <circle cx="16" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function RouteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6" cy="19" r="2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="5" r="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 19h6a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9V3h12v6M6 18H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1M6 14h12v7H6z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
