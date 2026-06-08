import express from "express";
import session from "express-session";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdirSync } from "fs";

import { config } from "./config.js";
import {
  loginBizdesk,
  getCustomerOptionsLive,
  getReportFilters,
  getBalanceReport,
  getBalanceByRetailstoreReport,
  getDashboardOverview,
  resendDashboardGiftCard,
  cancelDashboardGiftCard,
  getTransactions,
  getReceiptGuid,
  searchCardholders,
  assignExistingCardToCardholder,
  listGiftcards,
  listRetailstoresForAccount,
  updateExpiry,
  updateCardBlockStatus,
  adjustGiftcardBalance,
  getGiftcardDetailsFromDb,
  getGiftcardMakerSession,
} from "./bizdesk.js";
import { proxyMps2 } from "./mps2.js";
import { getPool } from "./db.js";
import {
  getGiftcardMakerAuthStatus,
  getGiftcardMakerCompanies,
  getGiftcardTemplates,
  getGiftcardData,
  updateGiftcardMakerCompany,
  createSettingsTemplate,
  updateSettingsTemplate,
  deleteSettingsTemplate,
  getSettingsTemplatesDirect,
} from "./giftcardMaker.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const giftcardMakerAssetDirectory = path.resolve(__dirname, "../public/giftcard-maker-assets");

const giftcardMakerWebeditorLiveCanvasPatchScript = `
;(() => {
  if (typeof window === "undefined") return;
  if (window.__giftcardWebeditorLiveCanvasPatchApplied) return;
  window.__giftcardWebeditorLiveCanvasPatchApplied = true;

  const COMPANY_PAGE_BASE_URL = "https://presentkort.microdeb.se";
  const COMPANY_GUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let companyPageLoadedFor = "";

  function toTrimmedString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function parseOperatorIdsSafe(raw) {
    if (typeof parseOperatorIds === "function") {
      return parseOperatorIds(raw);
    }
    if (!raw || typeof raw !== "string") return [];
    return raw
      .split(/[\\s,;|]+/)
      .map((value) => value.trim())
      .filter(Boolean);
  }

  function looksLikeCompanyId(value) {
    const normalized = toTrimmedString(value);
    return COMPANY_GUID_REGEX.test(normalized);
  }

  function getCompanyIdFromRecord(company) {
    if (!company || typeof company !== "object") return "";
    const idCandidates = [company.companyId, company.companyID, company.companyid, company.id];
    for (const candidate of idCandidates) {
      const normalized = toTrimmedString(candidate);
      if (normalized) return normalized;
    }
    return "";
  }

  function getCompanyNameFromRecord(company) {
    if (!company || typeof company !== "object") return "";
    const nameCandidates = [company.companyName, company.companyname, company.name];
    for (const candidate of nameCandidates) {
      const normalized = toTrimmedString(candidate);
      if (normalized) return normalized;
    }
    return "";
  }

  function collectCompanyRecords(node, output, depth = 0) {
    if (!node || depth > 4) return;
    if (Array.isArray(node)) {
      node.forEach((item) => collectCompanyRecords(item, output, depth + 1));
      return;
    }
    if (typeof node !== "object") return;

    const id = getCompanyIdFromRecord(node);
    const name = getCompanyNameFromRecord(node);
    const hasMarkup = typeof node.bannerHtml === "string" || typeof node.companyFooterHtml === "string";
    if (id || name || hasMarkup) {
      output.push(node);
    }

    Object.values(node).forEach((value) => {
      if (value && typeof value === "object") {
        collectCompanyRecords(value, output, depth + 1);
      }
    });
  }

  async function fetchCompaniesSafe() {
    try {
      const response = await fetch("/api/companies", { credentials: "same-origin" });
      if (!response.ok) return [];
      const payload = await response.json();
      const output = [];
      collectCompanyRecords(payload, output);
      return output;
    } catch {
      return [];
    }
  }

  function getStatusCompanyIdCandidates() {
    const status = currentAuthStatus || {};
    const candidates = [];

    const pushCandidate = (value) => {
      const normalized = toTrimmedString(value);
      if (normalized) {
        candidates.push(normalized);
      }
    };

    pushCandidate(activeCompanyId);
    pushCandidate(activeOperatorId);
    pushCandidate(status.operatorId);
    parseOperatorIdsSafe(status.operatorIds).forEach(pushCandidate);
    return Array.from(new Set(candidates));
  }

  function pickCompanyRecord(companies, candidates) {
    if (!Array.isArray(companies) || companies.length === 0) return null;
    if (!Array.isArray(candidates) || candidates.length === 0) return companies[0];

    const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());

    for (const company of companies) {
      const companyId = getCompanyIdFromRecord(company).toLowerCase();
      if (companyId && normalizedCandidates.includes(companyId)) {
        return company;
      }
    }

    for (const company of companies) {
      const companyName = getCompanyNameFromRecord(company).toLowerCase();
      if (companyName && normalizedCandidates.includes(companyName)) {
        return company;
      }
    }

    for (const company of companies) {
      const companyName = getCompanyNameFromRecord(company).toLowerCase();
      if (!companyName) continue;
      if (normalizedCandidates.some((candidate) => companyName.includes(candidate))) {
        return company;
      }
    }

    return companies[0];
  }

  function syncCompanyMarkupCache(companyRecord) {
    if (!companyRecord || typeof companyRecord !== "object") return;
    if (typeof companyMarkupCache !== "object" || !companyMarkupCache) return;

    if (typeof companyRecord.bannerHtml === "string") {
      companyMarkupCache.bannerHtml = companyRecord.bannerHtml;
    }
    if (typeof companyRecord.companyFooterHtml === "string") {
      companyMarkupCache.companyFooterHtml = companyRecord.companyFooterHtml;
    }
    companyCacheLoaded = true;
  }

  async function resolveActiveCompanyId() {
    const candidates = getStatusCompanyIdCandidates();
    const directGuid = candidates.find((candidate) => looksLikeCompanyId(candidate));
    if (directGuid) {
      activeCompanyId = directGuid;
      return directGuid;
    }

    const companies = await fetchCompaniesSafe();
    const matchedCompany = pickCompanyRecord(companies, candidates);
    if (!matchedCompany) {
      return "";
    }

    const matchedCompanyId = getCompanyIdFromRecord(matchedCompany);
    if (!matchedCompanyId) {
      return "";
    }

    activeCompanyId = matchedCompanyId;
    syncCompanyMarkupCache(matchedCompany);
    return matchedCompanyId;
  }

  function ensureBaseTag(documentNode, pageUrl) {
    if (!documentNode || !documentNode.head) return;
    if (documentNode.head.querySelector("base")) return;
    const base = documentNode.createElement("base");
    base.setAttribute("href", pageUrl);
    documentNode.head.prepend(base);
  }

  function extractInlineAssets(documentNode) {
    const cssParts = [];
    const jsParts = [];

    documentNode.querySelectorAll("style").forEach((styleNode) => {
      const css = typeof styleNode.textContent === "string" ? styleNode.textContent.trim() : "";
      if (css) cssParts.push(css);
      styleNode.remove();
    });

    documentNode.querySelectorAll("script:not([src])").forEach((scriptNode) => {
      const scriptType = toTrimmedString(scriptNode.getAttribute("type")).toLowerCase();
      const isJsType =
        !scriptType
        || scriptType === "text/javascript"
        || scriptType === "application/javascript"
        || scriptType === "module";
      if (!isJsType) return;
      const js = typeof scriptNode.textContent === "string" ? scriptNode.textContent.trim() : "";
      if (js) jsParts.push(js);
      scriptNode.remove();
    });

    return {
      css: cssParts.join("\\n\\n"),
      js: jsParts.join("\\n\\n"),
    };
  }

  function buildFullHtml(documentNode) {
    const doctype = documentNode.doctype
      ? "<!DOCTYPE " + documentNode.doctype.name + ">"
      : "<!doctype html>";
    return doctype + "\\n" + documentNode.documentElement.outerHTML;
  }

  function updatePreviewMeta(companyId) {
    const metaValue = document.querySelector(".preview-meta .meta-value");
    if (!metaValue) return;
    metaValue.textContent = companyId || "srcdoc";
  }

  async function loadLiveCanvasFromCompany(options = {}) {
    const force = options.force === true;
    const companyId = await resolveActiveCompanyId();
    if (!companyId) {
      setStatus("Could not resolve companyId for live canvas.", "error");
      return false;
    }

    if (!force && companyPageLoadedFor === companyId) {
      updatePreviewMeta(companyId);
      return true;
    }

    const pageUrl = COMPANY_PAGE_BASE_URL.replace(/\\/$/, "") + "/" + encodeURIComponent(companyId);
    const fetchUrl = "/api/fetch-html?url=" + encodeURIComponent(pageUrl);

    try {
      const response = await fetch(fetchUrl, { credentials: "same-origin" });
      if (!response.ok) {
        setStatus("Could not load live company page.", "error");
        return false;
      }

      const html = await response.text();
      const parser = new DOMParser();
      const documentNode = parser.parseFromString(html, "text/html");
      if (!documentNode || !documentNode.documentElement) {
        setStatus("Company page could not be parsed.", "error");
        return false;
      }

      ensureBaseTag(documentNode, pageUrl + "/");
      const assets = extractInlineAssets(documentNode);
      const fullHtml = buildFullHtml(documentNode);

      applyEditorState({
        html: fullHtml,
        css: assets.css,
        js: assets.js,
      });

      companyPageLoadedFor = companyId;
      updatePreviewMeta(companyId);
      setStatus("Loaded live canvas from company " + companyId, "ok");
      return true;
    } catch {
      setStatus("Could not load live company page.", "error");
      return false;
    }
  }

  const originalGetPreviewState = getPreviewState;
  getPreviewState = function patchedGetPreviewState() {
    if (activeEditorTarget === "web") {
      const state = getEditorState();
      return {
        html: state.html || "",
        css: state.css || "",
        js: state.js || "",
      };
    }
    return originalGetPreviewState();
  };

  const originalLoadEditorTargetContent = loadEditorTargetContent;
  loadEditorTargetContent = async function patchedLoadEditorTargetContent() {
    if (activeEditorTarget === "web") {
      const loaded = await loadLiveCanvasFromCompany({ force: true });
      if (loaded) return true;
    }
    return originalLoadEditorTargetContent();
  };

  const bootstrapLiveCanvasSync = async () => {
    let attempts = 0;
    while (!currentAuthStatus && attempts < 40) {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (activeEditorTarget === "web") {
      await loadLiveCanvasFromCompany({ force: true });
    }
  };

  void bootstrapLiveCanvasSync();
})();
`;
const giftcardMakerBackofficeShellStyles = `
<style id="giftcard-backoffice-shell">
  :root,
  :root[data-backoffice-theme="modern"] {
    --header-height: 72px;
    --backoffice-shell-font: "Segoe UI", "Aptos", sans-serif;
    --backoffice-shell-radius: 20px;
    --backoffice-shell-background: hsl(222 27% 96%);
    --backoffice-shell-background-2: hsl(200 52% 92%);
    --backoffice-shell-surface: hsl(0 0% 100% / 0.94);
    --backoffice-shell-surface-soft: hsl(210 31% 94%);
    --backoffice-shell-text: hsl(224 28% 14%);
    --backoffice-shell-muted: hsl(220 14% 41%);
    --backoffice-shell-primary: hsl(214 84% 56%);
    --backoffice-shell-primary-foreground: hsl(0 0% 100%);
    --backoffice-shell-accent: hsl(160 84% 39%);
    --backoffice-shell-border: hsl(220 20% 88%);
    --backoffice-shell-hover: hsl(210 31% 94%);
    --backoffice-shell-shadow: 0 24px 60px hsl(224 30% 20% / 0.18);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(224 30% 20% / 0.12);
    --backoffice-shell-glow: hsl(214 84% 56% / 0.18);
  }

  :root[data-backoffice-theme="microdeb"] {
    --backoffice-shell-font: "Montserrat", "Segoe UI", "Trebuchet MS", sans-serif;
    --backoffice-shell-radius: 18px;
    --backoffice-shell-background: hsl(210 30% 98%);
    --backoffice-shell-background-2: hsl(227 32% 90%);
    --backoffice-shell-surface: hsl(0 0% 100% / 0.96);
    --backoffice-shell-surface-soft: hsl(220 22% 94%);
    --backoffice-shell-text: hsl(219 22% 7%);
    --backoffice-shell-muted: hsl(220 10% 45%);
    --backoffice-shell-primary: hsl(95 54% 58%);
    --backoffice-shell-primary-foreground: hsl(219 22% 7%);
    --backoffice-shell-accent: hsl(227 42% 29%);
    --backoffice-shell-border: hsl(220 20% 84%);
    --backoffice-shell-hover: hsl(220 26% 95%);
    --backoffice-shell-shadow: 0 24px 60px hsl(227 42% 29% / 0.2);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(227 42% 29% / 0.14);
    --backoffice-shell-glow: hsl(95 54% 58% / 0.22);
  }

  :root[data-backoffice-theme="microdeb-dark"] {
    --backoffice-shell-font: "Montserrat", "Segoe UI", "Trebuchet MS", sans-serif;
    --backoffice-shell-radius: 18px;
    --backoffice-shell-background: hsl(227 42% 20%);
    --backoffice-shell-background-2: hsl(221 33% 26%);
    --backoffice-shell-surface: hsl(227 34% 24% / 0.97);
    --backoffice-shell-surface-soft: hsl(227 24% 30%);
    --backoffice-shell-text: hsl(0 0% 100%);
    --backoffice-shell-muted: hsl(220 19% 78%);
    --backoffice-shell-primary: hsl(95 61% 58%);
    --backoffice-shell-primary-foreground: hsl(219 22% 7%);
    --backoffice-shell-accent: hsl(227 27% 48%);
    --backoffice-shell-border: hsl(227 24% 38%);
    --backoffice-shell-hover: hsl(227 27% 28%);
    --backoffice-shell-shadow: 0 24px 60px hsl(0 0% 0% / 0.44);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(0 0% 0% / 0.3);
    --backoffice-shell-glow: hsl(95 61% 58% / 0.26);
  }

  :root[data-backoffice-theme="portal"] {
    --backoffice-shell-font: "Trebuchet MS", "Arial Narrow", sans-serif;
    --backoffice-shell-radius: 14px;
    --backoffice-shell-background: hsl(215 28% 9%);
    --backoffice-shell-background-2: hsl(215 21% 14%);
    --backoffice-shell-surface: hsl(215 24% 13% / 0.96);
    --backoffice-shell-surface-soft: hsl(214 18% 18%);
    --backoffice-shell-text: hsl(210 40% 96%);
    --backoffice-shell-muted: hsl(213 15% 72%);
    --backoffice-shell-primary: hsl(24 100% 56%);
    --backoffice-shell-primary-foreground: hsl(0 0% 100%);
    --backoffice-shell-accent: hsl(197 100% 58%);
    --backoffice-shell-border: hsl(213 21% 24%);
    --backoffice-shell-hover: hsl(210 20% 16%);
    --backoffice-shell-shadow: 0 24px 60px hsl(0 0% 0% / 0.42);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(0 0% 0% / 0.28);
    --backoffice-shell-glow: hsl(24 100% 56% / 0.2);
  }

  :root[data-backoffice-theme="wii"] {
    --backoffice-shell-font: Verdana, "Segoe UI", sans-serif;
    --backoffice-shell-radius: 30px;
    --backoffice-shell-background: hsl(200 56% 97%);
    --backoffice-shell-background-2: hsl(208 54% 90%);
    --backoffice-shell-surface: hsl(0 0% 100% / 0.97);
    --backoffice-shell-surface-soft: hsl(198 46% 93%);
    --backoffice-shell-text: hsl(210 30% 24%);
    --backoffice-shell-muted: hsl(210 18% 46%);
    --backoffice-shell-primary: hsl(199 89% 55%);
    --backoffice-shell-primary-foreground: hsl(0 0% 100%);
    --backoffice-shell-accent: hsl(188 83% 67%);
    --backoffice-shell-border: hsl(200 32% 85%);
    --backoffice-shell-hover: hsl(198 46% 93%);
    --backoffice-shell-shadow: 0 24px 60px hsl(199 89% 55% / 0.16);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(199 89% 55% / 0.12);
    --backoffice-shell-glow: hsl(199 89% 55% / 0.18);
  }

  :root[data-backoffice-theme="retro"] {
    --backoffice-shell-font: "Courier New", monospace;
    --backoffice-shell-radius: 4px;
    --backoffice-shell-background: hsl(120 16% 8%);
    --backoffice-shell-background-2: hsl(120 22% 12%);
    --backoffice-shell-surface: hsl(120 14% 11% / 0.97);
    --backoffice-shell-surface-soft: hsl(120 12% 14%);
    --backoffice-shell-text: hsl(120 100% 84%);
    --backoffice-shell-muted: hsl(120 36% 64%);
    --backoffice-shell-primary: hsl(120 100% 65%);
    --backoffice-shell-primary-foreground: hsl(120 16% 8%);
    --backoffice-shell-accent: hsl(49 100% 58%);
    --backoffice-shell-border: hsl(120 28% 22%);
    --backoffice-shell-hover: hsl(120 12% 14%);
    --backoffice-shell-shadow: 0 0 0 1px hsl(120 28% 22%), 0 0 28px hsl(120 100% 65% / 0.08);
    --backoffice-shell-shadow-soft: 0 0 0 1px hsl(120 28% 18%);
    --backoffice-shell-glow: hsl(120 100% 65% / 0.12);
  }

  :root[data-backoffice-theme="warm"] {
    --backoffice-shell-font: "Trebuchet MS", "Segoe UI", sans-serif;
    --backoffice-shell-radius: 28px;
    --backoffice-shell-background: hsl(30 50% 95%);
    --backoffice-shell-background-2: hsl(16 69% 87%);
    --backoffice-shell-surface: hsl(36 100% 98% / 0.96);
    --backoffice-shell-surface-soft: hsl(35 56% 91%);
    --backoffice-shell-text: hsl(18 34% 20%);
    --backoffice-shell-muted: hsl(20 18% 43%);
    --backoffice-shell-primary: hsl(17 78% 54%);
    --backoffice-shell-primary-foreground: hsl(36 100% 98%);
    --backoffice-shell-accent: hsl(43 90% 60%);
    --backoffice-shell-border: hsl(28 35% 84%);
    --backoffice-shell-hover: hsl(35 56% 91%);
    --backoffice-shell-shadow: 0 24px 60px hsl(17 78% 54% / 0.18);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(17 78% 54% / 0.12);
    --backoffice-shell-glow: hsl(17 78% 54% / 0.18);
  }

  :root[data-backoffice-theme="water"] {
    --backoffice-shell-font: "Segoe UI", "Aptos", sans-serif;
    --backoffice-shell-radius: 24px;
    --backoffice-shell-background: hsl(248 42% 8%);
    --backoffice-shell-background-2: hsl(201 88% 10%);
    --backoffice-shell-surface: hsl(248 36% 14% / 0.96);
    --backoffice-shell-surface-soft: hsl(248 24% 17%);
    --backoffice-shell-text: hsl(210 100% 96%);
    --backoffice-shell-muted: hsl(225 16% 72%);
    --backoffice-shell-primary: hsl(319 100% 58%);
    --backoffice-shell-primary-foreground: hsl(0 0% 100%);
    --backoffice-shell-accent: hsl(194 100% 58%);
    --backoffice-shell-border: hsl(249 24% 27%);
    --backoffice-shell-hover: hsl(248 28% 18%);
    --backoffice-shell-shadow: 0 24px 60px hsl(319 100% 58% / 0.24);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(194 100% 58% / 0.12);
    --backoffice-shell-glow: hsl(319 100% 58% / 0.22);
  }

  :root[data-backoffice-theme="galaxy"] {
    --backoffice-shell-font: "Segoe UI", "Trebuchet MS", sans-serif;
    --backoffice-shell-radius: 22px;
    --backoffice-shell-background: hsl(245 34% 9%);
    --backoffice-shell-background-2: hsl(216 55% 16%);
    --backoffice-shell-surface: hsl(246 31% 14% / 0.96);
    --backoffice-shell-surface-soft: hsl(241 25% 18%);
    --backoffice-shell-text: hsl(226 100% 96%);
    --backoffice-shell-muted: hsl(227 33% 73%);
    --backoffice-shell-primary: hsl(282 85% 66%);
    --backoffice-shell-primary-foreground: hsl(0 0% 100%);
    --backoffice-shell-accent: hsl(195 95% 61%);
    --backoffice-shell-border: hsl(244 22% 24%);
    --backoffice-shell-hover: hsl(241 25% 18%);
    --backoffice-shell-shadow: 0 24px 60px hsl(282 85% 66% / 0.18);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(282 85% 66% / 0.12);
    --backoffice-shell-glow: hsl(282 85% 66% / 0.18);
  }

  :root[data-backoffice-theme="wood"] {
    --backoffice-shell-font: Georgia, "Trebuchet MS", serif;
    --backoffice-shell-radius: 18px;
    --backoffice-shell-background: hsl(33 28% 92%);
    --backoffice-shell-background-2: hsl(25 33% 82%);
    --backoffice-shell-surface: hsl(34 42% 97% / 0.96);
    --backoffice-shell-surface-soft: hsl(32 30% 87%);
    --backoffice-shell-text: hsl(24 31% 19%);
    --backoffice-shell-muted: hsl(24 16% 40%);
    --backoffice-shell-primary: hsl(28 52% 37%);
    --backoffice-shell-primary-foreground: hsl(33 30% 96%);
    --backoffice-shell-accent: hsl(18 60% 54%);
    --backoffice-shell-border: hsl(29 24% 76%);
    --backoffice-shell-hover: hsl(32 30% 87%);
    --backoffice-shell-shadow: 0 24px 60px hsl(28 52% 37% / 0.18);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(28 52% 37% / 0.12);
    --backoffice-shell-glow: hsl(28 52% 37% / 0.18);
  }

  :root[data-backoffice-theme="swamp"] {
    --backoffice-shell-font: "Trebuchet MS", "Segoe UI", sans-serif;
    --backoffice-shell-radius: 16px;
    --backoffice-shell-background: hsl(104 18% 14%);
    --backoffice-shell-background-2: hsl(84 19% 18%);
    --backoffice-shell-surface: hsl(102 16% 18% / 0.96);
    --backoffice-shell-surface-soft: hsl(94 15% 22%);
    --backoffice-shell-text: hsl(84 25% 88%);
    --backoffice-shell-muted: hsl(88 14% 66%);
    --backoffice-shell-primary: hsl(82 41% 43%);
    --backoffice-shell-primary-foreground: hsl(84 25% 92%);
    --backoffice-shell-accent: hsl(153 38% 39%);
    --backoffice-shell-border: hsl(93 16% 28%);
    --backoffice-shell-hover: hsl(94 15% 22%);
    --backoffice-shell-shadow: 0 24px 60px hsl(0 0% 0% / 0.28);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(0 0% 0% / 0.2);
    --backoffice-shell-glow: hsl(153 38% 39% / 0.16);
  }

  :root[data-backoffice-theme="autumn"] {
    --backoffice-shell-font: "Trebuchet MS", "Segoe UI", sans-serif;
    --backoffice-shell-radius: 26px;
    --backoffice-shell-background: hsl(30 54% 95%);
    --backoffice-shell-background-2: hsl(9 72% 84%);
    --backoffice-shell-surface: hsl(38 100% 98% / 0.97);
    --backoffice-shell-surface-soft: hsl(34 56% 90%);
    --backoffice-shell-text: hsl(13 33% 20%);
    --backoffice-shell-muted: hsl(14 18% 43%);
    --backoffice-shell-primary: hsl(18 78% 47%);
    --backoffice-shell-primary-foreground: hsl(38 100% 98%);
    --backoffice-shell-accent: hsl(41 95% 57%);
    --backoffice-shell-border: hsl(26 35% 82%);
    --backoffice-shell-hover: hsl(34 56% 90%);
    --backoffice-shell-shadow: 0 24px 60px hsl(18 78% 47% / 0.16);
    --backoffice-shell-shadow-soft: 0 16px 40px hsl(18 78% 47% / 0.1);
    --backoffice-shell-glow: hsl(18 78% 47% / 0.16);
  }

  html {
    background:
      radial-gradient(circle at top right, var(--backoffice-shell-glow), transparent 26%),
      linear-gradient(135deg, var(--backoffice-shell-background), var(--backoffice-shell-background-2));
  }

  body {
    background:
      radial-gradient(circle at top right, var(--backoffice-shell-glow), transparent 26%),
      linear-gradient(135deg, var(--backoffice-shell-background), var(--backoffice-shell-background-2)) !important;
    color: var(--backoffice-shell-text) !important;
    font-family: var(--backoffice-shell-font);
    --app-bg: var(--backoffice-shell-background);
    --app-text: var(--backoffice-shell-text);
    --surface-strong: var(--backoffice-shell-surface);
    --surface-soft: var(--backoffice-shell-surface-soft);
    --surface-input: var(--backoffice-shell-surface);
    --surface-input-soft: var(--backoffice-shell-surface-soft);
    --border: var(--backoffice-shell-border);
    --border-strong: var(--backoffice-shell-border);
    --text-muted: var(--backoffice-shell-muted);
    --text-soft: var(--backoffice-shell-text);
    --accent: var(--backoffice-shell-primary);
    --accent-strong: var(--backoffice-shell-primary);
    --accent-soft: var(--backoffice-shell-accent);
    --accent-text: var(--backoffice-shell-primary-foreground);
    --status-ok: hsl(142 76% 36%);
    --status-error: hsl(0 84% 60%);
    --button-bg: linear-gradient(180deg, var(--backoffice-shell-surface) 0%, var(--backoffice-shell-surface-soft) 100%);
    --button-active-bg: linear-gradient(180deg, var(--backoffice-shell-primary) 0%, var(--backoffice-shell-primary) 100%);
    --shadow-soft: var(--backoffice-shell-shadow-soft);
    --shadow-strong: var(--backoffice-shell-shadow);
    --shadow-hover: var(--backoffice-shell-shadow);
    --panel-bg: var(--backoffice-shell-surface);
    --panel-border: var(--backoffice-shell-border);
    --panel-title: var(--backoffice-shell-text);
    --panel-kicker: var(--backoffice-shell-muted);
    --panel-body: var(--backoffice-shell-text);
    --panel-muted: var(--backoffice-shell-muted);
  }

  body[data-hide-backoffice-header="true"] {
    --header-height: 0px;
  }

  :root[data-backoffice-theme="warm"] html,
  :root[data-backoffice-theme="warm"] body {
    background:
      radial-gradient(58% 110% at 0% 50%, hsl(17 78% 54% / 0.42), transparent 70%),
      radial-gradient(55% 110% at 100% 46%, hsl(43 90% 60% / 0.4), transparent 72%),
      radial-gradient(circle at 50% 12%, hsl(36 100% 98% / 0.75), transparent 38%),
      linear-gradient(148deg, hsl(36 100% 98%), hsl(33 66% 92%) 54%, hsl(16 69% 86%)) !important;
  }

  :root[data-backoffice-theme="water"] html,
  :root[data-backoffice-theme="water"] body {
    background:
      radial-gradient(74% 126% at 0% 100%, hsl(319 100% 58% / 0.7) 0 32%, transparent 66%),
      radial-gradient(74% 126% at 100% 100%, hsl(194 100% 58% / 0.6) 0 30%, transparent 66%),
      radial-gradient(48% 92% at 50% 82%, hsl(282 90% 62% / 0.4) 0 24%, transparent 56%),
      radial-gradient(40% 50% at 26% 58%, hsl(319 100% 80% / 0.24), transparent 72%),
      radial-gradient(40% 50% at 74% 56%, hsl(194 100% 78% / 0.2), transparent 72%),
      linear-gradient(180deg, hsl(0 0% 0% / 0.38), transparent 36%),
      linear-gradient(160deg, hsl(251 62% 5%), hsl(274 52% 9%) 46%, hsl(202 88% 9%)) !important;
  }

  :root[data-backoffice-theme="wood"] html,
  :root[data-backoffice-theme="wood"] body {
    background:
      repeating-linear-gradient(
        92deg,
        hsl(28 52% 37% / 0.16) 0 3px,
        hsl(28 33% 55% / 0.08) 3px 9px,
        hsl(24 30% 44% / 0.12) 9px 16px,
        transparent 16px 30px
      ),
      radial-gradient(26% 18% at 22% 34%, hsl(24 44% 35% / 0.14), transparent 70%),
      radial-gradient(22% 16% at 72% 62%, hsl(18 47% 43% / 0.12), transparent 72%),
      linear-gradient(155deg, hsl(37 39% 95%), hsl(33 29% 89%) 55%, hsl(25 33% 82%)) !important;
  }

  .top-nav,
  .webeditor-operator-bar .operator-switch {
    border: 1px solid var(--backoffice-shell-border);
    background: var(--backoffice-shell-surface);
    box-shadow: var(--backoffice-shell-shadow-soft);
  }

  .backoffice-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 320;
    border-bottom: 1px solid var(--backoffice-shell-border);
    background: color-mix(in srgb, var(--backoffice-shell-surface) 88%, transparent);
    backdrop-filter: blur(18px);
    box-shadow: 0 1px 0 hsl(0 0% 100% / 0.12);
  }

  .backoffice-header__inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    min-height: var(--header-height);
    padding: 0 22px;
  }

  .backoffice-header__brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: var(--backoffice-shell-text);
    text-decoration: none;
    flex-shrink: 0;
  }

  .backoffice-header__brand-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: calc(var(--backoffice-shell-radius) * 0.75);
    background: linear-gradient(135deg, var(--backoffice-shell-primary), var(--backoffice-shell-accent));
    color: var(--backoffice-shell-primary-foreground);
    font-size: 18px;
    font-weight: 700;
    box-shadow: 0 18px 40px -24px var(--backoffice-shell-glow);
  }

  .backoffice-header__brand-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .backoffice-header__brand-text {
    font-size: 18px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .backoffice-header__brand-kicker {
    color: var(--backoffice-shell-muted);
    font-size: 11px;
    letter-spacing: 0.28em;
    text-transform: uppercase;
  }

  .backoffice-header__nav {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    flex: 1 1 auto;
    overflow: visible;
    scrollbar-width: none;
  }

  .backoffice-header__nav::-webkit-scrollbar {
    display: none;
  }

  .backoffice-header__link,
  .backoffice-header__summary,
  .backoffice-header__action,
  .backoffice-header__menu a,
  .backoffice-header__menu button {
    color: var(--backoffice-shell-muted);
    text-decoration: none;
    white-space: nowrap;
    font-size: 14px;
    font-weight: 500;
  }

  .backoffice-header__link,
  .backoffice-header__summary,
  .backoffice-header__action {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 0 12px;
    border-radius: 999px;
    border: 0;
    background: transparent;
    cursor: pointer;
    transition: background-color 160ms ease, color 160ms ease, box-shadow 160ms ease;
  }

  :root[data-backoffice-theme="retro"] .backoffice-header__link,
  :root[data-backoffice-theme="retro"] .backoffice-header__summary,
  :root[data-backoffice-theme="retro"] .backoffice-header__action {
    border-radius: 4px;
  }

  .backoffice-header__link:hover,
  .backoffice-header__summary:hover,
  .backoffice-header__summary:focus-visible,
  .backoffice-header__action:hover,
  .backoffice-header__action:focus-visible {
    background: var(--backoffice-shell-hover) !important;
    color: var(--backoffice-shell-text) !important;
  }

  .backoffice-header__link.is-active,
  .backoffice-header__summary.is-active,
  .backoffice-header__dropdown[open] > .backoffice-header__summary,
  .backoffice-header__dropdown[open] > .backoffice-header__action {
    background: var(--backoffice-shell-primary);
    color: var(--backoffice-shell-primary-foreground);
    box-shadow: 0 18px 40px -24px var(--backoffice-shell-glow);
  }

  .backoffice-header__dropdown {
    position: relative;
  }

  .backoffice-header__summary {
    list-style: none;
  }

  .backoffice-header__summary::-webkit-details-marker {
    display: none;
  }

  .backoffice-header__caret {
    font-size: 11px;
  }

  .backoffice-header__menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 210px;
    padding: 8px;
    border-radius: calc(var(--backoffice-shell-radius) * 0.8);
    border: 1px solid var(--backoffice-shell-border);
    background: var(--backoffice-shell-surface);
    box-shadow: var(--backoffice-shell-shadow);
    z-index: 340;
  }

  :root[data-backoffice-theme="retro"] .backoffice-header__menu {
    border-radius: 4px;
  }

  .backoffice-header__dropdown--theme .backoffice-header__menu {
    right: 0;
    left: auto;
    min-width: 150px;
    padding: 8px;
  }

  .backoffice-header__theme-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }

  .backoffice-header__dropdown--theme .backoffice-header__menu button {
    justify-content: center;
    align-items: center;
    width: 28px;
    height: 28px;
    padding: 0;
    gap: 0;
    border-radius: 10px;
  }

  .backoffice-header__menu a,
  .backoffice-header__menu button {
    display: flex;
    width: 100%;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    border: 0;
    border-radius: calc(var(--backoffice-shell-radius) * 0.65);
    background: transparent;
    text-align: left;
    cursor: pointer;
  }

  :root[data-backoffice-theme="retro"] .backoffice-header__menu a,
  :root[data-backoffice-theme="retro"] .backoffice-header__menu button {
    border-radius: 4px;
  }

  .backoffice-header__menu a:hover,
  .backoffice-header__menu a.is-active,
  .backoffice-header__menu button:hover,
  .backoffice-header__menu button.is-active {
    background: var(--backoffice-shell-hover);
    color: var(--backoffice-shell-text);
  }

  .backoffice-header__theme-dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    background: var(--backoffice-shell-primary);
    border: 1px solid hsl(0 0% 100% / 0.28);
    flex-shrink: 0;
  }

  :root[data-backoffice-theme="retro"] .backoffice-header__theme-dot {
    border-radius: 2px;
  }

  .backoffice-header__theme-current {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    border: 1px solid hsl(0 0% 100% / 0.28);
    background: var(--backoffice-shell-primary);
    box-shadow: 0 0 0 1px hsl(0 0% 0% / 0.18);
  }

  .backoffice-header__theme-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .backoffice-header__theme-title {
    color: var(--backoffice-shell-text);
    font-size: 13px;
    font-weight: 600;
  }

  .backoffice-header__theme-description {
    color: var(--backoffice-shell-muted);
    font-size: 12px;
    line-height: 1.45;
    white-space: normal;
  }

  .backoffice-header__meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .backoffice-header__user {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: var(--backoffice-shell-muted);
    font-size: 14px;
    white-space: nowrap;
  }

  .backoffice-header__user-icon,
  .backoffice-header__action-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    color: currentColor;
    font-size: 14px;
    line-height: 1;
  }

  /* Match icon style with backoffice: neutral, monochrome outline icons. */
  body :is(
    i.fa,
    i.fas,
    i.far,
    i.fal,
    i.fat,
    i.fa-solid,
    i.fa-regular,
    i.fa-light,
    i.fa-thin,
    i.fa-duotone,
    i.fad,
    .svg-inline--fa,
    [class^="icon-"],
    [class*=" icon-"]
  ) {
    color: currentColor !important;
    filter: none !important;
    box-shadow: none !important;
  }

  body :is(
    i.fa,
    i.fas,
    i.far,
    i.fal,
    i.fat,
    i.fa-solid,
    i.fa-regular,
    i.fa-light,
    i.fa-thin,
    i.fa-duotone,
    i.fad
  ) {
    -webkit-text-stroke: 1.05px currentColor;
    color: transparent !important;
    font-weight: 400 !important;
  }

  body :is(.svg-inline--fa, [class*="icon"] svg, svg[class*="icon"]) {
    fill: none !important;
    stroke: currentColor !important;
    stroke-width: 1.75 !important;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  body [class*="icon-container"] {
    background: transparent !important;
    box-shadow: none !important;
  }

  /* Thumbnail mode: use A4 landscape proportions and avoid full-height panel stretch. */
  body.thumbnail-mode .layout {
    align-items: start !important;
    min-height: auto !important;
  }

  body.thumbnail-mode .menu-panel,
  body.thumbnail-mode .detail-panel,
  body.thumbnail-mode .preview-wrapper {
    align-self: start !important;
    min-height: unset !important;
    max-height: clamp(
      420px,
      calc(100vh - (var(--header-height) + var(--top-nav-height) + 120px)),
      840px
    ) !important;
  }

  body.thumbnail-mode #giftcard {
    width: min(100%, 860px) !important;
    max-width: 860px !important;
    aspect-ratio: 3508 / 2480 !important;
    margin-inline: auto;
  }

  .webeditor-operator-bar {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: -4px;
  }

  .webeditor-operator-bar .operator-switch {
    margin-right: 0;
  }

  @media (max-width: 1100px) {
    .backoffice-header__inner {
      padding: 0 16px;
      gap: 14px;
    }

    .backoffice-header__user,
    .backoffice-header__action-label {
      display: none;
    }
  }

  @media (max-width: 860px) {
    .backoffice-header__inner {
      min-height: auto;
      padding-top: 10px;
      padding-bottom: 10px;
      flex-wrap: wrap;
    }

    .backoffice-header__nav {
      order: 3;
      flex-basis: 100%;
      padding-bottom: 6px;
    }
  }
</style>`;
const giftcardMakerBackofficeShellScript = `
<script id="giftcard-backoffice-shell-script">
  (function () {
    const validThemes = ["modern", "microdeb-dark", "warm", "water"];
    const themeSwatches = {
      modern: "hsl(214 84% 56%)",
      "microdeb-dark": "hsl(95 61% 58%)",
      warm: "hsl(17 78% 54%)",
      water: "hsl(319 100% 58%)",
    };
    const usernameElement = document.getElementById("backofficeUserName");
    const themeSwatchElement = document.getElementById("giftcardThemeSwatch");
    const logoutButton = document.getElementById("logoutBtn");

    function normalizeTheme(theme) {
      return validThemes.includes(theme) ? theme : "modern";
    }

    function applyTheme(theme, options) {
      const normalizedTheme = normalizeTheme(theme);
      const notifyParent = !options || options.notifyParent !== false;
      const persist = !options || options.persist !== false;

      document.documentElement.dataset.backofficeTheme = normalizedTheme;
      if (document.body) {
        document.body.dataset.backofficeTheme = normalizedTheme;
      }

      if (persist) {
        window.localStorage.setItem("backoffice-theme", normalizedTheme);
      }

      document.querySelectorAll("[data-theme-option]").forEach((button) => {
        const optionKey = button.getAttribute("data-theme-option");
        const isActive = optionKey === normalizedTheme;
        button.classList.toggle("is-active", isActive);
        const dot = button.querySelector(".backoffice-header__theme-dot");
        if (dot && optionKey && themeSwatches[optionKey]) {
          dot.style.background = themeSwatches[optionKey];
        }
      });

      if (themeSwatchElement) {
        themeSwatchElement.style.background = themeSwatches[normalizedTheme] || themeSwatches.modern;
      }

      if (notifyParent && window.parent && window.parent !== window) {
        window.parent.postMessage({ type: "backoffice-theme", theme: normalizedTheme }, window.location.origin);
      }
    }

    const storedTheme = window.localStorage.getItem("backoffice-theme");
    applyTheme(storedTheme, { notifyParent: false, persist: false });

    if (usernameElement) {
      fetch("/api/auth/me", { credentials: "same-origin" })
        .then((response) => response.ok ? response.json() : null)
        .then((payload) => {
          if (!payload || !payload.username) return;
          usernameElement.textContent = payload.username;
        })
        .catch(() => {});
    }

    const dropdowns = Array.from(document.querySelectorAll(".backoffice-header__dropdown"));

    function closeOtherDropdowns(currentDropdown) {
      dropdowns.forEach((other) => {
        if (other !== currentDropdown) {
          other.open = false;
        }
      });
    }

    dropdowns.forEach((dropdown) => {
      const summary = dropdown.querySelector(":scope > summary");
      if (!(summary instanceof HTMLElement)) return;

      summary.addEventListener("click", (event) => {
        // Force deterministic toggle so host-page listeners cannot swallow the click.
        event.preventDefault();
        event.stopPropagation();
        const shouldOpen = !dropdown.open;
        closeOtherDropdowns(dropdown);
        dropdown.open = shouldOpen;
      });

      summary.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        const shouldOpen = !dropdown.open;
        closeOtherDropdowns(dropdown);
        dropdown.open = shouldOpen;
      });

      dropdown.addEventListener("toggle", () => {
        if (!dropdown.open) return;
        closeOtherDropdowns(dropdown);
      });
    });

    document.querySelectorAll("[data-theme-option]").forEach((button) => {
      button.addEventListener("click", () => {
        applyTheme(button.getAttribute("data-theme-option"));
        const dropdown = button.closest(".backoffice-header__dropdown");
        if (dropdown) {
          dropdown.open = false;
        }
      });
    });

    if (logoutButton) {
      logoutButton.addEventListener("click", async () => {
        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "same-origin",
          });
        } catch {}

        if (window.top && window.top !== window) {
          window.top.location.href = "/login";
          return;
        }

        window.location.href = "/login";
      });
    }

    document.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      document.querySelectorAll(".backoffice-header__dropdown[open]").forEach((dropdown) => {
        if (!dropdown.contains(target)) {
          dropdown.open = false;
        }
      });
    });

    window.addEventListener("message", (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== "backoffice-theme") return;
      applyTheme(event.data.theme, { notifyParent: false });
    });

    window.addEventListener("storage", (event) => {
      if (event.key !== "backoffice-theme") return;
      applyTheme(event.newValue, { notifyParent: false, persist: false });
    });
  })();
</script>`;

function applyGiftcardMakerCookies(res, options = {}) {
  const operatorIds = options?.operatorIds || [];
  const companyIds = options?.companyIds || [];
  const primaryOperatorId = operatorIds[0] || "";
  const primaryCompanyId = companyIds[0] || "";
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax",
    secure: config.cookieSecure,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  };

  res.cookie("giftcard_auth", "1", cookieOptions);
  res.cookie("giftcard_role", "operator", cookieOptions);
  res.cookie("giftcard_operator", primaryOperatorId, cookieOptions);
  res.cookie("giftcard_operator_ids", operatorIds.join(","), cookieOptions);
  if (primaryCompanyId) {
    res.cookie("giftcard_company_id", primaryCompanyId, cookieOptions);
  }
  if (companyIds.length > 0) {
    res.cookie("giftcard_company_ids", companyIds.join(","), cookieOptions);
  }
}

app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));

app.use(
  session({
    name: "bizdesk.sid",
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: config.cookieSecure,
    },
  })
);

app.get("/login.html", (_req, res) => {
  res.redirect("/login");
});

app.get("/giftcard-maker-assets/*", (req, res) => {
  const requestedPath = req.path.replace(/^\/giftcard-maker-assets/, "");
  const resolvedPath = path.resolve(giftcardMakerAssetDirectory, `.${requestedPath}`);
  if (!resolvedPath.startsWith(giftcardMakerAssetDirectory)) {
    return res.status(403).send("Otillåten sökväg");
  }
  return res.sendFile(resolvedPath, (error) => {
    if (error && !res.headersSent) {
      res.status(error.statusCode || 404).send("Filen hittades inte");
    }
  });
});

function requireSession(req, res, options = {}) {
  if (!req.session || !req.session.bizdesk) {
    if (options.redirectToLogin) {
      res.redirect("/login");
    } else {
      res.status(401).json({ error: "No session" });
    }
    return null;
  }
  return req.session.bizdesk;
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password, supportId } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Missing credentials" });
    }

    const result = await loginBizdesk({ username, password, supportId });

    if (result.needsSupportSelection) {
      return res.status(200).json({
        needsSupportSelection: true,
        supportOptions: result.supportOptions || [],
        loginVersion: result.loginVersion,
      });
    }

    if (!result.success) {
      return res.status(401).json({
        error: result.error || "Inloggning misslyckades",
        loginVersion: result.loginVersion,
        details: result.details,
      });
    }

    req.session.bizdesk = {
      cookies: result.cookies,
      selectedCustomerId: result.selectedCustomerId || null,
      needsCustomer: !!result.needsCustomer,
      customerOptions: result.customerOptions || [],
      username,
      role: result.role || "Kundsupport",
      authSource: result.authSource || "bizdesk",
    };

    return res.status(200).json({
      success: true,
      role: req.session.bizdesk.role,
      needsCustomer: req.session.bizdesk.needsCustomer,
      selectedCustomerId: req.session.bizdesk.selectedCustomerId,
      loginVersion: result.loginVersion,
      authSource: req.session.bizdesk.authSource,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(502).json({ error: "Login gateway error", details: String(error) });
  }
});

app.post("/api/auth/logout", (req, res) => {
  if (!req.session) return res.json({ success: true });
  res.clearCookie("giftcard_auth", { path: "/" });
  res.clearCookie("giftcard_role", { path: "/" });
  res.clearCookie("giftcard_operator", { path: "/" });
  res.clearCookie("giftcard_operator_ids", { path: "/" });
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

app.get("/api/auth/me", (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    sessionData.needsCustomer = true;
  }
  res.json({
    authenticated: true,
    username: sessionData.username || "user",
    role: sessionData.role || "Kundsupport",
    needsCustomer: !!sessionData.needsCustomer,
    selectedCustomerId: sessionData.selectedCustomerId,
    selectedCustomerLabel: sessionData.selectedCustomerLabel || sessionData.selectedCustomerId,
  });
});

app.get("/api/customers", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;

  let customerOptions = sessionData.customerOptions || [];
  const shouldRefresh = sessionData.needsCustomer && customerOptions.length <= 1;
  if (customerOptions.length === 0 || shouldRefresh) {
    const liveOptions = await getCustomerOptionsLive(sessionData);
    if (liveOptions.length > 0) {
      customerOptions = liveOptions;
      sessionData.customerOptions = liveOptions;
    }
  }

  if (customerOptions.length === 0) {
    return res.status(502).json({ error: "Kunde inte hämta kundlistan" });
  }

  return res.json({ customers: customerOptions });
});

app.post("/api/customers/select", (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { customerId, customerLabel } = req.body || {};
  if (!customerId) return res.status(400).json({ error: "Missing customerId" });

  const normalizedCustomerId = String(customerId);
  const resolvedLabel = String(customerLabel || "").trim()
    || (Array.isArray(sessionData.customerOptions)
      ? String(
        sessionData.customerOptions.find((option) => String(option?.value || "") === normalizedCustomerId)?.label || ""
      ).trim()
      : "");

  sessionData.selectedCustomerId = customerId;
  sessionData.selectedCustomerLabel = resolvedLabel || normalizedCustomerId;
  sessionData.needsCustomer = false;
  return res.json({ success: true, selectedCustomerLabel: sessionData.selectedCustomerLabel });
});

app.get("/api/report/filters", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }
  try {
    const filterOptions = await getReportFilters(sessionData);
    return res.json({ filterOptions });
  } catch (error) {
    console.error("Report filters error:", error);
    return res.status(502).json({ error: "Kunde inte hämta filter" });
  }
});

app.post("/api/report/balances", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }
  try {
    const result = await getBalanceReport(sessionData, req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Kunde inte hämta saldo-rapport" });
    }
    return res.json(result);
  } catch (error) {
    console.error("Balance report error:", error);
    return res.status(502).json({ error: "Kunde inte hämta saldo-rapport" });
  }
});

app.post("/api/report/balances-by-retailstore", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }
  try {
    const result = await getBalanceByRetailstoreReport(sessionData, req.body || {});
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Kunde inte hämta saldo-rapport per säljställe" });
    }
    return res.json(result);
  } catch (error) {
    console.error("Balance by retailstore report error:", error);
    return res.status(502).json({ error: "Kunde inte hämta saldo-rapport per säljställe" });
  }
});

app.get("/api/dashboard", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }
  try {
    const options = {
      period: typeof req.query.period === "string" ? req.query.period : "",
      comparison: typeof req.query.comparison === "string" ? req.query.comparison : "",
      multiples: typeof req.query.multiples === "string" ? req.query.multiples : "",
      latestSalesLimit: typeof req.query.latestSalesLimit === "string" ? req.query.latestSalesLimit : "",
      currentFrom: typeof req.query.currentFrom === "string" ? req.query.currentFrom : "",
      currentTo: typeof req.query.currentTo === "string" ? req.query.currentTo : "",
      compareFrom: typeof req.query.compareFrom === "string" ? req.query.compareFrom : "",
      compareTo: typeof req.query.compareTo === "string" ? req.query.compareTo : "",
    };
    const result = await getDashboardOverview(sessionData, options);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Kunde inte hämta översikten" });
    }
    return res.json(result);
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(502).json({ error: "Kunde inte hämta översikten" });
  }
});

app.post("/api/dashboard/orders/:orderId/gift-cards/:giftCardId/resend", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }

  const orderId = String(req.params.orderId || "").trim();
  const giftCardId = String(req.params.giftCardId || "").trim();
  if (!orderId || !giftCardId) {
    return res.status(400).json({ error: "orderId och giftCardId är obligatoriska" });
  }

  try {
    const { sendToOriginal, manualEmail } = req.body || {};
    const result = await resendDashboardGiftCard(sessionData, { orderId, giftCardId, sendToOriginal, manualEmail });
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error || "Kunde inte skicka om presentkortet" });
    }
    return res.json(result);
  } catch (error) {
    console.error("Dashboard resend gift card error:", error);
    return res.status(502).json({ error: "Kunde inte skicka om presentkortet" });
  }
});

app.post("/api/dashboard/orders/:orderId/gift-cards/:giftCardId/cancel", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }

  const orderId = String(req.params.orderId || "").trim();
  const giftCardId = String(req.params.giftCardId || "").trim();
  if (!orderId || !giftCardId) {
    return res.status(400).json({ error: "orderId och giftCardId är obligatoriska" });
  }

  try {
    const result = await cancelDashboardGiftCard(sessionData, { orderId, giftCardId });
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error || "Kunde inte avbryta presentkortet" });
    }
    return res.json(result);
  } catch (error) {
    console.error("Dashboard cancel gift card error:", error);
    return res.status(502).json({ error: "Kunde inte avbryta presentkortet" });
  }
});

app.post("/api/report/transactions", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }
  try {
    const result = await getTransactions(sessionData, req.body || {});
    return res.json(result);
  } catch (error) {
    console.error("Report transactions error:", error);
    return res.status(502).json({ error: "Kunde inte hämta rapport" });
  }
});

app.post("/api/report/receipt-guid", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await getReceiptGuid(sessionData, req.body || {});
    if (!result.success) return res.status(404).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Receipt GUID error:", error);
    return res.status(502).json({ error: "Kunde inte hämta kvitto" });
  }
});

app.post("/api/cardholder/search", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await searchCardholders(sessionData, req.body || {});
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Cardholder search error:", error);
    return res.status(502).json({ error: "Kunde inte söka kortinnehavare" });
  }
});

app.post("/api/cardholder/assign-card", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { customerId, accountId, cardNumber } = req.body || {};
  if (!customerId || !accountId || !cardNumber) {
    return res.status(400).json({ error: "Missing customerId, accountId or cardNumber" });
  }
  try {
    const result = await assignExistingCardToCardholder(sessionData, { customerId, accountId, cardNumber });
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Assign card to cardholder error:", error);
    return res.status(502).json({ error: "Kunde inte koppla kortet" });
  }
});

app.post("/api/giftcards", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await listGiftcards(sessionData, req.body || {});
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Giftcards error:", error);
    return res.status(502).json({ error: "Kunde inte hämta presentkort" });
  }
});

app.post("/api/giftcards/details", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { cardNumber } = req.body || {};
  if (!cardNumber) {
    return res.status(400).json({ error: "Missing cardNumber" });
  }
  try {
    const details = await getGiftcardDetailsFromDb(sessionData, String(cardNumber));
    if (!details) {
      return res.status(404).json({ error: "Kunde inte hitta kortet" });
    }
    return res.json({ success: true, data: details });
  } catch (error) {
    console.error("Giftcard details error:", error);
    return res.status(502).json({ error: "Kunde inte hämta kortinformation" });
  }
});

app.get("/api/giftcards/retailstores", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const accountId = req.query?.accountId;
  if (!accountId) {
    return res.status(400).json({ error: "Missing accountId" });
  }
  try {
    const result = await listRetailstoresForAccount(sessionData, accountId);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Kunde inte hämta butiker" });
    }
    return res.json({ retailstores: result.retailstores || [] });
  } catch (error) {
    console.error("Retailstores error:", error);
    return res.status(502).json({ error: "Kunde inte hämta butiker" });
  }
});

app.post("/api/card/update-expiry", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { cardNumber, newExpiryDate } = req.body || {};
  if (!cardNumber || !newExpiryDate) {
    return res.status(400).json({ error: "Missing cardNumber or newExpiryDate" });
  }
  try {
    const result = await updateExpiry(sessionData, { cardNumber, newExpiryDate });
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Update expiry error:", error);
    return res.status(502).json({ error: "Kunde inte uppdatera utgångsdatum" });
  }
});

app.get("/api/giftcard-maker/auth/status", async (req, res) => {
  const sessionData = req.session?.bizdesk;
  if (!sessionData) {
    return res.json({ authenticated: false, role: "operator", operatorId: "", operatorIds: "", companyId: "", companyIds: "" });
  }
  try {
    const result = await getGiftcardMakerAuthStatus(sessionData);
    return res.json(result);
  } catch (error) {
    console.error("Giftcard maker auth status error:", error);
    return res.status(502).json({ authenticated: false, role: "operator", operatorId: "", operatorIds: "", companyId: "", companyIds: "" });
  }
});

app.get("/api/giftcard-maker/companies", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await getGiftcardMakerCompanies(sessionData);
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error || "Kunde inte hämta företag" });
    }
    return res.json({ companies: result.payload || [] });
  } catch (error) {
    console.error("Giftcard maker companies error:", error);
    return res.status(502).json({ error: "Kunde inte hämta företag" });
  }
});

app.patch("/api/giftcard-maker/companies/:id", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await updateGiftcardMakerCompany(sessionData, req.params.id, req.body || {});
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error || "Kunde inte uppdatera företag" });
    }
    return res.json(result.payload || {});
  } catch (error) {
    console.error("Giftcard maker company update error:", error);
    return res.status(502).json({ error: "Kunde inte uppdatera företag" });
  }
});

app.get("/api/giftcard-maker/giftcard/templates", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await getGiftcardTemplates(sessionData, req.query?.companyId || req.query?.companyid || "");
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error || "Kunde inte hämta mallar" });
    }
    return res.json(result.payload || []);
  } catch (error) {
    console.error("Giftcard maker templates error:", error);
    return res.status(502).json({ error: "Kunde inte hämta mallar" });
  }
});

app.get("/api/giftcard-maker/giftcard/data", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  try {
    const result = await getGiftcardData(sessionData, req.query?.companyId || req.query?.companyid || "");
    if (!result.success) {
      return res.status(result.status || 400).json({ error: result.error || "Kunde inte hämta presentkortsdata" });
    }
    return res.json(result.payload || {});
  } catch (error) {
    console.error("Giftcard maker data error:", error);
    return res.status(502).json({ error: "Kunde inte hämta presentkortsdata" });
  }
});

app.post("/api/giftcard-maker/session", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  if (!sessionData.selectedCustomerId) {
    return res.status(400).json({ error: "Ingen kund vald" });
  }
  try {
    const result = await getGiftcardMakerSession(sessionData);
    if (!result.success) {
      return res.status(400).json({ error: result.error || "Kunde inte h\u00e4mta f\u00f6retag" });
    }

    const companyIds = result.companyIds || [];
    const terminalIds = result.terminalIds || [];
    const operatorIds = result.operatorIds || [];
    applyGiftcardMakerCookies(res, {
      operatorIds: operatorIds.length > 0 ? operatorIds : terminalIds,
      companyIds,
    });

    return res.json({
      success: true,
      companies: result.companies || [],
      companyIds,
      terminalIds,
      operatorIds,
    });
  } catch (error) {
    console.error("Giftcard maker session error:", error);
    return res.status(502).json({ error: "Kunde inte initiera presentkortsskaparen" });
  }
});

app.post("/api/card/adjust-balance", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { cardNumber, amount, workstationId, operatorId } = req.body || {};
  if (!cardNumber || amount === undefined || amount === null) {
    return res.status(400).json({ error: "Missing cardNumber or amount" });
  }
  try {
    const result = await adjustGiftcardBalance(sessionData, { cardNumber, amount, workstationId, operatorId });
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Adjust balance error:", error);
    return res.status(502).json({ error: "Kunde inte justera saldo" });
  }
});

app.post("/api/card/block", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { cardNumber } = req.body || {};
  if (!cardNumber) {
    return res.status(400).json({ error: "Missing cardNumber" });
  }
  try {
    const result = await updateCardBlockStatus(sessionData, { cardNumber, isBlocked: true });
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Block card error:", error);
    return res.status(502).json({ error: "Kunde inte spärra kortet" });
  }
});

app.post("/api/card/unblock", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { cardNumber } = req.body || {};
  if (!cardNumber) {
    return res.status(400).json({ error: "Missing cardNumber" });
  }
  try {
    const result = await updateCardBlockStatus(sessionData, { cardNumber, isBlocked: false });
    if (!result.success) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    console.error("Unblock card error:", error);
    return res.status(502).json({ error: "Kunde inte häva spärren" });
  }
});

app.all("/api/mps2/*", proxyMps2);

app.get("/api/db/health", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT 1 AS ok");
    return res.json({ ok: true, result: result.recordset?.[0] || {} });
  } catch (error) {
    console.error("DB health error:", error);
    return res.status(500).json({ ok: false, error: String(error) });
  }
});

app.get("/api/website-settings/orders/by-ref/:orderRef", async (req, res) => {
  const sessionData = requireSession(req, res);
  if (!sessionData) return;
  const { orderRef } = req.params;
  try {
    const baseUrl = process.env.GIFTCARD_V3_API_BASE_URL || "https://presentkort-api.microdeb.se";
    const response = await fetch(
      `${baseUrl}/api/orders/by-ref/${encodeURIComponent(orderRef)}`,
      { headers: { accept: "application/json" } }
    );
    const text = await response.text();
    if (!response.ok) {
      let errObj;
      try { errObj = JSON.parse(text); } catch { errObj = null; }
      return res.status(response.status).json({
        error: errObj?.message || errObj?.error || text || "Kunde inte hämta order",
      });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return res.json(data);
  } catch (error) {
    console.error("Orders by-ref error:", error);
    return res.status(502).json({ error: "Kunde inte hämta order" });
  }
});

// ── Unauthenticated settings routes (for standalone settings app) ─────────────

const SETTINGS_V3_BASE = process.env.GIFTCARD_V3_API_BASE_URL || "https://presentkort-api.microdeb.se";

async function proxyV3(path, options = {}) {
  return fetch(`${SETTINGS_V3_BASE}${path}`, {
    ...options,
    headers: { accept: "application/json; charset=utf-8", ...(options.headers || {}) },
  });
}

app.get("/api/settings/companies", async (req, res) => {
  try {
    const response = await proxyV3("/api/companies");
    const text = await response.text();
    if (!response.ok) {
      return res.status(response.status).json({ error: text || "Kunde inte hämta företag" });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = []; }
    return res.json(data);
  } catch (error) {
    console.error("Settings companies error:", error);
    return res.status(502).json({ error: "Kunde inte hämta företag" });
  }
});

app.patch("/api/settings/companies/:id", async (req, res) => {
  try {
    const response = await proxyV3(`/api/companies/${encodeURIComponent(req.params.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(req.body || {}),
    });
    const text = await response.text();
    if (!response.ok) {
      let errObj;
      try { errObj = JSON.parse(text); } catch { errObj = null; }
      return res.status(response.status).json({
        error: errObj?.message || errObj?.error || text || "Kunde inte uppdatera företag",
      });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    return res.json(data);
  } catch (error) {
    console.error("Settings company update error:", error);
    return res.status(502).json({ error: "Kunde inte uppdatera företag" });
  }
});

app.post("/api/settings/companies", async (req, res) => {
  try {
    const response = await proxyV3("/api/companies", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(req.body || {}),
    });
    const text = await response.text();
    if (!response.ok) {
      let errObj;
      try { errObj = JSON.parse(text); } catch { errObj = null; }
      return res.status(response.status).json({
        error: errObj?.message || errObj?.error || text || "Kunde inte skapa företag",
      });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = {}; }
    return res.json(data);
  } catch (error) {
    console.error("Settings company create error:", error);
    return res.status(502).json({ error: "Kunde inte skapa företag" });
  }
});

app.get("/api/settings/templates", async (req, res) => {
  try {
    const companyId = String(req.query?.companyId || req.query?.companyid || "").trim();
    const companyName = String(req.query?.companyName || req.query?.companyname || "").trim();
    if (!companyId) return res.status(400).json({ error: "companyId krävs" });

    // Try direct DB first — returns ALL templates including inactive
    const directResult = await getSettingsTemplatesDirect(companyId);
    if (directResult.success) {
      return res.json(directResult.templates);
    }

    // Fall back to upstream API
    let response = await proxyV3(`/api/GiftCard/templates?companyId=${encodeURIComponent(companyId)}`);
    let text = await response.text();
    if (!response.ok) {
      const r2 = await proxyV3(`/api/GiftCard/templates`);
      text = await r2.text();
      if (!r2.ok) {
        return res.status(r2.status).json({ error: text || "Kunde inte hämta mallar" });
      }
    }

    let payload;
    try { payload = JSON.parse(text); } catch { payload = []; }

    const allTemplates = Array.isArray(payload) ? payload
      : Array.isArray(payload?.templates) ? payload.templates
      : Array.isArray(payload?.data) ? payload.data
      : [];

    const cid = companyId.toLowerCase();
    const cname = companyName.toLowerCase();
    const filtered = allTemplates.filter((t) => {
      const tCompanyId = String(t.companyId || t.companyid || t.CompanyId || "").toLowerCase();
      const tOperatorId = String(t.operatorId || t.operatorid || t.OperatorId || "").toLowerCase();
      if (tCompanyId && tCompanyId === cid) return true;
      if (cname && tOperatorId && tOperatorId === cname) return true;
      return false;
    });

    return res.json(filtered);
  } catch (error) {
    console.error("Settings templates error:", error);
    return res.status(502).json({ error: "Kunde inte hämta mallar" });
  }
});

app.post("/api/settings/templates", async (req, res) => {
  try {
    const { companyId, templateName, htmlContent, cssContent, operatorId } = req.body || {};
    if (!companyId) return res.status(400).json({ error: "companyId krävs" });
    const result = await createSettingsTemplate(companyId, { templateName, htmlContent, cssContent, operatorId });
    if (!result.success) return res.status(result.status || 400).json({ error: result.error });
    return res.json({ success: true, templateId: result.templateId });
  } catch (error) {
    console.error("Settings template create error:", error);
    return res.status(502).json({ error: "Kunde inte skapa mall" });
  }
});

app.patch("/api/settings/templates/:id", async (req, res) => {
  try {
    const companyId = String(req.query?.companyId || req.query?.companyid || "").trim();
    if (!companyId) return res.status(400).json({ error: "companyId krävs" });
    const { templateName, htmlContent, cssContent, isActive } = req.body || {};
    const result = await updateSettingsTemplate(companyId, req.params.id, { templateName, htmlContent, cssContent, isActive });
    if (!result.success) return res.status(result.status || 400).json({ error: result.error });
    return res.json({ success: true });
  } catch (error) {
    console.error("Settings template update error:", error);
    return res.status(502).json({ error: "Kunde inte uppdatera mall" });
  }
});

app.delete("/api/settings/templates/:id", async (req, res) => {
  try {
    const companyId = String(req.query?.companyId || req.query?.companyid || "").trim();
    if (!companyId) return res.status(400).json({ error: "companyId krävs" });
    const result = await deleteSettingsTemplate(companyId, req.params.id);
    if (!result.success) return res.status(result.status || 400).json({ error: result.error });
    return res.json({ success: true });
  } catch (error) {
    console.error("Settings template delete error:", error);
    return res.status(502).json({ error: "Kunde inte ta bort mall" });
  }
});

app.get("/api/settings/orders/by-ref/:orderRef", async (req, res) => {
  try {
    const response = await proxyV3(`/api/orders/by-ref/${encodeURIComponent(req.params.orderRef)}`);
    const text = await response.text();
    if (!response.ok) {
      let errObj;
      try { errObj = JSON.parse(text); } catch { errObj = null; }
      return res.status(response.status).json({
        error: errObj?.message || errObj?.error || text || "Kunde inte hämta order",
      });
    }
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return res.json(data);
  } catch (error) {
    console.error("Settings order by-ref error:", error);
    return res.status(502).json({ error: "Kunde inte hämta order" });
  }
});

// ── Image upload (unauthenticated, for settings app) ──────────────────────────

const uploadsDir = path.resolve(__dirname, "../public/uploads");
mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Endast bildfiler stöds"));
  },
});

app.use("/uploads", express.static(uploadsDir));

app.post("/api/settings/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Ingen fil uppladdad" });
  const url = `/uploads/${req.file.filename}`;
  return res.json({ url, filename: req.file.filename });
});

app.use((err, _req, res, _next) => {
  if (err?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ error: "Filen är för stor (max 5 MB)" });
  if (err?.message) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: "Serverfel" });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

