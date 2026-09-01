// Euro Gems — the conversation flow as data (single source of truth).
//
// Every string exists in English (en) and Italian (it). After the language
// node, the engine renders each node in the customer's chosen language.
// Stone selections write `last_stone`; the showroom node writes `showroom`.
// This is the exact logic zappie runs — kept as plain data so it is trivial to
// port into the zappie flow builder or run directly via src/server.js.

export const TRIGGER_KEYWORDS = ["hi", "hello", "hey", "ciao", "salve", "buongiorno", "menu", "start"];

// Reply-button limit is 3; anything with 4+ options is a WhatsApp list message.
export const NODES = {
  // The language node is shown bilingually because we don't know the language yet.
  language: {
    type: "buttons",
    bilingual: true,
    text: {
      en: "💎 Welcome to Euro Gems. Please choose your language.",
      it: "💎 Benvenuto in Euro Gems. Scegli la tua lingua.",
    },
    options: [
      { id: "lang_en", label: { en: "English", it: "English" }, set: { preferred_language: "English" }, next: "returning_check" },
      { id: "lang_it", label: { en: "Italiano", it: "Italiano" }, set: { preferred_language: "Italian" }, next: "returning_check" },
    ],
  },

  // Logical node (no message). Branches on whether last_stone is set.
  returning_check: {
    type: "branch",
    branch: (attrs) => (attrs.last_stone ? "welcome_back" : "main_menu"),
  },

  welcome_back: {
    type: "buttons",
    text: {
      en: "Welcome back! Last time you chose {{last_stone}} — would you like it again, or explore something else?",
      it: "Bentornato! L'ultima volta hai scelto {{last_stone}} — lo desideri di nuovo o preferisci esplorare altro?",
    },
    options: [
      { id: "wb_yes", label: { en: "Yes", it: "Sì" }, next: "showroom" },
      { id: "wb_explore", label: { en: "Explore", it: "Esplora" }, next: "main_menu" },
    ],
  },

  main_menu: {
    type: "list",
    header: { en: "Main menu", it: "Menu principale" },
    text: { en: "How can we help you today?", it: "Come possiamo aiutarti oggi?" },
    listButton: { en: "Open menu", it: "Apri menu" },
    options: [
      { id: "m_collections", label: { en: "Collections", it: "Collezioni" }, next: "collections" },
      { id: "m_custom", label: { en: "Custom order", it: "Ordine su misura" }, next: "showroom" },
      { id: "m_visit", label: { en: "Book a visit", it: "Prenota una visita" }, next: "showroom" },
      { id: "m_team", label: { en: "Talk to team", it: "Parla con il team" }, next: "handoff" },
    ],
  },

  collections: {
    type: "list",
    header: { en: "Collections", it: "Collezioni" },
    text: { en: "Choose a category:", it: "Scegli una categoria:" },
    listButton: { en: "Categories", it: "Categorie" },
    options: [
      { id: "c_precious", label: { en: "Precious stones", it: "Pietre preziose" }, next: "precious" },
      { id: "c_diamond", label: { en: "Diamond", it: "Diamante" }, next: "diamond" },
      { id: "c_semi", label: { en: "Semi-precious stones", it: "Pietre semipreziose" }, next: "semi" },
      { id: "c_others", label: { en: "Others", it: "Altro" }, set: { last_stone: "Others" }, next: "showroom" },
    ],
  },

  precious: {
    type: "list",
    header: { en: "Precious stones", it: "Pietre preziose" },
    text: { en: "Select a stone:", it: "Seleziona una pietra:" },
    listButton: { en: "Stones", it: "Pietre" },
    options: [
      { id: "p_emerald", label: { en: "Emerald", it: "Smeraldo" }, set: { last_stone: "Emerald" }, next: "showroom" },
      { id: "p_ruby", label: { en: "Ruby", it: "Rubino" }, set: { last_stone: "Ruby" }, next: "showroom" },
      { id: "p_sapphire", label: { en: "Sapphire", it: "Zaffiro" }, set: { last_stone: "Sapphire" }, next: "showroom" },
      { id: "p_others", label: { en: "Others", it: "Altro" }, set: { last_stone: "Other precious stones" }, next: "showroom" },
    ],
  },

  diamond: {
    type: "list",
    header: { en: "Diamond", it: "Diamante" },
    text: { en: "Select a type:", it: "Seleziona un tipo:" },
    listButton: { en: "Types", it: "Tipi" },
    options: [
      { id: "d_white", label: { en: "White", it: "Bianco" }, set: { last_stone: "White Diamond" }, next: "showroom" },
      { id: "d_black", label: { en: "Black", it: "Nero" }, set: { last_stone: "Black Diamond" }, next: "showroom" },
      { id: "d_brown", label: { en: "Brown", it: "Marrone" }, set: { last_stone: "Brown Diamond" }, next: "showroom" },
      { id: "d_rose", label: { en: "Rose cut", it: "Taglio rosa" }, set: { last_stone: "Rose cut Diamond" }, next: "showroom" },
      { id: "d_drops", label: { en: "Drops & Briolette", it: "Gocce e Briolette" }, set: { last_stone: "Drops & Briolette Diamond" }, next: "showroom" },
      { id: "d_fancy", label: { en: "Fancy color", it: "Colore fantasia" }, set: { last_stone: "Fancy color Diamond" }, next: "showroom" },
      { id: "d_flat", label: { en: "Flat", it: "Piatto" }, set: { last_stone: "Flat Diamond" }, next: "showroom" },
      { id: "d_others", label: { en: "Others", it: "Altro" }, set: { last_stone: "Other diamonds" }, next: "showroom" },
    ],
  },

  semi: {
    type: "list",
    header: { en: "Semi-precious stones", it: "Pietre semipreziose" },
    text: { en: "Select a stone:", it: "Seleziona una pietra:" },
    listButton: { en: "Stones", it: "Pietre" },
    options: [
      { id: "s_tanzanite", label: { en: "Tanzanite", it: "Tanzanite" }, set: { last_stone: "Tanzanite" }, next: "showroom" },
      { id: "s_aquamarine", label: { en: "Aquamarine", it: "Acquamarina" }, set: { last_stone: "Aquamarine" }, next: "showroom" },
      { id: "s_others", label: { en: "Others", it: "Altro" }, set: { last_stone: "Other semi-precious stones" }, next: "showroom" },
    ],
  },

  showroom: {
    type: "buttons",
    text: {
      en: "Beautiful choice! Which showroom would you prefer?",
      it: "Ottima scelta! Quale showroom preferisci?",
    },
    options: [
      { id: "sh_milan", label: { en: "Milan", it: "Milano" }, set: { showroom: "Milan" }, next: "handoff" },
      { id: "sh_valenza", label: { en: "Valenza", it: "Valenza" }, set: { showroom: "Valenza" }, next: "handoff" },
    ],
  },

  handoff: {
    type: "handoff",
    text: {
      en: "Thank you! Our agent will connect with you shortly.",
      it: "Grazie! Un nostro agente ti contatterà a breve.",
    },
  },
};

export const ENTRY_NODE = "language";
