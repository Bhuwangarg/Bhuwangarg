// Motor insurance claim + intimation paperwork for Mahalaxmi Travels.
//
// One set of details drives both documents, because they overlap heavily and
// staff should never type the same fact twice:
//   * Intimation  — sent to the insurer immediately after an accident.
//     Field list taken from the insurer's "Details Required for Claim
//     Intimation" sheet.
//   * Claim form  — the full National Insurance MOTOR INSURANCE CLAIM FORM,
//     filled in and signed by the insured once details are known.

export type LossType = "damage" | "theft" | "thirdParty";
export type DriverRelation = "owner" | "paid" | "relative";
export type YesNo = "yes" | "no";

export interface ClaimData {
  /* reference */
  refNo: string;

  /* policy & vehicle */
  vehicleNo: string;
  insuredName: string;
  policyNo: string;
  policyFrom: string;
  policyTo: string;
  engineNo: string;
  chassisNo: string;
  idv: string;

  /* insured contact */
  insuredAddress: string;
  insuredMobile: string;
  insuredEmail: string;
  otherPolicies: string;

  /* loss */
  lossDate: string;
  lossTime: string;
  lossPlace: string;
  lossType: LossType;
  estimateAmount: string;
  estimateDate: string;
  description: string;
  intimationDate: string;

  /* driver */
  driverName: string;
  driverAge: string;
  driverMobile: string;
  driverRelation: DriverRelation;
  licenseNo: string;
  licenseValidTo: string;
  authorisedToDrive: string;
  issuingAuthority: string;

  /* commercial vehicle */
  permitNo: string;
  permitValidTo: string;
  permitAuthority: string;
  fitnessValidTo: string;
  passengersCarried: string;
  goodsCarried: string;
  grLrNo: string;

  /* police & injury */
  policeReport: YesNo;
  firNo: string;
  policeStation: string;
  thirdPartyInjury: YesNo;
  injuryDetails: string;

  /* workshop & survey */
  workshopName: string;
  workshopAddress: string;
  workshopContact: string;
  spotSurvey: YesNo;

  /* bank */
  bankName: string;
  branchName: string;
  ifsCode: string;
  micrNo: string;
  accountNo: string;

  /* declaration */
  declarationPlace: string;
  declarationDate: string;
}

export const EMPTY_CLAIM: ClaimData = {
  refNo: "",
  vehicleNo: "",
  insuredName: "",
  policyNo: "",
  policyFrom: "",
  policyTo: "",
  engineNo: "",
  chassisNo: "",
  idv: "",
  insuredAddress: "",
  insuredMobile: "",
  insuredEmail: "",
  otherPolicies: "",
  lossDate: "",
  lossTime: "",
  lossPlace: "",
  lossType: "damage",
  estimateAmount: "",
  estimateDate: "",
  description: "",
  intimationDate: "",
  driverName: "",
  driverAge: "",
  driverMobile: "",
  driverRelation: "paid",
  licenseNo: "",
  licenseValidTo: "",
  authorisedToDrive: "",
  issuingAuthority: "",
  permitNo: "",
  permitValidTo: "",
  permitAuthority: "",
  fitnessValidTo: "",
  passengersCarried: "",
  goodsCarried: "",
  grLrNo: "",
  policeReport: "no",
  firNo: "",
  policeStation: "",
  thirdPartyInjury: "no",
  injuryDetails: "",
  workshopName: "",
  workshopAddress: "",
  workshopContact: "",
  spotSurvey: "no",
  bankName: "",
  branchName: "",
  ifsCode: "",
  micrNo: "",
  accountNo: "",
  declarationPlace: "Jaipur",
  declarationDate: "",
};

export const LOSS_TYPES: { value: LossType; label: string }[] = [
  { value: "damage", label: "Damage" },
  { value: "theft", label: "Theft" },
  { value: "thirdParty", label: "Third Party" },
];

export const DRIVER_RELATIONS: { value: DriverRelation; label: string }[] = [
  { value: "owner", label: "Owner" },
  { value: "paid", label: "Paid Driver" },
  { value: "relative", label: "Relative/Friend" },
];

/* ---------------- formatting helpers ---------------- */

/** "2026-07-27" -> "27/07/2026" (blank stays blank). */
export function formatDate(value: string): string {
  if (!value) return "";
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

/** "14:30" -> "02:30 pm" (blank stays blank). */
export function formatTime(value: string): string {
  if (!value) return "";
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value;
  let h = Number(m[1]);
  const ap = h < 12 ? "am" : "pm";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m[2]} ${ap}`;
}

/** Whole rupees with Indian grouping, e.g. "125000" -> "1,25,000". */
export function formatAmount(value: string): string {
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return "";
  return n.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

/** Date + time as one readable string. */
export function dateTime(date: string, time: string): string {
  return [formatDate(date), formatTime(time)].filter(Boolean).join(" at ");
}

/** A unique claim reference, e.g. "MLC-260727-8K2F". */
export function makeClaimRef(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MLC-${yy}${mm}${dd}-${rand}`;
}

/* ---------------- intimation ---------------- */

export interface IntimationRow {
  label: string;
  value: string;
}

/**
 * The insurer's intimation checklist, in their order. Every row is always
 * present — a blank value prints as a dash so the insurer can see at a glance
 * what is still outstanding rather than the row silently disappearing.
 */
export function buildIntimation(d: ClaimData): IntimationRow[] {
  const contact = [d.insuredName, d.insuredMobile].filter(Boolean).join(", ");
  const policyPeriod =
    d.policyFrom || d.policyTo
      ? `${formatDate(d.policyFrom) || "—"} to ${formatDate(d.policyTo) || "—"}`
      : "";
  const estimate = [
    formatAmount(d.estimateAmount) ? `Rs. ${formatAmount(d.estimateAmount)}` : "",
    formatDate(d.estimateDate),
  ]
    .filter(Boolean)
    .join(" dated ");
  const fir = d.policeReport === "yes"
    ? [d.firNo, d.policeStation].filter(Boolean).join(", ") || "Yes"
    : "No FIR lodged";
  const driver = [d.driverName, d.driverMobile].filter(Boolean).join(", ");
  const workshop = [d.workshopName, d.workshopAddress, d.workshopContact]
    .filter(Boolean)
    .join(", ");

  return [
    { label: "Insured Name & contact details", value: contact },
    { label: "Policy number", value: d.policyNo },
    { label: "Policy Period", value: policyPeriod },
    { label: "Date of Loss", value: dateTime(d.lossDate, d.lossTime) },
    { label: "Date of Intimation @workshop", value: formatDate(d.intimationDate) },
    { label: "Vehicle Number", value: d.vehicleNo },
    { label: "IDV", value: formatAmount(d.idv) ? `Rs. ${formatAmount(d.idv)}` : "" },
    { label: "Estimate Amount & date", value: estimate },
    { label: "Place of accident", value: d.lossPlace },
    { label: "FIR details, if any", value: fir },
    { label: "Driver Name & Contact number", value: driver },
    {
      label: "Whether spot survey done or not",
      value: d.spotSurvey === "yes" ? "Yes — spot survey done" : "No",
    },
    { label: "Workshop Name, address & Contact number", value: workshop },
  ];
}

/** The intimation as a WhatsApp-ready message. */
export function intimationText(d: ClaimData): string {
  const rows = buildIntimation(d)
    .map((r) => `${r.label}: ${r.value || "—"}`)
    .join("\n");
  return `*MOTOR CLAIM INTIMATION*\nRef: ${d.refNo}\n\n${rows}`;
}

/* ---------------- completeness ---------------- */

export interface FieldCheck {
  key: keyof ClaimData;
  label: string;
}

/** What the insurer needs before an intimation can go out. */
export const INTIMATION_REQUIRED: FieldCheck[] = [
  { key: "vehicleNo", label: "Vehicle number" },
  { key: "insuredName", label: "Insured name" },
  { key: "policyNo", label: "Policy number" },
  { key: "lossDate", label: "Date of loss" },
  { key: "lossPlace", label: "Place of accident" },
];

/** What the signed claim form needs on top of the intimation fields. */
export const CLAIM_REQUIRED: FieldCheck[] = [
  ...INTIMATION_REQUIRED,
  { key: "insuredAddress", label: "Insured address" },
  { key: "insuredMobile", label: "Insured mobile" },
  { key: "description", label: "Description of the accident" },
  { key: "driverName", label: "Driver name" },
  { key: "licenseNo", label: "Driving licence number" },
];

/** Required fields that are still blank. */
export function missingFields(
  d: ClaimData,
  required: FieldCheck[],
): FieldCheck[] {
  return required.filter((f) => !String(d[f.key] ?? "").trim());
}
