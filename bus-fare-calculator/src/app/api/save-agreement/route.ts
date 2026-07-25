import { NextResponse } from "next/server";

// Saves a generated agreement PDF into the company's Google Drive folder, so
// every real agreement leaves a central, official record. The site acts as the
// company Google account via a stored OAuth refresh token — this keeps files in
// that account's own (free) Drive storage, which a service account cannot do.
//
// Configure these environment variables on the deployment for saving to work.
// Until they are all present the endpoint is a graceful no-op (the app still
// prints/shares normally), so the feature can ship before credentials exist:
//   GOOGLE_CLIENT_ID       – OAuth client id
//   GOOGLE_CLIENT_SECRET   – OAuth client secret
//   GOOGLE_REFRESH_TOKEN   – refresh token for the company account (offline)
//   GOOGLE_DRIVE_FOLDER_ID – id of the Drive folder to store agreements in

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Guard against oversized uploads (a scanned A4 PDF is well under this).
const MAX_PDF_BYTES = 8 * 1024 * 1024;

interface SaveBody {
  id?: string;
  customer?: string;
  route?: string;
  amount?: string;
  date?: string;
  lang?: string;
  pdfBase64?: string;
}

function driveConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!clientId || !clientSecret || !refreshToken || !folderId) return null;
  return { clientId, clientSecret, refreshToken, folderId };
}

// Exchange the long-lived refresh token for a short-lived access token.
async function getAccessToken(c: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`token exchange failed: ${res.status} ${detail}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("token exchange returned no token");
  return data.access_token;
}

// A safe, descriptive Drive filename, e.g. "ML-260725-4F7A - Ramesh Kumar.pdf".
function fileName(body: SaveBody): string {
  const id = (body.id || "agreement").replace(/[\\/:*?"<>|]/g, "-").trim();
  const who = (body.customer || "").replace(/[\\/:*?"<>|]/g, "-").trim();
  return who ? `${id} - ${who}.pdf` : `${id}.pdf`;
}

export async function POST(request: Request) {
  const config = driveConfig();
  // Not configured yet — succeed quietly so the UI treats it as "not enabled".
  if (!config) {
    return NextResponse.json({ ok: false, skipped: true, reason: "not-configured" });
  }

  let body: SaveBody;
  try {
    body = (await request.json()) as SaveBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  if (!body.pdfBase64) {
    return NextResponse.json({ ok: false, error: "Missing PDF." }, { status: 400 });
  }

  let pdf: Buffer;
  try {
    pdf = Buffer.from(body.pdfBase64, "base64");
  } catch {
    return NextResponse.json({ ok: false, error: "Bad PDF data." }, { status: 400 });
  }
  if (pdf.length === 0 || pdf.length > MAX_PDF_BYTES) {
    return NextResponse.json({ ok: false, error: "PDF size out of range." }, { status: 400 });
  }

  try {
    const accessToken = await getAccessToken(config);

    // A human-readable trail on the file itself, matching what's on the PDF.
    const description = [
      body.id ? `Ref: ${body.id}` : "",
      body.customer ? `Customer: ${body.customer}` : "",
      body.route ? `Route: ${body.route}` : "",
      body.amount ? `Total: ${body.amount}` : "",
      body.date ? `Date: ${body.date}` : "",
      body.lang ? `Language: ${body.lang}` : "",
      "Saved automatically by the Mahalaxmi Travels agreement generator.",
    ]
      .filter(Boolean)
      .join("\n");

    // Step 1: create the file's metadata (name + parent folder), no content yet.
    const createRes = await fetch(
      "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: fileName(body),
          parents: [config.folderId],
          mimeType: "application/pdf",
          description,
        }),
        cache: "no-store",
      },
    );
    if (!createRes.ok) {
      const detail = await createRes.text();
      throw new Error(`create failed: ${createRes.status} ${detail}`);
    }
    const created = (await createRes.json()) as { id?: string };
    if (!created.id) throw new Error("create returned no file id");

    // Step 2: upload the PDF bytes into that file.
    const uploadRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${created.id}?uploadType=media&supportsAllDrives=true&fields=id,webViewLink`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/pdf",
        },
        body: new Uint8Array(pdf),
        cache: "no-store",
      },
    );
    if (!uploadRes.ok) {
      const detail = await uploadRes.text();
      throw new Error(`upload failed: ${uploadRes.status} ${detail}`);
    }
    const uploaded = (await uploadRes.json()) as {
      id?: string;
      webViewLink?: string;
    };

    return NextResponse.json({
      ok: true,
      fileId: uploaded.id ?? created.id,
      webViewLink: uploaded.webViewLink ?? null,
    });
  } catch (err) {
    console.error("save-agreement:", err);
    return NextResponse.json(
      { ok: false, error: "Could not save to Drive right now." },
      { status: 502 },
    );
  }
}
