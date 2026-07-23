// Shared presentational building blocks and style constants for the
// calculator page. Kept out of page.tsx to keep that file focused on logic.

import { BusIcon } from "./icons";

export const inputClass =
  "w-full rounded-lg border border-border bg-surface-muted px-3.5 py-2.5 text-foreground placeholder:text-muted/70 outline-none transition focus:border-primary focus:ring-4 focus:ring-[var(--ring)]";

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]";

export function Field({
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

export function LocationRow({
  label,
  id,
  value,
  onChange,
  placeholder,
  onRemove,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onRemove?: () => void;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 flex items-baseline justify-between gap-2"
      >
        <span className="text-sm font-medium text-foreground">{label}</span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className={`rounded text-xs font-medium text-muted transition hover:text-[var(--danger)] ${focusRing}`}
            aria-label={`Remove ${label}`}
          >
            Remove
          </button>
        )}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      />
    </div>
  );
}

export function NumberInput({
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

export function LineItem({
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

export function Header() {
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

export function Footer() {
  return (
    <footer className="mt-10 text-center text-xs text-muted no-print">
      Distances via OpenStreetMap &amp; OSRM. Always editable — you have the final
      say on the number.
    </footer>
  );
}
