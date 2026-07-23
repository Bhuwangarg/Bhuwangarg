// Runtime configuration for the Fleet Document Tracker.
// This file is safe to edit and redeploy. The Supabase anon key is a PUBLIC
// key (protected by row-level security) and is intended to be shipped in the
// client — it is NOT a secret. Leaving supabaseUrl/supabaseAnonKey null keeps
// the app in local-first mode (each browser stores its own edits + export/import).
window.FLEET_CONFIG = {
  orgName: "Mahalaxmi Travels",
  appTitle: "Fleet Document Tracker",
  // Number of days before expiry that a document is flagged "Expiring soon".
  expiringSoonDays: 30,
  // Shared team database (optional). Fill these to turn on live team sync.
  supabaseUrl: null,
  supabaseAnonKey: null,
  // Google Drive folder that holds the source documents (for the "open folder" link).
  driveRootUrl: "https://drive.google.com/drive/folders/1Wlj0Ws2JK95_73Ia0wCf5q37jXIgiu27"
};
