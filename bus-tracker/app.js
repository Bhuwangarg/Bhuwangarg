/* Fleet Document Tracker — static, dependency-free front end.
   Data flow: seed (data/fleet.json, from Drive OCR) + overlay (edits/uploads/new buses).
   Overlay storage backends: localStorage (default) or Supabase (shared team DB). */
(() => {
  "use strict";
  const CFG = Object.assign({
    orgName: "Fleet", appTitle: "Fleet Document Tracker",
    expiringSoonDays: 30, supabaseUrl: null, supabaseAnonKey: null, driveRootUrl: "#", dataUrl: null
  }, window.FLEET_CONFIG || {});

  const CORE_TYPES = ["Insurance", "Fitness", "Permit", "Tax", "PUC"]; // always shown per bus
  const ALL_TYPES = ["Insurance", "Fitness", "Permit", "Tax", "PUC", "RC"];
  const OVERLAY_KEY = "fleet_overlay_v1";
  const SETTINGS_KEY = "fleet_settings_v1";

  // ---------- small helpers ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const el = (t, props = {}, kids = []) => {
    const n = document.createElement(t);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "html") n.innerHTML = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) n.setAttribute(k, v);
    }
    (Array.isArray(kids) ? kids : [kids]).forEach(c => c != null && n.append(c.nodeType ? c : document.createTextNode(c)));
    return n;
  };
  const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const TODAY = startOfDay(new Date());
  const parseISO = s => { if (!s) return null; const d = new Date(s + "T00:00:00"); return isNaN(d) ? null : d; };
  const fmtDate = s => { const d = parseISO(s); return d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"; };
  const daysUntil = s => { const d = parseISO(s); return d ? Math.round((startOfDay(d) - TODAY) / 86400000) : null; };
  const toast = (() => {
    let t;
    return (msg) => {
      if (t) t.remove();
      t = el("div", { class: "toast", text: msg });
      document.body.append(t); requestAnimationFrame(() => t.classList.add("show"));
      setTimeout(() => { t && t.classList.remove("show"); }, 2600);
    };
  })();

  // ---------- settings ----------
  let settings = Object.assign(
    { expiringSoonDays: CFG.expiringSoonDays, supabaseUrl: CFG.supabaseUrl, supabaseAnonKey: CFG.supabaseAnonKey },
    JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
  );
  const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  // ---------- storage backends ----------
  const LocalStore = {
    mode: "local",
    async load() { try { return JSON.parse(localStorage.getItem(OVERLAY_KEY) || "{}"); } catch { return {}; } },
    async save(o) { localStorage.setItem(OVERLAY_KEY, JSON.stringify(o)); }
  };
  function makeSupabaseStore(url, key) {
    let client = null;
    async function get() {
      if (client) return client;
      const mod = await import("https://esm.sh/@supabase/supabase-js@2");
      client = mod.createClient(url, key);
      return client;
    }
    return {
      mode: "cloud",
      async load() {
        const c = await get();
        const { data, error } = await c.from("fleet_state").select("data").eq("id", "overlay").maybeSingle();
        if (error) throw error;
        return (data && data.data) || {};
      },
      async save(o) {
        const c = await get();
        const { error } = await c.from("fleet_state").upsert({ id: "overlay", data: o, updated_at: new Date().toISOString() });
        if (error) throw error;
      }
    };
  }
  let store = LocalStore;
  if (settings.supabaseUrl && settings.supabaseAnonKey) {
    try { store = makeSupabaseStore(settings.supabaseUrl, settings.supabaseAnonKey); } catch { store = LocalStore; }
  }

  // ---------- state ----------
  let seed = { buses: [], generatedAt: null };
  let overlay = { docEdits: {}, addedBuses: [], hiddenDocs: {} }; // docEdits keyed "busId::TYPE"
  let ui = { view: "attention", status: "all", type: "all", q: "" };

  const docKey = (busId, type) => `${busId}::${type}`;

  // Merge seed + overlay into a normalized list of buses with per-type docs.
  function buildModel() {
    const busMap = new Map();
    const folderUrl = id => id ? `https://drive.google.com/drive/folders/${id}` : null;
    const seedDoc = d => ({
      type: d.type,
      expiry: d.expiry || null,
      fileName: d.fn || d.fileName || null,
      viewUrl: d.fid ? `https://drive.google.com/file/d/${d.fid}/view` : (d.viewUrl || null),
      confidence: d.c ? ({ l: "low", m: "medium" }[d.c] || d.c) : (d.confidence || "high"),
      note: d.note || "",
      source: "drive"
    });
    const addBus = (b) => {
      if (!busMap.has(b.id)) busMap.set(b.id, { id: b.id, name: b.name, driveFolderUrl: b.driveFolderUrl || folderUrl(b.id), docs: {} });
      return busMap.get(b.id);
    };
    seed.buses.forEach(b => {
      const bus = addBus(b);
      (b.documents || []).forEach(d => { bus.docs[d.type] = seedDoc(d); });
    });
    (overlay.addedBuses || []).forEach(b => addBus(b));
    // apply per-doc edits/additions
    for (const [k, e] of Object.entries(overlay.docEdits || {})) {
      const [busId, type] = k.split("::");
      const bus = busMap.get(busId);
      if (!bus) continue;
      const base = bus.docs[type] || { type };
      bus.docs[type] = Object.assign({}, base, e, { type, source: e.fileDataUrl ? "upload" : (base.source || "manual") });
    }
    return Array.from(busMap.values()).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  function statusOf(doc) {
    if (!doc || !doc.expiry) return "unknown";
    const dl = daysUntil(doc.expiry);
    if (dl == null) return "unknown";
    if (dl < 0) return "expired";
    if (dl <= settings.expiringSoonDays) return "expiring";
    return "valid";
  }
  const STATUS_LABEL = { expired: "Expired", expiring: "Expiring soon", valid: "Valid", unknown: "No expiry / missing" };
  const STATUS_RANK = { expired: 0, expiring: 1, unknown: 2, valid: 3 };

  // Flatten to document rows for the core types (+RC if present) across all buses.
  function docRows(model) {
    const rows = [];
    model.forEach(bus => {
      const types = CORE_TYPES.slice();
      if (bus.docs.RC) types.push("RC");
      types.forEach(type => {
        const doc = bus.docs[type] || null;
        rows.push({
          bus, type, doc,
          status: doc ? statusOf(doc) : "unknown",
          missing: !doc,
          expiry: doc ? doc.expiry : null,
          dl: doc ? daysUntil(doc.expiry) : null
        });
      });
    });
    return rows;
  }

  // ---------- rendering ----------
  function renderKpis(model) {
    const rows = docRows(model).filter(r => r.type !== "RC");
    const c = { expired: 0, expiring: 0, valid: 0, missing: 0 };
    rows.forEach(r => {
      if (r.missing || !r.expiry) c.missing++;
      else c[r.status] !== undefined && c[r.status]++;
    });
    const tiles = [
      { cls: "total", n: model.length, l: "Buses in fleet" },
      { cls: "bad", n: c.expired, l: "Documents expired" },
      { cls: "warn", n: c.expiring, l: `Expiring ≤ ${settings.expiringSoonDays} days` },
      { cls: "ok", n: c.valid, l: "Valid documents" },
      { cls: "unk", n: c.missing, l: "Missing / no date" }
    ];
    const box = $("#kpis"); box.innerHTML = "";
    tiles.forEach(t => box.append(el("div", { class: `kpi ${t.cls}` }, [
      el("div", { class: "bar" }), el("div", { class: "n", text: String(t.n) }), el("div", { class: "l", text: t.l })
    ])));
  }

  function renderStatusChips(model) {
    const rows = docRows(model).filter(r => r.type !== "RC");
    const counts = { all: rows.length, expired: 0, expiring: 0, valid: 0, unknown: 0 };
    rows.forEach(r => { const s = (r.missing || !r.expiry) ? "unknown" : r.status; counts[s]++; });
    const defs = [
      ["all", "All", "var(--brand)"], ["expired", "Expired", "var(--bad)"],
      ["expiring", "Expiring", "var(--warn)"], ["valid", "Valid", "var(--ok)"], ["unknown", "Missing", "var(--unk)"]
    ];
    const box = $("#status-filters"); box.innerHTML = "";
    defs.forEach(([k, label, col]) => {
      const chip = el("button", { class: "chip" + (ui.status === k ? " active" : ""), "data-status": k }, [
        el("span", { class: "dot", style: `background:${col}` }),
        label, el("span", { class: "cnt", text: String(counts[k]) })
      ]);
      chip.addEventListener("click", () => { ui.status = k; render(); });
      box.append(chip);
    });
  }

  function pill(status) { return el("span", { class: `pill ${status}`, text: STATUS_LABEL[status] }); }
  // Context-aware pill: distinguishes "not on file" from "on file but no expiry".
  function pillFor(r) {
    if (!r.missing && r.expiry) return el("span", { class: `pill ${r.status}`, text: STATUS_LABEL[r.status] });
    return el("span", { class: "pill unknown", text: r.missing ? "Not on file" : "No expiry" });
  }
  function confFlag(doc) {
    // Only flag a DATE that needs checking (low-confidence OCR with an actual expiry).
    if (doc && doc.expiry && doc.confidence === "low") return el("span", { class: "conf-flag", title: "Low-confidence OCR — please verify this date", text: "⚠ verify" });
    return null;
  }
  function daysText(dl) {
    if (dl == null) return "—";
    if (dl < 0) return `${Math.abs(dl)}d overdue`;
    if (dl === 0) return "today";
    return `in ${dl}d`;
  }

  function matchesFilters(r) {
    if (ui.type !== "all" && r.type !== ui.type) return false;
    if (ui.q && !r.bus.name.toLowerCase().includes(ui.q)) return false;
    if (ui.status !== "all") {
      const s = (r.missing || !r.expiry) ? "unknown" : r.status;
      if (s !== ui.status) return false;
    }
    return true;
  }

  function viewDocLink(r) {
    const doc = r.doc;
    if (doc && doc.fileDataUrl) return el("a", { class: "iconbtn", href: doc.fileDataUrl, target: "_blank", rel: "noopener", text: "View" });
    if (doc && doc.viewUrl) return el("a", { class: "iconbtn", href: doc.viewUrl, target: "_blank", rel: "noopener", text: "View" });
    if (r.bus.driveFolderUrl) return el("a", { class: "iconbtn", href: r.bus.driveFolderUrl, target: "_blank", rel: "noopener", text: "Folder" });
    return null;
  }
  function editBtn(r) {
    return el("button", { class: "iconbtn", text: r.missing ? "Add" : "Edit", onclick: () => openDocModal(r.bus, r.type, r.doc) });
  }

  function renderAttention(model) {
    const rows = docRows(model).filter(matchesFilters).sort((a, b) => {
      const sa = (a.missing || !a.expiry) ? "unknown" : a.status, sb = (b.missing || !b.expiry) ? "unknown" : b.status;
      if (STATUS_RANK[sa] !== STATUS_RANK[sb]) return STATUS_RANK[sa] - STATUS_RANK[sb];
      if (a.expiry && b.expiry) return parseISO(a.expiry) - parseISO(b.expiry);
      if (a.expiry) return -1; if (b.expiry) return 1;
      return a.bus.name.localeCompare(b.bus.name, undefined, { numeric: true });
    });
    const content = $("#content"); content.innerHTML = "";
    if (!rows.length) { content.append(el("div", { class: "empty", text: "No documents match these filters." })); return; }
    const table = el("table", { class: "att" });
    table.append(el("thead", {}, el("tr", {}, [
      el("th", { text: "Bus" }), el("th", { text: "Document" }), el("th", { text: "Expiry" }),
      el("th", { class: "hide-sm", text: "Status" }), el("th", { text: "" })
    ])));
    const tb = el("tbody");
    rows.forEach(r => {
      const status = (r.missing || !r.expiry) ? "unknown" : r.status;
      const acts = el("div", {}, [viewDocLink(r), editBtn(r)].filter(Boolean));
      tb.append(el("tr", {}, [
        el("td", { class: "busname" }, r.bus.name),
        el("td", {}, [el("strong", { text: r.type }), confFlag(r.doc)].filter(Boolean)),
        el("td", {}, r.missing ? el("span", { class: "muted", text: "not on file" }) :
          el("div", {}, [el("div", { text: fmtDate(r.expiry) }), el("small", { class: "daysleft muted", text: daysText(r.dl) })])),
        el("td", { class: "hide-sm" }, pillFor(r)),
        el("td", { class: "t-actions" }, acts)
      ]));
    });
    table.append(tb);
    content.append(el("div", { class: "table-wrap" }, table));
  }

  function renderBuses(model) {
    const content = $("#content"); content.innerHTML = "";
    const grid = el("div", { class: "bus-grid" });
    let shown = 0;
    model.forEach(bus => {
      const types = CORE_TYPES.slice(); if (bus.docs.RC) types.push("RC");
      const rows = types.map(type => ({ bus, type, doc: bus.docs[type] || null, missing: !bus.docs[type] }))
        .map(r => Object.assign(r, { status: r.doc ? statusOf(r.doc) : "unknown", expiry: r.doc ? r.doc.expiry : null, dl: r.doc ? daysUntil(r.doc.expiry) : null }));
      // bus-level filter: show bus if any row matches, respect search
      if (ui.q && !bus.name.toLowerCase().includes(ui.q)) return;
      const visRows = rows.filter(r => {
        if (ui.type !== "all" && r.type !== ui.type) return false;
        if (ui.status !== "all") { const s = (r.missing || !r.expiry) ? "unknown" : r.status; return s === ui.status; }
        return true;
      });
      if (!visRows.length) return;
      shown++;
      const worst = rows.reduce((w, r) => { const s = (r.missing || !r.expiry) ? "unknown" : r.status; return STATUS_RANK[s] < STATUS_RANK[w] ? s : w; }, "valid");
      const card = el("div", { class: "bus-card" }, [
        el("div", { class: "bc-head" }, [
          el("div", {}, [el("div", { class: "bc-name", text: bus.name }),
            el("div", { class: "bc-sub", text: `${rows.filter(r => !r.missing).length}/${rows.length} on file` })]),
          el("span", { class: `bc-worst pill ${worst}`, text: STATUS_LABEL[worst] })
        ]),
        el("div", { class: "doc-rows" }, visRows.map(r => el("div", { class: "doc-row" }, [
          el("div", { class: "dt", text: r.type }),
          el("div", { class: "de" }, r.missing ? el("span", { class: "muted", text: "not on file" }) :
            el("span", {}, [fmtDate(r.expiry) + "  ", el("small", { class: "muted", text: daysText(r.dl) }), confFlag(r.doc)].filter(Boolean))),
          pillFor(r),
          el("div", { class: "actions" }, [viewDocLink(r), editBtn(r)].filter(Boolean))
        ])))
      ]);
      grid.append(card);
    });
    if (!shown) { content.append(el("div", { class: "empty", text: "No buses match these filters." })); return; }
    content.append(grid);
  }

  function render() {
    const model = buildModel();
    $("#org-name").textContent = CFG.orgName;
    $("#app-subtitle").textContent = CFG.appTitle;
    document.title = `${CFG.orgName} — ${CFG.appTitle}`;
    renderKpis(model);
    renderStatusChips(model);
    // type filter options
    const tf = $("#type-filter");
    if (!tf.dataset.built) {
      tf.append(el("option", { value: "all", text: "All document types" }));
      ALL_TYPES.forEach(t => tf.append(el("option", { value: t, text: t })));
      tf.dataset.built = "1";
      tf.addEventListener("change", () => { ui.type = tf.value; render(); });
    }
    $$(".vt").forEach(b => b.classList.toggle("active", b.dataset.view === ui.view));
    if (ui.view === "attention") renderAttention(model); else renderBuses(model);
    const meta = seed.generatedAt ? `Data seeded ${new Date(seed.generatedAt).toLocaleDateString("en-GB")} from Google Drive · ` : "";
    $("#foot-meta").textContent = `${meta}${model.length} buses · Status computed for ${TODAY.toLocaleDateString("en-GB")}. Always verify against the source document before renewal.`;
    // datalist of buses for the form
    const dl = $("#bus-list"); dl.innerHTML = "";
    model.forEach(b => dl.append(el("option", { value: b.name })));
    $("#sync-badge").className = "sync-badge " + (store.mode === "cloud" ? "cloud" : "local");
    $("#sync-badge").textContent = store.mode === "cloud" ? "● Team sync" : "● Local";
  }

  // ---------- persistence of edits ----------
  async function persist() {
    try { await store.save(overlay); }
    catch (e) { console.error(e); toast("Could not save to team database — saved locally instead."); await LocalStore.save(overlay); }
  }

  function findBusByName(name) {
    const model = buildModel();
    return model.find(b => b.name.toLowerCase() === name.toLowerCase()) || null;
  }
  const slug = s => "custom-" + s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // ---------- doc modal ----------
  let modalCtx = null;
  function openDocModal(bus, type, doc) {
    modalCtx = { busId: bus ? bus.id : null };
    $("#doc-modal-title").textContent = doc ? `Update ${type} — ${bus.name}` : (bus ? `Add document — ${bus.name}` : "Add / update document");
    $("#f-bus").value = bus ? bus.name : "";
    const ts = $("#f-type"); ts.innerHTML = ""; ALL_TYPES.forEach(t => ts.append(el("option", { value: t, text: t })));
    ts.value = type || "Insurance";
    $("#f-expiry").value = doc && doc.expiry ? doc.expiry : "";
    $("#f-note").value = doc && doc.note ? doc.note : "";
    $("#f-file").value = "";
    $("#f-file-note").textContent = doc && (doc.fileName || doc.viewUrl) ? `On file: ${doc.fileName || "Drive document"} (attach a file to replace).` : "Attach a scan/photo. Stored with this record.";
    showModal("#doc-modal");
  }

  function readFileAsDataURL(file) {
    return new Promise((res, rej) => {
      if (!file) return res(null);
      if (file.size > 4 * 1024 * 1024) return rej(new Error("File is larger than 4 MB. Use the Drive folder for large scans."));
      const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
    });
  }

  $("#doc-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("#f-bus").value.trim();
    if (!name) return;
    const type = $("#f-type").value;
    const expiry = $("#f-expiry").value || null;
    const note = $("#f-note").value.trim();
    const file = $("#f-file").files[0];
    let bus = findBusByName(name);
    if (!bus) {
      const id = slug(name);
      overlay.addedBuses = overlay.addedBuses || [];
      if (!overlay.addedBuses.some(b => b.id === id)) overlay.addedBuses.push({ id, name, driveFolderUrl: null });
      bus = { id, name };
    }
    let fileDataUrl = null, fileName = file ? file.name : undefined;
    try { fileDataUrl = await readFileAsDataURL(file); }
    catch (err) { toast(err.message); return; }
    const key = docKey(bus.id, type);
    const prev = (overlay.docEdits && overlay.docEdits[key]) || {};
    overlay.docEdits = overlay.docEdits || {};
    overlay.docEdits[key] = Object.assign({}, prev, {
      expiry, note,
      updatedAt: new Date().toISOString(),
      confidence: "high"
    });
    if (fileDataUrl) { overlay.docEdits[key].fileDataUrl = fileDataUrl; overlay.docEdits[key].fileName = fileName; overlay.docEdits[key].viewUrl = null; }
    else if (fileName) { overlay.docEdits[key].fileName = fileName; }
    await persist();
    hideModal("#doc-modal");
    toast(`${type} saved for ${bus.name}.`);
    render();
  });

  // ---------- settings modal ----------
  function openSettings() {
    $("#s-days").value = settings.expiringSoonDays;
    $("#s-sb-url").value = settings.supabaseUrl || "";
    $("#s-sb-key").value = settings.supabaseAnonKey || "";
    $("#s-storage-desc").textContent = store.mode === "cloud"
      ? "Connected to a shared team database — edits sync for everyone."
      : "Local mode — edits are saved in this browser. Use Export to share a master file, or connect a team database below.";
    showModal("#settings-modal");
  }
  $("#s-save").addEventListener("click", async () => {
    const days = Math.max(1, Math.min(365, parseInt($("#s-days").value, 10) || 30));
    settings.expiringSoonDays = days;
    const url = $("#s-sb-url").value.trim(), key = $("#s-sb-key").value.trim();
    const changed = url !== (settings.supabaseUrl || "") || key !== (settings.supabaseAnonKey || "");
    settings.supabaseUrl = url || null; settings.supabaseAnonKey = key || null;
    saveSettings();
    if (changed) {
      if (url && key) {
        try {
          const s = makeSupabaseStore(url, key);
          const remote = await s.load();
          store = s; overlay = normalizeOverlay(remote);
          toast("Connected to team database.");
        } catch (e) { console.error(e); toast("Could not connect — check URL/key. Staying local."); }
      } else { store = LocalStore; overlay = normalizeOverlay(await LocalStore.load()); }
    }
    hideModal("#settings-modal");
    render();
  });

  // ---------- export / import ----------
  function exportData() {
    const model = buildModel();
    const payload = { exportedAt: new Date().toISOString(), org: CFG.orgName, seedGeneratedAt: seed.generatedAt, overlay, snapshot: model.map(b => ({ bus: b.name, docs: b.docs })) };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: `fleet-documents-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    toast("Exported current data.");
  }
  function importData(file) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const data = JSON.parse(r.result);
        const ov = data.overlay || data;
        overlay = normalizeOverlay(ov);
        await persist(); render(); toast("Imported data.");
      } catch { toast("Could not read that file."); }
    };
    r.readAsText(file);
  }
  function normalizeOverlay(o) {
    o = o && typeof o === "object" ? o : {};
    return { docEdits: o.docEdits || {}, addedBuses: o.addedBuses || [], hiddenDocs: o.hiddenDocs || {} };
  }

  // ---------- modal plumbing ----------
  function showModal(sel) { $(sel).hidden = false; }
  function hideModal(sel) { $(sel).hidden = true; }
  $$("[data-close]").forEach(b => b.addEventListener("click", e => { e.target.closest(".modal-backdrop").hidden = true; }));
  $$(".modal-backdrop").forEach(m => m.addEventListener("click", e => { if (e.target === m) m.hidden = true; }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal-backdrop").forEach(m => m.hidden = true); });

  // ---------- wiring ----------
  $("#btn-add").addEventListener("click", () => openDocModal(null, "Insurance", null));
  $("#btn-settings").addEventListener("click", openSettings);
  $("#search").addEventListener("input", e => { ui.q = e.target.value.trim().toLowerCase(); render(); });
  $$(".vt").forEach(b => b.addEventListener("click", () => { ui.view = b.dataset.view; render(); }));
  const dataMenu = $("#data-menu");
  $("#btn-data").addEventListener("click", e => { e.stopPropagation(); dataMenu.hidden = !dataMenu.hidden; });
  document.addEventListener("click", () => { dataMenu.hidden = true; });
  dataMenu.addEventListener("click", e => e.stopPropagation());
  $("#btn-export").addEventListener("click", () => { dataMenu.hidden = true; exportData(); });
  $("#btn-import").addEventListener("click", () => { dataMenu.hidden = true; $("#import-file").click(); });
  $("#import-file").addEventListener("change", e => { if (e.target.files[0]) importData(e.target.files[0]); e.target.value = ""; });
  $("#btn-drive").href = CFG.driveRootUrl;

  // ---------- boot ----------
  async function boot() {
    // Try same-origin data first, then the configured remote data URL (e.g. GitHub raw).
    const sources = ["./data/fleet.json", CFG.dataUrl].filter(Boolean);
    for (const url of sources) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        seed = await res.json();
        if (seed && Array.isArray(seed.buses) && seed.buses.length) break;
      } catch (e) { console.error("data source failed:", url, e); }
    }
    if (!seed || !Array.isArray(seed.buses)) seed = { buses: [], generatedAt: null };
    try { overlay = normalizeOverlay(await store.load()); }
    catch (e) { console.error(e); store = LocalStore; overlay = normalizeOverlay(await LocalStore.load()); toast("Team database unreachable — using local data."); }
    render();
  }
  boot();
})();
