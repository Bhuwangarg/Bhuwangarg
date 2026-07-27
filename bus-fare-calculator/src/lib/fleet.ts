// Fleet register for Mahalaxmi Travels, imported from the operator's
// fleet list. Picking a bus here fills the owner (the insured) into the
// claim and intimation forms, so staff never retype a registration number.

export interface Vehicle {
  /** Registration number as printed on the plate, e.g. "MP 44 ZC 2735". */
  reg: string;
  /** Registered owner — the insured party on the policy. */
  owner: string;
}

export const FLEET: Vehicle[] = [
  { reg: "DD 03 Q 9979", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZC 2735", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZD 1609", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZD 9306", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZD 9341", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZD 9379", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZD 9385", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 2065", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 2704", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 2715", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 2745", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 3358", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 3397", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 6216", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 6253", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 6257", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 6274", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 7954", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 7969", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 7989", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZE 7992", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZF 2103", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZF 2127", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZF 2133", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZF 2191", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZF 2506", owner: "Bhuwan Garg" },
  { reg: "MP 44 ZF 2538", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 1614", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 4676", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 4677", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 6131", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 6132", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 6133", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 6134", owner: "Bhuwan Garg" },
  { reg: "RJ 14 TG 6135", owner: "Bhuwan Garg" },
  { reg: "RJ 60 CB 1258", owner: "Bhuwan Garg" },
  { reg: "BR 04 PA 6484", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6485", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6509", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6510", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6519", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6520", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6584", owner: "Praveen Agrawal" },
  { reg: "BR 04 PA 6585", owner: "Praveen Agrawal" },
  { reg: "BR 21 P 9389", owner: "Praveen Agrawal" },
  { reg: "BR 21 P 9521", owner: "Praveen Agrawal" },
  { reg: "BR 28 P 3338", owner: "Praveen Agrawal" },
  { reg: "DD 01 N 9872", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZC 6928", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZC 6944", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZC 6967", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZC 6994", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZC 8936", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZC 8958", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZD 0471", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZD 0639", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZD 0649", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZF 2124", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZF 2172", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZF 2176", owner: "Praveen Agrawal" },
  { reg: "MP 44 ZF 2198", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0583", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0584", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0585", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0586", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0587", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0588", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0589", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0639", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0663", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0668", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0684", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0685", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0687", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0712", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0899", owner: "Praveen Agrawal" },
  { reg: "NL 07 B 0902", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6126", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6127", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6128", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6133", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6134", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6136", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6137", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6141", owner: "Praveen Agrawal" },
  { reg: "RJ 09 PA 6142", owner: "Praveen Agrawal" },
  { reg: "RJ 14 PD 8001", owner: "Praveen Agrawal" },
  { reg: "RJ 14 PF 0207", owner: "Praveen Agrawal" },
  { reg: "RJ 14 PF 0306", owner: "Praveen Agrawal" },
  { reg: "RJ 14 PF 4074", owner: "Praveen Agrawal" },
  { reg: "RJ 14 PF 4075", owner: "Praveen Agrawal" },
  { reg: "RJ 14 UK 7677", owner: "Praveen Agrawal" },
  { reg: "RJ 30 PA 4601", owner: "Praveen Agrawal" },
  { reg: "RJ 30 PA 4602", owner: "Praveen Agrawal" },
  { reg: "RJ 47 PA 0369", owner: "Praveen Agrawal" },
  { reg: "RJ 47 PA 0405", owner: "Praveen Agrawal" },
  { reg: "UK 07 PA 5509", owner: "Praveen Agrawal" },
  { reg: "UK 07 PA 5510", owner: "Praveen Agrawal" },
  { reg: "UP 78 JN 4688", owner: "Praveen Agrawal" },
];

/** Compare registrations ignoring spaces/dashes, so "MP44ZC2735" matches. */
export function normalizeReg(reg: string): string {
  return reg.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

/** Find a fleet vehicle by registration, however it was typed. */
export function findVehicle(reg: string): Vehicle | undefined {
  const key = normalizeReg(reg);
  return FLEET.find((v) => normalizeReg(v.reg) === key);
}

/** Vehicles matching a free-text search on registration or owner. */
export function searchFleet(query: string, limit = 8): Vehicle[] {
  const q = query.trim();
  if (!q) return FLEET.slice(0, limit);
  const key = normalizeReg(q);
  const lower = q.toLowerCase();
  return FLEET.filter(
    (v) =>
      normalizeReg(v.reg).includes(key) ||
      v.owner.toLowerCase().includes(lower),
  ).slice(0, limit);
}
