// Bus-hire agreement (Anubandh Patra) template for Mahalaxmi Travels.
//
// The document body is fixed boilerplate; only the customer/trip details
// change per agreement. `buildAgreement` interpolates the details into either
// the Hindi or English template and returns a structured document that the UI
// renders and prints.

import { HI_LABELS, amountInWordsHi, buildHindiAgreement } from "./agreementHindi";

export type Lang = "hi" | "en";

export interface AgreementData {
  serialNo: string;
  agreementDate: string; // yyyy-mm-dd
  tripType: string; // key into TRIP_TYPES
  busType: string; // key into BUS_TYPES
  paymentType: string; // key into PAYMENT_TYPES
  name: string;
  fatherName: string;
  address: string;
  mobile: string;
  advanceDate: string; // yyyy-mm-dd
  signAmount: string; // advance received
  ratePerKm: string;
  finalAmount: string; // total fare
  pickupCity: string;
  dropCity: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  returnPlace: string;
  paxCount: string;
  extraPaxCharge: string;
  beforeAmount: string;
  betweenAmount: string;
  returnAmount: string;
  localExtraPerKm: string;
  remark: string;
}

interface Bilingual {
  hi: string;
  en: string;
}

export const TRIP_TYPES: { value: string; label: Bilingual }[] = [
  { value: "baraat", label: { hi: HI_LABELS.baraat, en: "Baraat" } },
  { value: "yatra", label: { hi: HI_LABELS.yatra, en: "Journey (Yatra)" } },
  { value: "tourist", label: { hi: HI_LABELS.tourist, en: "Tourist" } },
  { value: "picnic", label: { hi: HI_LABELS.picnic, en: "Picnic" } },
  { value: "reserve", label: { hi: HI_LABELS.reserve, en: "Reserved Party" } },
];

export const BUS_TYPES: { value: string; label: Bilingual }[] = [
  { value: "semi", label: { hi: "Ac Semi Sleeper", en: "Ac Semi Sleeper" } },
  { value: "full", label: { hi: "Ac Full Sleeper", en: "Ac Full Sleeper" } },
];

export const PAYMENT_TYPES: { value: string; label: Bilingual }[] = [
  { value: "cash", label: { hi: HI_LABELS.cash, en: "Cash" } },
  { value: "draft", label: { hi: HI_LABELS.draft, en: "Draft" } },
  { value: "cheque", label: { hi: HI_LABELS.cheque, en: "Cheque" } },
  { value: "epayment", label: { hi: HI_LABELS.epayment, en: "E-Payment" } },
];

function labelOf(
  list: { value: string; label: Bilingual }[],
  value: string,
  lang: Lang,
): string {
  return list.find((o) => o.value === value)?.label[lang] ?? "";
}

/* ---------------- number & date helpers ---------------- */

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h) s += ONES[h] + " Hundred" + (r ? " " : "");
  if (r) s += twoDigits(r);
  return s;
}

/** Indian-system number to words, e.g. 110000 -> "One Lakh Ten Thousand". */
function indianWords(num: number): string {
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (num) parts.push(threeDigits(num));
  return parts.join(" ").trim();
}

/** Rupee amount in words, e.g. "11000" -> "Eleven Thousand Rupees Only". */
export function amountInWords(value: string | number): string {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return indianWords(n) + " Rupees Only";
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
  "Dec",
];

/** yyyy-mm-dd -> "07/Jul/2026" (unchanged if not an ISO date). */
export function formatAgreementDate(iso: string): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const mon = MONTHS[Number(m[2]) - 1] ?? m[2];
  return `${m[3]}/${mon}/${m[1]}`;
}

/** "13:00" -> "01:00 pm" (unchanged if not HH:mm). */
export function formatTime12(t: string): string {
  if (!t) return "";
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return t;
  let h = Number(m[1]);
  const ap = h < 12 ? "am" : "pm";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m[2]} ${ap}`;
}

/* ---------------- document builder ---------------- */

export interface AgreementDoc {
  company: { name: string; regd: string; address: string; phone: string; mobile: string };
  title: string;
  phoneLabel: string;
  serialLabel: string;
  dateLabel: string;
  serialNo: string;
  agreementDate: string;
  intro: string;
  clauses: string[];
  specialLabel: string;
  special: string;
  signParty: string;
  signCompany: string;
}

// Pre-formatted, display-ready values shared by both language templates.
export interface Vals {
  tripType: string;
  busType: string;
  payment: string;
  name: string;
  fatherName: string;
  address: string;
  mobile: string;
  advanceDate: string;
  signAmount: string;
  signWords: string;
  ratePerKm: string;
  rateWords: string;
  finalAmount: string;
  finalWords: string;
  pickupCity: string;
  dropCity: string;
  fromDate: string;
  fromTime: string;
  toDate: string;
  toTime: string;
  returnPlace: string;
  paxCount: string;
  extraPaxCharge: string;
  beforeAmount: string;
  betweenAmount: string;
  returnAmount: string;
  localExtraPerKm: string;
  serialNo: string;
  agreementDate: string;
  special: string;
}

// Fill blanks with an underline so a printed agreement has a space to write in.
function fill(v: string): string {
  const s = (v ?? "").trim();
  return s.length ? s : "______";
}

export function buildAgreement(data: AgreementData, lang: Lang): AgreementDoc {
  // Amount-in-words must match the document language, so a Hindi agreement
  // uses the Hindi converter rather than the English "Eleven Thousand..." form.
  const words = lang === "hi" ? amountInWordsHi : amountInWords;
  const vals: Vals = {
    tripType: fill(labelOf(TRIP_TYPES, data.tripType, lang)),
    busType: fill(labelOf(BUS_TYPES, data.busType, lang)),
    payment: fill(labelOf(PAYMENT_TYPES, data.paymentType, lang)),
    name: fill(data.name),
    fatherName: fill(data.fatherName),
    address: fill(data.address),
    mobile: fill(data.mobile),
    advanceDate: fill(formatAgreementDate(data.advanceDate)),
    signAmount: fill(data.signAmount),
    signWords: fill(words(data.signAmount)),
    ratePerKm: fill(data.ratePerKm),
    rateWords: fill(words(data.ratePerKm)),
    finalAmount: fill(data.finalAmount),
    finalWords: fill(words(data.finalAmount)),
    pickupCity: fill(data.pickupCity),
    dropCity: fill(data.dropCity),
    fromDate: fill(formatAgreementDate(data.fromDate)),
    fromTime: fill(formatTime12(data.fromTime)),
    toDate: fill(formatAgreementDate(data.toDate)),
    toTime: fill(formatTime12(data.toTime)),
    returnPlace: fill(data.returnPlace || data.dropCity),
    paxCount: fill(data.paxCount),
    extraPaxCharge: fill(data.extraPaxCharge),
    beforeAmount: fill(data.beforeAmount),
    betweenAmount: fill(data.betweenAmount),
    returnAmount: fill(data.returnAmount),
    localExtraPerKm: fill(data.localExtraPerKm),
    serialNo: data.serialNo || "",
    agreementDate: fill(formatAgreementDate(data.agreementDate)),
    special: data.remark || "",
  };

  if (lang === "hi") return buildHindiAgreement(vals);

  const v = vals;
  const company = {
    name: "MAHALAXMI TRAVELS",
    regd: "(Regd.)",
    address: "2, Station Road, Jaipur",
    phone: "0141-2369307, 0141-4040340",
    mobile: "Mob. 9414058723",
  };

  // English
  const intro =
    `This agreement for ${v.tripType} with a ${v.busType} bus is made with ` +
    `Shri ${v.name}, son of Shri ${v.fatherName}, resident of ` +
    `${v.address}, Mob. ${v.mobile}, on the following terms. ` +
    `Against this, an advance (token) of Rs. ${v.signAmount} ` +
    `(${v.signWords}) was received in ${v.payment} on ${v.advanceDate}.`;

  const clauses = [
    `The fare shall be charged at the rate of Rs. ${v.ratePerKm} (${v.rateWords}) per km/day; the total fare shall be Rs. ${v.finalAmount} (${v.finalWords}).`,
    `The bus shall run from ${v.pickupCity} to ${v.dropCity} and back. It will depart on ${v.fromDate} at ${v.fromTime}, and will return from ${v.returnPlace} on ${v.toDate} at ${v.toTime}.`,
    `The bus shall carry a total of ${v.paxCount} passengers. For any passengers beyond this, Rs. ${v.extraPaxCharge} per passenger shall be charged separately.`,
    `Before departure, Rs. ${v.beforeAmount} shall be paid to the company/driver; Rs. ${v.betweenAmount} shall be paid en route while going; and the remaining balance of Rs. ${v.returnAmount} shall be paid to the driver on return.`,
    `18% GST shall be paid separately by the party.`,
    `Responsibility and safety of luggage shall rest entirely with the party.`,
    `If the bus breaks down en route, the company shall not be responsible for it, nor liable for any damages or expenses.`,
    `Halting beyond the agreed time shall be at the driver's discretion and shall be charged separately.`,
    `Children aged 3 to 8 years shall be counted as half a passenger, and those above 8 years as one full passenger. A half passenger shall not be allotted a seat.`,
    `If the agreement is cancelled, the advance (token) amount shall not be refunded.`,
    `If the bus provided under this agreement breaks down or is unavailable for any other reason, the company shall provide any other bus available at that time.`,
    `This agreement shall be valid only upon providing the wedding card / passenger list eight days before the scheduled date, or as per the condition.`,
    `The bus shall not ply on unpaved or poor roads and narrow lanes.`,
    `Any damage caused by any passenger in the bus shall be recovered from the party/passenger.`,
    `Video/TV/fans/lights/tape recorder etc. in the bus may be used only at the driver's convenience and with consent.`,
    `Carrying explosives, intoxicants, inflammable substances and legally prohibited items in the bus is strictly forbidden.`,
    `If the route is changed under special circumstances during the journey and the bus cannot reach the destination on time, the company shall bear no responsibility.`,
    `For local sightseeing, apart from the agreed fare, Rs. ${v.localExtraPerKm} per km shall be charged separately.`,
    `The jurisdiction for all matters shall be Jaipur.`,
    `If diesel and taxes increase after the date of the agreement, the party shall separately pay the increased diesel/tax amount.`,
  ];

  return {
    company,
    title: "AGREEMENT",
    phoneLabel: "Phone",
    serialLabel: "Sr. No.:",
    dateLabel: "Date:",
    serialNo: v.serialNo,
    agreementDate: v.agreementDate,
    intro,
    clauses,
    specialLabel: "Special",
    special: v.special,
    signParty: "Signature of Customer/Party",
    signCompany: "For: Mahalaxmi Travels",
  };
}
