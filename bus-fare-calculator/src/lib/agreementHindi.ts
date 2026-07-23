// Hindi (Devanagari) template for the Mahalaxmi Travels hire agreement.
// Isolated in its own file so the rest of the codebase stays ASCII.

import type { AgreementDoc, Vals } from "./agreement";

// Hindi labels for the booking-type radio options (kept here to keep
// agreement.ts free of Devanagari).
export const HI_LABELS: Record<string, string> = {
  baraat: "बारात",
  yatra: "यात्रा",
  tourist: "टूरिस्ट",
  picnic: "पिकनिक",
  reserve: "रिजर्व पार्टी",
  cash: "नकद",
  draft: "ड्राफ्ट",
  cheque: "चैक",
  epayment: "ई-पेमेन्ट",
  hindi: "हिन्दी",
  phone: "फोन",
  customer: "ग्राहक",
  route: "मार्ग",
  totalFare: "कुल किराया",
};

// Hindi cardinal numbers 0-99 (each form is irregular, so a full table is the
// only reliable way). Index 0 is empty; "shunya" is only used at the top level.
const HI_ONES = [
  "", "एक", "दो", "तीन", "चार", "पाँच", "छह", "सात", "आठ", "नौ", "दस",
  "ग्यारह", "बारह", "तेरह", "चौदह", "पंद्रह", "सोलह", "सत्रह", "अठारह", "उन्नीस", "बीस",
  "इक्कीस", "बाईस", "तेईस", "चौबीस", "पच्चीस", "छब्बीस", "सत्ताईस", "अट्ठाईस", "उनतीस", "तीस",
  "इकतीस", "बत्तीस", "तैंतीस", "चौंतीस", "पैंतीस", "छत्तीस", "सैंतीस", "अड़तीस", "उनतालीस", "चालीस",
  "इकतालीस", "बयालीस", "तैंतालीस", "चौवालीस", "पैंतालीस", "छियालीस", "सैंतालीस", "अड़तालीस", "उनचास", "पचास",
  "इक्यावन", "बावन", "तिरेपन", "चौवन", "पचपन", "छप्पन", "सत्तावन", "अट्ठावन", "उनसठ", "साठ",
  "इकसठ", "बासठ", "तिरेसठ", "चौंसठ", "पैंसठ", "छियासठ", "सड़सठ", "अड़सठ", "उनहत्तर", "सत्तर",
  "इकहत्तर", "बहत्तर", "तिहत्तर", "चौहत्तर", "पचहत्तर", "छिहत्तर", "सतहत्तर", "अठहत्तर", "उन्यासी", "अस्सी",
  "इक्यासी", "बयासी", "तिरासी", "चौरासी", "पचासी", "छियासी", "सत्तासी", "अट्ठासी", "नवासी", "नब्बे",
  "इक्यानवे", "बानवे", "तिरानवे", "चौरानवे", "पचानवे", "छियानवे", "सत्तानवे", "अट्ठानवे", "निन्यानवे",
];

function hiThreeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = "";
  if (h) s += HI_ONES[h] + " सौ" + (r ? " " : "");
  if (r) s += HI_ONES[r];
  return s;
}

// Indian-system number to Hindi words, e.g. 425040 -> "चार लाख पच्चीस हज़ार चालीस".
function hiWords(num: number): string {
  if (num === 0) return "शून्य";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(hiThreeDigits(crore) + " करोड़");
  if (lakh) parts.push(HI_ONES[lakh] + " लाख");
  if (thousand) parts.push(HI_ONES[thousand] + " हज़ार");
  if (num) parts.push(hiThreeDigits(num));
  return parts.join(" ").trim();
}

/** Rupee amount in Hindi words, e.g. "11000" -> "ग्यारह हज़ार रुपये मात्र". */
export function amountInWordsHi(value: string | number): string {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n <= 0) return "";
  return hiWords(n) + " रुपये मात्र";
}

export function buildHindiAgreement(v: Vals): AgreementDoc {
  const company = {
    name: "महालक्ष्मी ट्रेवल्स",
    regd: "(रजि.)",
    address: "2, स्टेशन रोड, जयपुर",
    phone: "0141-2369307, 0141-4040340",
    mobile: "मोबा. 9414058723",
  };

  const intro =
    `${v.tripType} के लिए ${v.busType} श्रीमान ${v.name} पुत्र श्री ` +
    `${v.fatherName} निवासी ${v.address} मो.${v.mobile} से ` +
    `निम्नलिखित शर्तों के साथ तय हुई। जिसके साई पेटे (अग्रिम) दिनांक ${v.advanceDate} को ` +
    `रुपये ${v.signAmount} अक्षरे ${v.signWords} ${v.payment} से प्राप्त किये।`;

  const clauses = [
    `किराया प्रति कि.मी./दिन की दर रु ${v.ratePerKm} अक्षरे ${v.rateWords} लिए जावेंगे, कुल किराया रु ${v.finalAmount} अक्षरे ${v.finalWords} होगा।`,
    `बस स्थान ${v.pickupCity} से ${v.dropCity} तक जाने व आने के वास्ते होगी। दिनांक ${v.fromDate} समय ${v.fromTime} रवाना होगी और दिनांक ${v.toDate} को समय ${v.toTime} स्थान ${v.returnPlace} से वापस रवाना होगी।`,
    `गाड़ी में कुल ${v.paxCount} सवारियां होगी। इससे ज्यादा सवारियां होने पर रु ${v.extraPaxCharge} प्रति सवारी अलग से चार्ज किया जायेगा।`,
    `गाड़ी रवाना होने से पूर्व रुपये ${v.beforeAmount} कम्पनी/चालक को देने होंगे तथा जाते समय रास्ते में रुपये ${v.betweenAmount} देने होंगे व वापसी में आते समय शेष रकम चुकती रुपये ${v.returnAmount} चालक को देने होंगे।`,
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
    `लोकल घूमने के लिए किराये की तयशुदा राशि के अलावा रुपये ${v.localExtraPerKm} प्रति कि.मी. अलग से चार्ज होगा।`,
    `सभी प्रसंगों का न्याय क्षेत्र जयपुर होगा।`,
    `अनुबंध की तारीख के बाद डीजल व टैक्स बढ़ने पर पार्टी द्वारा बढ़ा हुआ डीजल टैक्स का पैसा अलग से देना होगा।`,
  ];

  return {
    company,
    title: "अनुबंध पत्र",
    phoneLabel: "फोन",
    serialLabel: "क्रमांकः",
    dateLabel: "दिनांकः",
    serialNo: v.serialNo,
    agreementDate: v.agreementDate,
    intro,
    clauses,
    specialLabel: "विशेष",
    special: v.special,
    signParty: "हस्ताक्षर ग्राहक/पार्टी",
    signCompany: "वास्ते: महालक्ष्मी ट्रेवल्स",
  };
}
