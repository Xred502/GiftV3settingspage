const editorRoot = document.getElementById("giftcard-editor-root") || document.body;
const giftcard = document.getElementById("giftcard");
const bgInput = document.getElementById("bgImageInput");
const bgColorInput = document.getElementById("bgColorInput");
const textColorInput = document.getElementById("textColorInput");
const bottomGroupTextColorInput = document.getElementById("bottomGroupTextColorInput");
const bottomGroupBackdropColorInput = document.getElementById("bottomGroupBackdropColorInput");
const bottomGroupBackdropOpacityInput = document.getElementById("bottomGroupBackdropOpacityInput");
const bottomGroupBackdropShadowColorInput = document.getElementById("bottomGroupBackdropShadowColorInput");
const bottomGroupBackdropShadowXInput = document.getElementById("bottomGroupBackdropShadowXInput");
const bottomGroupBackdropShadowYInput = document.getElementById("bottomGroupBackdropShadowYInput");
const bottomGroupBackdropShadowBlurInput = document.getElementById("bottomGroupBackdropShadowBlurInput");
const bottomGroupBackdropShadowOpacityInput = document.getElementById("bottomGroupBackdropShadowOpacityInput");
const saveLayoutBtn = document.getElementById("saveLayoutBtn");
const loadLayoutInput = document.getElementById("loadLayoutInput");
const newGiftcardBtn = document.getElementById("newGiftcardBtn");
const getTemplateBtn = document.getElementById("getTemplateBtn");
const templateControls = document.getElementById("templateControls");
const operatorSelect = document.getElementById("operatorSelect");
const premadeTemplatesBtn = document.getElementById("premadeTemplatesBtn");
const premadeTemplateControls = document.getElementById("premadeTemplateControls");
const premadeTemplateSelect = document.getElementById("premadeTemplateSelect");
const templateStatus = document.getElementById("templateStatus");
const languageToggleBtn = document.getElementById("languageToggleBtn");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const logoutBtn = document.getElementById("logoutBtn");
const textVisibilityCheckboxes = Array.from(editorRoot.querySelectorAll("[data-text-visibility-target]"));
const textVisibilityState = new Map();
const isThumbnailMode = editorRoot.classList.contains("thumbnail-mode");
const themeStorageKey = "previewEditorTheme";
const languageStorageKey = "previewEditorLanguage";
const groupedPreviewIds = new Set(["identifierPreview", "shortpassPreview", "validtoPreview"]);
const bottomMovableGroupId = "bottomMovableGroup";
const bottomBackdropPreviewId = "bottomBackdropPreview";
const scriptSource = typeof document.currentScript?.src === "string" ? document.currentScript.src : "";
const appRoot = scriptSource
  ? new URL(".", scriptSource).toString().replace(/\/$/, "")
  : "/giftcard-maker-assets";
const backendOrigin = window.location.port === "8080"
  ? `${window.location.protocol}//${window.location.hostname}:3001`
  : window.location.origin;
const giftcardMakerApiRoot = new URL("/api/giftcard-maker/", backendOrigin).toString();
const giftcardMakerAuthStatusUrl = new URL("auth/status", giftcardMakerApiRoot).toString();
const giftcardMakerLogoutUrl = new URL("/api/auth/logout", backendOrigin).toString();
const giftcardDataApiUrl = new URL("giftcard/data", giftcardMakerApiRoot).toString();
const defaultGiftcardLayoutUrl = new URL(`${appRoot}/premade-templates/giftcard-layout-default.json`, window.location.origin).toString();
const bottomGroupValueMap = {
  amountPreview: "groupAmountPreview",
  identifierPreview: "identifierPreview",
  shortpassPreview: "shortpassPreview",
  validtoPreview: "validtoPreview"
};
const apiBoundFieldConfig = {
  amountPreview: {
    inputId: "amountInput",
    token: "#AMOUNT#",
    apiKeys: ["amount", "value", "Amount", "Value"]
  },
  identifierPreview: {
    inputId: "identifierInput",
    token: "#IDENTIFIER#",
    apiKeys: ["identifier", "cardNumber", "Identifier", "CardNumber"]
  },
  shortpassPreview: {
    inputId: "shortpassInput",
    token: "#SHORTPASS#",
    apiKeys: ["shortpass", "shortPass", "Shortpass", "ShortPass"]
  },
  validtoPreview: {
    inputId: "validToInput",
    token: "#VALIDTO#",
    apiKeys: ["validTo", "valid_to", "expiresAt", "ValidTo", "ExpiryDate"]
  }
};
const bottomReferenceLayout = {
  group: { left: 6.8, top: 76.0, width: 85.4, height: 10.6 },
  qr: { left: 2.2, top: 0, width: 16.9, height: 100 },
  details: { left: 22.8, top: 0, width: 77.2, height: 100 }
};
let currentBackgroundImageDataUrl = null;
let templatesById = new Map();
let premadeLayoutsById = new Map();
let defaultLayoutState = null;
let currentLanguage = "en";

function emitEditorStateChange() {
  window.dispatchEvent(new CustomEvent("giftcard-editor-state-change"));
}

const translations = {
  en: {
    modeGiftcard: "Giftcard mode",
    modeThumbnail: "Thumbnail mode",
    modeWebEditor: "Web Editor",
    logout: "Logout",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    newGiftcard: "New giftcard",
    newThumbnail: "New thumbnail",
    premadeTemplates: "Premade templates",
    selectPremadeTemplate: "Select premade template",
    selectOperatorTemplate: "Select operatorId and template",
    getTemplate: "Get template",
    noTemplatesLoaded: "No templates loaded",
    backgroundImage: "Background image",
    backgroundColor: "Background color",
    textColor: "Text color",
    bottomGroupTextColor: "Card info text color",
    bottomGroupBoxColor: "Card info box color",
    bottomGroupBoxOpacity: "Card info box opacity",
    bottomGroupBoxShadowColor: "Card info box shadow color",
    bottomGroupBoxShadowX: "Card info box shadow X (px)",
    bottomGroupBoxShadowY: "Card info box shadow Y (px)",
    bottomGroupBoxShadowBlur: "Card info box shadow blur (px)",
    bottomGroupBoxShadowOpacity: "Card info box shadow opacity",
    cardInfo: "Card info",
    cardInfoDescription: "Card info box color, opacity and shadow.",
    menuBackground: "Background",
    menuBackgroundDescription: "Background image and base card colors.",
    menuContent: "Content",
    menuContentDescription: "Text content and visibility per field.",
    menuTypography: "Typography",
    menuTypographyDescription: "Fonts, size, weight and text shadow.",
    menuSaveLoad: "Save / Load",
    menuSaveLoadDescription: "Export and import editor JSON layouts.",
    menuMain: "Main menu",
    menuProperties: "Properties",
    menuElement: "Element",
    title: "Title",
    message: "Message",
    info: "Info",
    visibleTextFields: "Visible text fields",
    amount: "Amount",
    sender: "Sender",
    identifier: "Identifier",
    shortpass: "Shortpass",
    validTo: "Valid to",
    bottomGroupBox: "Card info box",
    textField: "Text field",
    bottomGroup: "Card info",
    fontFamily: "Font family",
    default: "Default",
    fontSizePx: "Font size (px)",
    fontWeight: "Font weight",
    textShadowColor: "Text shadow color",
    textShadowOffsetX: "Text shadow X (px)",
    textShadowOffsetY: "Text shadow Y (px)",
    textShadowBlur: "Text shadow blur (px)",
    saveJson: "Save JSON",
    loadJson: "Load JSON",
    preset1: "Preset 1",
    preset2: "Preset 2",
    preset3: "Preset 3",
    preset4: "Preset 4",
    thumbnailPreset1: "Thumbnail preset",
    thumbnailPreset2: "Thumbnail preset 2",
    defaultGiftcardLoaded: "Loaded default giftcard layout.",
    bottomRowAmount: "VALUE:",
    bottomRowIdentifier: "CARD NUMBER:",
    bottomRowShortpass: "SHORTPASS:",
    bottomRowValidTo: "VALID TO:"
  },
  sv: {
    modeGiftcard: "Presentkortsläge",
    modeThumbnail: "Miniatyrläge",
    modeWebEditor: "Webbredigerare",
    logout: "Logga ut",
    lightMode: "Ljust läge",
    darkMode: "Mörkt läge",
    newGiftcard: "Nytt presentkort",
    newThumbnail: "Ny miniatyr",
    premadeTemplates: "Färdiga mallar",
    selectPremadeTemplate: "Välj färdig mall",
    selectOperatorTemplate: "Välj operatorId och mall",
    getTemplate: "Hämta mall",
    noTemplatesLoaded: "Inga mallar laddade",
    backgroundImage: "Bakgrundsbild",
    backgroundColor: "Bakgrundsfärg",
    textColor: "Textfärg",
    bottomGroupTextColor: "Textfärg för kortinfo",
    bottomGroupBoxColor: "Färg för kortinfo-rutan",
    bottomGroupBoxOpacity: "Opacitet för kortinfo-rutan",
    bottomGroupBoxShadowColor: "Skuggfärg för kortinfo-rutan",
    bottomGroupBoxShadowX: "Skugga X för kortinfo (px)",
    bottomGroupBoxShadowY: "Skugga Y för kortinfo (px)",
    bottomGroupBoxShadowBlur: "Skugga oskärpa för kortinfo (px)",
    bottomGroupBoxShadowOpacity: "Skugga opacitet för kortinfo",
    cardInfo: "Kort info",
    cardInfoDescription: "Färg, opacitet och skugga för kortinfo-rutan.",
    menuBackground: "Bakgrund",
    menuBackgroundDescription: "Bakgrundsbild och grundfärger för kortet.",
    menuContent: "Innehåll",
    menuContentDescription: "Textinnehåll och synlighet per fält.",
    menuTypography: "Typografi",
    menuTypographyDescription: "Typsnitt, storlek, vikt och textskugga.",
    menuSaveLoad: "Spara / Ladda",
    menuSaveLoadDescription: "Exportera och importera JSON-layouter.",
    menuMain: "Huvudmeny",
    menuProperties: "Egenskaper",
    menuElement: "Element",
    title: "Titel",
    message: "Meddelande",
    info: "Info",
    visibleTextFields: "Synliga textfält",
    amount: "Belopp",
    sender: "Avsändare",
    identifier: "Kortnummer",
    shortpass: "Shortpass",
    validTo: "Giltig till",
    bottomGroupBox: "Kortinfo-ruta",
    textField: "Textfält",
    bottomGroup: "Kort info",
    fontFamily: "Typsnitt",
    default: "Standard",
    fontSizePx: "Textstorlek (px)",
    fontWeight: "Texttjocklek",
    textShadowColor: "Textskugga farg",
    textShadowOffsetX: "Textskugga X (px)",
    textShadowOffsetY: "Textskugga Y (px)",
    textShadowBlur: "Textskugga oskarpa (px)",
    saveJson: "Spara JSON",
    loadJson: "Ladda JSON",
    preset1: "Mall 1",
    preset2: "Mall 2",
    preset3: "Mall 3",
    preset4: "Mall 4",
    thumbnailPreset1: "Miniatyrmall",
    thumbnailPreset2: "Miniatyrmall 2",
    defaultGiftcardLoaded: "Standardlayout för presentkort laddad.",
    bottomRowAmount: "VÄRDE:",
    bottomRowIdentifier: "KORTNUMMER:",
    bottomRowShortpass: "SHORTPASS:",
    bottomRowValidTo: "GILTIGHETSDATUM:"
  }
};

function t(key) {
  const languageTable = translations[currentLanguage] || translations.en;
  return languageTable[key] || translations.en[key] || key;
}

function getPreferredLanguage() {
  try {
    const saved = localStorage.getItem(languageStorageKey);
    if (saved === "en" || saved === "sv") {
      return saved;
    }
  } catch {
    // Ignore storage failures and fall back to browser/default.
  }

  return navigator.language && navigator.language.toLowerCase().startsWith("sv") ? "sv" : "en";
}

function getThemeToggleLabel(theme) {
  return theme === "light" ? t("darkMode") : t("lightMode");
}

function applyLanguage(language) {
  currentLanguage = language === "sv" ? "sv" : "en";
  document.documentElement.lang = currentLanguage;

  editorRoot.querySelectorAll("[data-i18n]").forEach(element => {
    const key = element.getAttribute("data-i18n");
    if (!key) return;
    element.innerText = t(key);
  });

  if (languageToggleBtn) {
    updateLanguageToggleLabel();
  }

  const activeTheme = editorRoot.classList.contains("light-mode") ? "light" : "dark";
  if (themeToggleBtn) {
    themeToggleBtn.innerText = getThemeToggleLabel(activeTheme);
  }

  updateSelectPlaceholders();
  ensureGroupedDetailsPreview();
  updateMainMenuInspectorLabels();
}

function updateSelectPlaceholders() {
  if (premadeTemplateSelect) {
    const firstOption = premadeTemplateSelect.options[0];
    if (firstOption && firstOption.value === "") {
      firstOption.innerText = t("selectPremadeTemplate");
    }
    Array.from(premadeTemplateSelect.options).forEach(option => {
      const nameKey = option.dataset ? option.dataset.nameKey : "";
      if (nameKey) {
        option.innerText = t(nameKey);
      }
    });
  }

  if (operatorSelect) {
    const firstOption = operatorSelect.options[0];
    if (firstOption && firstOption.value === "") {
      firstOption.innerText = operatorSelect.disabled ? t("noTemplatesLoaded") : t("selectOperatorTemplate");
    }
  }
}

function setupLanguageToggle() {
  const initialLanguage = getPreferredLanguage();
  applyLanguage(initialLanguage);

  if (!languageToggleBtn) return;

  languageToggleBtn.addEventListener("click", () => {
    const nextLanguage = currentLanguage === "sv" ? "en" : "sv";
    applyLanguage(nextLanguage);
    try {
      localStorage.setItem(languageStorageKey, nextLanguage);
    } catch {
      // Ignore storage failures; language still applies for the session.
    }
  });
}

function getPreferredTheme() {
  try {
    const saved = localStorage.getItem(themeStorageKey);
    if (saved === "light" || saved === "dark") {
      return saved;
    }
  } catch {
    // Ignore storage failures and fall back to system/default.
  }

  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }

  return "dark";
}

function applyTheme(theme) {
  const resolvedTheme = theme === "light" ? "light" : "dark";
  editorRoot.classList.toggle("light-mode", resolvedTheme === "light");

  if (themeToggleBtn) {
    themeToggleBtn.innerText = getThemeToggleLabel(resolvedTheme);
    themeToggleBtn.setAttribute("aria-pressed", String(resolvedTheme === "light"));
  }
}

function setupThemeToggle() {
  const initialTheme = getPreferredTheme();
  applyTheme(initialTheme);

  if (!themeToggleBtn) return;

  themeToggleBtn.addEventListener("click", () => {
    const nextTheme = editorRoot.classList.contains("light-mode") ? "dark" : "light";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(themeStorageKey, nextTheme);
    } catch {
      // Ignore storage failures; theme still applies for the session.
    }
  });
}

function updateLanguageToggleLabel() {
  if (!languageToggleBtn) return;

  const isSwedishActive = currentLanguage === "sv";
  const label = isSwedishActive ? "English" : "Svenska";
  const flagSrc = isSwedishActive ? `${appRoot}/images/flag-en.svg` : `${appRoot}/images/flag-sv.svg`;
  const flagAlt = isSwedishActive ? "English flag" : "Swedish flag";

  let flagImg = languageToggleBtn.querySelector("img.language-flag");
  let labelSpan = languageToggleBtn.querySelector("span");

  if (!flagImg || !labelSpan) {
    languageToggleBtn.innerHTML = "";
    flagImg = document.createElement("img");
    flagImg.className = "language-flag";
    labelSpan = document.createElement("span");
    languageToggleBtn.appendChild(flagImg);
    languageToggleBtn.appendChild(labelSpan);
  }

  flagImg.src = flagSrc;
  flagImg.alt = flagAlt;
  labelSpan.textContent = label;
}

function setupLogoutButton() {
  if (!logoutBtn) return;

  logoutBtn.addEventListener("click", async () => {
    logoutBtn.disabled = true;

    try {
      await fetch(giftcardMakerLogoutUrl, {
        method: "POST",
        headers: {
          accept: "application/json"
        },
        credentials: "include"
      });
    } catch {
      // Redirect regardless to avoid trapping the user in a stale session.
    } finally {
      window.location.href = "/login";
    }
  });
}

async function ensureAuthenticated() {
  try {
    const response = await fetch(giftcardMakerAuthStatusUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json"
      }
    });

    if (!response.ok) {
      window.location.href = "/login";
      return false;
    }

    const payload = await response.json();
    if (!payload || payload.authenticated !== true) {
      window.location.href = "/login";
      return false;
    }

    return true;
  } catch {
    window.location.href = "/login";
    return false;
  }
}

function updateMainMenuInspectorLabels() {
  const mainMenuPanel = document.getElementById("mainMenuPanel");
  const detailPanel = document.getElementById("detailPanel");
  const detailTitle = document.getElementById("detailPanelTitle");
  const detailDescription = document.getElementById("detailPanelDescription");
  if (!mainMenuPanel || !detailPanel || !detailTitle || !detailDescription) return;

  const activeButton = mainMenuPanel.querySelector(".menu-panel-btn.active")
    || mainMenuPanel.querySelector(".menu-panel-btn[data-menu-target]");
  if (!activeButton) return;

  const titleKey = activeButton.dataset.menuTitleKey;
  const descriptionKey = activeButton.dataset.menuDescriptionKey;
  const fallbackTitle = activeButton.dataset.menuTitle || activeButton.innerText;
  const fallbackDescription = activeButton.dataset.menuDescription || "";

  detailTitle.innerText = titleKey ? t(titleKey) : fallbackTitle;
  detailDescription.innerText = descriptionKey ? t(descriptionKey) : fallbackDescription;
}

function setupMainMenuInspector() {
  if (editorRoot?.dataset?.reactManagedInspector === "true") return;

  const mainMenuPanel = document.getElementById("mainMenuPanel");
  const detailPanel = document.getElementById("detailPanel");
  const detailTitle = document.getElementById("detailPanelTitle");
  const detailDescription = document.getElementById("detailPanelDescription");
  if (!mainMenuPanel || !detailPanel || !detailTitle || !detailDescription) return;

  const menuButtons = Array.from(mainMenuPanel.querySelectorAll(".menu-panel-btn[data-menu-target]"));
  const detailSections = Array.from(detailPanel.querySelectorAll(".menu-detail-section"));
  if (!menuButtons.length || !detailSections.length) return;

  const activateSection = button => {
    if (!button) return;
    const targetId = button.dataset.menuTarget;
    if (!targetId) return;

    menuButtons.forEach(item => {
      item.classList.toggle("active", item === button);
    });

    detailSections.forEach(section => {
      section.classList.toggle("active", section.id === targetId);
    });

    updateMainMenuInspectorLabels();
  };

  menuButtons.forEach(button => {
    button.addEventListener("click", () => activateSection(button));
  });

  const defaultButton = menuButtons.find(button => button.classList.contains("active")) || menuButtons[0];
  activateSection(defaultButton);
}

setupThemeToggle();
setupLanguageToggle();
setupLogoutButton();
setupMainMenuInspector();
void ensureAuthenticated();

// -------------------------------
// Background image upload
// -------------------------------
bgInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    currentBackgroundImageDataUrl = evt.target.result;
    giftcard.style.backgroundImage = `url(${currentBackgroundImageDataUrl})`;
    giftcard.style.backgroundSize = "100% 100%";
    giftcard.style.backgroundPosition = "center";
    giftcard.style.backgroundRepeat = "no-repeat";
    emitEditorStateChange();
  };
  reader.readAsDataURL(file);
});

// -------------------------------
// Scale factor for preview
// -------------------------------
function getScaleFactor() {
  return giftcard.offsetWidth / 2480; // scale based on displayed width
}

// -------------------------------
// Draggable content inside giftcard (scaled correctly)
// -------------------------------
function isTextDraggableElement(el) {
  return el instanceof HTMLElement && el.matches("p.draggable");
}

function applyTextDragWrapWidth(el, cardRect, leftPx) {
  if (!isTextDraggableElement(el) || !cardRect.width) return;
  const normalizedLeft = Number.isFinite(leftPx) ? leftPx : 0;
  const safeLeft = Math.max(0, Math.min(normalizedLeft, cardRect.width));
  const availableWidthPx = Math.max(32, cardRect.width - safeLeft);
  el.style.maxWidth = `${(availableWidthPx / cardRect.width) * 100}%`;
}

function clampDraggableToCard(el) {
  const cardRect = giftcard.getBoundingClientRect();

  const leftValue = el.style.left || "0px";
  const topValue = el.style.top || "0px";

  const currentLeft = leftValue.endsWith("%")
    ? (parseFloat(leftValue) / 100) * cardRect.width
    : parseFloat(leftValue);
  const currentTop = topValue.endsWith("%")
    ? (parseFloat(topValue) / 100) * cardRect.height
    : parseFloat(topValue);
  applyTextDragWrapWidth(el, cardRect, currentLeft);

  const elRect = el.getBoundingClientRect();

  const clampAxis = (positionPx, containerSize, elementSize) => {
    const normalizedPosition = Number.isNaN(positionPx) ? 0 : positionPx;
    const overflow = containerSize - elementSize;
    if (overflow >= 0) {
      return Math.max(0, Math.min(normalizedPosition, overflow));
    }
    return Math.min(0, Math.max(normalizedPosition, overflow));
  };

  const clampedLeft = clampAxis(currentLeft, cardRect.width, elRect.width);
  applyTextDragWrapWidth(el, cardRect, clampedLeft);
  const resizedRect = el.getBoundingClientRect();
  const clampedTop = clampAxis(currentTop, cardRect.height, resizedRect.height);

  el.style.left = `${(clampedLeft / cardRect.width) * 100}%`;
  el.style.top = `${(clampedTop / cardRect.height) * 100}%`;
}

function ensureGroupedDetailsPreview() {
  if (isThumbnailMode || !giftcard) return null;

  let group = document.getElementById("detailsPreviewGroup");
  if (!group) {
    group = document.createElement("div");
    group.id = "detailsPreviewGroup";
    group.className = "details-preview-group";
    giftcard.appendChild(group);
  }

  const rows = [
    { label: t("bottomRowAmount"), valueId: "groupAmountPreview", inputId: "amountInput", fallback: "#AMOUNT#" },
    { label: t("bottomRowIdentifier"), valueId: "identifierPreview", inputId: "identifierInput", fallback: "#IDENTIFIER#" },
    { label: t("bottomRowShortpass"), valueId: "shortpassPreview", inputId: "shortpassInput", fallback: "#SHORTPASS#" },
    { label: t("bottomRowValidTo"), valueId: "validtoPreview", inputId: "validToInput", fallback: "#VALIDTO#" }
  ];

  if (!group.dataset.initialized) {
    group.innerHTML = "";
    rows.forEach(({ label, valueId }) => {
      const line = document.createElement("div");
      line.className = "details-preview-line";

      const labelSpan = document.createElement("span");
      labelSpan.className = "details-label";
      labelSpan.innerText = label;

      const valueSpan = document.createElement("span");
      valueSpan.className = "details-value";
      valueSpan.id = valueId;

      line.appendChild(labelSpan);
      line.appendChild(valueSpan);
      group.appendChild(line);
    });
    group.dataset.initialized = "true";
  }

  rows.forEach(({ valueId, inputId, fallback }) => {
    const valueElement = document.getElementById(valueId);
    const input = document.getElementById(inputId);
    if (!valueElement) return;
    valueElement.innerText = input ? input.value : fallback;
  });

  const labels = group.querySelectorAll(".details-label");
  rows.forEach((row, index) => {
    if (!labels[index]) return;
    labels[index].innerText = row.label;
  });

  applyBottomGroupTextStyles();

  return group;
}

function resolveGiftcardDataUrl(url) {
  const value = typeof url === "string" ? url.trim() : "";
  if (!value) {
    return giftcardDataApiUrl;
  }
  if (
    value.includes("localhost:1025/api/giftcard/data")
    || /\/api\/giftcard\/data$/i.test(value)
    || /\/api\/giftcard-maker\/giftcard\/data$/i.test(value)
  ) {
    return giftcardDataApiUrl;
  }
  return value;
}

function applyBottomGroupTextStyles() {
  const group = document.getElementById("detailsPreviewGroup");
  if (!group) return;

  if (bottomGroupTextColorInput && typeof bottomGroupTextColorInput.value === "string") {
    group.style.color = bottomGroupTextColorInput.value;
  }
}

function applyBottomBackdropStyles() {
  const group = document.getElementById(bottomMovableGroupId);
  if (!group) return;

  const backdrop = ensureBottomBackdropElement(group);
  if (!backdrop) return;

  if (bottomGroupBackdropColorInput && typeof bottomGroupBackdropColorInput.value === "string") {
    backdrop.style.backgroundColor = bottomGroupBackdropColorInput.value;
  }
  if (bottomGroupBackdropOpacityInput) {
    const opacity = Math.max(0, Math.min(100, parseInt(bottomGroupBackdropOpacityInput.value, 10)));
    const normalizedOpacity = (Number.isNaN(opacity) ? 100 : opacity) / 100;
    backdrop.style.opacity = String(normalizedOpacity);
  }
  backdrop.style.boxShadow = buildBottomBackdropShadowValue();

  syncBottomBackdropCoverage();
}

function hexColorToRgb(colorValue) {
  if (typeof colorValue !== "string") return null;
  const hex = colorValue.trim();
  const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(hex);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("").map(ch => parseInt(`${ch}${ch}`, 16));
    return { r, g, b };
  }

  const fullHexMatch = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!fullHexMatch) return null;
  const value = fullHexMatch[1];
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16)
  };
}

function buildBottomBackdropShadowValue() {
  if (!bottomGroupBackdropShadowColorInput
    || !bottomGroupBackdropShadowXInput
    || !bottomGroupBackdropShadowYInput
    || !bottomGroupBackdropShadowBlurInput
    || !bottomGroupBackdropShadowOpacityInput) {
    return "";
  }

  const shadowX = parseInt(bottomGroupBackdropShadowXInput.value, 10) || 0;
  const shadowY = parseInt(bottomGroupBackdropShadowYInput.value, 10) || 0;
  const shadowBlur = Math.max(0, parseInt(bottomGroupBackdropShadowBlurInput.value, 10) || 0);
  const shadowOpacityRaw = Math.max(0, Math.min(100, parseInt(bottomGroupBackdropShadowOpacityInput.value, 10)));
  const shadowOpacity = (Number.isNaN(shadowOpacityRaw) ? 0 : shadowOpacityRaw) / 100;
  if (shadowOpacity <= 0) {
    return "none";
  }

  const rgb = hexColorToRgb(bottomGroupBackdropShadowColorInput.value || "#000000");
  const r = rgb ? rgb.r : 0;
  const g = rgb ? rgb.g : 0;
  const b = rgb ? rgb.b : 0;

  return `${shadowX}px ${shadowY}px ${shadowBlur}px rgba(${r}, ${g}, ${b}, ${shadowOpacity})`;
}

function parseBottomBackdropShadowValue(shadowValue) {
  if (typeof shadowValue !== "string" || shadowValue.trim() === "" || shadowValue.trim() === "none") {
    return null;
  }

  const value = shadowValue.trim();
  const rgbaMatch = value.match(
    /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px\s+rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i
  );
  if (!rgbaMatch) return null;

  const toHex = number => Math.max(0, Math.min(255, parseInt(number, 10) || 0)).toString(16).padStart(2, "0");
  const color = `#${toHex(rgbaMatch[4])}${toHex(rgbaMatch[5])}${toHex(rgbaMatch[6])}`;
  const alphaRaw = rgbaMatch[7] === undefined ? 1 : parseFloat(rgbaMatch[7]);
  const alpha = Number.isNaN(alphaRaw) ? 1 : Math.max(0, Math.min(1, alphaRaw));

  return {
    x: parseInt(rgbaMatch[1], 10) || 0,
    y: parseInt(rgbaMatch[2], 10) || 0,
    blur: Math.max(0, parseInt(rgbaMatch[3], 10) || 0),
    color,
    opacity: Math.round(alpha * 100)
  };
}

function getBottomBackdropRectState() {
  const group = document.getElementById(bottomMovableGroupId);
  const backdrop = group ? group.querySelector(`#${bottomBackdropPreviewId}`) : null;
  if (!backdrop) return null;

  return {
    left: backdrop.style.left || "0%",
    top: backdrop.style.top || "0%",
    width: backdrop.style.width || "100%",
    height: backdrop.style.height || "100%"
  };
}

function applyBottomBackdropRectState(rect) {
  if (!rect || typeof rect !== "object") return;
  const group = document.getElementById(bottomMovableGroupId);
  if (!group) return;
  const backdrop = ensureBottomBackdropElement(group);
  if (!backdrop) return;

  if (typeof rect.left === "string" && rect.left) backdrop.style.left = rect.left;
  if (typeof rect.top === "string" && rect.top) backdrop.style.top = rect.top;
  if (typeof rect.width === "string" && rect.width) backdrop.style.width = rect.width;
  if (typeof rect.height === "string" && rect.height) backdrop.style.height = rect.height;

  syncBottomResizeHandlePosition();
}

function syncBottomBackdropCoverage() {
  const group = document.getElementById(bottomMovableGroupId);
  if (!group) return;

  const backdrop = group.querySelector(`#${bottomBackdropPreviewId}`);
  const detailsGroup = group.querySelector("#detailsPreviewGroup");
  if (!backdrop || !detailsGroup) return;

  const groupRect = group.getBoundingClientRect();
  if (!groupRect.width || !groupRect.height) return;

  const qrElement = group.querySelector("#qrWrapper, #qrPreview, .qr-placeholder");
  const detailsTextElements = Array.from(
    detailsGroup.querySelectorAll(".details-preview-line, .details-label, .details-value")
  );
  const contentElements = detailsTextElements.length ? detailsTextElements : [detailsGroup];
  if (qrElement) {
    contentElements.push(qrElement);
  }

  let minLeft = Number.POSITIVE_INFINITY;
  let minTop = Number.POSITIVE_INFINITY;
  let maxRight = Number.NEGATIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  contentElements.forEach(element => {
    const rect = element.getBoundingClientRect();
    minLeft = Math.min(minLeft, rect.left - groupRect.left);
    minTop = Math.min(minTop, rect.top - groupRect.top);
    maxRight = Math.max(maxRight, rect.right - groupRect.left);
    maxBottom = Math.max(maxBottom, rect.bottom - groupRect.top);
  });

  if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
    return;
  }

  const fontSizePx = parseFloat(window.getComputedStyle(detailsGroup).fontSize) || 0;
  const verticalPaddingPx = Math.max(10, Math.round(fontSizePx * 0.38));
  const horizontalPaddingPx = Math.max(8, Math.round(fontSizePx * 0.28));
  const extraHeightPx = 50;
  const extraHeightHalfPx = extraHeightPx / 2;
  const bottomInsetPx = 14;

  const desiredLeftPx = minLeft - horizontalPaddingPx;
  const desiredRightPx = maxRight + horizontalPaddingPx;
  const desiredTopPx = minTop - verticalPaddingPx - extraHeightHalfPx;
  const desiredBottomPx = maxBottom + verticalPaddingPx + extraHeightHalfPx - bottomInsetPx;
  const desiredWidthPx = desiredRightPx - desiredLeftPx;
  const desiredHeightPx = desiredBottomPx - desiredTopPx;

  backdrop.style.left = `${(desiredLeftPx / groupRect.width) * 100}%`;
  backdrop.style.width = `${(desiredWidthPx / groupRect.width) * 100}%`;
  backdrop.style.top = `${(desiredTopPx / groupRect.height) * 100}%`;
  backdrop.style.height = `${(desiredHeightPx / groupRect.height) * 100}%`;
  syncBottomResizeHandlePosition();
}

function syncBottomResizeHandlePosition() {
  const group = document.getElementById(bottomMovableGroupId);
  if (!group) return;

  const handle = group.querySelector(".resize-handle");
  if (!handle) return;

  const backdrop = group.querySelector(`#${bottomBackdropPreviewId}`);
  if (!backdrop) {
    handle.style.removeProperty("left");
    handle.style.removeProperty("top");
    handle.style.removeProperty("right");
    handle.style.removeProperty("bottom");
    return;
  }

  const leftPercent = parseFloat(backdrop.style.left || "0");
  const widthPercent = parseFloat(backdrop.style.width || "100");
  const topPercent = parseFloat(backdrop.style.top || "0");
  const heightPercent = parseFloat(backdrop.style.height || "100");
  if ([leftPercent, widthPercent, topPercent, heightPercent].some(Number.isNaN)) return;

  handle.style.right = "auto";
  handle.style.bottom = "auto";
  handle.style.left = `calc(${leftPercent + widthPercent}% - 9px)`;
  handle.style.top = `calc(${topPercent + heightPercent}% - 9px)`;
}

function updateDetailsGroupVisibility() {
  const group = document.getElementById("detailsPreviewGroup");
  if (!group) return;
  const anyVisible = Object.keys(bottomGroupValueMap).some(previewId => textVisibilityState.get(previewId) !== false);
  group.style.display = anyVisible ? "" : "none";
}

function ensureBottomMovableGroup() {
  if (isThumbnailMode || !giftcard) return null;

  let group = document.getElementById(bottomMovableGroupId);
  if (!group) {
    group = document.createElement("div");
    group.id = bottomMovableGroupId;
    group.className = "draggable bottom-movable-group";
    group.style.left = "8%";
    group.style.top = "74%";
    group.style.width = "42%";
    group.style.height = "18%";
    giftcard.appendChild(group);
    bindDraggable(group);
  }
  ensureBottomBackdropElement(group);
  return group;
}

function ensureBottomBackdropElement(group) {
  if (!group) return null;

  let backdrop = group.querySelector(`#${bottomBackdropPreviewId}`);
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = bottomBackdropPreviewId;
    backdrop.className = "bottom-group-backdrop";
    group.prepend(backdrop);
  }

  if (bottomGroupBackdropColorInput && typeof bottomGroupBackdropColorInput.value === "string") {
    backdrop.style.backgroundColor = bottomGroupBackdropColorInput.value;
  }
  if (bottomGroupBackdropOpacityInput) {
    const opacity = Math.max(0, Math.min(100, parseInt(bottomGroupBackdropOpacityInput.value, 10)));
    const normalizedOpacity = (Number.isNaN(opacity) ? 50 : opacity) / 100;
    backdrop.style.opacity = String(normalizedOpacity);
  }
  backdrop.style.boxShadow = buildBottomBackdropShadowValue();

  return backdrop;
}

function ensureQrPlaceholder() {
  let placeholder = document.getElementById("qrPlaceholder");
  if (!placeholder) {
    placeholder = document.createElement("div");
    placeholder.id = "qrPlaceholder";
    placeholder.className = "qr-placeholder";
  }
  return placeholder;
}

function getElementRectInCard(element, cardRect) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left - cardRect.left,
    top: rect.top - cardRect.top,
    width: rect.width,
    height: rect.height,
    right: rect.right - cardRect.left,
    bottom: rect.bottom - cardRect.top
  };
}

function moveElementIntoBottomGroup(element, group, groupBounds, cardRect) {
  const rect = getElementRectInCard(element, cardRect);
  const relativeLeft = rect.left - groupBounds.left;
  const relativeTop = rect.top - groupBounds.top;
  const groupWidth = Math.max(1, groupBounds.width);
  const groupHeight = Math.max(1, groupBounds.height);

  element.classList.remove("draggable");
  delete element.dataset.draggableBound;
  element.style.pointerEvents = "none";
  element.style.position = "absolute";
  element.style.left = `${(relativeLeft / groupWidth) * 100}%`;
  element.style.top = `${(relativeTop / groupHeight) * 100}%`;
  element.style.width = `${(rect.width / groupWidth) * 100}%`;
  element.style.height = `${(rect.height / groupHeight) * 100}%`;

  group.appendChild(element);
}

function groupBottomElementsFromQrLevel() {
  if (isThumbnailMode || !giftcard) return;

  const qrElement = document.getElementById("qrWrapper") || document.getElementById("qrPreview");
  const detailsGroup = ensureGroupedDetailsPreview();
  const group = ensureBottomMovableGroup();
  if (!group || !detailsGroup) return;

  // If template has no detectable QR element, keep group interactive using a visible placeholder.
  if (!qrElement) {
    group.innerHTML = "";
    const placeholder = ensureQrPlaceholder();
    const details = detailsGroup;
    details.classList.remove("draggable");
    delete details.dataset.draggableBound;
    details.style.pointerEvents = "none";
    details.style.position = "absolute";
    group.appendChild(placeholder);
    group.appendChild(details);
    ensureBottomBackdropElement(group);
    applyBottomReferenceProportions();
    syncBottomGroupScale();
    enableBottomGroupResizing(group);
    clampDraggableToCard(group);
    return;
  }

  const cardRect = giftcard.getBoundingClientRect();
  const qrRect = getElementRectInCard(qrElement, cardRect);
  const detailsRect = getElementRectInCard(detailsGroup, cardRect);
  const groupLeft = Math.min(qrRect.left, detailsRect.left);
  const groupTop = Math.min(qrRect.top, detailsRect.top);
  const groupRight = Math.max(qrRect.right, detailsRect.right);
  const groupBottom = Math.max(qrRect.bottom, detailsRect.bottom);

  group.innerHTML = "";
  group.style.left = `${(groupLeft / cardRect.width) * 100}%`;
  group.style.top = `${(groupTop / cardRect.height) * 100}%`;
  group.style.width = `${((groupRight - groupLeft) / cardRect.width) * 100}%`;
  group.style.height = `${((groupBottom - groupTop) / cardRect.height) * 100}%`;

  const groupBounds = {
    left: groupLeft,
    top: groupTop,
    width: groupRight - groupLeft,
    height: groupBottom - groupTop
  };

  moveElementIntoBottomGroup(qrElement, group, groupBounds, cardRect);
  moveElementIntoBottomGroup(detailsGroup, group, groupBounds, cardRect);
  ensureBottomBackdropElement(group);
  hideTemplateBottomAtQrLevel(qrRect.top);
  applyBottomReferenceProportions();
  syncBottomGroupScale();
  enableBottomGroupResizing(group);
  clampDraggableToCard(group);
}

function setElementPercentRect(element, rect) {
  if (!element || !rect) return;
  element.style.position = "absolute";
  element.style.left = `${rect.left}%`;
  element.style.top = `${rect.top}%`;
  element.style.width = `${rect.width}%`;
  element.style.height = `${rect.height}%`;
}

function applyBottomReferenceProportions() {
  const bottomGroup = document.getElementById(bottomMovableGroupId);
  if (!bottomGroup) return;

  const backdrop = bottomGroup.querySelector(`#${bottomBackdropPreviewId}`);
  setElementPercentRect(backdrop, { left: 0, top: 0, width: 100, height: 100 });

  setElementPercentRect(bottomGroup, bottomReferenceLayout.group);

  const qrElement = bottomGroup.querySelector("#qrWrapper, #qrPreview, #qrPlaceholder");
  setElementPercentRect(qrElement, bottomReferenceLayout.qr);
  if (qrElement && qrElement.tagName === "IMG") {
    qrElement.style.objectFit = "contain";
  }

  const detailsGroup = bottomGroup.querySelector("#detailsPreviewGroup");
  setElementPercentRect(detailsGroup, bottomReferenceLayout.details);
  syncBottomBackdropCoverage();
}

function hideTemplateBottomAtQrLevel(qrTopPx) {
  const templateRoot = document.getElementById("templateRoot");
  if (!templateRoot || !Number.isFinite(qrTopPx)) return;

  const cardRect = giftcard.getBoundingClientRect();
  const candidates = templateRoot.querySelectorAll("p, div, span, a, img");
  candidates.forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    if (node.id === "templateRoot") return;
    if (node.closest(`#${bottomMovableGroupId}`)) return;
    if (node.classList.contains("qr-code-image")) return;

    const rect = node.getBoundingClientRect();
    const topInCard = rect.top - cardRect.top;
    if (topInCard >= qrTopPx - 2) {
      node.style.display = "none";
    }
  });
}

function syncBottomGroupScale() {
  const bottomGroup = document.getElementById(bottomMovableGroupId);
  if (!bottomGroup) return;

  const baseWidthPx = (bottomReferenceLayout.group.width / 100) * giftcard.clientWidth;
  const currentWidthPx = bottomGroup.getBoundingClientRect().width;
  const scale = currentWidthPx > 0 && baseWidthPx > 0 ? currentWidthPx / baseWidthPx : 1;
  bottomGroup.style.setProperty("--bottom-scale", `${Math.max(0.55, Math.min(scale, 2.4))}`);
  syncBottomBackdropCoverage();
}

function enableBottomGroupResizing(group) {
  if (!group || isThumbnailMode) return;

  let handle = group.querySelector(".resize-handle");
  if (!handle) {
    handle = document.createElement("div");
    handle.className = "resize-handle";
    handle.title = "Drag to resize";
    group.appendChild(handle);
    syncBottomResizeHandlePosition();
  }

  if (handle.dataset.resizeBound === "true") return;
  handle.dataset.resizeBound = "true";

  let isResizing = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startWidthPx = 0;
  let startHeightPx = 0;
  let startAspect = 1;

  handle.addEventListener("mousedown", e => {
    e.preventDefault();
    e.stopPropagation();

    const groupRect = group.getBoundingClientRect();
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startWidthPx = groupRect.width;
    startHeightPx = groupRect.height;
    startAspect = startWidthPx / Math.max(1, startHeightPx);
    isResizing = true;
  });

  document.addEventListener("mousemove", e => {
    if (!isResizing) return;

    const cardRect = giftcard.getBoundingClientRect();
    const groupRect = group.getBoundingClientRect();
    const groupLeftPx = groupRect.left - cardRect.left;
    const groupTopPx = groupRect.top - cardRect.top;

    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    const delta = Math.max(dx, dy);

    const minWidthPx = 120;
    const minHeightPx = 60;
    const maxWidthPx = Math.max(minWidthPx, cardRect.width - groupLeftPx);
    const maxHeightPx = Math.max(minHeightPx, cardRect.height - groupTopPx);

    let newWidthPx = Math.max(minWidthPx, Math.min(startWidthPx + delta, maxWidthPx));
    let newHeightPx = newWidthPx / Math.max(0.1, startAspect);

    if (newHeightPx > maxHeightPx) {
      newHeightPx = maxHeightPx;
      newWidthPx = newHeightPx * startAspect;
    }
    if (newHeightPx < minHeightPx) {
      newHeightPx = minHeightPx;
      newWidthPx = newHeightPx * startAspect;
    }

    group.style.width = `${(newWidthPx / cardRect.width) * 100}%`;
    group.style.height = `${(newHeightPx / cardRect.height) * 100}%`;
    syncBottomGroupScale();
  });

  document.addEventListener("mouseup", () => {
    if (isResizing) {
      emitEditorStateChange();
    }
    isResizing = false;
  });
}

function bindDraggable(el) {
  if (!el || el.dataset.draggableBound === "true") return;
  el.dataset.draggableBound = "true";
  if (el.tagName === "IMG") {
    el.setAttribute("draggable", "false");
  }
  el.style.pointerEvents = "auto";
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("mousedown", e => {
    if (e.target instanceof Element && e.target.closest(".resize-handle")) return;
    e.stopPropagation(); // prevent other actions
    isDragging = true;

    const rect = el.getBoundingClientRect();
    const cardRect = giftcard.getBoundingClientRect();

    // Save mouse offset inside element
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    el.style.zIndex = 100;
  });

  document.addEventListener("mousemove", e => {
    if (!isDragging) return;

    const cardRect = giftcard.getBoundingClientRect();

    // calculate new position as a percentage of giftcard size
    let leftPx = e.clientX - cardRect.left - offsetX;
    let topPx = e.clientY - cardRect.top - offsetY;
    applyTextDragWrapWidth(el, cardRect, leftPx);
    const elRect = el.getBoundingClientRect();

    // Clamp inside giftcard, while still allowing movement when element is larger than the card.
    const clampAxis = (positionPx, containerSize, elementSize) => {
      const overflow = containerSize - elementSize;
      if (overflow >= 0) {
        return Math.max(0, Math.min(positionPx, overflow));
      }
      return Math.min(0, Math.max(positionPx, overflow));
    };
    leftPx = clampAxis(leftPx, cardRect.width, elRect.width);
    topPx = clampAxis(topPx, cardRect.height, elRect.height);

    // convert to percentages
    const leftPercent = (leftPx / cardRect.width) * 100;
    const topPercent = (topPx / cardRect.height) * 100;

    el.style.left = `${leftPercent}%`;
    el.style.top = `${topPercent}%`;
    clampDraggableToCard(el);
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      emitEditorStateChange();
    }
    isDragging = false;
    el.style.zIndex = "";
  });

  el.addEventListener("dragstart", e => {
    e.preventDefault();
  });

  clampDraggableToCard(el);
}

function setupDraggables() {
  document.querySelectorAll(".draggable").forEach(bindDraggable);
}

ensureGroupedDetailsPreview();
if (!isThumbnailMode) {
  const group = ensureBottomMovableGroup();
  if (group) {
    enableBottomGroupResizing(group);
    syncBottomGroupScale();
  }
  // Keep default (no-template) state on the same movable/resizable bottom group.
  groupBottomElementsFromQrLevel();
}
setupDraggables();

// -------------------------------
// Text inputs → preview bindings
// -------------------------------
const bindings = [
  ["titleInput", "titlePreview"],
  ["messageInput", "messagePreview"],
  ["infoInput", "infoPreview"],
  ["amountInput", "amountPreview"],
  ["senderInput", "senderPreview"],
  ["identifierInput", "identifierPreview"],
  ["shortpassInput", "shortpassPreview"],
  ["validToInput", "validtoPreview"]
];

function setPreviewVisibility(previewId, isVisible) {
  textVisibilityState.set(previewId, isVisible);
  const preview = document.getElementById(previewId);
  if (preview) {
    preview.style.display = isVisible ? "" : "none";
  }

  const mappedBottomValueId = bottomGroupValueMap[previewId];
  if (mappedBottomValueId) {
    const bottomValue = document.getElementById(mappedBottomValueId);
    const bottomRow = bottomValue ? bottomValue.closest(".details-preview-line") : null;
    if (bottomRow) {
      bottomRow.style.display = isVisible ? "" : "none";
    }
  }

  if (groupedPreviewIds.has(previewId)) {
    updateDetailsGroupVisibility();
  }
  if (previewId === "amountPreview") {
    updateDetailsGroupVisibility();
  }
}

function applyTextVisibilityState() {
  textVisibilityState.forEach((isVisible, previewId) => {
    setPreviewVisibility(previewId, isVisible);
  });
}

textVisibilityCheckboxes.forEach(checkbox => {
  const previewId = checkbox.dataset.textVisibilityTarget;
  if (!previewId) return;
  textVisibilityState.set(previewId, checkbox.checked);
  checkbox.addEventListener("change", () => {
    setPreviewVisibility(previewId, checkbox.checked);
  });
});

applyTextVisibilityState();

bindings.forEach(([inputId, previewId]) => {
  const input = document.getElementById(inputId);
  if (!input) return;

  input.addEventListener("input", () => {
    const preview = document.getElementById(previewId);
    if (!preview) return;
    preview.innerText = input.value;
  });
});

["amountInput", "identifierInput", "shortpassInput", "validToInput"].forEach(inputId => {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener("input", () => {
    ensureGroupedDetailsPreview();
    syncBottomBackdropCoverage();
  });
});

if (bottomGroupTextColorInput) {
  bottomGroupTextColorInput.addEventListener("input", applyBottomGroupTextStyles);
  bottomGroupTextColorInput.addEventListener("change", applyBottomGroupTextStyles);
}

if (bottomGroupBackdropColorInput) {
  bottomGroupBackdropColorInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropColorInput.addEventListener("change", applyBottomBackdropStyles);
}

if (bottomGroupBackdropOpacityInput) {
  bottomGroupBackdropOpacityInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropOpacityInput.addEventListener("change", applyBottomBackdropStyles);
}
if (bottomGroupBackdropShadowColorInput) {
  bottomGroupBackdropShadowColorInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropShadowColorInput.addEventListener("change", applyBottomBackdropStyles);
}
if (bottomGroupBackdropShadowXInput) {
  bottomGroupBackdropShadowXInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropShadowXInput.addEventListener("change", applyBottomBackdropStyles);
}
if (bottomGroupBackdropShadowYInput) {
  bottomGroupBackdropShadowYInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropShadowYInput.addEventListener("change", applyBottomBackdropStyles);
}
if (bottomGroupBackdropShadowBlurInput) {
  bottomGroupBackdropShadowBlurInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropShadowBlurInput.addEventListener("change", applyBottomBackdropStyles);
}
if (bottomGroupBackdropShadowOpacityInput) {
  bottomGroupBackdropShadowOpacityInput.addEventListener("input", applyBottomBackdropStyles);
  bottomGroupBackdropShadowOpacityInput.addEventListener("change", applyBottomBackdropStyles);
}

// -------------------------------
// Color controls
// -------------------------------
bgColorInput.addEventListener("input", e => {
  giftcard.style.backgroundColor = e.target.value;
  giftcard.style.backgroundImage = "none";
  currentBackgroundImageDataUrl = null;
});

textColorInput.addEventListener("input", e => {
  giftcard.style.color = e.target.value;
});

// -------------------------------
// Font controls per text field
// -------------------------------
const textTargetInput = document.getElementById("textTargetInput");
const fontFamilyInput = document.getElementById("fontFamilyInput");
const fontSizeInput = document.getElementById("fontSizeInput");
const fontWeightInput = document.getElementById("fontWeightInput");
const textShadowColorInput = document.getElementById("textShadowColorInput");
const textShadowOffsetXInput = document.getElementById("textShadowOffsetXInput");
const textShadowOffsetYInput = document.getElementById("textShadowOffsetYInput");
const textShadowBlurInput = document.getElementById("textShadowBlurInput");

function getSelectedTextField() {
  return document.getElementById(textTargetInput.value);
}

function normalizeFontWeightValue(value, fallback = "400") {
  if (value === "normal") return "400";
  if (value === "bold") return "700";
  if (typeof value === "string" && value.trim() !== "") return value;
  return fallback;
}

function parseTextShadowValue(shadowValue) {
  if (!shadowValue || shadowValue === "none") {
    return { x: 0, y: 0, blur: 0, color: "#000000" };
  }

  const match = shadowValue.match(/(-?\d+(\.\d+)?)px\s+(-?\d+(\.\d+)?)px\s+(-?\d+(\.\d+)?)px\s+(.+)/i);
  if (!match) {
    return { x: 0, y: 0, blur: 0, color: "#000000" };
  }

  return {
    x: parseInt(match[1], 10) || 0,
    y: parseInt(match[3], 10) || 0,
    blur: Math.max(0, parseInt(match[5], 10) || 0),
    color: toHexColor(match[7])
  };
}

function toHexColor(colorValue) {
  if (!colorValue) return "#000000";
  const value = colorValue.trim().toLowerCase();
  if (value.startsWith("#")) return value;

  const rgbMatch = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!rgbMatch) return "#000000";

  const toHex = number => Math.max(0, Math.min(255, parseInt(number, 10) || 0)).toString(16).padStart(2, "0");
  return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
}

function syncFontControlsFromSelectedField() {
  const selectedField = getSelectedTextField();
  if (!selectedField) return;
  const hasShadowControls = textShadowColorInput && textShadowOffsetXInput && textShadowOffsetYInput && textShadowBlurInput;

  if (selectedField.id === "detailsPreviewGroup") {
    const baseSizeRaw = selectedField.style.getPropertyValue("--bottom-font-base");
    const baseSize = parseInt(baseSizeRaw, 10);
    fontSizeInput.value = Number.isNaN(baseSize) ? 26 : baseSize;
    const firstDetailText = selectedField.querySelector(".details-label, .details-value");
    fontFamilyInput.value = (firstDetailText && firstDetailText.style.fontFamily) || selectedField.style.fontFamily || "inherit";
    if (fontWeightInput) {
      const bottomWeight = normalizeFontWeightValue((firstDetailText && firstDetailText.style.fontWeight) || selectedField.style.fontWeight, "700");
      fontWeightInput.value = bottomWeight;
    }
    if (hasShadowControls) {
      const shadowSource = (firstDetailText && firstDetailText.style.textShadow)
        || selectedField.style.textShadow
        || window.getComputedStyle(firstDetailText || selectedField).textShadow;
      const shadow = parseTextShadowValue(shadowSource);
      textShadowColorInput.value = shadow.color;
      textShadowOffsetXInput.value = String(shadow.x);
      textShadowOffsetYInput.value = String(shadow.y);
      textShadowBlurInput.value = String(shadow.blur);
    }
    return;
  }

  const computedStyle = window.getComputedStyle(selectedField);
  const fontSize = parseInt(computedStyle.fontSize, 10);
  fontSizeInput.value = Number.isNaN(fontSize) ? 16 : fontSize;
  fontFamilyInput.value = selectedField.style.fontFamily || "inherit";
  if (fontWeightInput) {
    fontWeightInput.value = normalizeFontWeightValue(selectedField.style.fontWeight || computedStyle.fontWeight, "400");
  }
  if (hasShadowControls) {
    const shadow = parseTextShadowValue(selectedField.style.textShadow || computedStyle.textShadow);
    textShadowColorInput.value = shadow.color;
    textShadowOffsetXInput.value = String(shadow.x);
    textShadowOffsetYInput.value = String(shadow.y);
    textShadowBlurInput.value = String(shadow.blur);
  }
}

textTargetInput.addEventListener("change", syncFontControlsFromSelectedField);

function applySelectedFontFamily() {
  const selectedField = getSelectedTextField();
  if (!selectedField) return;
  if (selectedField.id === "detailsPreviewGroup") {
    selectedField.style.fontFamily = fontFamilyInput.value;
    selectedField.querySelectorAll(".details-label, .details-value").forEach(node => {
      node.style.fontFamily = fontFamilyInput.value;
    });
    syncBottomBackdropCoverage();
    return;
  }
  selectedField.style.fontFamily = fontFamilyInput.value;
  if (selectedField.id !== "detailsPreviewGroup") {
    clampDraggableToCard(selectedField);
  }
}

function applySelectedFontSize() {
  const selectedField = getSelectedTextField();
  if (!selectedField) return;

  const fontSize = parseInt(fontSizeInput.value, 10);
  if (Number.isNaN(fontSize)) return;
  if (selectedField.id === "detailsPreviewGroup") {
    selectedField.style.setProperty("--bottom-font-base", `${fontSize}px`);
    syncBottomBackdropCoverage();
    return;
  }
  selectedField.style.fontSize = `${fontSize}px`;
  clampDraggableToCard(selectedField);
}

function applySelectedFontWeight() {
  const selectedField = getSelectedTextField();
  if (!selectedField || !fontWeightInput) return;

  const fontWeight = fontWeightInput.value;
  if (selectedField.id === "detailsPreviewGroup") {
    selectedField.style.fontWeight = fontWeight;
    selectedField.querySelectorAll(".details-label, .details-value").forEach(node => {
      node.style.fontWeight = fontWeight;
    });
    syncBottomBackdropCoverage();
    return;
  }

  selectedField.style.fontWeight = fontWeight;
  clampDraggableToCard(selectedField);
}

function applySelectedTextShadow() {
  const selectedField = getSelectedTextField();
  if (!selectedField) return;
  if (!textShadowColorInput || !textShadowOffsetXInput || !textShadowOffsetYInput || !textShadowBlurInput) return;

  const shadowX = parseInt(textShadowOffsetXInput.value, 10) || 0;
  const shadowY = parseInt(textShadowOffsetYInput.value, 10) || 0;
  const shadowBlur = Math.max(0, parseInt(textShadowBlurInput.value, 10) || 0);
  const shadowColor = textShadowColorInput.value || "#000000";
  const textShadow = `${shadowX}px ${shadowY}px ${shadowBlur}px ${shadowColor}`;

  if (selectedField.id === "detailsPreviewGroup") {
    selectedField.style.textShadow = textShadow;
    selectedField.querySelectorAll(".details-label, .details-value").forEach(node => {
      node.style.textShadow = textShadow;
    });
    syncBottomBackdropCoverage();
    return;
  }

  selectedField.style.textShadow = textShadow;
  clampDraggableToCard(selectedField);
}

fontFamilyInput.addEventListener("change", applySelectedFontFamily);
fontFamilyInput.addEventListener("input", applySelectedFontFamily);
fontSizeInput.addEventListener("change", applySelectedFontSize);
fontSizeInput.addEventListener("input", applySelectedFontSize);
if (fontWeightInput) {
  fontWeightInput.addEventListener("change", applySelectedFontWeight);
  fontWeightInput.addEventListener("input", applySelectedFontWeight);
}
if (textShadowColorInput) {
  textShadowColorInput.addEventListener("change", applySelectedTextShadow);
  textShadowColorInput.addEventListener("input", applySelectedTextShadow);
}
if (textShadowOffsetXInput) {
  textShadowOffsetXInput.addEventListener("change", applySelectedTextShadow);
  textShadowOffsetXInput.addEventListener("input", applySelectedTextShadow);
}
if (textShadowOffsetYInput) {
  textShadowOffsetYInput.addEventListener("change", applySelectedTextShadow);
  textShadowOffsetYInput.addEventListener("input", applySelectedTextShadow);
}
if (textShadowBlurInput) {
  textShadowBlurInput.addEventListener("change", applySelectedTextShadow);
  textShadowBlurInput.addEventListener("input", applySelectedTextShadow);
}

syncFontControlsFromSelectedField();
defaultLayoutState = createLayoutState();
if (!isThumbnailMode) {
  initializeDefaultLayoutState();
}

window.addEventListener("resize", () => {
  document.querySelectorAll(".draggable").forEach(clampDraggableToCard);
  scaleTemplateToGiftcard();
  requestAnimationFrame(syncBottomBackdropCoverage);
});

// -------------------------------
// Save/load layout as JSON
// -------------------------------
function createDefaultGiftcardDataSourceState() {
  const fields = {};
  Object.entries(apiBoundFieldConfig).forEach(([previewId, config]) => {
    fields[previewId] = {
      inputId: config.inputId,
      token: config.token,
      apiKeys: [...config.apiKeys]
    };
  });

  return {
    enabled: true,
    url: giftcardDataApiUrl,
    fields
  };
}

function resolveApiFieldValue(payload, apiKeys) {
  if (!payload || typeof payload !== "object") return null;
  const sources = [payload];
  if (payload.data && typeof payload.data === "object") sources.push(payload.data);
  if (payload.giftcard && typeof payload.giftcard === "object") sources.push(payload.giftcard);
  if (payload.values && typeof payload.values === "object") sources.push(payload.values);

  for (const source of sources) {
    for (const key of apiKeys) {
      const value = source[key];
      if (value === undefined || value === null) continue;
      if (typeof value === "string" && value.trim() === "") continue;
      return String(value);
    }
  }
  return null;
}

function applyApiBoundFieldValue(previewId, value) {
  if (typeof value !== "string") return;
  const config = apiBoundFieldConfig[previewId];
  if (!config) return;

  const input = document.getElementById(config.inputId);
  const preview = document.getElementById(previewId);
  if (input) {
    input.value = value;
  }
  if (preview) {
    preview.innerText = value;
  }
}

async function hydrateGiftcardFieldsFromApi(layout) {
  const dataSource = layout && layout.dataSource && layout.dataSource.giftcardData;
  if (!dataSource || dataSource.enabled === false) return;

  const dataUrl = resolveGiftcardDataUrl(dataSource.url);

  try {
    const response = await fetch(dataUrl, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        accept: "application/json"
      }
    });
    if (!response.ok) {
      throw new Error(`Giftcard data API request failed (${response.status}).`);
    }

    const payload = await response.json();
    const customFields = dataSource.fields && typeof dataSource.fields === "object"
      ? dataSource.fields
      : {};

    Object.keys(apiBoundFieldConfig).forEach(previewId => {
      const baseConfig = apiBoundFieldConfig[previewId];
      const customConfig = customFields[previewId];
      const apiKeys = Array.isArray(customConfig?.apiKeys) && customConfig.apiKeys.length
        ? customConfig.apiKeys
        : baseConfig.apiKeys;
      const value = resolveApiFieldValue(payload, apiKeys);
      if (typeof value === "string" && value !== "") {
        applyApiBoundFieldValue(previewId, value);
      }
    });

    ensureGroupedDetailsPreview();
    syncBottomBackdropCoverage();
  } catch (error) {
    console.warn("Could not hydrate giftcard values from API.", error);
  }
}

function createLayoutState() {
  const fields = {};
  bindings.forEach(([inputId, previewId]) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    if (!input && !preview) return;
    const detailsGroup = document.getElementById("detailsPreviewGroup");
    const bottomGroup = document.getElementById(bottomMovableGroupId);
    const positionTarget = groupedPreviewIds.has(previewId)
      ? (bottomGroup || detailsGroup)
      : preview;
    const apiConfig = apiBoundFieldConfig[previewId];
    const fieldText = apiConfig && apiConfig.token
      ? apiConfig.token
      : (input ? input.value : "");
    fields[previewId] = {
      inputId,
      text: fieldText,
      top: positionTarget ? (positionTarget.style.top || "0%") : "0%",
      left: positionTarget ? (positionTarget.style.left || "0%") : "0%",
      width: positionTarget ? (positionTarget.style.width || "") : "",
      height: positionTarget ? (positionTarget.style.height || "") : "",
      fontFamily: preview ? (preview.style.fontFamily || "") : "",
      fontSize: preview ? (preview.style.fontSize || "") : "",
      fontWeight: preview ? (preview.style.fontWeight || "") : "",
      textShadow: preview ? (preview.style.textShadow || "") : ""
    };
  });

  return {
    version: 1,
    giftcard: {
      backgroundColor: bgColorInput.value,
      backgroundImageDataUrl: currentBackgroundImageDataUrl,
      textColor: textColorInput.value
    },
    ui: {
      textTarget: textTargetInput.value,
      textVisibility: Object.fromEntries(textVisibilityState.entries()),
      bottomGroupStyle: {
        textColor: bottomGroupTextColorInput ? bottomGroupTextColorInput.value : "",
        backdropColor: bottomGroupBackdropColorInput ? bottomGroupBackdropColorInput.value : "",
        backdropOpacity: bottomGroupBackdropOpacityInput ? bottomGroupBackdropOpacityInput.value : "100",
        backdropShadow: buildBottomBackdropShadowValue(),
        backdropRect: getBottomBackdropRectState(),
        fontFamily: (document.getElementById("detailsPreviewGroup")?.style.fontFamily) || "",
        fontSize: (document.getElementById("detailsPreviewGroup")?.style.getPropertyValue("--bottom-font-base")) || "",
        fontWeight: (document.getElementById("detailsPreviewGroup")?.style.fontWeight) || "",
        textShadow: (document.querySelector("#detailsPreviewGroup .details-label, #detailsPreviewGroup .details-value")?.style.textShadow)
          || (document.getElementById("detailsPreviewGroup")?.style.textShadow)
          || ""
      }
    },
    dataSource: {
      giftcardData: createDefaultGiftcardDataSourceState()
    },
    fields
  };
}

function downloadLayoutJson() {
  const layout = createLayoutState();
  const json = JSON.stringify(layout, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "giftcard-layout.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function applyLayoutState(layout) {
  if (!layout || typeof layout !== "object") {
    throw new Error("Invalid layout JSON.");
  }

  if (layout.giftcard) {
    if (typeof layout.giftcard.backgroundColor === "string" && layout.giftcard.backgroundColor) {
      giftcard.style.backgroundColor = layout.giftcard.backgroundColor;
      bgColorInput.value = layout.giftcard.backgroundColor;
    }

    if (typeof layout.giftcard.textColor === "string" && layout.giftcard.textColor) {
      giftcard.style.color = layout.giftcard.textColor;
      textColorInput.value = layout.giftcard.textColor;
    }

    if (typeof layout.giftcard.backgroundImageDataUrl === "string" && layout.giftcard.backgroundImageDataUrl) {
      currentBackgroundImageDataUrl = layout.giftcard.backgroundImageDataUrl;
      giftcard.style.backgroundImage = `url(${currentBackgroundImageDataUrl})`;
      giftcard.style.backgroundSize = "100% 100%";
      giftcard.style.backgroundPosition = "center";
      giftcard.style.backgroundRepeat = "no-repeat";
    } else {
      currentBackgroundImageDataUrl = null;
      giftcard.style.backgroundImage = "none";
    }
  }

  if (layout.fields && typeof layout.fields === "object") {
    Object.keys(layout.fields).forEach(previewId => {
      const field = layout.fields[previewId];
      const preview = document.getElementById(previewId);
      const positionTarget = groupedPreviewIds.has(previewId)
        ? (document.getElementById(bottomMovableGroupId) || ensureGroupedDetailsPreview())
        : preview;
      if (!preview && !positionTarget) return;

      if (preview && typeof field.text === "string") {
        preview.innerText = field.text;
      }
      if (positionTarget && typeof field.top === "string") {
        positionTarget.style.top = field.top;
      }
      if (positionTarget && typeof field.left === "string") {
        positionTarget.style.left = field.left;
      }
      if (positionTarget && typeof field.width === "string" && field.width) {
        positionTarget.style.width = field.width;
      }
      if (positionTarget && typeof field.height === "string" && field.height) {
        positionTarget.style.height = field.height;
      }
      if (preview && typeof field.fontFamily === "string") {
        preview.style.fontFamily = field.fontFamily;
      }
      if (preview && typeof field.fontSize === "string") {
        preview.style.fontSize = field.fontSize;
      }
      if (preview && typeof field.fontWeight === "string") {
        preview.style.fontWeight = field.fontWeight;
      }
      if (preview && typeof field.textShadow === "string") {
        preview.style.textShadow = field.textShadow;
      }

      if (typeof field.inputId === "string") {
        const input = document.getElementById(field.inputId);
        if (input && typeof field.text === "string") {
          input.value = field.text;
        }
      }

      if (positionTarget) {
        clampDraggableToCard(positionTarget);
      }
    });
  }

  if (layout.ui && typeof layout.ui.textTarget === "string") {
    const optionExists = Array.from(textTargetInput.options).some(option => option.value === layout.ui.textTarget);
    if (optionExists) {
      textTargetInput.value = layout.ui.textTarget;
    }
  }

  if (layout.ui && layout.ui.textVisibility && typeof layout.ui.textVisibility === "object") {
    Object.entries(layout.ui.textVisibility).forEach(([previewId, isVisible]) => {
      const visible = Boolean(isVisible);
      textVisibilityState.set(previewId, visible);

      const checkbox = textVisibilityCheckboxes.find(item => item.dataset.textVisibilityTarget === previewId);
      if (checkbox) {
        checkbox.checked = visible;
      }
    });
  }

  if (layout.ui && layout.ui.bottomGroupStyle && typeof layout.ui.bottomGroupStyle === "object") {
    const style = layout.ui.bottomGroupStyle;
    const detailsGroup = ensureGroupedDetailsPreview();
    if (bottomGroupTextColorInput && typeof style.textColor === "string" && style.textColor) {
      bottomGroupTextColorInput.value = style.textColor;
    }
    if (detailsGroup && typeof style.fontFamily === "string" && style.fontFamily) {
      detailsGroup.style.fontFamily = style.fontFamily;
    }
    if (detailsGroup && typeof style.fontSize === "string" && style.fontSize) {
      detailsGroup.style.setProperty("--bottom-font-base", style.fontSize);
    }
    if (detailsGroup && typeof style.fontWeight === "string" && style.fontWeight) {
      detailsGroup.style.fontWeight = style.fontWeight;
      detailsGroup.querySelectorAll(".details-label, .details-value").forEach(node => {
        node.style.fontWeight = style.fontWeight;
      });
    }
    if (detailsGroup) {
      const nextShadow = typeof style.textShadow === "string" ? style.textShadow : "";
      detailsGroup.style.textShadow = nextShadow;
      detailsGroup.querySelectorAll(".details-label, .details-value").forEach(node => {
        node.style.textShadow = nextShadow;
      });
    }
    if (bottomGroupBackdropColorInput && typeof style.backdropColor === "string" && style.backdropColor) {
      bottomGroupBackdropColorInput.value = style.backdropColor;
    }
    if (bottomGroupBackdropOpacityInput && style.backdropOpacity !== undefined && style.backdropOpacity !== null) {
      bottomGroupBackdropOpacityInput.value = String(style.backdropOpacity);
    }
    if (typeof style.backdropShadow === "string") {
      const parsedBackdropShadow = parseBottomBackdropShadowValue(style.backdropShadow);
      if (parsedBackdropShadow
        && bottomGroupBackdropShadowColorInput
        && bottomGroupBackdropShadowXInput
        && bottomGroupBackdropShadowYInput
        && bottomGroupBackdropShadowBlurInput
        && bottomGroupBackdropShadowOpacityInput) {
        bottomGroupBackdropShadowColorInput.value = parsedBackdropShadow.color;
        bottomGroupBackdropShadowXInput.value = String(parsedBackdropShadow.x);
        bottomGroupBackdropShadowYInput.value = String(parsedBackdropShadow.y);
        bottomGroupBackdropShadowBlurInput.value = String(parsedBackdropShadow.blur);
        bottomGroupBackdropShadowOpacityInput.value = String(parsedBackdropShadow.opacity);
      } else if (style.backdropShadow === "none" && bottomGroupBackdropShadowOpacityInput) {
        bottomGroupBackdropShadowOpacityInput.value = "0";
      }
    }
  } else {
    const detailsGroup = ensureGroupedDetailsPreview();
    if (detailsGroup) {
      detailsGroup.style.textShadow = "";
      detailsGroup.querySelectorAll(".details-label, .details-value").forEach(node => {
        node.style.textShadow = "";
      });
    }
  }

  applyBottomGroupTextStyles();
  applyBottomBackdropStyles();
  if (layout.ui && layout.ui.bottomGroupStyle && layout.ui.bottomGroupStyle.backdropRect) {
    applyBottomBackdropRectState(layout.ui.bottomGroupStyle.backdropRect);
  }
  syncBottomGroupScale();
  applyTextVisibilityState();
  syncFontControlsFromSelectedField();
  void hydrateGiftcardFieldsFromApi(layout);
  emitEditorStateChange();
}

saveLayoutBtn.addEventListener("click", downloadLayoutJson);

loadLayoutInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const layout = JSON.parse(evt.target.result);
      applyLayoutState(layout);
    } catch (error) {
      alert("Could not load JSON layout file.");
      console.error(error);
    }
  };
  reader.readAsText(file);

  // Allow loading the same file again later.
  loadLayoutInput.value = "";
});

// -------------------------------
// Import template from API
// -------------------------------
const templateApiUrl = new URL("giftcard/templates", giftcardMakerApiRoot).toString();
const templateApiFallbackUrl = null;
const premadeTemplateDefinitions = [
  {
    id: "giftcard-layout-7",
    nameKey: "preset1",
    url: new URL(`${appRoot}/premade-templates/giftcard-layout-7.json`, window.location.origin).toString(),
    modes: ["giftcard"]
  },
  {
    id: "giftcard-layout-11",
    nameKey: "preset2",
    url: new URL(`${appRoot}/premade-templates/giftcard-layout-11.json`, window.location.origin).toString(),
    modes: ["giftcard"]
  },
  {
    id: "giftcard-layout-3",
    nameKey: "preset3",
    url: new URL(`${appRoot}/premade-templates/giftcard-layout-3.json`, window.location.origin).toString(),
    modes: ["giftcard"]
  },
  {
    id: "giftcard-layout-4",
    nameKey: "preset4",
    url: new URL(`${appRoot}/premade-templates/giftcard-layout-4.json`, window.location.origin).toString(),
    modes: ["giftcard"]
  },
  {
    id: "thumbnail-layout-20",
    nameKey: "thumbnailPreset1",
    url: new URL(`${appRoot}/premade-templates/thumbnail-layout-20.json`, window.location.origin).toString(),
    modes: ["thumbnail"]
  },
  {
    id: "thumbnail-layout-21",
    nameKey: "thumbnailPreset2",
    url: new URL(`${appRoot}/premade-templates/thumbnail-layout-21.json`, window.location.origin).toString(),
    modes: ["thumbnail"]
  }
];
let templateStatusFadeTimeoutId = null;
let templateStatusClearTimeoutId = null;

function getActivePremadeTemplateDefinitions() {
  const mode = isThumbnailMode ? "thumbnail" : "giftcard";
  return premadeTemplateDefinitions.filter(definition => {
    if (!Array.isArray(definition.modes) || definition.modes.length === 0) {
      return true;
    }
    return definition.modes.includes(mode);
  });
}

function setTemplateStatus(message, isError = false, autoHideMs = 0) {
  if (!templateStatus) return;

  if (templateStatusFadeTimeoutId) {
    clearTimeout(templateStatusFadeTimeoutId);
    templateStatusFadeTimeoutId = null;
  }
  if (templateStatusClearTimeoutId) {
    clearTimeout(templateStatusClearTimeoutId);
    templateStatusClearTimeoutId = null;
  }

  templateStatus.classList.remove("fading-out");
  templateStatus.style.removeProperty("--template-status-fade-ms");
  templateStatus.innerText = message;
  templateStatus.classList.toggle("error", isError);

  if (!isError && autoHideMs > 0 && message) {
    templateStatus.style.setProperty("--template-status-fade-ms", `${autoHideMs}ms`);
    templateStatusFadeTimeoutId = setTimeout(() => {
      templateStatus.classList.add("fading-out");
      templateStatusFadeTimeoutId = null;
    }, 20);
    templateStatusClearTimeoutId = setTimeout(() => {
      templateStatus.innerText = "";
      templateStatus.classList.remove("fading-out");
      templateStatus.style.removeProperty("--template-status-fade-ms");
      templateStatusFadeTimeoutId = null;
      templateStatusClearTimeoutId = null;
    }, autoHideMs);
  }
}

function normalizeTemplatesPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.templates)) return payload.templates;
  if (payload && Array.isArray(payload.data)) return payload.data;
  return [];
}

function getTemplateOperatorId(template) {
  if (!template || typeof template !== "object") return null;
  const operatorId = template.operatorId ?? template.operatorID ?? template.OperatorId;
  if (operatorId === undefined || operatorId === null || operatorId === "") {
    return null;
  }
  return String(operatorId);
}

function getTemplateName(template) {
  if (!template || typeof template !== "object") return "Unnamed template";
  const name = template.templateName ?? template.name ?? template.TemplateName;
  if (typeof name === "string" && name.trim() !== "") {
    return name.trim();
  }
  return "Unnamed template";
}

function getTemplateId(template) {
  if (!template || typeof template !== "object") return null;
  const templateId = template.templateId ?? template.id ?? template.TemplateId;
  if (templateId === undefined || templateId === null || templateId === "") {
    return null;
  }
  return String(templateId);
}

function clearOperatorSelect() {
  if (!operatorSelect) return;
  operatorSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.innerText = t("noTemplatesLoaded");
  operatorSelect.appendChild(option);
  operatorSelect.value = "";
  operatorSelect.disabled = true;
}

function clearPremadeTemplateSelect() {
  if (!premadeTemplateSelect) return;
  premadeTemplateSelect.innerHTML = "";
  const option = document.createElement("option");
  option.value = "";
  option.innerText = t("selectPremadeTemplate");
  premadeTemplateSelect.appendChild(option);
  premadeTemplateSelect.value = "";
}

function initializePremadeTemplateSelect() {
  if (!premadeTemplateSelect) return;
  clearPremadeTemplateSelect();

  const activeDefinitions = getActivePremadeTemplateDefinitions();
  activeDefinitions.forEach(definition => {
    const option = document.createElement("option");
    option.value = definition.id;
    option.innerText = t(definition.nameKey || "");
    option.dataset.nameKey = definition.nameKey || "";
    premadeTemplateSelect.appendChild(option);
  });

  premadeTemplateSelect.disabled = activeDefinitions.length === 0;
}

function togglePremadeTemplateControls() {
  if (!premadeTemplateControls) return;
  premadeTemplateControls.hidden = !premadeTemplateControls.hidden;
}

async function loadSelectedPremadeTemplate() {
  if (!premadeTemplateSelect) return;

  const selectedId = premadeTemplateSelect.value;
  if (!selectedId) {
    setTemplateStatus("Choose a premade template first.", true);
    return;
  }

  const activeDefinitions = getActivePremadeTemplateDefinitions();
  const definition = activeDefinitions.find(item => item.id === selectedId);
  if (!definition) {
    setTemplateStatus("Selected premade template was not found.", true);
    return;
  }
  const templateDisplayName = t(definition.nameKey || "");

  setTemplateStatus(`Loading ${templateDisplayName}...`);

  try {
    let layout = premadeLayoutsById.get(definition.id);
    if (!layout) {
      const response = await fetch(definition.url, {
        method: "GET",
        cache: "no-store",
        headers: {
          accept: "application/json"
        }
      });
      if (!response.ok) {
        throw new Error(`Premade template request failed (${response.status}).`);
      }
      layout = await response.json();
      premadeLayoutsById.set(definition.id, layout);
    }

    applyLayoutState(layout);
    setTemplateStatus(`Premade template loaded: ${templateDisplayName}.`, false, 4000);
  } catch (error) {
    console.error(error);
    setTemplateStatus("Could not load premade template JSON.", true);
  }
}

function loadDefaultGiftcardLayout() {
  if (!defaultLayoutState) {
    setTemplateStatus("Default giftcard layout is not available.", true);
    return;
  }

  const defaultLayout = JSON.parse(JSON.stringify(defaultLayoutState));
  applyLayoutState(defaultLayout);

  if (operatorSelect) {
    operatorSelect.value = "";
  }
  if (premadeTemplateSelect) {
    premadeTemplateSelect.value = "";
  }
  setTemplateStatus(t("defaultGiftcardLoaded"), false, 3000);
}

async function initializeDefaultLayoutState() {
  if (isThumbnailMode) return;

  try {
    const response = await fetch(defaultGiftcardLayoutUrl, {
      method: "GET",
      cache: "no-store",
      headers: {
        accept: "application/json"
      }
    });
    if (!response.ok) return;

    const layout = await response.json();
    if (!layout || typeof layout !== "object") return;
    defaultLayoutState = layout;
    loadDefaultGiftcardLayout();
  } catch (error) {
    console.error("Could not load default giftcard layout JSON.", error);
  }
}

function readStringFromKeys(source, keys) {
  for (const key of keys) {
    if (typeof source[key] === "string" && source[key].trim() !== "") {
      return source[key];
    }
  }
  return null;
}

function parseJsonIfString(value) {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeHtmlEntities(value) {
  if (typeof value !== "string" || value === "") return value;
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function normalizeTemplateMarkup(value) {
  if (typeof value !== "string" || value.trim() === "") return "";
  const decoded = decodeHtmlEntities(value);
  if (decoded.includes("<") && decoded.includes(">")) {
    return decoded;
  }
  return value;
}

function extractPrimaryFontFamily(cssText) {
  if (typeof cssText !== "string" || cssText.trim() === "") return "";
  const match = cssText.match(/font-family\s*:\s*([^;]+);/i);
  if (!match) return "";
  return match[1].trim();
}

function applyFontToGiftcardTextFields(fontFamily) {
  if (!fontFamily || isThumbnailMode) return;
  const previewIds = [
    "titlePreview",
    "messagePreview",
    "infoPreview",
    "amountPreview",
    "senderPreview",
    "identifierPreview",
    "shortpassPreview",
    "validtoPreview"
  ];

  previewIds.forEach(previewId => {
    const preview = document.getElementById(previewId);
    if (preview) {
      preview.style.fontFamily = fontFamily;
    }
  });

  const detailsGroup = document.getElementById("detailsPreviewGroup");
  if (detailsGroup) {
    detailsGroup.style.fontFamily = fontFamily;
    detailsGroup.querySelectorAll(".details-preview-line, .details-label, .details-value").forEach(node => {
      node.style.fontFamily = fontFamily;
    });
  }

  if (fontFamilyInput) {
    fontFamilyInput.value = fontFamily;
  }
}

function applyTemplateByFields(template) {
  let appliedAny = false;

  const textMappings = [
    { inputId: "titleInput", previewId: "titlePreview", keys: ["title", "Title"] },
    { inputId: "messageInput", previewId: "messagePreview", keys: ["message", "Message", "description", "Description"] },
    { inputId: "infoInput", previewId: "infoPreview", keys: ["info", "Info", "note", "Note"] },
    { inputId: "amountInput", previewId: "amountPreview", keys: ["amount", "value", "Amount", "Value"] },
    { inputId: "senderInput", previewId: "senderPreview", keys: ["sender", "Sender", "from", "From"] },
    { inputId: "identifierInput", previewId: "identifierPreview", keys: ["identifier", "cardNumber", "Identifier", "CardNumber"] },
    { inputId: "shortpassInput", previewId: "shortpassPreview", keys: ["shortpass", "shortPass", "Shortpass", "ShortPass"] },
    { inputId: "validToInput", previewId: "validtoPreview", keys: ["validTo", "valid_to", "expiresAt", "ValidTo", "ExpiryDate"] }
  ];

  textMappings.forEach(mapping => {
    const value = readStringFromKeys(template, mapping.keys);
    if (!value) return;
    const input = document.getElementById(mapping.inputId);
    const preview = document.getElementById(mapping.previewId);
    if (!input || !preview) return;
    input.value = value;
    preview.innerText = value;
    appliedAny = true;
  });

  const backgroundColor = readStringFromKeys(template, ["backgroundColor", "BackgroundColor", "bgColor", "BgColor"]);
  if (backgroundColor) {
    giftcard.style.backgroundColor = backgroundColor;
    bgColorInput.value = backgroundColor;
    giftcard.style.backgroundImage = "none";
    currentBackgroundImageDataUrl = null;
    appliedAny = true;
  }

  const textColor = readStringFromKeys(template, ["textColor", "TextColor", "fontColor", "FontColor"]);
  if (textColor) {
    giftcard.style.color = textColor;
    textColorInput.value = textColor;
    appliedAny = true;
  }

  const backgroundImage = readStringFromKeys(template, ["backgroundImage", "BackgroundImage", "backgroundImageUrl", "BackgroundImageUrl"]);
  if (backgroundImage) {
    currentBackgroundImageDataUrl = backgroundImage;
    giftcard.style.backgroundImage = `url(${backgroundImage})`;
    giftcard.style.backgroundSize = "100% 100%";
    giftcard.style.backgroundPosition = "center";
    giftcard.style.backgroundRepeat = "no-repeat";
    appliedAny = true;
  }

  if (appliedAny) {
    ensureGroupedDetailsPreview();
    syncBottomBackdropCoverage();
  }

  return appliedAny;
}

function applyHtmlTemplate(template) {
  const html = readStringFromKeys(template, ["htmlContent", "HtmlContent", "html", "Html"]);
  const css = readStringFromKeys(template, ["cssContent", "CssContent", "css", "Css"]);
  if (!html && !css) return false;

  let resolvedHtml = normalizeTemplateMarkup(html || "");
  const templateFontFamily = extractPrimaryFontFamily(css || "");
  const messageInput = document.getElementById("messageInput");
  const infoInput = document.getElementById("infoInput");
  const amountInput = document.getElementById("amountInput");
  const titleInput = document.getElementById("titleInput");
  const identifierInput = document.getElementById("identifierInput");
  const shortpassInput = document.getElementById("shortpassInput");
  const validToInput = document.getElementById("validToInput");

  const replacements = [
    ["#PERSONALMESSAGE#", "<span id=\"messageAnchor\"></span>"],
    ["#INFO#", "<span id=\"infoAnchor\"></span>"],
    ["#TITLE#", "<span id=\"titleAnchor\"></span>"],
    ["#IDENTIFIER#", "<span id=\"identifierAnchor\"></span>"],
    ["#SHORTPASS#", "<span id=\"shortpassAnchor\"></span>"],
    ["#VALIDTO#", "<span id=\"validtoAnchor\"></span>"],
    ["#AMOUNT#", amountInput ? amountInput.value : ""],
    ["#INFO_TEXT#", infoInput ? infoInput.value : ""],
    ["#SENDER#", ""],
    ["#TITLE_TEXT#", titleInput ? titleInput.value : ""]
  ];

  replacements.forEach(([token, value]) => {
    if (!resolvedHtml) return;
    resolvedHtml = resolvedHtml.split(token).join(value || "");
  });

  const backgroundResult = extractBackgroundImageUrl(resolvedHtml);
  const backgroundImageUrl = backgroundResult ? backgroundResult.url : null;
  if (backgroundResult && backgroundResult.cleanedHtml) {
    resolvedHtml = backgroundResult.cleanedHtml;
  }
  if (backgroundImageUrl) {
    giftcard.style.backgroundImage = `url(${backgroundImageUrl})`;
    giftcard.style.backgroundSize = "100% 100%";
    giftcard.style.backgroundPosition = "center";
    giftcard.style.backgroundRepeat = "no-repeat";
    currentBackgroundImageDataUrl = backgroundImageUrl;
  }

  giftcard.innerHTML = `<div id="templateRoot">${resolvedHtml}</div>`;
  removeTemplateBackgroundOverlays();

  if (css) {
    let styleTag = document.getElementById("templateStyle");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "templateStyle";
      document.head.appendChild(styleTag);
    }
    styleTag.innerText = normalizeTemplateMarkup(css);
  }

  const templateRoot = document.getElementById("templateRoot");
  if (templateRoot) {
    templateRoot.style.pointerEvents = "none";
  }

  scaleTemplateToGiftcard();
  requestAnimationFrame(() => {
    injectTitlePreviewFromAnchor();
    injectMessagePreviewFromAnchor();
    injectInfoPreviewFromAnchor();
    injectGroupedDetailsFromAnchors();
    injectTemplateQrFromHtml();
    groupBottomElementsFromQrLevel();
    const amountPreview = document.getElementById("amountPreview");
    if (amountPreview) {
      amountPreview.style.display = "none";
    }
    setupDraggables();
    applyTextVisibilityState();
    const root = document.getElementById("templateRoot");
    if (root) {
      root.style.display = "none";
    }
    if (templateFontFamily) {
      applyFontToGiftcardTextFields(templateFontFamily);
    }
  });
  return true;
}

function injectInfoPreviewFromAnchor() {
  const anchor = document.getElementById("infoAnchor");
  const infoInput = document.getElementById("infoInput");
  if (!giftcard) return;

  let left = "8%";
  let top = "28%";
  if (anchor) {
    const cardRect = giftcard.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const leftPx = anchorRect.left - cardRect.left;
    const topPx = anchorRect.top - cardRect.top;
    left = `${(leftPx / cardRect.width) * 100}%`;
    top = `${(topPx / cardRect.height) * 100}%`;
    anchor.remove();
  }

  let infoPreview = document.getElementById("infoPreview");
  if (!infoPreview) {
    infoPreview = document.createElement("p");
    infoPreview.id = "infoPreview";
    infoPreview.className = "draggable";
    giftcard.appendChild(infoPreview);
  }

  infoPreview.innerText = infoInput ? infoInput.value : "";
  infoPreview.style.left = left;
  infoPreview.style.top = top;
  clampDraggableToCard(infoPreview);
}

function injectTitlePreviewFromAnchor() {
  const anchor = document.getElementById("titleAnchor");
  const titleInput = document.getElementById("titleInput");
  if (!giftcard) return;

  let left = "8%";
  let top = "12%";
  if (anchor) {
    const cardRect = giftcard.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const leftPx = anchorRect.left - cardRect.left;
    const topPx = anchorRect.top - cardRect.top;
    left = `${(leftPx / cardRect.width) * 100}%`;
    top = `${(topPx / cardRect.height) * 100}%`;
    anchor.remove();
  }

  let titlePreview = document.getElementById("titlePreview");
  if (!titlePreview) {
    titlePreview = document.createElement("p");
    titlePreview.id = "titlePreview";
    titlePreview.className = "draggable";
    giftcard.appendChild(titlePreview);
  }

  titlePreview.innerText = titleInput ? titleInput.value : "";
  titlePreview.style.left = left;
  titlePreview.style.top = top;
  clampDraggableToCard(titlePreview);
}

function removeTemplateBackgroundOverlays() {
  const templateRoot = document.getElementById("templateRoot");
  if (!templateRoot) return;

  templateRoot.querySelectorAll(".showtic").forEach(el => el.remove());
}

function extractBackgroundImageUrl(htmlString) {
  if (!htmlString || typeof htmlString !== "string") return null;
  const match = htmlString.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
  if (!match) return null;
  const url = match[1];
  const cleanedHtml = htmlString.replace(match[0], "");
  return { url, cleanedHtml };
}

function injectMessagePreviewFromAnchor() {
  const anchor = document.getElementById("messageAnchor");
  const messageInput = document.getElementById("messageInput");
  if (!giftcard) return;

  let left = "8%";
  let top = "20%";
  if (anchor) {
    const cardRect = giftcard.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const leftPx = anchorRect.left - cardRect.left;
    const topPx = anchorRect.top - cardRect.top;
    left = `${(leftPx / cardRect.width) * 100}%`;
    top = `${(topPx / cardRect.height) * 100}%`;
    anchor.remove();
  }

  let messagePreview = document.getElementById("messagePreview");
  if (!messagePreview) {
    messagePreview = document.createElement("p");
    messagePreview.id = "messagePreview";
    messagePreview.className = "draggable";
    giftcard.appendChild(messagePreview);
  }

  messagePreview.innerText = messageInput ? messageInput.value : "";
  messagePreview.style.left = left;
  messagePreview.style.top = top;
  clampDraggableToCard(messagePreview);
}

function injectGroupedDetailsFromAnchors() {
  const group = ensureGroupedDetailsPreview();
  if (!group || !giftcard) return;

  const anchorIds = ["identifierAnchor", "shortpassAnchor", "validtoAnchor"];
  const anchor = anchorIds
    .map(id => document.getElementById(id))
    .find(node => node);

  if (anchor) {
    const cardRect = giftcard.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const leftPx = anchorRect.left - cardRect.left;
    const topPx = anchorRect.top - cardRect.top;

    group.style.left = `${(leftPx / cardRect.width) * 100}%`;
    group.style.top = `${(topPx / cardRect.height) * 100}%`;
  }

  anchorIds.forEach(id => {
    const current = document.getElementById(id);
    if (current) current.remove();
  });

  updateDetailsGroupVisibility();
  clampDraggableToCard(group);
}

function injectTemplateQrFromHtml() {
  const templateRoot = document.getElementById("templateRoot");
  if (!templateRoot || !giftcard) return;

  const qrImg = templateRoot.querySelector("img.qr-code-image");
  if (!qrImg) return;

  const qrBackgroundImg = Array.from(templateRoot.querySelectorAll("img")).find(img => {
    const src = img.getAttribute("src") || "";
    return src.toLowerCase().includes("qr-background");
  });

  const cardRect = giftcard.getBoundingClientRect();
  const src = qrImg.getAttribute("src");
  if (!src) return;

  if (qrBackgroundImg) {
    const bgRect = qrBackgroundImg.getBoundingClientRect();
    const qrRect = qrImg.getBoundingClientRect();

    const bgLeft = bgRect.left - cardRect.left;
    const bgTop = bgRect.top - cardRect.top;
    const bgWidth = bgRect.width;
    const bgHeight = bgRect.height;

    const qrOffsetLeft = qrRect.left - bgRect.left;
    const qrOffsetTop = qrRect.top - bgRect.top;

    qrBackgroundImg.remove();
    qrImg.remove();

    let qrWrapper = document.getElementById("qrWrapper");
    if (!qrWrapper) {
      qrWrapper = document.createElement("div");
      qrWrapper.id = "qrWrapper";
      qrWrapper.className = "draggable";
      qrWrapper.style.position = "absolute";
      giftcard.appendChild(qrWrapper);
    }

    qrWrapper.style.left = `${(bgLeft / cardRect.width) * 100}%`;
    qrWrapper.style.top = `${(bgTop / cardRect.height) * 100}%`;
    qrWrapper.style.width = `${(bgWidth / cardRect.width) * 100}%`;
    qrWrapper.style.height = `${(bgHeight / cardRect.height) * 100}%`;
    qrWrapper.innerHTML = "";

    const bgClone = document.createElement("img");
    bgClone.src = qrBackgroundImg.getAttribute("src") || "";
    bgClone.alt = "QR Background";
    bgClone.style.position = "absolute";
    bgClone.style.left = "0";
    bgClone.style.top = "0";
    bgClone.style.width = "100%";
    bgClone.style.height = "100%";

    const qrClone = document.createElement("img");
    qrClone.src = src;
    qrClone.alt = "QR Code";
    qrClone.style.position = "absolute";
    qrClone.style.left = `${(qrOffsetLeft / bgWidth) * 100}%`;
    qrClone.style.top = `${(qrOffsetTop / bgHeight) * 100}%`;
    qrClone.style.width = `${(qrRect.width / bgWidth) * 100}%`;
    qrClone.style.height = `${(qrRect.height / bgHeight) * 100}%`;

    qrWrapper.appendChild(bgClone);
    qrWrapper.appendChild(qrClone);
    bgClone.style.pointerEvents = "none";
    qrClone.style.pointerEvents = "none";
    clampDraggableToCard(qrWrapper);
    return;
  }

  const qrRect = qrImg.getBoundingClientRect();
  const leftPx = qrRect.left - cardRect.left;
  const topPx = qrRect.top - cardRect.top;

  qrImg.remove();

  let qrPreview = document.getElementById("qrPreview");
  if (!qrPreview) {
    qrPreview = document.createElement("img");
    qrPreview.id = "qrPreview";
    qrPreview.className = "draggable";
    giftcard.appendChild(qrPreview);
  }

  qrPreview.src = src;
  qrPreview.alt = "QR Code";
  qrPreview.setAttribute("draggable", "false");
  qrPreview.style.left = `${(leftPx / cardRect.width) * 100}%`;
  qrPreview.style.top = `${(topPx / cardRect.height) * 100}%`;
  clampDraggableToCard(qrPreview);
}
function scaleTemplateToGiftcard() {
  const templateRoot = document.getElementById("templateRoot");
  if (!templateRoot) return;

  const baseWidth = giftcard.dataset.mode === "thumbnail" ? 3508 : 2480;
  const baseHeight = giftcard.dataset.mode === "thumbnail" ? 2480 : 3508;
  templateRoot.style.position = "relative";
  templateRoot.style.transformOrigin = "top left";
  templateRoot.style.width = `${baseWidth}px`;
  templateRoot.style.height = `${baseHeight}px`;
  templateRoot.style.zIndex = "1";

  requestAnimationFrame(() => {
    const scaleX = giftcard.clientWidth / baseWidth;
    const scaleY = giftcard.clientHeight / baseHeight;

    templateRoot.style.transform = `scale(${scaleX}, ${scaleY})`;
  });
}

function applySelectedOperatorTemplate() {
  const templateId = operatorSelect.value;
  if (!templateId) {
    setTemplateStatus("Choose a template first.", true);
    return;
  }

  const template = templatesById.get(templateId);
  if (!template) {
    setTemplateStatus("Selected operator template was not found.", true);
    return;
  }

  applyTemplateRecord(template);
}

function applyTemplateRecord(template) {
  if (!template || typeof template !== "object") {
    setTemplateStatus("Selected operator template was not found.", true);
    return false;
  }

  const htmlApplied = applyHtmlTemplate(template);
  if (htmlApplied) {
    const operatorId = getTemplateOperatorId(template) ?? "unknown";
    const templateName = getTemplateName(template);
    setTemplateStatus(`Template imported for ${operatorId} (${templateName}).`, false, 4000);
    emitEditorStateChange();
    return true;
  }

  const jsonCandidates = [
    template.layout,
    template.template,
    template.design,
    template.payload,
    parseJsonIfString(template.layoutJson),
    parseJsonIfString(template.templateJson),
    parseJsonIfString(template.json)
  ].filter(candidate => candidate && typeof candidate === "object");

  let applied = false;
  for (const layout of jsonCandidates) {
    try {
      applyLayoutState(layout);
      applied = true;
      break;
    } catch {
      // Try next candidate format.
    }
  }

  if (!applied) {
    applied = applyTemplateByFields(template);
  }

  if (!applied) {
    setTemplateStatus("Template format is not supported by the current importer.", true);
    return false;
  }

  const operatorId = getTemplateOperatorId(template) ?? "unknown";
  const templateName = getTemplateName(template);
  setTemplateStatus(`Template imported for ${operatorId} (${templateName}).`, false, 4000);
  emitEditorStateChange();
  return true;
}

async function fetchTemplates() {
  if (!getTemplateBtn || !operatorSelect) return;
  getTemplateBtn.disabled = true;
  clearOperatorSelect();
  setTemplateStatus("Loading templates...");

  try {
    let response = await fetch(templateApiUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        accept: "application/json"
      }
    });

    // No fallback needed; routing is case-insensitive.

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Template API request failed (${response.status}).`);
    }

    const rawBody = await response.text();
    const payload = rawBody ? JSON.parse(rawBody) : null;
    const templates = normalizeTemplatesPayload(payload);
    if (!templates.length) {
      setTemplateStatus("No templates returned by API.", true);
      return;
    }

    templatesById = new Map();
    const templateOptions = [];

    templates.forEach(template => {
      const operatorId = getTemplateOperatorId(template);
      const templateId = getTemplateId(template);
      if (!operatorId || !templateId) return;
      if (templatesById.has(templateId)) return;
      templatesById.set(templateId, template);
      templateOptions.push({
        templateId,
        operatorId,
        templateName: getTemplateName(template)
      });
    });

    if (!templateOptions.length) {
      setTemplateStatus("No operatorId/templateId values found in templates.", true);
      return;
    }

    operatorSelect.innerHTML = "";
    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.innerText = t("selectOperatorTemplate");
    operatorSelect.appendChild(defaultOption);

    templateOptions
      .sort((a, b) => {
        const operatorSort = a.operatorId.localeCompare(b.operatorId);
        if (operatorSort !== 0) return operatorSort;
        return a.templateName.localeCompare(b.templateName);
      })
      .forEach(optionData => {
        const option = document.createElement("option");
        option.value = optionData.templateId;
        option.innerText = `${optionData.operatorId} - ${optionData.templateName}`;
        operatorSelect.appendChild(option);
      });

    operatorSelect.disabled = false;
    setTemplateStatus(`Loaded ${templateOptions.length} templates.`, false, 4000);

    if (templateControls) {
      templateControls.hidden = false;
    }
  } catch (error) {
    console.error(error);
    setTemplateStatus("Could not load templates from API.", true);
  } finally {
    getTemplateBtn.disabled = false;
  }
}

if (getTemplateBtn && operatorSelect && templateStatus) {
  clearOperatorSelect();
  if (templateControls) {
    templateControls.hidden = true;
  }
  getTemplateBtn.addEventListener("click", fetchTemplates);
  operatorSelect.addEventListener("change", () => {
    if (!operatorSelect.value) return;
    applySelectedOperatorTemplate();
  });
}

if (premadeTemplatesBtn && premadeTemplateSelect) {
  initializePremadeTemplateSelect();
  if (premadeTemplateControls) {
    premadeTemplateControls.hidden = true;
  }
  premadeTemplatesBtn.addEventListener("click", togglePremadeTemplateControls);
  premadeTemplateSelect.addEventListener("change", () => {
    if (!premadeTemplateSelect.value) return;
    loadSelectedPremadeTemplate();
  });
}

if (newGiftcardBtn) {
  newGiftcardBtn.addEventListener("click", loadDefaultGiftcardLayout);
}

window.giftcardEditorApi = {
  applyLayoutState,
  createLayoutState,
  downloadLayoutJson,
  applyTemplateRecord,
  hydrateGiftcardFieldsFromApi
};









