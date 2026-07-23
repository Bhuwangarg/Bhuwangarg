"use client";

import { useMemo, useRef, useState } from "react";
import { computeFare, formatINR, formatKm, formatRate } from "@/lib/fare";
import {
  Field,
  Footer,
  Header,
  LineItem,
  LocationRow,
  NumberInput,
  focusRing,
} from "./ui";
import {
  CheckIcon,
  CopyIcon,
  PlusIcon,
  PrintIcon,
  RouteIcon,
  Spinner,
} from "./icons";

type DistanceStatus =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok" }
  | { state: "error"; message: string };

type CopyStatus = "idle" | "ok" | "error";

type Stop = { id: number; value: string };

// A trip can pass through several stops, so keep the intermediate points as
// their own ordered list between the start and the destination.
const MAX_STOPS = 10;

export default function Home() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [distanceKm, setDistanceKm] = useState("");
  const [ratePerKm, setRatePerKm] = useState("");
  const [toll, setToll] = useState("");
  const [distance, setDistance] = useState<DistanceStatus>({ state: "idle" });
  const [copyStatus, setCopyStatus] = useState<CopyStatus>("idle");
  const nextStopId = useRef(0);

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

  // The trip in order: start, any stops, destination — trimmed, no blanks.
  const routePlaces = [from, ...stops.map((s) => s.value), to]
    .map((p) => p.trim())
    .filter(Boolean);
  const routeLabel = routePlaces.join(" → ");

  // Editing the route invalidates any previously auto-filled distance banner,
  // so we drop back to the idle state (the number stays, still editable).
  function clearDistanceBanner() {
    setDistance((d) => (d.state === "idle" ? d : { state: "idle" }));
  }

  function addStop() {
    setStops((s) => [...s, { id: nextStopId.current++, value: "" }]);
    clearDistanceBanner();
  }
  function updateStop(id: number, value: string) {
    setStops((s) => s.map((st) => (st.id === id ? { ...st, value } : st)));
    clearDistanceBanner();
  }
  function removeStop(id: number) {
    setStops((s) => s.filter((st) => st.id !== id));
    clearDistanceBanner();
  }

  async function fetchDistance() {
    if (routePlaces.length < 2) {
      setDistance({
        state: "error",
        message: "Enter at least a starting point and a destination first.",
      });
      return;
    }
    setDistance({ state: "loading" });
    setCopyStatus("idle");
    try {
      const params = new URLSearchParams();
      routePlaces.forEach((p) => params.append("points", p));
      const res = await fetch(`/api/distance?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setDistance({
          state: "error",
          message: data?.error ?? "Could not calculate the distance.",
        });
        return;
      }
      setDistanceKm(String(data.distanceKm));
      setDistance({ state: "ok" });
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
    setStops([]);
    setDistanceKm("");
    setRatePerKm("");
    setToll("");
    setDistance({ state: "idle" });
    setCopyStatus("idle");
  }

  async function copyQuote() {
    const routeLine =
      routePlaces.length >= 2 ? `Route: ${routePlaces.join(" → ")}\n` : "";
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
              <div className="mt-4 space-y-3">
                <LocationRow
                  label="From"
                  id="from"
                  value={from}
                  placeholder="e.g. Jaipur"
                  onChange={(v) => {
                    setFrom(v);
                    clearDistanceBanner();
                  }}
                />

                {stops.map((s, i) => (
                  <LocationRow
                    key={s.id}
                    label={`Stop ${i + 1}`}
                    id={`stop-${s.id}`}
                    value={s.value}
                    placeholder="e.g. Ajmer"
                    onChange={(v) => updateStop(s.id, v)}
                    onRemove={() => removeStop(s.id)}
                  />
                ))}

                <LocationRow
                  label="To"
                  id="to"
                  value={to}
                  placeholder="e.g. Udaipur"
                  onChange={(v) => {
                    setTo(v);
                    clearDistanceBanner();
                  }}
                />
              </div>

              <button
                type="button"
                onClick={addStop}
                disabled={stops.length >= MAX_STOPS}
                className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-sm font-medium text-muted transition hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
              >
                <PlusIcon /> Add stop
              </button>

              <div className="mt-4">
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
                      Total road distance through your route filled in. You can
                      edit it below.
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
                hint="total km — auto-filled or type it"
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
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Fare quote
              </h2>
              {routeLabel && (
                <span className="max-w-[60%] truncate text-right text-sm font-medium text-foreground">
                  {routeLabel}
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
