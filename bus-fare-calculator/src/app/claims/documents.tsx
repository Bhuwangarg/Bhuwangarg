// Print-ready renderings of the two insurance documents. Kept separate from
// the wizard so the form logic and the paperwork layout stay independent.

import {
  ClaimData,
  DRIVER_RELATIONS,
  LOSS_TYPES,
  buildIntimation,
  dateTime,
  formatAmount,
  formatDate,
} from "@/lib/claim";

const COMPANY = {
  name: "MAHALAXMI TRAVELS",
  address: "2, Station Road, Jaipur",
  phone: "0141-2369307, 0141-4040340",
  mobile: "9414058723",
};

/** A blank that is visible on paper, so nothing looks accidentally omitted. */
function blank(v: string, width = "auto"): React.ReactNode {
  if (v) return <span className="font-semibold">{v}</span>;
  return (
    <span
      className="inline-block border-b border-dotted border-[#666] align-baseline"
      style={{ minWidth: width === "auto" ? "8rem" : width }}
    />
  );
}

/** A checkbox that prints correctly in black and white. */
function Tick({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="mr-4 inline-flex items-center gap-1 whitespace-nowrap">
      <span className="inline-flex h-3 w-3 items-center justify-center border border-[#111] text-[9px] leading-none">
        {on ? "X" : ""}
      </span>
      {label}
    </span>
  );
}

function Row({
  label,
  value,
  width,
}: {
  label: string;
  value: string;
  width?: string;
}) {
  return (
    <span className="whitespace-nowrap">
      {label} {blank(value, width)}
    </span>
  );
}

/* ---------------- intimation letter ---------------- */

export function IntimationDoc({ data }: { data: ClaimData }) {
  const rows = buildIntimation(data);
  return (
    <div className="claim-doc bg-white px-8 py-8 text-[12.5px] leading-relaxed text-[#111] sm:px-10">
      <div className="text-center">
        <div className="text-xl font-bold tracking-wide">{COMPANY.name}</div>
        <div className="text-[11px]">{COMPANY.address}</div>
        <div className="text-[11px]">
          Ph: {COMPANY.phone} &middot; Mob. {COMPANY.mobile}
        </div>
      </div>

      <div className="mx-auto mt-4 inline-block w-full border-y-2 border-[#111] py-1 text-center text-base font-bold">
        MOTOR CLAIM INTIMATION
      </div>

      <div className="mt-3 flex justify-between text-[11px]">
        <span>Ref. No.: {blank(data.refNo)}</span>
        <span>Date: {blank(formatDate(data.intimationDate))}</span>
      </div>

      <p className="mt-4">To,</p>
      <p className="font-semibold">The Claims Manager,</p>
      <p>National Insurance Company Limited</p>

      <p className="mt-4 text-justify">
        Dear Sir/Madam,
        <br />
        We wish to intimate a motor claim in respect of the vehicle detailed
        below. The particulars required for claim intimation are set out in the
        table that follows. Kindly register the claim and arrange for survey.
      </p>

      <table className="mt-4 w-full border-collapse border border-[#111]">
        <thead>
          <tr>
            <th className="w-[45%] border border-[#111] bg-[#eee] px-2 py-1 text-left font-bold">
              Details Required for Claim Intimation
            </th>
            <th className="border border-[#111] bg-[#eee] px-2 py-1 text-left font-bold">
              Details
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="border border-[#111] px-2 py-1 align-top">
                {r.label}
              </td>
              <td className="border border-[#111] px-2 py-1 align-top font-semibold">
                {r.value || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.description && (
        <p className="mt-3 text-justify">
          <strong>दुर्घटना का विवरण / Brief description:</strong>{" "}
          <span lang="hi" className="devanagari">
            {data.description}
          </span>
        </p>
      )}

      <p className="mt-4 text-justify">
        Kindly acknowledge receipt of this intimation and advise the claim
        number for our records.
      </p>

      <div className="mt-10 flex justify-end text-[12px] font-medium">
        <div className="text-center">
          <div className="border-t border-[#111] px-6 pt-1">
            For: {COMPANY.name}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- claim form ---------------- */

function SectionBar({ n, title }: { n: number; title: string }) {
  return (
    <div className="mt-3 flex items-center gap-2 bg-[#555] px-2 py-0.5 text-white">
      <span className="font-bold">{n})</span>
      <span className="font-bold tracking-wide">{title}</span>
    </div>
  );
}

export function ClaimFormDoc({ data }: { data: ClaimData }) {
  const lossLabel = LOSS_TYPES.find((t) => t.value === data.lossType);
  return (
    <div className="claim-doc bg-white px-8 py-8 text-[12px] leading-relaxed text-[#111] sm:px-10">
      <div className="text-right text-[11px] font-semibold text-[#1e3a8a]">
        National Insurance Company Limited
      </div>
      <div className="text-lg font-bold tracking-tight">
        MOTOR INSURANCE CLAIM FORM
      </div>
      <div className="text-[10px] font-bold">
        ISSUE OF THIS FORM DOES NOT IMPLY ACCEPTANCE OF LIABILITY.
      </div>
      <div className="text-[9.5px]">
        PLEASE GIVE ALL THE DETAILS ASKED FOR IN THE CLAIM FORM. CLAIM FORM TO BE
        FILLED IN AND SIGNED BY THE INSURED ONLY.
      </div>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
        <Row label="Policy No." value={data.policyNo} width="12rem" />
        <span className="whitespace-nowrap">
          Claim No. {blank("", "7rem")}{" "}
          <span className="text-[10px]">(for office use only)</span>
        </span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-6 gap-y-1">
        <Row label="Vehicle No." value={data.vehicleNo} width="9rem" />
        <Row label="Engine No." value={data.engineNo} width="8rem" />
        <Row label="Chassis No." value={data.chassisNo} width="8rem" />
      </div>

      <SectionBar n={1} title="INSURED DETAILS" />
      <div className="mt-1.5 space-y-1">
        <div>Name {blank(data.insuredName, "26rem")}</div>
        <div>Address {blank(data.insuredAddress, "25rem")}</div>
        <div className="flex flex-wrap gap-x-6">
          <Row label="Mobile No." value={data.insuredMobile} width="9rem" />
          <Row label="E-Mail Id" value={data.insuredEmail} width="12rem" />
        </div>
        <div>
          Details of other existing Insurance policy (ies) in respect of this
          accident {blank(data.otherPolicies, "10rem")}
        </div>
      </div>

      <SectionBar n={2} title="LOSS DETAILS" />
      <div className="mt-1.5 space-y-1">
        <div className="flex flex-wrap gap-x-6">
          <Row
            label="Date & Time of Accident/ Occurrence"
            value={dateTime(data.lossDate, data.lossTime)}
            width="11rem"
          />
          <Row label="Place of Loss" value={data.lossPlace} width="10rem" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4">
          <span>Type of Loss:</span>
          {LOSS_TYPES.map((t) => (
            <Tick key={t.value} on={data.lossType === t.value} label={t.label} />
          ))}
          <Row
            label="Estimated Cost of Repairs"
            value={
              formatAmount(data.estimateAmount)
                ? `Rs. ${formatAmount(data.estimateAmount)}`
                : ""
            }
            width="8rem"
          />
        </div>
        <div>
          Short Description of Accident/ Incident{" "}
          {data.description ? (
            <span lang="hi" className="devanagari font-semibold">
              {data.description}
            </span>
          ) : (
            blank("", "18rem")
          )}
        </div>
        {!data.description && (
          <div className="h-4 border-b border-dotted border-[#666]" />
        )}
      </div>

      <SectionBar n={3} title="DRIVER DETAILS" />
      <div className="mt-1.5 space-y-1">
        <div className="flex flex-wrap gap-x-6">
          <Row label="Name" value={data.driverName} width="18rem" />
          <Row label="Age" value={data.driverAge} width="4rem" />
        </div>
        <div className="flex flex-wrap items-center gap-x-4">
          <span>Is Driver:</span>
          {DRIVER_RELATIONS.map((r) => (
            <Tick
              key={r.value}
              on={data.driverRelation === r.value}
              label={r.label}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Row label="Driving License No" value={data.licenseNo} width="13rem" />
          <Row
            label="Valid up to"
            value={formatDate(data.licenseValidTo)}
            width="7rem"
          />
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Row
            label="Authorised to drive"
            value={data.authorisedToDrive}
            width="11rem"
          />
          <Row
            label="Issuing Authority"
            value={data.issuingAuthority}
            width="11rem"
          />
        </div>
      </div>

      <SectionBar n={4} title="ADDITIONAL DETAILS IN CASE OF COMMERCIAL VEHICLES" />
      <div className="mt-1.5 space-y-1">
        <div className="flex flex-wrap gap-x-6">
          <Row label="Permit No." value={data.permitNo} width="9rem" />
          <Row
            label="Valid Up to"
            value={formatDate(data.permitValidTo)}
            width="7rem"
          />
          <Row
            label="Issuing Authority"
            value={data.permitAuthority}
            width="9rem"
          />
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Row
            label="Fitness Certificate Valid Up to"
            value={formatDate(data.fitnessValidTo)}
            width="8rem"
          />
          <Row
            label="No. of fare paying Passengers carried"
            value={data.passengersCarried}
            width="6rem"
          />
        </div>
        <div className="flex flex-wrap gap-x-6">
          <Row
            label="Weight and Nature of Goods Carried"
            value={data.goodsCarried}
            width="11rem"
          />
          <Row label="GR/LR No." value={data.grLrNo} width="8rem" />
        </div>
      </div>

      <SectionBar n={5} title="INJURY/DEATH DETAILS & POLICE REPORT" />
      <div className="mt-1.5 space-y-1">
        <div className="flex flex-wrap items-center gap-x-4">
          <span>Police Report Lodged:</span>
          <Tick on={data.policeReport === "yes"} label="Yes" />
          <Tick on={data.policeReport === "no"} label="No" />
          <Row label="If yes, FIR/GD No." value={data.firNo} width="7rem" />
          <Row
            label="Police Station Name"
            value={data.policeStation}
            width="9rem"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4">
          <span>
            Death/Injury to any occupant / Third Party (others) and/or Third
            Party Property Damage:
          </span>
          <Tick on={data.thirdPartyInjury === "yes"} label="Yes" />
          <Tick on={data.thirdPartyInjury === "no"} label="No" />
        </div>
        <div>
          Details in case of Death and/or Injury to Third
          Party/Occupants/Driver or damage to property:{" "}
          {data.injuryDetails ? (
            <span className="font-semibold">{data.injuryDetails}</span>
          ) : (
            blank("", "12rem")
          )}
        </div>
      </div>

      <SectionBar n={6} title="DECLARATION" />
      <p className="mt-1.5 text-justify text-[11px]">
        I/We the above named, do hereby, to the best of my/our knowledge and
        belief, warrant the truth of the foregoing statement in every respect and
        I/We agree that if I/We have made or in any further declaration the
        company may require in respect of the said accident, shall make any false
        or fraudulent statement or any suppression or concealment the policy
        shall be void and all right to recover there-under in respect of past or
        future accidents shall be forfeited. I understand that the company
        reserves the right of verification of facts and documents relating to
        policy and the claim.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-2">
        <Row label="Date" value={formatDate(data.declarationDate)} width="7rem" />
        <Row label="Place" value={data.declarationPlace} width="8rem" />
        <span className="whitespace-nowrap">
          Signature of the Insured {blank("", "10rem")}
        </span>
      </div>

      <p className="mt-3 text-[10.5px] font-bold">
        N.B. Please attach a photocopy of your blank / cancelled cheque for NEFT
        purpose.
      </p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <table className="border-collapse border border-[#111] text-[10.5px]">
          <tbody>
            <tr>
              <td
                colSpan={2}
                className="border border-[#111] px-2 py-0.5 text-center font-bold"
              >
                INSURED&apos;S BANK A/C DETAILS
              </td>
            </tr>
            {[
              ["BANK NAME", data.bankName],
              ["BRANCH NAME", data.branchName],
              ["IFS CODE", data.ifsCode],
              ["MICR No.", data.micrNo],
              ["A/C No.", data.accountNo],
            ].map(([k, v]) => (
              <tr key={k}>
                <td className="border border-[#111] px-2 py-0.5 font-bold">
                  {k}
                </td>
                <td className="min-w-[9rem] border border-[#111] px-2 py-0.5 font-semibold">
                  {v || " "}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="text-center text-[10.5px]">
          <div className="text-[12px] font-bold">
            National Insurance Company Limited
          </div>
          <div>Registered Office :- 3, Middleton Street, Kolkata-700 001</div>
          <div>IRDA Registration No. 58</div>
          <div>Phone : 2242 0913 / 0434</div>
        </div>
      </div>

      {lossLabel && (
        <div className="mt-3 text-[10px] text-[#555]">
          Ref: {data.refNo} &middot; {lossLabel.label} claim
        </div>
      )}
    </div>
  );
}
