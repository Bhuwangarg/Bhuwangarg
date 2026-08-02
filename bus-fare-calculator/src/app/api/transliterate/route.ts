import { NextResponse } from "next/server";

// Roman -> Devanagari transliteration for the accident description, so staff
// can type "gaadi kharab ho gayi" on an ordinary keyboard and get
// "गाडी ख़राब हो गयी" on the claim paperwork.
//
// Backed by Google Input Tools, the same keyless service behind the Google
// Indic keyboard. Runs server-side to avoid CORS and to keep the upstream
// call swappable.
//
// NOTE: this transliterates sounds, it does not translate meaning. Typing
// English prose yields Devanagari-spelled English ("the" -> "थे"), so the UI
// asks for Hinglish and shows the result for the operator to check.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INPUT_TOOLS = "https://inputtools.google.com/request";

// A description is a couple of sentences; anything larger is not a legitimate
// caller and would just burden the free upstream service.
const MAX_TEXT = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get("text") ?? "").trim();

  if (!text) {
    return NextResponse.json({ error: "Nothing to convert." }, { status: 400 });
  }
  if (text.length > MAX_TEXT) {
    return NextResponse.json(
      { error: "Text is too long to convert." },
      { status: 400 },
    );
  }

  try {
    const url =
      `${INPUT_TOOLS}?text=${encodeURIComponent(text)}` +
      `&itc=hi-t-i0-und&num=1&cp=0&cs=1&ie=utf-8&oe=utf-8`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Conversion service is unavailable." },
        { status: 502 },
      );
    }

    // Shape: ["SUCCESS", [[ "<input>", ["<candidate>"], [], {...} ]]]
    const data = (await res.json()) as
      | [string, Array<[string, string[], unknown, unknown]>]
      | unknown;

    if (
      !Array.isArray(data) ||
      data[0] !== "SUCCESS" ||
      !Array.isArray(data[1]) ||
      !data[1][0]
    ) {
      return NextResponse.json(
        { error: "Could not convert that text." },
        { status: 502 },
      );
    }

    const candidates = data[1][0][1];
    const hindi = Array.isArray(candidates) ? candidates[0] : null;
    if (typeof hindi !== "string" || !hindi) {
      return NextResponse.json(
        { error: "Could not convert that text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ text: hindi });
  } catch {
    return NextResponse.json(
      { error: "Conversion service is unreachable." },
      { status: 503 },
    );
  }
}
