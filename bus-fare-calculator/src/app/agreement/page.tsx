"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field, focusRing, inputClass } from "../ui";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudUploadIcon,
  PrintIcon,
  Spinner,
  WhatsAppIcon,
} from "../icons";
import {
  AgreementData,
  BUS_TYPES,
  Lang,
  PAYMENT_TYPES,
  TRIP_TYPES,
  buildAgreement,
} from "@/lib/agreement";
import { HI_LABELS } from "@/lib/agreementHindi";

// A unique, human-readable agreement reference, e.g. "ML-260725-4F7A".
// Date part (YYMMDD) keeps it sortable; the random tail makes each one unique
// so a genuine agreement can be matched against the saved Drive record.
function makeAgreementId(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ML-${yy}${mm}${dd}-${rand}`;
}

// Strip the "data:...;base64," prefix so only the raw base64 payload is sent.
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// A blank form for a new agreement: fresh unique id and today's dates.
function newBlank(): AgreementData {
  const today = new Date().toISOString().slice(0, 10);
  return {
    ...EMPTY,
    serialNo: makeAgreementId(),
    agreementDate: today,
    advanceDate: today,
  };
}

const EMPTY: AgreementData = {
  serialNo: "",
  agreementDate: "",
  tripType: "baraat",
  busType: "full",
  paymentType: "cash",
  name: "",
  fatherName: "",
  address: "",
  mobile: "",
  advanceDate: "",
  signAmount: "",
  ratePerKm: "",
  finalAmount: "",
  pickupCity: "",
  dropCity: "",
  fromDate: "",
  fromTime: "",
  toDate: "",
  toTime: "",
  returnPlace: "",
  paxCount: "",
  extraPaxCharge: "",
  beforeAmount: "",
  betweenAmount: "",
  returnAmount: "",
  localExtraPerKm: "",
  remark: "",
};

export default function AgreementPage() {
  const [lang, setLang] = useState<Lang>("hi");
  const [data, setData] = useState<AgreementData>(EMPTY);
  const [sharing, setSharing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "notset" | "error"
  >("idle");
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  // Prefill today's date and a unique agreement id (client-only, avoids SSR
  // hydration mismatch — Date/random must not run during server render).
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only prefill after mount
    setData((d) => ({
      ...d,
      agreementDate: d.agreementDate || today,
      advanceDate: d.advanceDate || today,
      serialNo: d.serialNo || makeAgreementId(),
    }));
  }, []);

  const set = <K extends keyof AgreementData>(k: K, v: AgreementData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const doc = useMemo(() => buildAgreement(data, lang), [data, lang]);

  const docFont =
    lang === "hi"
      ? "'Noto Sans Devanagari','Nirmala UI','Mangal','Kohinoor Devanagari',system-ui,sans-serif"
      : "Georgia,'Times New Roman',serif";

  // A short WhatsApp caption summarising the trip.
  function shareText(): string {
    const hi = lang === "hi";
    return [
      `${doc.company.name} - ${doc.title}`,
      data.name ? `${hi ? HI_LABELS.customer : "Customer"}: ${data.name}` : "",
      data.pickupCity || data.dropCity
        ? `${hi ? HI_LABELS.route : "Route"}: ${data.pickupCity || "?"} -> ${data.dropCity || "?"}`
        : "",
      data.finalAmount
        ? `${hi ? HI_LABELS.totalFare : "Total fare"}: Rs. ${
            Number.isFinite(Number(data.finalAmount))
              ? Number(data.finalAmount).toLocaleString("en-IN")
              : data.finalAmount
          }`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  // If the customer's mobile is filled, target that chat directly.
  function whatsappNumber(): string {
    const digits = (data.mobile.match(/\d/g) || []).join("");
    return digits.length >= 10 ? "91" + digits.slice(-10) : "";
  }

  // Render the live agreement document to a single PDF Blob. Shared by the
  // WhatsApp share and the "Save to Drive" record so both produce the same file.
  async function buildPdfBlob(): Promise<Blob | null> {
    const node = docRef.current;
    if (!node) return null;
    try {
      const [htmlToImage, jspdf] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);
      const canvas = await htmlToImage.toCanvas(node, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
      });
      const pdf = new jspdf.jsPDF({ unit: "pt", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      let position = 0;
      let remaining = imgH;
      pdf.addImage(imgData, "JPEG", 0, position, pageW, imgH);
      remaining -= pageH;
      while (remaining > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, pageW, imgH);
        remaining -= pageH;
      }
      return pdf.output("blob");
    } catch {
      return null; // caller falls back to a text-only path
    }
  }

  // Render the live document to a PDF and hand it to WhatsApp (native share
  // sheet where supported; otherwise download the PDF and open a WhatsApp chat
  // with a caption so staff can attach it).
  async function shareOnWhatsApp() {
    setSharing(true);
    try {
      let file: File | null = null;
      const blob = await buildPdfBlob();
      if (blob) {
        const safeName = (data.name || "mahalaxmi").replace(/\s+/g, "_");
        file = new File([blob], `agreement-${safeName}.pdf`, {
          type: "application/pdf",
        });
      }

      const waUrl = `https://wa.me/${whatsappNumber()}?text=${encodeURIComponent(
        shareText(),
      )}`;

      if (
        file &&
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: doc.title,
            text: shareText(),
          });
          return;
        } catch {
          // user dismissed the share sheet, or it failed — fall through
        }
      }

      // Fallback: download the PDF (if we built one) and open WhatsApp.
      if (file) {
        const href = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = href;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(href);
      }
      window.open(waUrl, "_blank");
    } finally {
      setSharing(false);
    }
  }

  // Save the generated agreement PDF into the company's Google Drive record.
  // The server route is a no-op until Drive credentials are configured, which
  // surfaces here as the "notset" state.
  async function saveToDrive() {
    setSaveStatus("saving");
    setSavedLink(null);
    try {
      const blob = await buildPdfBlob();
      if (!blob) {
        setSaveStatus("error");
        return;
      }
      const pdfBase64 = await blobToBase64(blob);
      const amount = data.finalAmount
        ? `Rs. ${
            Number.isFinite(Number(data.finalAmount))
              ? Number(data.finalAmount).toLocaleString("en-IN")
              : data.finalAmount
          }`
        : "";
      const res = await fetch("/api/save-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.serialNo,
          customer: data.name,
          route: [data.pickupCity, data.dropCity].filter(Boolean).join(" -> "),
          amount,
          date: data.agreementDate,
          lang,
          pdfBase64,
        }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        skipped?: boolean;
        webViewLink?: string | null;
      };
      if (out.ok) {
        setSaveStatus("saved");
        setSavedLink(out.webViewLink ?? null);
      } else if (out.skipped) {
        setSaveStatus("notset");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <main className="flex-1 w-full">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition hover:text-foreground ${focusRing}`}
          >
            <ArrowLeftIcon /> Back to calculator
          </Link>

          <div className="flex items-center gap-3">
            <div
              className="inline-flex rounded-lg border border-border bg-surface p-0.5"
              role="group"
              aria-label="Agreement language"
            >
              {(["en", "hi"] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    lang === l
                      ? "bg-primary text-primary-foreground"
                      : "text-muted hover:text-foreground"
                  } ${focusRing}`}
                >
                  {l === "en" ? "English" : HI_LABELS.hindi}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className={`inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 ${focusRing}`}
            >
              <PrintIcon /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={saveToDrive}
              disabled={saveStatus === "saving"}
              className={`inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 disabled:opacity-60 ${focusRing}`}
            >
              {saveStatus === "saving" ? (
                <Spinner />
              ) : saveStatus === "saved" ? (
                <CheckIcon />
              ) : (
                <CloudUploadIcon />
              )}
              {saveStatus === "saving"
                ? "Saving…"
                : saveStatus === "saved"
                  ? "Saved to Drive"
                  : "Save to Drive"}
            </button>
            <button
              type="button"
              onClick={shareOnWhatsApp}
              disabled={sharing}
              className={`inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1da851] disabled:opacity-60 ${focusRing}`}
            >
              {sharing ? <Spinner /> : <WhatsAppIcon />}
              {sharing ? "Preparing…" : "Share on WhatsApp"}
            </button>
          </div>
        </div>

        {/* Save-to-Drive status line */}
        <div
          role="status"
          aria-live="polite"
          className="mt-2 text-right text-xs no-print empty:mt-0"
        >
          {saveStatus === "saved" && (
            <span className="text-[var(--success-text)]">
              Agreement saved to the company Drive record.
              {savedLink && (
                <>
                  {" "}
                  <a
                    href={savedLink}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline underline-offset-2"
                  >
                    Open in Drive
                  </a>
                </>
              )}
            </span>
          )}
          {saveStatus === "notset" && (
            <span className="text-muted">
              Drive saving isn&apos;t set up yet — printing &amp; sharing still
              work.
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-[var(--danger)]">
              Couldn&apos;t save to Drive — please try again.
            </span>
          )}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          {/* ---- Details form ---- */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6 no-print">
            <h1 className="text-lg font-bold tracking-tight">
              Booking agreement details
            </h1>
            <p className="mt-1 text-sm text-muted">
              Fill the customer &amp; trip details &mdash; the agreement on the
              right updates live. Switch language any time.
            </p>

            <Group title="Booking type">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Agreement no."
                  htmlFor="serialNo"
                  hint="auto-generated · unique"
                >
                  <input
                    id="serialNo"
                    className={inputClass}
                    value={data.serialNo}
                    onChange={(e) => set("serialNo", e.target.value)}
                    placeholder="auto"
                  />
                </Field>
                <Field label="Agreement date" htmlFor="agreementDate">
                  <input
                    id="agreementDate"
                    type="date"
                    className={inputClass}
                    value={data.agreementDate}
                    onChange={(e) => set("agreementDate", e.target.value)}
                  />
                </Field>
              </div>
              <RadioRow
                label="Type"
                lang={lang}
                options={TRIP_TYPES}
                value={data.tripType}
                onChange={(v) => set("tripType", v)}
              />
              <RadioRow
                label="Bus type"
                lang={lang}
                options={BUS_TYPES}
                value={data.busType}
                onChange={(v) => set("busType", v)}
              />
              <RadioRow
                label="Payment"
                lang={lang}
                options={PAYMENT_TYPES}
                value={data.paymentType}
                onChange={(v) => set("paymentType", v)}
              />
            </Group>

            <Group title="Customer">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" htmlFor="name">
                  <input
                    id="name"
                    className={inputClass}
                    value={data.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Customer name"
                  />
                </Field>
                <Field label="Father's name" htmlFor="fatherName">
                  <input
                    id="fatherName"
                    className={inputClass}
                    value={data.fatherName}
                    onChange={(e) => set("fatherName", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Address" htmlFor="address">
                <textarea
                  id="address"
                  rows={2}
                  className={inputClass}
                  value={data.address}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="Mobile" htmlFor="mobile">
                <input
                  id="mobile"
                  inputMode="tel"
                  className={inputClass}
                  value={data.mobile}
                  onChange={(e) => set("mobile", e.target.value)}
                  placeholder="98xxxxxxxx"
                />
              </Field>
            </Group>

            <Group title="Route & schedule">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Pick-up from city" htmlFor="pickupCity">
                  <input
                    id="pickupCity"
                    className={inputClass}
                    value={data.pickupCity}
                    onChange={(e) => set("pickupCity", e.target.value)}
                  />
                </Field>
                <Field label="Drop to city" htmlFor="dropCity">
                  <input
                    id="dropCity"
                    className={inputClass}
                    value={data.dropCity}
                    onChange={(e) => set("dropCity", e.target.value)}
                  />
                </Field>
                <Field label="From date" htmlFor="fromDate">
                  <input
                    id="fromDate"
                    type="date"
                    className={inputClass}
                    value={data.fromDate}
                    onChange={(e) => set("fromDate", e.target.value)}
                  />
                </Field>
                <Field label="From time" htmlFor="fromTime">
                  <input
                    id="fromTime"
                    type="time"
                    className={inputClass}
                    value={data.fromTime}
                    onChange={(e) => set("fromTime", e.target.value)}
                  />
                </Field>
                <Field label="To date" htmlFor="toDate">
                  <input
                    id="toDate"
                    type="date"
                    className={inputClass}
                    value={data.toDate}
                    onChange={(e) => set("toDate", e.target.value)}
                  />
                </Field>
                <Field label="To time" htmlFor="toTime">
                  <input
                    id="toTime"
                    type="time"
                    className={inputClass}
                    value={data.toTime}
                    onChange={(e) => set("toTime", e.target.value)}
                  />
                </Field>
                <Field
                  label="Return from place"
                  htmlFor="returnPlace"
                  hint="defaults to drop city"
                >
                  <input
                    id="returnPlace"
                    className={inputClass}
                    value={data.returnPlace}
                    onChange={(e) => set("returnPlace", e.target.value)}
                  />
                </Field>
                <Field label="Pax count" htmlFor="paxCount">
                  <input
                    id="paxCount"
                    inputMode="numeric"
                    className={inputClass}
                    value={data.paxCount}
                    onChange={(e) => set("paxCount", e.target.value)}
                  />
                </Field>
              </div>
            </Group>

            <Group title="Amounts (₹)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Money label="Advance received" id="signAmount" data={data} set={set} k="signAmount" />
                <Field label="Advance date" htmlFor="advanceDate">
                  <input
                    id="advanceDate"
                    type="date"
                    className={inputClass}
                    value={data.advanceDate}
                    onChange={(e) => set("advanceDate", e.target.value)}
                  />
                </Field>
                <Money label="Total fare" id="finalAmount" data={data} set={set} k="finalAmount" />
                <Money label="Rate per km/day" id="ratePerKm" data={data} set={set} k="ratePerKm" />
                <Money label="Pay before departure" id="beforeAmount" data={data} set={set} k="beforeAmount" />
                <Money label="Pay en route" id="betweenAmount" data={data} set={set} k="betweenAmount" />
                <Money label="Balance on return" id="returnAmount" data={data} set={set} k="returnAmount" />
                <Money label="Extra per passenger" id="extraPaxCharge" data={data} set={set} k="extraPaxCharge" />
                <Money label="Local/extra per km" id="localExtraPerKm" data={data} set={set} k="localExtraPerKm" />
              </div>
            </Group>

            <Group title="Special / remark">
              <Field label="Special note" htmlFor="remark">
                <textarea
                  id="remark"
                  rows={2}
                  className={inputClass}
                  value={data.remark}
                  onChange={(e) => set("remark", e.target.value)}
                  placeholder="e.g. 32*8 WASHROOM, extra conditions..."
                />
              </Field>
            </Group>

            <button
              type="button"
              onClick={() => setData(newBlank())}
              className={`mt-6 rounded text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline ${focusRing}`}
            >
              Clear all
            </button>
          </section>

          {/* ---- Live agreement preview ---- */}
          <section className="lg:sticky lg:top-6">
            <div
              ref={docRef}
              className="agreement-doc mx-auto max-w-[820px] rounded-lg border border-border bg-white px-8 py-8 text-[13px] leading-relaxed text-[#111] shadow-sm sm:px-12"
              style={{ fontFamily: docFont }}
            >
              <div className="text-center">
                <LogoMark />
                <div className="mt-1 text-sm font-semibold">{doc.company.regd}</div>
                <div className="mt-0.5">{doc.company.address}</div>
                <div className="text-[12px]">
                  {doc.phoneLabel}: {doc.company.phone} &middot; {doc.company.mobile}
                </div>
                <div className="mx-auto mt-3 inline-block border-y-2 border-[#111] px-6 py-0.5 text-lg font-bold">
                  {doc.title}
                </div>
              </div>

              <div className="mt-4 flex justify-between text-[12px]">
                <span>
                  {doc.serialLabel} {doc.serialNo || "________"}
                </span>
                <span>
                  {doc.dateLabel} {doc.agreementDate || "________"}
                </span>
              </div>

              <p className="mt-3 text-justify">{doc.intro}</p>

              <ol className="mt-2 list-decimal space-y-1 pl-5 text-justify">
                {doc.clauses.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ol>

              <p className="mt-3">
                <strong>
                  {doc.specialLabel} :-
                </strong>{" "}
                {doc.special || "____________________________________________"}
              </p>

              <div className="mt-10 flex items-end justify-between text-[12px] font-medium">
                <div className="text-center">
                  <div className="mb-1 border-t border-[#111] pt-1 px-2">
                    {doc.signParty}
                  </div>
                </div>
                <div className="text-center">
                  <div className="mb-1 border-t border-[#111] pt-1 px-2">
                    {doc.signCompany}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

// Inline SVG wordmark for the letterhead. Kept as vector (not a PNG) so the
// whole app ships as plain text and the logo stays crisp in the printed /
// shared PDF at any size.
function LogoMark() {
  return (
    <svg
      viewBox="0 0 460 90"
      className="mx-auto h-auto w-full max-w-[360px]"
      role="img"
      aria-label="Maha Laxmi Travels"
    >
      {/* mountains + sun mark */}
      <circle cx="52" cy="30" r="9" fill="#f59e0b" />
      <path d="M8 74 L44 30 L80 74 Z" fill="#1e3a8a" />
      <path d="M46 74 L78 34 L110 74 Z" fill="#2563eb" opacity="0.85" />
      <path
        d="M30 30 q8 -8 16 0"
        fill="none"
        stroke="#1e3a8a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* wordmark */}
      <text
        x="125"
        y="46"
        fill="#1e3a8a"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="40"
        fontWeight="700"
        fontStyle="italic"
      >
        Maha Laxmi
      </text>
      <text
        x="125"
        y="78"
        fill="#2563eb"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="30"
        fontWeight="700"
        letterSpacing="1"
      >
        Travels
      </text>
    </svg>
  );
}

/* ---------------- small form helpers ---------------- */

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 border-t border-border pt-5 first:mt-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Money({
  label,
  id,
  data,
  set,
  k,
}: {
  label: string;
  id: string;
  data: AgreementData;
  set: <K extends keyof AgreementData>(k: K, v: AgreementData[K]) => void;
  k: keyof AgreementData;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
          ₹
        </span>
        <input
          id={id}
          inputMode="decimal"
          className={`${inputClass} pl-8`}
          value={data[k]}
          onChange={(e) => set(k, e.target.value)}
          placeholder="0"
        />
      </div>
    </Field>
  );
}

function RadioRow({
  label,
  options,
  value,
  onChange,
  lang,
}: {
  label: string;
  options: { value: string; label: { hi: string; en: string } }[];
  value: string;
  onChange: (v: string) => void;
  lang: Lang;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${focusRing} ${
              value === o.value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            {o.label[lang]}
          </button>
        ))}
      </div>
    </div>
  );
}
