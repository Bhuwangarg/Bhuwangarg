"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field, focusRing, inputClass } from "../ui";
import {
  ArrowLeftIcon,
  CheckIcon,
  CloudUploadIcon,
  CopyIcon,
  PrintIcon,
  Spinner,
  WhatsAppIcon,
} from "../icons";
import {
  CLAIM_REQUIRED,
  ClaimData,
  DRIVER_RELATIONS,
  EMPTY_CLAIM,
  INTIMATION_REQUIRED,
  LOSS_TYPES,
  formatDate,
  intimationText,
  makeClaimRef,
  missingFields,
} from "@/lib/claim";
import { FLEET, findVehicle, searchFleet } from "@/lib/fleet";
import { coversDate, findPolicy } from "@/lib/policies";
import { ClaimFormDoc, IntimationDoc } from "./documents";

// Drafts survive an accidental refresh — staff often fill these in while on the
// phone to a driver, and losing the form mid-call would be costly.
const DRAFT_KEY = "mahalaxmi.claimDraft.v1";

type StepId =
  | "vehicle"
  | "loss"
  | "driver"
  | "police"
  | "workshop"
  | "insured"
  | "done";

const STEPS: { id: StepId; title: string; blurb: string }[] = [
  { id: "vehicle", title: "Bus & policy", blurb: "Which bus, and its policy" },
  { id: "loss", title: "What happened", blurb: "Date, place and damage" },
  { id: "driver", title: "Driver", blurb: "Who was driving" },
  { id: "police", title: "Police & injury", blurb: "FIR and third party" },
  { id: "workshop", title: "Workshop", blurb: "Repair estimate & survey" },
  { id: "insured", title: "Insured & bank", blurb: "Address and NEFT details" },
  { id: "done", title: "Documents", blurb: "Print, share, save" },
];

type DocTab = "intimation" | "claim";

export default function ClaimsPage() {
  const [data, setData] = useState<ClaimData>(EMPTY_CLAIM);
  const [stepIndex, setStepIndex] = useState(0);
  const [docTab, setDocTab] = useState<DocTab>("intimation");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "ok" | "error">("idle");
  const [sharing, setSharing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "notset" | "error"
  >("idle");
  const [savedLink, setSavedLink] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];

  // Restore a draft, or start a fresh one. Client-only: Date/random must not
  // run during server render, and localStorage does not exist there.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    let restored: Partial<ClaimData> | null = null;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) restored = JSON.parse(raw) as Partial<ClaimData>;
    } catch {
      /* corrupt or unavailable draft — start clean */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only hydrate
    setData((d) => ({
      ...d,
      ...(restored ?? {}),
      refNo: restored?.refNo || makeClaimRef(),
      intimationDate: restored?.intimationDate || today,
      declarationDate: restored?.declarationDate || today,
    }));
    if (restored?.vehicleNo) setVehicleQuery(restored.vehicleNo);
  }, []);

  // Persist every edit, so a refresh or a closed tab never loses the form.
  useEffect(() => {
    if (!data.refNo) return; // pre-hydration
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* storage full or blocked — the form still works in-memory */
    }
  }, [data]);

  const set = <K extends keyof ClaimData>(k: K, v: ClaimData[K]) =>
    setData((d) => ({ ...d, [k]: v }));

  const suggestions = useMemo(
    () => searchFleet(vehicleQuery, 8),
    [vehicleQuery],
  );

  // Choosing a bus fills everything already known about it: the registered
  // owner from the fleet list, and the whole policy schedule from the PDF held
  // in Drive. Anything the operator has already typed by hand is preserved.
  function pickVehicle(reg: string) {
    const v = findVehicle(reg);
    const p = findPolicy(reg);
    setVehicleQuery(reg);
    setShowSuggestions(false);
    setData((d) => ({
      ...d,
      vehicleNo: reg,
      insuredName: p?.insuredName || v?.owner || d.insuredName,
      policyNo: d.policyNo || p?.policyNo || "",
      policyFrom: d.policyFrom || p?.validFrom || "",
      policyTo: d.policyTo || p?.validTo || "",
      engineNo: d.engineNo || p?.engineNo || "",
      chassisNo: d.chassisNo || p?.chassisNo || "",
      idv: d.idv || p?.idv || "",
      insuredAddress: d.insuredAddress || p?.insuredAddress || "",
      insuredMobile: d.insuredMobile || p?.insuredMobile || "",
      passengersCarried: d.passengersCarried || p?.seatingCapacity || "",
    }));
  }

  // The policy on file for the chosen bus, and whether it covered the date of
  // loss. A claim filed against a lapsed policy is rejected outright, so this
  // is surfaced prominently rather than left for staff to notice.
  const policy = data.vehicleNo ? findPolicy(data.vehicleNo) : undefined;
  const policyCovers = policy ? coversDate(policy, data.lossDate) : null;

  const missingIntimation = missingFields(data, INTIMATION_REQUIRED);
  const missingClaim = missingFields(data, CLAIM_REQUIRED);
  const intimationReady = missingIntimation.length === 0;
  const claimReady = missingClaim.length === 0;

  function startNew() {
    const today = new Date().toISOString().slice(0, 10);
    setData({
      ...EMPTY_CLAIM,
      refNo: makeClaimRef(),
      intimationDate: today,
      declarationDate: today,
    });
    setVehicleQuery("");
    setStepIndex(0);
    setSaveStatus("idle");
    setSavedLink(null);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  async function copyIntimation() {
    try {
      await navigator.clipboard.writeText(intimationText(data));
      setCopyStatus("ok");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      setCopyStatus("error");
    }
  }

  // Render whichever document is on screen to a PDF blob, shared by the
  // WhatsApp and Save-to-Drive actions.
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
      return null;
    }
  }

  const docLabel = docTab === "intimation" ? "intimation" : "claim-form";

  async function shareOnWhatsApp() {
    setSharing(true);
    try {
      const blob = await buildPdfBlob();
      const text = intimationText(data);
      let file: File | null = null;
      if (blob) {
        file = new File([blob], `${docLabel}-${data.refNo}.pdf`, {
          type: "application/pdf",
        });
      }
      if (
        file &&
        typeof navigator !== "undefined" &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({ files: [file], text });
          return;
        } catch {
          // dismissed — fall through to the link-based path
        }
      }
      if (file) {
        const href = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = href;
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(href);
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    } finally {
      setSharing(false);
    }
  }

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
      const res = await fetch("/api/save-agreement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `${data.refNo}-${docLabel}`,
          customer: data.insuredName,
          route: data.vehicleNo,
          amount: data.estimateAmount,
          date: data.lossDate,
          lang: docLabel,
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
        <div className="flex flex-wrap items-center justify-between gap-3 no-print">
          <Link
            href="/"
            className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted transition hover:text-foreground ${focusRing}`}
          >
            <ArrowLeftIcon /> Back to calculator
          </Link>
          <span className="rounded-lg bg-surface-muted px-3 py-1 font-mono text-xs font-semibold text-muted">
            {data.refNo || "—"}
          </span>
        </div>

        <header className="mt-4 no-print">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
            Insurance claim &amp; intimation
          </h1>
          <p className="mt-1 text-sm text-muted">
            Answer the questions step by step — the intimation letter and the
            claim form both fill themselves in as you go.
          </p>
        </header>

        {/* ---- Journey progress ---- */}
        <nav className="mt-5 no-print" aria-label="Claim steps">
          <ol className="flex flex-wrap gap-1.5">
            {STEPS.map((s, i) => {
              const state =
                i === stepIndex ? "current" : i < stepIndex ? "done" : "todo";
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setStepIndex(i)}
                    aria-current={state === "current" ? "step" : undefined}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${focusRing} ${
                      state === "current"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : state === "done"
                          ? "bg-surface-muted text-foreground"
                          : "bg-surface-muted text-muted hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                        state === "current"
                          ? "bg-white/25"
                          : state === "done"
                            ? "bg-[var(--success-text)] text-white"
                            : "bg-border text-muted"
                      }`}
                    >
                      {state === "done" ? "✓" : i + 1}
                    </span>
                    {s.title}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </nav>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:items-start">
          {/* ---- Current step ---- */}
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6 no-print">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-bold text-foreground">
                {step.title}
              </h2>
              <span className="text-xs text-muted">
                Step {stepIndex + 1} of {STEPS.length}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted">{step.blurb}</p>

            <div className="mt-5 space-y-4">
              {step.id === "vehicle" && (
                <>
                  <div className="relative">
                    <Field
                      label="Bus number"
                      htmlFor="vehicleNo"
                      hint={`pick from your ${FLEET.length} buses`}
                    >
                      <input
                        id="vehicleNo"
                        autoComplete="off"
                        className={inputClass}
                        value={vehicleQuery}
                        placeholder="Start typing, e.g. MP 44 or Praveen"
                        onChange={(e) => {
                          setVehicleQuery(e.target.value);
                          set("vehicleNo", e.target.value);
                          setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                      />
                    </Field>
                    {showSuggestions && suggestions.length > 0 && (
                      <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-surface shadow-lg">
                        {suggestions.map((v) => (
                          <li key={v.reg}>
                            <button
                              type="button"
                              onClick={() => pickVehicle(v.reg)}
                              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-surface-muted"
                            >
                              <span className="font-mono font-semibold">
                                {v.reg}
                              </span>
                              <span className="flex items-center gap-2 text-xs text-muted">
                                {v.owner}
                                {findPolicy(v.reg) && (
                                  <span className="rounded bg-[var(--success-text)]/15 px-1.5 py-0.5 font-semibold text-[var(--success-text)]">
                                    policy
                                  </span>
                                )}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {policy && (
                    <div className="rounded-xl border border-[var(--success-text)]/40 bg-[var(--success-text)]/5 p-3.5">
                      <div className="flex items-center gap-2">
                        <CheckIcon />
                        <span className="text-sm font-bold text-foreground">
                          Policy found on file
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {policy.makeModel} &middot; {policy.seatingCapacity}{" "}
                        seats &middot; {policy.insurer}
                      </p>
                      <p className="mt-1.5 text-xs text-muted">
                        Everything below was filled from the policy document —
                        check it against the papers before sending.
                      </p>
                    </div>
                  )}

                  {data.vehicleNo && !policy && (
                    <p className="rounded-xl border border-border bg-surface-muted p-3.5 text-xs text-muted">
                      No policy document on file for this bus — type the policy
                      details by hand below.
                    </p>
                  )}

                  <Field
                    label="Insured name"
                    htmlFor="insuredName"
                    hint="auto-filled from the fleet"
                  >
                    <input
                      id="insuredName"
                      className={inputClass}
                      value={data.insuredName}
                      onChange={(e) => set("insuredName", e.target.value)}
                    />
                  </Field>

                  <Field label="Policy number" htmlFor="policyNo">
                    <input
                      id="policyNo"
                      className={inputClass}
                      value={data.policyNo}
                      onChange={(e) => set("policyNo", e.target.value)}
                      placeholder="as printed on the policy"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Policy from" htmlFor="policyFrom">
                      <input
                        id="policyFrom"
                        type="date"
                        className={inputClass}
                        value={data.policyFrom}
                        onChange={(e) => set("policyFrom", e.target.value)}
                      />
                    </Field>
                    <Field label="Policy to" htmlFor="policyTo">
                      <input
                        id="policyTo"
                        type="date"
                        className={inputClass}
                        value={data.policyTo}
                        onChange={(e) => set("policyTo", e.target.value)}
                      />
                    </Field>
                    <Field label="Engine no." htmlFor="engineNo">
                      <input
                        id="engineNo"
                        className={inputClass}
                        value={data.engineNo}
                        onChange={(e) => set("engineNo", e.target.value)}
                      />
                    </Field>
                    <Field label="Chassis no." htmlFor="chassisNo">
                      <input
                        id="chassisNo"
                        className={inputClass}
                        value={data.chassisNo}
                        onChange={(e) => set("chassisNo", e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="IDV" htmlFor="idv" hint="insured declared value">
                    <RupeeInput
                      id="idv"
                      value={data.idv}
                      onChange={(v) => set("idv", v)}
                    />
                  </Field>
                </>
              )}

              {step.id === "loss" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Date of loss" htmlFor="lossDate">
                      <input
                        id="lossDate"
                        type="date"
                        className={inputClass}
                        value={data.lossDate}
                        onChange={(e) => set("lossDate", e.target.value)}
                      />
                    </Field>
                    <Field label="Time of loss" htmlFor="lossTime">
                      <input
                        id="lossTime"
                        type="time"
                        className={inputClass}
                        value={data.lossTime}
                        onChange={(e) => set("lossTime", e.target.value)}
                      />
                    </Field>
                  </div>

                  {policy && policyCovers === false && (
                    <div className="rounded-xl border border-[var(--danger)]/50 bg-[var(--danger)]/5 p-3.5">
                      <p className="text-sm font-bold text-[var(--danger)]">
                        The policy on file did not cover this date
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        Policy {policy.policyNo} runs{" "}
                        {formatDate(policy.validFrom)} to{" "}
                        {formatDate(policy.validTo)}, but the loss is dated{" "}
                        {formatDate(data.lossDate)}. Check for a renewal — if the
                        bus was insured under a newer policy, enter that policy
                        number instead. Filing against a lapsed policy will be
                        rejected.
                      </p>
                    </div>
                  )}

                  {policy && policyCovers === true && (
                    <p className="text-xs font-medium text-[var(--success-text)]">
                      Policy {policy.policyNo} was in force on this date.
                    </p>
                  )}

                  <Field label="Place of accident" htmlFor="lossPlace">
                    <input
                      id="lossPlace"
                      className={inputClass}
                      value={data.lossPlace}
                      onChange={(e) => set("lossPlace", e.target.value)}
                      placeholder="e.g. NH-48 near Kishangarh"
                    />
                  </Field>

                  <Choice
                    label="Type of loss"
                    options={LOSS_TYPES}
                    value={data.lossType}
                    onChange={(v) => set("lossType", v)}
                  />

                  <Field
                    label="What happened"
                    htmlFor="description"
                    hint="short description for the form"
                  >
                    <textarea
                      id="description"
                      rows={3}
                      className={inputClass}
                      value={data.description}
                      onChange={(e) => set("description", e.target.value)}
                      placeholder="e.g. Bus was hit from behind by a truck while stationary at a toll plaza; rear body and bumper damaged."
                    />
                  </Field>

                  <Field
                    label="Date intimated to workshop"
                    htmlFor="intimationDate"
                  >
                    <input
                      id="intimationDate"
                      type="date"
                      className={inputClass}
                      value={data.intimationDate}
                      onChange={(e) => set("intimationDate", e.target.value)}
                    />
                  </Field>
                </>
              )}

              {step.id === "driver" && (
                <>
                  <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <Field label="Driver name" htmlFor="driverName">
                      <input
                        id="driverName"
                        className={inputClass}
                        value={data.driverName}
                        onChange={(e) => set("driverName", e.target.value)}
                      />
                    </Field>
                    <Field label="Age" htmlFor="driverAge">
                      <input
                        id="driverAge"
                        inputMode="numeric"
                        className={inputClass}
                        value={data.driverAge}
                        onChange={(e) => set("driverAge", e.target.value)}
                      />
                    </Field>
                  </div>

                  <Field label="Driver mobile" htmlFor="driverMobile">
                    <input
                      id="driverMobile"
                      inputMode="tel"
                      className={inputClass}
                      value={data.driverMobile}
                      onChange={(e) => set("driverMobile", e.target.value)}
                    />
                  </Field>

                  <Choice
                    label="Is driver"
                    options={DRIVER_RELATIONS}
                    value={data.driverRelation}
                    onChange={(v) => set("driverRelation", v)}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Driving licence no." htmlFor="licenseNo">
                      <input
                        id="licenseNo"
                        className={inputClass}
                        value={data.licenseNo}
                        onChange={(e) => set("licenseNo", e.target.value)}
                      />
                    </Field>
                    <Field label="Licence valid up to" htmlFor="licenseValidTo">
                      <input
                        id="licenseValidTo"
                        type="date"
                        className={inputClass}
                        value={data.licenseValidTo}
                        onChange={(e) => set("licenseValidTo", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Authorised to drive"
                      htmlFor="authorisedToDrive"
                    >
                      <input
                        id="authorisedToDrive"
                        className={inputClass}
                        value={data.authorisedToDrive}
                        onChange={(e) =>
                          set("authorisedToDrive", e.target.value)
                        }
                        placeholder="e.g. Transport / HGV"
                      />
                    </Field>
                    <Field label="Issuing authority" htmlFor="issuingAuthority">
                      <input
                        id="issuingAuthority"
                        className={inputClass}
                        value={data.issuingAuthority}
                        onChange={(e) => set("issuingAuthority", e.target.value)}
                        placeholder="e.g. RTO Jaipur"
                      />
                    </Field>
                  </div>

                  <h3 className="mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                    Commercial vehicle papers
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Permit no." htmlFor="permitNo">
                      <input
                        id="permitNo"
                        className={inputClass}
                        value={data.permitNo}
                        onChange={(e) => set("permitNo", e.target.value)}
                      />
                    </Field>
                    <Field label="Permit valid up to" htmlFor="permitValidTo">
                      <input
                        id="permitValidTo"
                        type="date"
                        className={inputClass}
                        value={data.permitValidTo}
                        onChange={(e) => set("permitValidTo", e.target.value)}
                      />
                    </Field>
                    <Field label="Permit authority" htmlFor="permitAuthority">
                      <input
                        id="permitAuthority"
                        className={inputClass}
                        value={data.permitAuthority}
                        onChange={(e) => set("permitAuthority", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Fitness valid up to"
                      htmlFor="fitnessValidTo"
                    >
                      <input
                        id="fitnessValidTo"
                        type="date"
                        className={inputClass}
                        value={data.fitnessValidTo}
                        onChange={(e) => set("fitnessValidTo", e.target.value)}
                      />
                    </Field>
                    <Field
                      label="Fare-paying passengers"
                      htmlFor="passengersCarried"
                    >
                      <input
                        id="passengersCarried"
                        inputMode="numeric"
                        className={inputClass}
                        value={data.passengersCarried}
                        onChange={(e) =>
                          set("passengersCarried", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="GR/LR no." htmlFor="grLrNo">
                      <input
                        id="grLrNo"
                        className={inputClass}
                        value={data.grLrNo}
                        onChange={(e) => set("grLrNo", e.target.value)}
                        placeholder="if goods carried"
                      />
                    </Field>
                  </div>
                </>
              )}

              {step.id === "police" && (
                <>
                  <Choice
                    label="Police report lodged?"
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                    value={data.policeReport}
                    onChange={(v) => set("policeReport", v)}
                  />

                  {data.policeReport === "yes" && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="FIR / GD no." htmlFor="firNo">
                        <input
                          id="firNo"
                          className={inputClass}
                          value={data.firNo}
                          onChange={(e) => set("firNo", e.target.value)}
                        />
                      </Field>
                      <Field label="Police station" htmlFor="policeStation">
                        <input
                          id="policeStation"
                          className={inputClass}
                          value={data.policeStation}
                          onChange={(e) => set("policeStation", e.target.value)}
                        />
                      </Field>
                    </div>
                  )}

                  <Choice
                    label="Any injury, death or third-party property damage?"
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                    value={data.thirdPartyInjury}
                    onChange={(v) => set("thirdPartyInjury", v)}
                  />

                  {data.thirdPartyInjury === "yes" && (
                    <Field
                      label="Details of injury / damage"
                      htmlFor="injuryDetails"
                    >
                      <textarea
                        id="injuryDetails"
                        rows={3}
                        className={inputClass}
                        value={data.injuryDetails}
                        onChange={(e) => set("injuryDetails", e.target.value)}
                      />
                    </Field>
                  )}
                </>
              )}

              {step.id === "workshop" && (
                <>
                  <Field label="Workshop name" htmlFor="workshopName">
                    <input
                      id="workshopName"
                      className={inputClass}
                      value={data.workshopName}
                      onChange={(e) => set("workshopName", e.target.value)}
                    />
                  </Field>
                  <Field label="Workshop address" htmlFor="workshopAddress">
                    <textarea
                      id="workshopAddress"
                      rows={2}
                      className={inputClass}
                      value={data.workshopAddress}
                      onChange={(e) => set("workshopAddress", e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Workshop contact" htmlFor="workshopContact">
                      <input
                        id="workshopContact"
                        inputMode="tel"
                        className={inputClass}
                        value={data.workshopContact}
                        onChange={(e) => set("workshopContact", e.target.value)}
                      />
                    </Field>
                    <Field label="Estimate date" htmlFor="estimateDate">
                      <input
                        id="estimateDate"
                        type="date"
                        className={inputClass}
                        value={data.estimateDate}
                        onChange={(e) => set("estimateDate", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field
                    label="Estimated cost of repairs"
                    htmlFor="estimateAmount"
                  >
                    <RupeeInput
                      id="estimateAmount"
                      value={data.estimateAmount}
                      onChange={(v) => set("estimateAmount", v)}
                    />
                  </Field>
                  <Choice
                    label="Spot survey done?"
                    options={[
                      { value: "yes", label: "Yes" },
                      { value: "no", label: "No" },
                    ]}
                    value={data.spotSurvey}
                    onChange={(v) => set("spotSurvey", v)}
                  />
                </>
              )}

              {step.id === "insured" && (
                <>
                  <Field label="Insured address" htmlFor="insuredAddress">
                    <textarea
                      id="insuredAddress"
                      rows={2}
                      className={inputClass}
                      value={data.insuredAddress}
                      onChange={(e) => set("insuredAddress", e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Insured mobile" htmlFor="insuredMobile">
                      <input
                        id="insuredMobile"
                        inputMode="tel"
                        className={inputClass}
                        value={data.insuredMobile}
                        onChange={(e) => set("insuredMobile", e.target.value)}
                      />
                    </Field>
                    <Field label="E-mail id" htmlFor="insuredEmail">
                      <input
                        id="insuredEmail"
                        type="email"
                        className={inputClass}
                        value={data.insuredEmail}
                        onChange={(e) => set("insuredEmail", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field
                    label="Other existing policies"
                    htmlFor="otherPolicies"
                    hint="for this accident, if any"
                  >
                    <input
                      id="otherPolicies"
                      className={inputClass}
                      value={data.otherPolicies}
                      onChange={(e) => set("otherPolicies", e.target.value)}
                      placeholder="leave blank if none"
                    />
                  </Field>

                  <h3 className="mt-6 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                    Bank details for NEFT
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Bank name" htmlFor="bankName">
                      <input
                        id="bankName"
                        className={inputClass}
                        value={data.bankName}
                        onChange={(e) => set("bankName", e.target.value)}
                      />
                    </Field>
                    <Field label="Branch name" htmlFor="branchName">
                      <input
                        id="branchName"
                        className={inputClass}
                        value={data.branchName}
                        onChange={(e) => set("branchName", e.target.value)}
                      />
                    </Field>
                    <Field label="IFS code" htmlFor="ifsCode">
                      <input
                        id="ifsCode"
                        className={`${inputClass} uppercase`}
                        value={data.ifsCode}
                        onChange={(e) =>
                          set("ifsCode", e.target.value.toUpperCase())
                        }
                      />
                    </Field>
                    <Field label="MICR no." htmlFor="micrNo">
                      <input
                        id="micrNo"
                        className={inputClass}
                        value={data.micrNo}
                        onChange={(e) => set("micrNo", e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Account no." htmlFor="accountNo">
                    <input
                      id="accountNo"
                      className={inputClass}
                      value={data.accountNo}
                      onChange={(e) => set("accountNo", e.target.value)}
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Declaration place" htmlFor="declarationPlace">
                      <input
                        id="declarationPlace"
                        className={inputClass}
                        value={data.declarationPlace}
                        onChange={(e) =>
                          set("declarationPlace", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Declaration date" htmlFor="declarationDate">
                      <input
                        id="declarationDate"
                        type="date"
                        className={inputClass}
                        value={data.declarationDate}
                        onChange={(e) => set("declarationDate", e.target.value)}
                      />
                    </Field>
                  </div>
                </>
              )}

              {step.id === "done" && (
                <>
                  <ReadyCard
                    title="Intimation letter"
                    ready={intimationReady}
                    missing={missingIntimation.map((f) => f.label)}
                    note="Send this to the insurer straight away — it does not need the full claim details."
                  />
                  <ReadyCard
                    title="Claim form"
                    ready={claimReady}
                    missing={missingClaim.map((f) => f.label)}
                    note="Print, get the insured to sign, and attach a cancelled cheque for NEFT."
                  />

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      type="button"
                      onClick={shareOnWhatsApp}
                      disabled={sharing || !intimationReady}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1da851] disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                    >
                      {sharing ? <Spinner /> : <WhatsAppIcon />}
                      {sharing ? "Preparing…" : "Share on WhatsApp"}
                    </button>
                    <button
                      type="button"
                      onClick={copyIntimation}
                      disabled={!intimationReady}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
                    >
                      {copyStatus === "ok" ? <CheckIcon /> : <CopyIcon />}
                      {copyStatus === "ok" ? "Copied!" : "Copy"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 ${focusRing}`}
                    >
                      <PrintIcon /> Print / Save PDF
                    </button>
                    <button
                      type="button"
                      onClick={saveToDrive}
                      disabled={saveStatus === "saving"}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-primary/40 disabled:opacity-60 ${focusRing}`}
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
                          ? "Saved"
                          : "Save to Drive"}
                    </button>
                  </div>

                  {saveStatus === "notset" && (
                    <p className="text-xs text-muted">
                      Drive saving isn&apos;t set up yet — printing and sharing
                      still work normally.
                    </p>
                  )}
                  {saveStatus === "error" && (
                    <p className="text-xs text-[var(--danger)]">
                      Couldn&apos;t save to Drive. Print or share instead.
                    </p>
                  )}
                  {saveStatus === "saved" && savedLink && (
                    <a
                      href={savedLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-medium text-primary underline"
                    >
                      Open the saved copy in Drive
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={startNew}
                    className={`mt-2 rounded text-sm font-medium text-muted underline-offset-4 hover:text-foreground hover:underline ${focusRing}`}
                  >
                    Start a new claim
                  </button>
                </>
              )}
            </div>

            {/* ---- Step navigation ---- */}
            <div className="mt-7 flex items-center justify-between gap-3 border-t border-border pt-5">
              <button
                type="button"
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                disabled={stepIndex === 0}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
              >
                <ArrowLeftIcon /> Back
              </button>
              {stepIndex < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary-hover ${focusRing}`}
                >
                  Next: {STEPS[stepIndex + 1].title}
                </button>
              ) : (
                <span className="text-xs text-muted">All steps done</span>
              )}
            </div>
          </section>

          {/* ---- Live document preview ---- */}
          <section className="lg:sticky lg:top-6">
            <div
              className="mb-3 inline-flex rounded-lg border border-border bg-surface p-0.5 no-print"
              role="group"
              aria-label="Document"
            >
              {(
                [
                  ["intimation", "Intimation letter"],
                  ["claim", "Claim form"],
                ] as [DocTab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDocTab(id)}
                  aria-pressed={docTab === id}
                  className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                    docTab === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted hover:text-foreground"
                  } ${focusRing}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div
              ref={docRef}
              className="mx-auto max-w-[820px] overflow-hidden rounded-lg border border-border shadow-sm"
            >
              {docTab === "intimation" ? (
                <IntimationDoc data={data} />
              ) : (
                <ClaimFormDoc data={data} />
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

/* ---------------- helpers ---------------- */

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

function RupeeInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">
        ₹
      </span>
      <input
        id={id}
        inputMode="decimal"
        className={`${inputClass} pl-8`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
      />
    </div>
  );
}

function Choice<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
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
            aria-pressed={value === o.value}
            className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition ${focusRing} ${
              value === o.value
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReadyCard({
  title,
  ready,
  missing,
  note,
}: {
  title: string;
  ready: boolean;
  missing: string[];
  note: string;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        ready
          ? "border-[var(--success-text)]/40 bg-[var(--success-text)]/5"
          : "border-border bg-surface-muted"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
            ready
              ? "bg-[var(--success-text)] text-white"
              : "bg-border text-muted"
          }`}
        >
          {ready ? "✓" : "!"}
        </span>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <span className="ml-auto text-xs font-semibold text-muted">
          {ready ? "Ready" : `${missing.length} missing`}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted">{note}</p>
      {!ready && (
        <p className="mt-2 text-xs text-[var(--danger)]">
          Still needed: {missing.join(", ")}
        </p>
      )}
    </div>
  );
}
