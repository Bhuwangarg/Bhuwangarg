// Bus-hire agreement (अनुबंध पत्र) template for Mahalaxmi Travels.
//
// The document body is fixed boilerplate; only the customer/trip details
// change per agreement. `buildAgreement` interpolates the details into either
// the Hindi or English template and returns a structured document that the UI
// renders and prints.

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
  { value: "baraat", label: { hi: "बारात", en: "Baraat" } },
  { value: "yatra", label: { hi: "यात्रा", en: "Journey (Yatra)" } },
  { value: "tourist", label: { hi: "टूरिस्ट", en: "Tourist" } },
  { value: "picnic", label: { hi: "पिकनिक", en: "Picnic" } },
  { value: "reserve", label: { hi: "रिजर्व पार्टी", en: "Reserved Party" } },
];

export const BUS_TYPES: { value: string; label: Bilingual }[] = [
  { value: "semi", label: { hi: "Ac Semi Sleeper", en: "Ac Semi Sleeper" } },
  { value: "full", label: { hi: "Ac Full Sleeper", en: "Ac Full Sleeper" } },
];

export const PAYMENT_TYPES: { value: string; label: Bilingual }[] = [
  { value: "cash", label: { hi: "नकद", en: "Cash" } },
  { value: "draft", label: { hi: "ड्राफ्ट", en: "Draft" } },
  { value: "cheque", label: { hi: "चैक", en: "Cheque" } },
  { value: "epayment", label: { hi: "ई-पेमेन्ट", en: "E-Payment" } },
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

// Fill blanks with an underline so a printed agreement has a space to write in.
function fill(v: string): string {
  const s = (v ?? "").trim();
  return s.length ? s : "______";
}

export function buildAgreement(data: AgreementData, lang: Lang): AgreementDoc {
  const tripType = labelOf(TRIP_TYPES, data.tripType, lang);
  const busType = labelOf(BUS_TYPES, data.busType, lang);
  const payment = labelOf(PAYMENT_TYPES, data.paymentType, lang);
  const signWords = amountInWords(data.signAmount);
  const rateWords = amountInWords(data.ratePerKm);
  const finalWords = amountInWords(data.finalAmount);
  const fromDate = formatAgreementDate(data.fromDate);
  const toDate = formatAgreementDate(data.toDate);
  const fromTime = formatTime12(data.fromTime);
  const toTime = formatTime12(data.toTime);
  const advanceDate = formatAgreementDate(data.advanceDate);
  const agreementDate = formatAgreementDate(data.agreementDate);

  const company = {
    name: lang === "hi" ? "महालक्ष्मी ट्रेवल्स" : "MAHALAXMI TRAVELS",
    regd: lang === "hi" ? "(रजि.)" : "(Regd.)",
    address: lang === "hi" ? "2, स्टेशन रोड, जयपुर" : "2, Station Road, Jaipur",
    phone: "0141-2369307, 0141-4040340",
    mobile: lang === "hi" ? "मोबा. 9414058723" : "Mob. 9414058723",
  };

  if (lang === "hi") {
    const intro =
      `${fill(tripType)} के लिए ${fill(busType)} श्रीमान ${fill(data.name)} पुत्र श्री ` +
      `${fill(data.fatherName)} निवासी ${fill(data.address)} मो.${fill(data.mobile)} से ` +
      `निम्नलिखित शर्तों के साथ तय हुई। जिसके साई पेटे (अग्रिम) दिनांक ${fill(advanceDate)} को ` +
      `रुपये ${fill(data.signAmount)} अक्षरे ${fill(signWords)} ${fill(payment)} से प्राप्त किये।`;

    const clauses = [
      `किराया प्रति कि.मी./दिन की दर रु ${fill(data.ratePerKm)} अक्षरे ${fill(rateWords)} लिए जावेंगे, कुल किराया रु ${fill(data.finalAmount)} अक्षरे ${fill(finalWords)} होगा।`,
      `बस स्थान ${fill(data.pickupCity)} से ${fill(data.dropCity)} तक जाने व आने के वास्ते होगी। दिनांक ${fill(fromDate)} समय ${fill(fromTime)} रवाना होगी और दिनांक ${fill(toDate)} को समय ${fill(toTime)} स्थान ${fill(data.returnPlace || data.dropCity)} से वापस रवाना होगी।`,
      `गाड़ी में कुल ${fill(data.paxCount)} सवारियां होगी। इससे ज्यादा सवारियां होने पर रु ${fill(data.extraPaxCharge)} प्रति सवारी अलग से चार्ज किया जायेगा।`,
      `गाड़ी रवाना होने से पूर्व रुपये ${fill(data.beforeAmount)} कम्पनी/चालक को देने होंगे तथा जाते समय रास्ते में रुपये ${fill(data.betweenAmount)} देने होंगे व वापसी में आते समय शेष रकम चुकती रुपये ${fill(data.returnAmount)} चालक को देने होंगे।`,
      `18% जीएसटी अलग से पार्टी को देना होगा।`,
      `सामान की जिम्मेदारी व हिफाजत पूर्णतया पार्टी की होगी।`,
      `अगर गाड़ी रास्ते में ब्रेक डाउन हो जावेगी तो कम्पनी इसकी जिम्मेदार नहीं होगी और न ही हर्जे-खर्चे की जिम्मेदार होगी।`,
      `तयशुदा समय के बाद हॉल्टेज चालक की मर्जी से होगा व उसका किराया अलग से लिया जायेगा।`,
      `3 से 8 वर्ष तक के बच्चों को आधी सवारी मानी जावेगी व 8 साल से बड़ी उम्र की एक सवारी मानी जावेगी। आधी सवारी को सीट नहीं दी जायेगी।`,
      `यदि एग्रीमेन्ट रद्द किया गया तो अग्रिम (एडवांस) की राशि नहीं लौटाई जावेगी।`,
      `यदि एग्रीमेन्ट के तहत दी जाने वाली गाड़ी खराब हो जाए अथवा किन्हीं अन्य कारणों से उपलब्ध न होने पर कम्पनी अन्य गाड़ी, जो भी मौजूदा समय पर उपलब्ध होगी वही दी जावेगी।`,
      `निर्धारित तारीख के आठ दिन पहले या शर्त के अनुसार शादी कार्ड/यात्री सूची देने पर ही यह एग्रीमेन्ट मान्य होगा।`,
      `गाड़ी कच्चे, खराब मार्ग एवं तंग गलियों में नहीं जावेगी।`,
      `गाड़ी में किसी भी यात्री द्वारा किया गया नुकसान पार्टी/यात्री से वसूल किया जावेगा।`,
      `गाड़ी में वीडियो/टी.वी./पंखे/लाइट/टेपरिकार्डर आदि चालक की सुविधा एवं स्वीकृति पर ही चलाये जा सकेंगे।`,
      `गाड़ी में विस्फोटक, नशीले, ज्वलनशील पदार्थ एवं कानूनन वर्जित वस्तुएं ले जाना सख्त मना है।`,
      `यदि यात्रा के दौरान विशेष परिस्थितियों में मार्ग बदला गया तो गन्तव्य स्थान पर गाड़ी समय पर न पहुंच सके, इसके लिए कम्पनी की कोई जिम्मेदारी नहीं होगी।`,
      `लोकल घूमने के लिए किराये की तयशुदा राशि के अलावा रुपये ${fill(data.localExtraPerKm)} प्रति कि.मी. अलग से चार्ज होगा।`,
      `सभी प्रसंगों का न्याय क्षेत्र जयपुर होगा।`,
      `अनुबंध की तारीख के बाद डीजल व टैक्स बढ़ने पर पार्टी द्वारा बढ़ा हुआ डीजल टैक्स का पैसा अलग से देना होगा।`,
    ];

    return {
      company,
      title: "अनुबंध पत्र",
      serialLabel: "क्रमांकः",
      dateLabel: "दिनांकः",
      serialNo: data.serialNo || "",
      agreementDate,
      intro,
      clauses,
      specialLabel: "विशेष",
      special: data.remark || "",
      signParty: "हस्ताक्षर ग्राहक/पार्टी",
      signCompany: "वास्ते: महालक्ष्मी ट्रेवल्स",
    };
  }

  // English
  const intro =
    `This agreement for ${fill(tripType)} with a ${fill(busType)} bus is made with ` +
    `Shri ${fill(data.name)}, son of Shri ${fill(data.fatherName)}, resident of ` +
    `${fill(data.address)}, Mob. ${fill(data.mobile)}, on the following terms. ` +
    `Against this, an advance (token) of Rs. ${fill(data.signAmount)} ` +
    `(${fill(signWords)}) was received in ${fill(payment)} on ${fill(advanceDate)}.`;

  const clauses = [
    `The fare shall be charged at the rate of Rs. ${fill(data.ratePerKm)} (${fill(rateWords)}) per km/day; the total fare shall be Rs. ${fill(data.finalAmount)} (${fill(finalWords)}).`,
    `The bus shall run from ${fill(data.pickupCity)} to ${fill(data.dropCity)} and back. It will depart on ${fill(fromDate)} at ${fill(fromTime)}, and will return from ${fill(data.returnPlace || data.dropCity)} on ${fill(toDate)} at ${fill(toTime)}.`,
    `The bus shall carry a total of ${fill(data.paxCount)} passengers. For any passengers beyond this, Rs. ${fill(data.extraPaxCharge)} per passenger shall be charged separately.`,
    `Before departure, Rs. ${fill(data.beforeAmount)} shall be paid to the company/driver; Rs. ${fill(data.betweenAmount)} shall be paid en route while going; and the remaining balance of Rs. ${fill(data.returnAmount)} shall be paid to the driver on return.`,
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
    `For local sightseeing, apart from the agreed fare, Rs. ${fill(data.localExtraPerKm)} per km shall be charged separately.`,
    `The jurisdiction for all matters shall be Jaipur.`,
    `If diesel and taxes increase after the date of the agreement, the party shall separately pay the increased diesel/tax amount.`,
  ];

  return {
    company,
    title: "AGREEMENT",
    serialLabel: "Sr. No.:",
    dateLabel: "Date:",
    serialNo: data.serialNo || "",
    agreementDate,
    intro,
    clauses,
    specialLabel: "Special",
    special: data.remark || "",
    signParty: "Signature of Customer/Party",
    signCompany: "For: Mahalaxmi Travels",
  };
}
