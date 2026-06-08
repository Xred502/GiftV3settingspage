
import { config } from "./config.js";
import { getPool, query, sql } from "./db.js";
import crypto from "crypto";

const AUTH_BASE_URL = config.authBaseUrl;
const MPS2_BASE_URL = config.mps2BaseUrl;
const GIFTCARD_V3_API_BASE_URL = process.env.GIFTCARD_V3_API_BASE_URL || "https://giftcardv3api-preprod.microdeb.se";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const TIMEOUT_MS = 15000;

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

function parseHiddenFields(html) {
  const fields = {};
  const regex = /<input\b[^>]*type\s*=\s*(['"]?)hidden\1[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const tag = match[0];
    const nameMatch = tag.match(/name\s*=\s*(['"])(.*?)\1/i) || tag.match(/name\s*=\s*([^\s>]+)/i);
    const valueMatch = tag.match(/value\s*=\s*(['"])(.*?)\1/i) || tag.match(/value\s*=\s*([^\s>]+)/i);
    if (nameMatch) {
      const name = nameMatch[2] ?? nameMatch[1];
      const value = valueMatch ? (valueMatch[2] ?? valueMatch[1]) : "";
      fields[name] = decodeHtmlEntities(value || "");
    }
  }
  return fields;
}

function extractCookies(headers) {
  const cookies = {};
  let setCookieHeaders = [];
  if (typeof headers.getSetCookie === "function") {
    setCookieHeaders = headers.getSetCookie();
    if (!setCookieHeaders || setCookieHeaders.length === 0) {
      for (const [key, value] of headers.entries()) {
        if (key.toLowerCase() === "set-cookie") {
          setCookieHeaders.push(value);
        }
      }
    }
  } else {
    for (const [key, value] of headers.entries()) {
      if (key.toLowerCase() === "set-cookie") {
        setCookieHeaders.push(value);
      }
    }
  }
  for (const sc of setCookieHeaders) {
    const parts = sc.split(";")[0].split("=");
    if (parts.length >= 2) {
      cookies[parts[0].trim()] = parts.slice(1).join("=").trim();
    }
  }
  return cookies;
}

function buildCookieHeader(cookies) {
  return Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function fetchWithTimeout(url, init, timeoutMs = TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildFormData(base, overrides) {
  const merged = { ...base, ...overrides };
  const form = new URLSearchParams();
  for (const [key, val] of Object.entries(merged)) {
    form.append(key, val ?? "");
  }
  return form;
}

function getAttr(tag, attr) {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*(['"])(.*?)\\1`, "i"));
  if (m) return m[2];
  const m2 = tag.match(new RegExp(`${attr}\\s*=\\s*([^\\s>]+)`, "i"));
  return m2 ? m2[1] : null;
}

function parseFormFields(html) {
  const fields = {};

  const inputRegex = /<input\b[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(html)) !== null) {
    const tag = match[0];
    const name = getAttr(tag, "name");
    if (!name) continue;
    const type = (getAttr(tag, "type") || "text").toLowerCase();
    if ((type === "checkbox" || type === "radio") && !/checked/i.test(tag)) {
      continue;
    }
    const value = getAttr(tag, "value") ?? "";
    fields[name] = decodeHtmlEntities(value);
  }

  const selectRegex = /<select\b[^>]*>/gi;
  while ((match = selectRegex.exec(html)) !== null) {
    const tag = match[0];
    const name = getAttr(tag, "name");
    if (!name) continue;
    const start = match.index;
    const end = html.indexOf("</select>", start);
    if (end < 0) continue;
    const block = html.substring(start, end + 9);
    const optionRegex = /<option[^>]*>/gi;
    let optMatch;
    let selectedValue = null;
    let firstValue = null;
    while ((optMatch = optionRegex.exec(block)) !== null) {
      const optTag = optMatch[0];
      const value = decodeHtmlEntities(getAttr(optTag, "value") ?? "");
      if (firstValue === null) firstValue = value;
      if (/selected/i.test(optTag)) {
        selectedValue = value;
        break;
      }
    }
    const finalValue = selectedValue ?? firstValue;
    if (finalValue !== null) {
      fields[name] = finalValue;
    }
  }

  return fields;
}
function stripTags(html) {
  return html.replace(/<[^>]*>/g, "");
}

function normalizeText(html) {
  return decodeHtmlEntities(stripTags(html)).replace(/\s+/g, " ").trim();
}

function extractFormAction(html, fallback) {
  const actionMatch = html.match(/<form[^>]+action="([^"]+)"/i);
  return actionMatch ? actionMatch[1] : fallback;
}

function parseOptionList(html) {
  const options = [];
  const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
  let match;
  while ((match = optionRegex.exec(html)) !== null) {
    const value = decodeHtmlEntities(match[1] || "").trim();
    const label = normalizeText(match[2] || "");
    if (!value && !label) continue;
    options.push({ value, label });
  }
  return options;
}

function extractSelectOptionsByName(html, nameOrId) {
  const safe = nameOrId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectRegex = new RegExp(`<select[^>]+(?:name|id)="${safe}"[^>]*>([\\s\\S]*?)<\\/select>`, "i");
  const match = html.match(selectRegex);
  if (!match) return [];
  return parseOptionList(match[1]);
}

function extractSelectByToken(html, token) {
  const safe = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selectRegex = new RegExp(`<select[^>]+(?:name|id)=\"([^\"]*${safe}[^\"]*)\"[^>]*>([\\s\\S]*?)<\\/select>`, "i");
  const match = html.match(selectRegex);
  if (!match) return null;
  const name = match[1];
  const options = parseOptionList(match[2] || "");
  return { name, options };
}

function extractCustomerOptionsFromHtml(html) {
  const selectRegex = /<select([^>]*)>([\s\S]*?)<\/select>/gi;
  const selects = [];
  let match;
  while ((match = selectRegex.exec(html)) !== null) {
    const attrs = match[1] || "";
    const nameMatch = attrs.match(/name="([^"]+)"/i) || attrs.match(/id="([^"]+)"/i);
    const name = nameMatch ? nameMatch[1] : "";
    const options = parseOptionList(match[2] || "");
    if (options.length > 0) {
      selects.push({ name, options });
    }
  }
  if (selects.length === 0) return [];

  const preferred = selects.filter((s) => /kund|customer|client|company/i.test(s.name));
  const pool = preferred.length > 0 ? preferred : selects;
  let best = pool[0];
  let bestScore = -1;
  for (const candidate of pool) {
    const score = candidate.options.filter((o) => o.value && o.label && o.label !== "--").length;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best.options.filter((o) => o.value && o.label && o.label !== "--");
}

function findRoleValueFromOptions(options) {
  if (options.length === 0) return null;
  let fallback = options[0].value || null;
  let support = null;
  let customerSupport = null;
  for (const opt of options) {
    const label = opt.label.toLowerCase();
    if (label.includes("kundsupport")) customerSupport = opt.value;
    else if (label.includes("support")) support = opt.value;
  }
  return customerSupport || support || fallback;
}

function findPostbackTargetById(html, idFragment) {
  if (!html || !idFragment) return null;
  const safe = idFragment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const decodedHtml = decodeHtmlEntities(html);
  const regexes = [
    new RegExp(`__doPostBack\\('([^']*${safe}[^']*)'`, "i"),
    new RegExp(`WebForm_DoPostBackWithOptions\\(new WebForm_PostBackOptions\\(\"([^\"]*${safe}[^\"]*)\"`, "i"),
  ];
  for (const regex of regexes) {
    const match = decodedHtml.match(regex);
    if (match) return match[1];
  }
  const idRegex = new RegExp(`\\bid\\s*=\\s*(['\"])${safe}\\1`, "i");
  if (idRegex.test(decodedHtml)) {
    return idFragment;
  }
  return null;
}

function findSupportPostbackTarget(html) {
  if (!html) return null;
  const decodedHtml = decodeHtmlEntities(html);
  const linkRegex = /<a[^>]+href="javascript:__doPostBack\('([^']+)'[^\)]*\)"[^>]*>([\s\S]*?)<\/a>/gi;
  let fallback = null;
  let support = null;
  let customerSupport = null;
  let match;
  while ((match = linkRegex.exec(decodedHtml)) !== null) {
    const target = match[1];
    const text = normalizeText(match[2]).toLowerCase();
    if (!fallback) fallback = target;
    if (text.includes("kundsupport")) customerSupport = target;
    else if (text.includes("support")) support = target;
  }
  if (customerSupport) return customerSupport;
  if (support) return support;
  if (/\bid\s*=\s*['"]LinkButtonSupport['"]/i.test(decodedHtml)) return "LinkButtonSupport";
  return fallback;
}
function extractCustomerIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/\/bizdesk\/([^\/]+)\/default/i);
  return match ? match[1] : null;
}

function extractCustomerIdFromLocation(location) {
  return extractCustomerIdFromUrl(location);
}

function extractCustomerIdFromHtml(html) {
  if (!html) return null;
  const match = html.match(/\/bizdesk\/([^\/]+)\/default/i);
  return match ? match[1] : null;
}

function isLoginForm(html) {
  return /frmUsername|frmPassword|btnLogin/i.test(html);
}

function isRoleSelectionForm(html) {
  return /frmRoles|btnSetRole/i.test(html);
}

async function decodeResponseText(response) {
  return await response.text();
}

function calculateDateRange(period) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  const format = (d) => d.toISOString().slice(0, 10);

  switch ((period || "").toLowerCase()) {
    case "today": {
      const from = new Date(year, month, date);
      const to = new Date(year, month, date);
      return { from: format(from), to: format(to) };
    }
    case "yesterday": {
      const from = new Date(year, month, date - 1);
      const to = new Date(year, month, date - 1);
      return { from: format(from), to: format(to) };
    }
    case "week": {
      const day = now.getDay() || 7;
      const from = new Date(year, month, date - day + 1);
      const to = new Date(year, month, date - day + 7);
      return { from: format(from), to: format(to) };
    }
    case "last week": {
      const day = now.getDay() || 7;
      const from = new Date(year, month, date - day - 6);
      const to = new Date(year, month, date - day);
      return { from: format(from), to: format(to) };
    }
    case "month": {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { from: format(from), to: format(to) };
    }
    case "last month": {
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 0);
      return { from: format(from), to: format(to) };
    }
    case "year": {
      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31);
      return { from: format(from), to: format(to) };
    }
    case "last year": {
      const from = new Date(year - 1, 0, 1);
      const to = new Date(year - 1, 11, 31);
      return { from: format(from), to: format(to) };
    }
    default: {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { from: format(from), to: format(to) };
    }
  }
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatReportDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function formatReportAmount(ore) {
  const amount = Number(ore);
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat("sv-SE", { style: "currency", currency: "SEK" }).format(amount / 100);
}

function normalizeReportTransactionType(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lowered = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (["alla", "all", "0"].includes(lowered)) return null;
  if (["purchase", "kop", "koep", "kop"].includes(lowered)) return "K\u00f6p";
  if (["deposit", "insattning", "insattning"].includes(lowered)) return "Ins\u00e4ttning";
  if (["buyback", "aterkop", "aaterkop"].includes(lowered)) return "\u00c5terk\u00f6p";
  if (["clearing", "avrakning", "avrakning"].includes(lowered)) return "Avr\u00e4kning";

  if (lowered.includes("kop")) return "K\u00f6p";
  if (lowered.includes("insatt")) return "Ins\u00e4ttning";
  if (lowered.includes("aterkop")) return "\u00c5terk\u00f6p";
  if (lowered.includes("avrak")) return "Avr\u00e4kning";

  return raw;
}

function normalizeRetailstoreBalanceTransactionTitle(value) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const lowered = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (["alla", "all", "0"].includes(lowered)) return null;
  if (["kop", "koep", "purchase"].includes(lowered)) return "K\u00f6p";
  if (["insattning", "deposit"].includes(lowered)) return "Ins\u00e4ttning";
  if (["aterkop", "aaterkop", "buyback"].includes(lowered)) return "\u00c5terk\u00f6p";
  if (["avslut"].includes(lowered)) return "Avslut";

  return raw;
}

function normalizeSelectionArray(values) {
  const list = Array.isArray(values) ? values : [values];
  const normalized = [];
  const seen = new Set();

  for (const value of list) {
    const normalizedValue = normalizeString(value);
    if (!normalizedValue) continue;
    if (normalizedValue.toLowerCase() === "all") continue;
    if (seen.has(normalizedValue)) continue;
    seen.add(normalizedValue);
    normalized.push(normalizedValue);
  }

  return normalized;
}

async function getGiftcardV3Columns(tableName) {
  const rows = await query(
    `SELECT column_name
     FROM GiftcardV3.INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_NAME = @tableName`,
    [{ name: "tableName", type: sql.VarChar, value: tableName }]
  );
  return (rows || []).map((row) => String(row.column_name));
}

function findColumn(columns, candidates) {
  const lookup = new Map();
  for (const col of columns || []) {
    lookup.set(String(col).toLowerCase(), col);
  }
  for (const candidate of candidates) {
    const match = lookup.get(candidate.toLowerCase());
    if (match) return match;
  }
  return null;
}

async function getRetailstoresForReport(supportId) {
  if (!Number.isFinite(supportId)) return [];
  const params = [{ name: "supportId", type: sql.Int, value: supportId }];

  const tryQuery = async (sqlText) => {
    try {
      const rows = await query(sqlText, params);
      return rows && rows.length > 0 ? rows : [];
    } catch (error) {
      console.log("[report] Retailstore lookup failed:", error?.message || error);
      return [];
    }
  };

  const storeRows = [];

  storeRows.push(...await tryQuery(
    `SELECT rs.id, rs.name, rs.friendlyname
     FROM retailstore rs
     WHERE rs.poolid = @supportId
       AND (rs.inactive IS NULL OR rs.inactive = 0)
     ORDER BY rs.friendlyname, rs.name, rs.id`
  ));

  storeRows.push(...await tryQuery(
    `SELECT DISTINCT rs.id, rs.name, rs.friendlyname
     FROM pool_retailstore pr
     INNER JOIN retailstore rs ON rs.id = pr.retailstoreid
     WHERE pr.poolid = @supportId
       AND (rs.inactive IS NULL OR rs.inactive = 0)
     ORDER BY rs.friendlyname, rs.name, rs.id`
  ));

  storeRows.push(...await tryQuery(
    `SELECT DISTINCT rs.id, rs.name, rs.friendlyname
     FROM pool p
     INNER JOIN pool_retailstore pr ON pr.poolid = p.id
     INNER JOIN retailstore rs ON rs.id = pr.retailstoreid
     WHERE p.id = @supportId
       AND (rs.inactive IS NULL OR rs.inactive = 0)
     ORDER BY rs.friendlyname, rs.name, rs.id`
  ));

  storeRows.push(...await tryQuery(
    `SELECT DISTINCT rs.id, rs.name, rs.friendlyname
     FROM view_account va
     INNER JOIN poolcardtype pct ON pct.id = va.poolcardtypeid
     INNER JOIN poolcardtype_retailstore pcr ON pcr.poolcardtypeid = pct.id
     INNER JOIN retailstore rs ON rs.id = pcr.retailstoreid
     WHERE va.supportid = @supportId
       AND (rs.inactive IS NULL OR rs.inactive = 0)
     ORDER BY rs.friendlyname, rs.name, rs.id`
  ));

  storeRows.push(...await tryQuery(
    `SELECT DISTINCT rs.id, rs.name, rs.friendlyname
     FROM [transaction] t
     INNER JOIN view_account va ON va.id = t.accountid AND va.supportid = @supportId
     INNER JOIN workstation w ON w.id = t.workstationid
     INNER JOIN retailstore rs ON rs.id = w.retailstoreid
     WHERE rs.inactive IS NULL OR rs.inactive = 0
     ORDER BY rs.friendlyname, rs.name, rs.id`
  ));

  const deduped = new Map();
  for (const row of storeRows || []) {
    const id = String(row.id);
    if (!deduped.has(id)) {
      deduped.set(id, row);
    }
  }

  const sorted = Array.from(deduped.values()).sort((a, b) => {
    const left = String(a.friendlyname || a.name || a.id);
    const right = String(b.friendlyname || b.name || b.id);
    return left.localeCompare(right, "sv-SE");
  });

  return sorted.map((row) => ({
    value: String(row.id),
    label: row.friendlyname || row.name || String(row.id),
  }));
}

async function resolveGiftcardMakerCompanies(session) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const retailstores = await getRetailstoresForReport(supportId);
  const storeIds = retailstores
    .map((store) => parseInt(store.value, 10))
    .filter((value) => Number.isFinite(value));

  if (storeIds.length === 0) {
    return { success: false, error: "Kunde inte hitta s\u00e4ljst\u00e4llen f\u00f6r kunden" };
  }

  const storeParams = storeIds.map((id, idx) => ({
    name: `storeId${idx}`,
    type: sql.Int,
    value: id,
  }));
  const storePlaceholders = storeParams.map((param) => `@${param.name}`).join(", ");
  const terminalRows = await query(
    `SELECT DISTINCT terminalid
     FROM workstation
     WHERE retailstoreid IN (${storePlaceholders})
       AND terminalid IS NOT NULL`,
    storeParams
  );

  const terminalIds = (terminalRows || [])
    .map((row) => String(row.terminalid || "").trim())
    .filter((value) => value.length > 0);

  if (terminalIds.length === 0) {
    return { success: false, error: "Kunde inte hitta terminaler f\u00f6r kunden" };
  }

  const templateColumns = await getGiftcardV3Columns("gift_card_templates");
  const templateTerminalColumn = findColumn(templateColumns, ["terminalId", "terminalid"]);
  const templateCompanyColumn = findColumn(templateColumns, ["companyId", "companyid"]);
  const templateOperatorColumn = findColumn(templateColumns, [
    "operatorId",
    "operatorID",
    "operator_id",
    "operatorName",
    "operatorname",
    "operator",
  ]);

  if (!templateTerminalColumn) {
    return { success: false, error: "Kunde inte l\u00e4sa presentkortsmallarna" };
  }

  const companyColumns = await getGiftcardV3Columns("companies");
  const companyIdColumn = findColumn(companyColumns, ["companyId", "companyid", "id"]);
  const companyNameColumn = findColumn(companyColumns, ["companyName", "companyname", "name"]);
  const companyNumberColumn = findColumn(companyColumns, ["companyNumber", "companynumber", "orgnumber", "org"]);

  const terminalParams = terminalIds.map((id, idx) => ({
    name: `terminalId${idx}`,
    type: sql.VarChar,
    value: id,
  }));
  const terminalPlaceholders = terminalParams.map((param) => `@${param.name}`).join(", ");

  let companyRows = [];
  if (templateCompanyColumn) {
    const selectCompanyName = companyIdColumn && companyNameColumn
      ? `, c.[${companyNameColumn}] AS companyName`
      : "";
    const joinCompany = companyIdColumn
      ? `LEFT JOIN GiftcardV3.dbo.companies c ON c.[${companyIdColumn}] = gct.[${templateCompanyColumn}]`
      : "";

    companyRows = await query(
      `SELECT DISTINCT gct.[${templateCompanyColumn}] AS companyId${selectCompanyName}
       FROM GiftcardV3.dbo.gift_card_templates gct
       ${joinCompany}
       WHERE gct.[${templateTerminalColumn}] IN (${terminalPlaceholders})`,
      terminalParams
    );
  }

  let operatorRows = [];
  if (templateOperatorColumn) {
    operatorRows = await query(
      `SELECT DISTINCT gct.[${templateOperatorColumn}] AS operatorId
       FROM GiftcardV3.dbo.gift_card_templates gct
       WHERE gct.[${templateTerminalColumn}] IN (${terminalPlaceholders})
         AND gct.[${templateOperatorColumn}] IS NOT NULL`,
      terminalParams
    );
  }

  const companies = [];
  const companyIds = [];
  const operatorIds = [];
  const seen = new Set();
  for (const row of companyRows || []) {
    const id = row.companyId != null ? String(row.companyId) : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const name = row.companyName ? String(row.companyName) : "";
    companies.push({ companyId: id, companyName: name });
    companyIds.push(id);
  }

  const operatorSeen = new Set();
  for (const row of operatorRows || []) {
    const operatorId = row?.operatorId != null ? String(row.operatorId).trim() : "";
    if (!operatorId || operatorSeen.has(operatorId)) continue;
    operatorSeen.add(operatorId);
    operatorIds.push(operatorId);
  }

  if (companyIds.length === 0 || operatorIds.length === 0) {
    const poolInfoRows = await query(
      `SELECT name, friendlyname, org, externalid
       FROM pool
       WHERE id = @supportId`,
      [{ name: "supportId", type: sql.Int, value: supportId }]
    );
    const storeInfoRows = await query(
      `SELECT name, friendlyname, org, externalid
       FROM retailstore
       WHERE id IN (${storePlaceholders})`,
      storeParams
    );
    const nameCandidates = new Set();
    const orgCandidates = new Set();

    for (const row of poolInfoRows || []) {
      const name = String(row?.friendlyname || row?.name || "").trim();
      if (name) nameCandidates.add(name);
      const org = String(row?.org || row?.externalid || "").trim();
      if (org) orgCandidates.add(org);
    }

    for (const row of storeInfoRows || []) {
      const name = String(row?.friendlyname || row?.name || "").trim();
      if (name) nameCandidates.add(name);
      const org = String(row?.org || row?.externalid || "").trim();
      if (org) orgCandidates.add(org);
    }

    if (operatorIds.length === 0 && nameCandidates.size > 0) {
      for (const name of nameCandidates) {
        const trimmed = String(name || "").trim();
        if (!trimmed || operatorSeen.has(trimmed)) continue;
        operatorSeen.add(trimmed);
        operatorIds.push(trimmed);
      }
    }

    const lookupParams = [];
    const clauses = [];
    if (companyNameColumn && nameCandidates.size > 0) {
      const nameParams = Array.from(nameCandidates).map((value, idx) => {
        const param = { name: `companyName${idx}`, type: sql.NVarChar, value };
        lookupParams.push(param);
        return `@${param.name}`;
      });
      clauses.push(`c.[${companyNameColumn}] COLLATE Latin1_General_CI_AI IN (${nameParams.join(", ")})`);
    }

    if (companyNumberColumn && orgCandidates.size > 0) {
      const orgParams = Array.from(orgCandidates).map((value, idx) => {
        const param = { name: `companyOrg${idx}`, type: sql.NVarChar, value };
        lookupParams.push(param);
        return `@${param.name}`;
      });
      clauses.push(`c.[${companyNumberColumn}] IN (${orgParams.join(", ")})`);
    }

    if (companyIds.length === 0 && clauses.length > 0 && companyIdColumn) {
      const fallbackRows = await query(
        `SELECT DISTINCT c.[${companyIdColumn}] AS companyId${companyNameColumn ? `, c.[${companyNameColumn}] AS companyName` : ""}
         FROM GiftcardV3.dbo.companies c
         WHERE ${clauses.join(" OR ")}`,
        lookupParams
      );
      for (const row of fallbackRows || []) {
        const id = row.companyId != null ? String(row.companyId) : "";
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const name = row.companyName ? String(row.companyName) : "";
        companies.push({ companyId: id, companyName: name });
        companyIds.push(id);
      }
    }
  }

  if (companyIds.length === 0 && operatorIds.length === 0) {
    return { success: false, error: "Kunde inte hitta f\u00f6retag f\u00f6r kunden" };
  }

  return { success: true, companyIds, companies, terminalIds, operatorIds };
}

function appendRadComboFields(form, baseName, { input = "", value = "", text = "", width = "107px", height = "15px" } = {}) {
  form.append(`${baseName}_Input`, input ?? "");
  form.append(`${baseName}_value`, value ?? "");
  form.append(`${baseName}_text`, text ?? "");
  form.append(`${baseName}_clientWidth`, width);
  form.append(`${baseName}_clientHeight`, height);
}

function buildCalendarSelection(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("-").map((part) => parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "";
  const [year, month, day] = parts;
  return `[[${year},${month},${day}]]`;
}

function appendDateRangeFields(form, dateRange, calendarState = {}) {
  const from = dateRange?.from || "";
  const to = dateRange?.to || "";

  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateFrom", from);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateFrom$dateInput", from);
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_dateInput_ClientState",
    from ? buildDateInputClientState(from) : ""
  );
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_calendar_SD",
    buildCalendarSelection(from) || calendarState?.from?.calendarSD || ""
  );
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_calendar_AD",
    calendarState?.from?.calendarAD || ""
  );
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_ClientState",
    calendarState?.from?.clientState || ""
  );

  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateTo", to);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateTo$dateInput", to);
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateTo_dateInput_ClientState",
    to ? buildDateInputClientState(to) : ""
  );
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateTo_calendar_SD",
    buildCalendarSelection(to) || calendarState?.to?.calendarSD || ""
  );
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateTo_calendar_AD",
    calendarState?.to?.calendarAD || ""
  );
  form.append(
    "ctl00_MPSPage_ContentPlaceHolder_frmDateTo_ClientState",
    calendarState?.to?.clientState || ""
  );
}

function appendReportFormFields(form, opts = {}) {
  const dateLabel = opts.dateLabel || "Denna vecka";
  const dateValue = opts.dateValue || "week";
  const transactionTypeValue = opts.transactionType ?? "0";
  const transactionTypeLabel = opts.transactionTypeLabel || opts.transactionTypeText || (transactionTypeValue === "0" ? "Alla" : String(transactionTypeValue));
  const statusValue = opts.status === "__all" ? "" : (opts.status ?? "");
  const statusLabel = opts.statusLabel || (statusValue ? String(statusValue) : "Alla");
  const terminalTypeValue = opts.terminalType === "__all" ? "" : (opts.terminalType ?? "");
  const terminalTypeLabel = opts.terminalTypeLabel || (terminalTypeValue ? String(terminalTypeValue) : "Alla");
  const showOfflineValue = opts.showOfflineTrans ?? "2";
  const showOfflineLabel = opts.showOfflineLabel || (String(showOfflineValue) === "1" ? "Ja" : "Nej");

  form.append("ctl00$mdRadMenu", "");
  form.append("ctl00_MPSPage_ContentPlaceHolder_RadWindowReciept_ClientState", "");
  form.append("ctl00_MPSPage_ContentPlaceHolder_RadWindowManager1_ClientState", "");
  form.append("ctl00_MPSPage_ContentPlaceHolder_RadGridTransaction_ClientState", "");

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$SearchRetailstore$RadComboBoxSearch", {
    input: "",
    value: "",
    text: "",
    width: "107px",
    height: "15px",
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$SearchPool$RadComboBoxSearch", {
    input: "",
    value: "",
    text: "",
    width: "127px",
    height: "15px",
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$SearchPoolcardtype$RadComboBoxSearch", {
    input: "",
    value: "",
    text: "",
    width: "127px",
    height: "15px",
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmDateregion", {
    input: dateLabel,
    value: dateValue,
    text: dateLabel,
  });
  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmDateRegion", {
    input: dateLabel,
    value: dateValue,
    text: dateLabel,
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmTransactiontype", {
    input: transactionTypeLabel,
    value: transactionTypeValue,
    text: transactionTypeLabel,
  });
  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmTransactionType", {
    input: transactionTypeLabel,
    value: transactionTypeValue,
    text: transactionTypeLabel,
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmStatus", {
    input: statusLabel,
    value: statusValue,
    text: statusLabel,
    width: "97px",
    height: "15px",
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmTerminalType", {
    input: terminalTypeLabel,
    value: terminalTypeValue,
    text: terminalTypeLabel,
    width: "97px",
    height: "15px",
  });

  appendRadComboFields(form, "ctl00$MPSPage_ContentPlaceHolder$frmShowOfflineTrans", {
    input: showOfflineLabel,
    value: showOfflineValue,
    text: showOfflineLabel,
    width: "97px",
    height: "15px",
  });

  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateRegion", dateLabel);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateRegion_value", dateValue);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmDateRegion_text", dateLabel);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmTransactionType", transactionTypeValue);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmStatus", statusValue);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmTerminalType", terminalTypeValue);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmShowOfflineTrans", showOfflineValue);
}

function appendAdvancedSearchFields(form, opts = {}) {
  appendDateRangeFields(form, opts.dateRange, opts.calendarState);
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmAccountid", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardNo", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmTransactionId", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmReceiptNo", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmExcludeClearingTransaction", "Nej");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmAmountFrom", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmAmountTo", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmAccountCostCenter", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmRefNo", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardtype_Input", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardtype_value", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardtype_text", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardtype_clientWidth", "107px");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardtype_clientHeight", "15px");
  form.append("ctl00$MPSPage_ContentPlaceHolder$RadComboBoxPoolcardtypeReferencenumber_Input", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$RadComboBoxPoolcardtypeReferencenumber_value", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$RadComboBoxPoolcardtypeReferencenumber_text", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$RadComboBoxPoolcardtypeReferencenumber_clientWidth", "107px");
  form.append("ctl00$MPSPage_ContentPlaceHolder$RadComboBoxPoolcardtypeReferencenumber_clientHeight", "15px");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmInvoiceCode", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmSecurityCode", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$frmCardHolderPersId", "");
  form.append("ctl00$MPSPage_ContentPlaceHolder$operatorID", "");
}

function parseSelectOptions(html, fieldName) {
  const options = [];
  const regex = new RegExp(`<select[^>]*name="${fieldName}"[^>]*>([\\s\\S]*?)<\\/select>`, "i");
  const match = html.match(regex);
  if (!match) return options;
  const optionRegex = /<option[^>]*value="([^"]*)"[^>]*>([\s\S]*?)<\/option>/gi;
  let optMatch;
  while ((optMatch = optionRegex.exec(match[1])) !== null) {
    options.push({ value: optMatch[1], label: decodeHtmlEntities(optMatch[2].trim()) });
  }
  return options;
}

function parseRadGridTable(html) {
  const rows = [];
  const tableMatch = html.match(/<table[^>]*class="[^"]*rgMasterTable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return rows;
  const tableHtml = tableMatch[1];
  const headerMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  const headerCells = [];
  if (headerMatch) {
    const thRegex = /<th[^>]*>([\s\S]*?)<\/th>/gi;
    let thMatch;
    while ((thMatch = thRegex.exec(headerMatch[1])) !== null) {
      const header = normalizeText(thMatch[1]);
      headerCells.push(header || "");
    }
  }

  const bodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) return rows;
  const bodyHtml = bodyMatch[1];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;
  while ((trMatch = trRegex.exec(bodyHtml)) !== null) {
    const trContent = trMatch[1];
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch;
    const cells = [];
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      cells.push(normalizeText(tdMatch[1]));
    }
    if (cells.length === 0) continue;

    const row = {};
    const hiddenValues = [];
    cells.forEach((cell, index) => {
      const header = headerCells[index] || `col_${index}`;
      if (header === "" || header === "&nbsp;" || header === "\u00a0") {
        hiddenValues.push(cell);
      } else if (header !== '&nbsp;' && header !== '\u00a0' && header.trim() !== '') {
        row[header] = cell || '';
      }
    });
    if (hiddenValues.length > 0 && hiddenValues[0]) {
      row['__transactionId'] = hiddenValues[0];
    }
    const lastCellHtml = trContent.match(/<td[^>]*>[\s\S]*?__doPostBack[\s\S]*?<\/td>/i);
    if (lastCellHtml) {
      row['__hasReceipt'] = 'true';
    }
    rows.push(row);
  }

  return rows;
}

function parseCardholderTable(html) {
  return parseRadGridTable(html);
}

function parseGiftcardsFromCardAccountFindHtml(html) {
  return parseRadGridTable(html).map((row) => {
    const cardNo = row["Kortnr"] || row["Kortnummer"] || row["Card number"] || row["Cardno"] || "";
    const accountNo = row["Konto"] || row["Account"] || row["Account id"] || "";
    return { ...row, cardNo, accountNo };
  });
}

function extractPagerSubmitNames(html) {
  const pager = { next: null, prev: null };
  const inputRegex = /<input[^>]*type="submit"[^>]*name="([^"]+)"[^>]*value="([^"]*)"[^>]*>/gi;
  let match;
  while ((match = inputRegex.exec(html)) !== null) {
    const name = match[1];
    const value = match[2];
    const text = `${name} ${value}`.toLowerCase();
    if (!pager.next && /next|nästa/.test(text)) pager.next = name;
    if (!pager.prev && /prev|föreg|previous/.test(text)) pager.prev = name;
  }
  return pager;
}

function extractDoPostBackTargets(html) {
  const targets = [];
  const regex = /__doPostBack\('([^']+)'\s*,\s*'([^']*)'\)/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    targets.push({ target: match[1], argument: match[2] });
  }
  return targets;
}

function tryGetInfoPartText(html) {
  const match = html.match(/<div[^>]*class="[^"]*rgInfoPart[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  return match ? normalizeText(match[1]) : "";
}

function tryGetCurrentPageFromHtml(html) {
  const match = html.match(/<span[^>]*class="[^"]*rgCurrentPage[^"]*"[^>]*>(\d+)<\/span>/i);
  return match ? parseInt(match[1], 10) : null;
}

function parseInfoCounts(infoText) {
  if (!infoText) return { totalItems: 0, pages: 0 };
  const nums = infoText.match(/\d+/g) || [];
  const totalItems = nums.length > 0 ? parseInt(nums[nums.length - 1], 10) : 0;
  const pages = nums.length > 1 ? parseInt(nums[nums.length - 2], 10) : 0;
  return { totalItems, pages };
}

function makeKey(row) {
  return Object.values(row || {}).join("|");
}

function hashPassword(value) {
  if (!value) return "";
  if (value.length === 64 && /^[a-fA-F0-9]+$/.test(value)) return value.toLowerCase();
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

async function loginFromDb({ username, password, supportId }) {
  if (!username || !password) return { success: false, error: "Missing credentials" };
  try {
    const rows = await query(
      "SELECT TOP 1 userid, hashed_password FROM mobile WHERE userid = @userid",
      [{ name: "userid", type: sql.VarChar, value: username }]
    );
    if (!rows || rows.length === 0) return { success: false, error: "Felaktiga inloggningsuppgifter" };

    const hashed = hashPassword(password);
    const stored = String(rows[0].hashed_password || "").toLowerCase();
    if (!stored || stored !== hashed) {
      return { success: false, error: "Felaktiga inloggningsuppgifter" };
    }

    const options = await getCustomerOptionsFromDb(username);
    if (options.length === 0) {
      return { success: false, error: "Saknar behörighet" };
    }

    let selectedCustomerId = null;
    let needsCustomer = false;
    if (supportId && options.some((o) => o.value === String(supportId))) {
      selectedCustomerId = String(supportId);
    } else if (options.length === 1) {
      selectedCustomerId = options[0].value;
    } else {
      needsCustomer = true;
    }

    return {
      success: true,
      role: "Kundsupport",
      needsCustomer,
      selectedCustomerId,
      customerOptions: options,
      cookies: "",
      loginVersion: "db-fallback",
      authSource: "db",
    };
  } catch (error) {
    console.log("[login] DB auth failed:", error);
    return { success: false, error: "Inloggningen misslyckades" };
  }
}

async function getCustomerOptionsFromDb(username) {
  if (!username) return [];
  try {
    const rows = await query(
      `SELECT DISTINCT p.id AS value, p.name AS label
       FROM mobile_role mr
       INNER JOIN role r ON mr.roleid = r.id
       INNER JOIN pool p ON mr.poolid = p.id
       WHERE mr.userid = @userid AND r.name = @rolename AND mr.poolid IS NOT NULL
       ORDER BY p.name`,
      [
        { name: "userid", value: username },
        { name: "rolename", value: "kundsupport" },
      ]
    );
    return (rows || []).map((row) => ({
      value: String(row.value ?? row.id ?? ""),
      label: row.label || row.name || String(row.value ?? row.id ?? ""),
    })).filter((opt) => opt.value);
  } catch (error) {
    console.log("[login] DB customer lookup failed:", error);
    return [];
  }
}

function normalizeCardholderText(value) {
  if (value == null) return "";
  const str = String(value).trim();
  if (!str || str === "&nbsp;" || str === "\u00a0") return "";
  return str;
}

function normalizeCardholderStatus(isBlocked, expires) {
  if (isBlocked === true || isBlocked === 1 || String(isBlocked).toLowerCase() === "true") {
    return "blocked";
  }
  const expiryDate = parseGiftcardExpiryDate(expires);
  if (expiryDate && expiryDate < new Date()) {
    return "expired";
  }
  return expires || isBlocked != null ? "active" : "";
}

function formatCardholderStatusLabel(status) {
  switch (status) {
    case "active":
      return "Aktiv";
    case "blocked":
      return "Sp\u00e4rrad";
    case "expired":
      return "Utg\u00e5ngen";
    default:
      return "";
  }
}

function formatLatestTransactionLabel(lastTransactionDate, lastTransactionTitle, lastTransactionType) {
  const datePart = normalizeCardholderText(lastTransactionDate);
  const titlePart = normalizeCardholderText(lastTransactionTitle) || normalizeCardholderText(lastTransactionType);
  if (datePart && titlePart) return `${datePart} - ${titlePart}`;
  return datePart || titlePart || "";
}

function mapDbCardholderRow(row) {
  const cardNumber = normalizeCardholderText(row.cardno) || (row.cardid != null ? String(row.cardid) : "");
  const statusKey = normalizeCardholderStatus(row.isblocked, row.expires);
  const firstTransactionDate = normalizeCardholderText(row.firstTransactionDate);
  const firstTransactionRetailstore = normalizeCardholderText(row.firstTransactionRetailstore);
  const lastTransactionDate = normalizeCardholderText(row.lastTransactionDate);
  const lastTransactionTitle = normalizeCardholderText(row.lastTransactionTitle);
  const lastTransactionType = normalizeCardholderText(row.lastTransactionType);
  const lastTransactionRetailstore = normalizeCardholderText(row.lastTransactionRetailstore);

  return {
    "F\u00f6rnamn": normalizeCardholderText(row.firstname),
    "Efternamn": normalizeCardholderText(row.lastname),
    "E-post": normalizeCardholderText(row.email),
    "Kortnr": cardNumber,
    "Saldo": row.balance != null && row.balance !== "" ? String(row.balance) : "",
    "Utg\u00e5ngsdatum": normalizeCardholderText(row.expires),
    "Status": formatCardholderStatusLabel(statusKey),
    "Ink\u00f6psdatum": firstTransactionDate,
    "Ink\u00f6pt p\u00e5": firstTransactionRetailstore,
    "Senaste transaktion": formatLatestTransactionLabel(lastTransactionDate, lastTransactionTitle, lastTransactionType),
    "Senaste transaktion plats": lastTransactionRetailstore,
    "Telefon": normalizeCardholderText(row.phone),
    "__customerId": row.customerid != null ? String(row.customerid) : "",
    "__cardId": row.cardid != null ? String(row.cardid) : "",
    "__accountId": row.accountid != null ? String(row.accountid) : "",
    "__status": statusKey,
    "__firstTransactionDate": firstTransactionDate,
    "__firstTransactionRetailstore": firstTransactionRetailstore,
    "__lastTransactionDate": lastTransactionDate,
    "__lastTransactionTitle": lastTransactionTitle,
    "__lastTransactionType": lastTransactionType,
    "__lastTransactionRetailstore": lastTransactionRetailstore,
  };
}

function buildCardNumberExpression(alias = "card") {
  return `COALESCE(
    NULLIF(LTRIM(RTRIM(${alias}.shortcardnumber2)), ''),
    NULLIF(LTRIM(RTRIM(${alias}.shortcardnumber)), '')
  )`;
}

function buildCardNumberLikeFilter(alias = "card", paramName = "cardNo") {
  return `(
    (NULLIF(LTRIM(RTRIM(${alias}.shortcardnumber2)), '') IS NOT NULL AND LTRIM(RTRIM(${alias}.shortcardnumber2)) LIKE @${paramName})
    OR
    (NULLIF(LTRIM(RTRIM(${alias}.shortcardnumber)), '') IS NOT NULL AND LTRIM(RTRIM(${alias}.shortcardnumber)) LIKE @${paramName})
  )`;
}

async function searchCardholdersFromDb(session, params = {}) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  const exportAll = params?.exportAll === true || String(params?.exportAll || "").toLowerCase() === "true";
  const safePageSize = Math.min(Math.max(parseInt(params.pageSize, 10) || 100, 1), 500);
  const safePage = Math.max(parseInt(params.page, 10) || 1, 1);
  if (!Number.isFinite(supportId)) {
    return { cardholders: [], totalCount: 0, page: safePage, pageSize: safePageSize };
  }

  const offset = (safePage - 1) * safePageSize;
  const normalizedSort = normalizeCardholderSort(params.sortBy);
  const sortDir = normalizeSortDir(params.sortDir);
  const minBalance = Number(params?.minBalanceOre);
  const minBalanceOre = Number.isFinite(minBalance) && minBalance > 0 ? minBalance : null;
  const expiryFilterRaw = String(params?.expiryFilter || "").toLowerCase();
  const expiryFilter = expiryFilterRaw === "expired" || expiryFilterRaw === "active" ? expiryFilterRaw : "all";
  const purchaseDateFilterRaw = String(params?.purchaseDateFilter || "").toLowerCase();
  const purchaseDateFilter = (
    purchaseDateFilterRaw === "today"
    || purchaseDateFilterRaw === "thisweek"
    || purchaseDateFilterRaw === "thismonth"
    || purchaseDateFilterRaw === "custom"
  ) ? purchaseDateFilterRaw : "all";
  const purchaseDateFrom = normalizeCardholderText(params?.purchaseDateFrom);
  const purchaseDateTo = normalizeCardholderText(params?.purchaseDateTo);
  const requestedAccountId = parseInt(params?.cardAccount, 10);

  const rows = await query(
    `
    ;WITH account_scope AS (
      SELECT a.id AS accountId,
             a.balance AS balance
      FROM account a
      INNER JOIN view_poolcardtype vpt
        ON vpt.id = a.poolcardtypeid
       AND vpt.supportid = @supportId
    ),
    card_scope AS (
      SELECT
        s.accountId AS accountid,
        s.balance AS balance,
        cd.id AS cardid,
        ${buildCardNumberExpression("cd")} AS cardno,
        cd.expires AS expires,
        cd.isblocked AS isblocked,
        owner.customerid AS customerid,
        c.firstname AS firstname,
        c.lastname AS lastname,
        c.email AS email,
        NULL AS phone
      FROM account_scope s
      INNER JOIN card cd
        ON cd.accountid = s.accountId
      OUTER APPLY (
        SELECT TOP 1 ca.customerid
        FROM customer_account ca
        WHERE ca.accountid = s.accountId
        ORDER BY ca.customerid DESC
      ) owner
      LEFT JOIN customer c
        ON c.id = owner.customerid
    ),
    customer_scope AS (
      SELECT DISTINCT ca.customerid AS customerid
      FROM customer_account ca
      INNER JOIN account_scope s
        ON s.accountId = ca.accountid
    ),
    customer_only_scope AS (
      SELECT
        best.accountid AS accountid,
        best.balance AS balance,
        NULL AS cardid,
        NULL AS cardno,
        NULL AS expires,
        CAST(NULL AS BIT) AS isblocked,
        cs.customerid AS customerid,
        c.firstname AS firstname,
        c.lastname AS lastname,
        c.email AS email,
        NULL AS phone
      FROM customer_scope cs
      INNER JOIN customer c
        ON c.id = cs.customerid
      OUTER APPLY (
        SELECT TOP 1
          s.accountId AS accountid,
          s.balance AS balance
        FROM customer_account ca
        INNER JOIN account_scope s
          ON s.accountId = ca.accountid
        WHERE ca.customerid = cs.customerid
        ORDER BY s.balance DESC, s.accountId DESC
      ) best
      WHERE NOT EXISTS (
        SELECT 1
        FROM card_scope cr
        WHERE cr.customerid = cs.customerid
      )
    ),
    merged_scope AS (
      SELECT
        accountid,
        balance,
        cardid,
        cardno,
        expires,
        isblocked,
        customerid,
        firstname,
        lastname,
        email,
        phone
      FROM card_scope
      UNION ALL
      SELECT
        accountid,
        balance,
        cardid,
        cardno,
        expires,
        isblocked,
        customerid,
        firstname,
        lastname,
        email,
        phone
      FROM customer_only_scope
    )
    SELECT
      accountid,
      balance,
      cardid,
      cardno,
      expires,
      isblocked,
      customerid,
      firstname,
      lastname,
      email,
      phone
    FROM merged_scope`,
    [{ name: "supportId", type: sql.Int, value: supportId }]
  );

  const txSummary = await getTransactionSummaryByAccountIds((rows || []).map((row) => row.accountid));
  const enrichedRows = (rows || []).map((row) => {
    const accountKey = row.accountid != null ? String(row.accountid) : "";
    const summary = txSummary.get(accountKey);
    return {
      ...row,
      firstTransactionDate: summary?.firstTransactionDate || "",
      firstTransactionRetailstore: summary?.firstTransactionRetailstore || "",
      lastTransactionDate: summary?.lastTransactionDate || "",
      lastTransactionType: summary?.lastTransactionType || "",
      lastTransactionTitle: summary?.lastTransactionTitle || "",
      lastTransactionRetailstore: summary?.lastTransactionRetailstore || "",
    };
  });

  const matchContains = (haystack, needle) => {
    const hay = normalizeCardholderText(haystack).toLowerCase();
    const need = normalizeCardholderText(needle).toLowerCase();
    if (!need) return true;
    return hay.includes(need);
  };

  const toDayStart = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const toDayEnd = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
  const parseInputDate = (value, endOfDay = false) => {
    if (!value) return null;
    const normalized = String(value).trim();
    if (!normalized) return null;
    const parsed = new Date(`${normalized}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) return null;
    return endOfDay ? toDayEnd(parsed) : toDayStart(parsed);
  };
  const isWithinPurchaseDate = (row) => {
    if (purchaseDateFilter === "all") return true;
    const purchaseDate = parseGiftcardDate(row.firstTransactionDate);
    if (!purchaseDate) return false;
    const purchaseStart = toDayStart(purchaseDate);
    const now = new Date();

    if (purchaseDateFilter === "today") {
      return purchaseStart.valueOf() === toDayStart(now).valueOf();
    }

    if (purchaseDateFilter === "thisweek") {
      const weekStart = toDayStart(now);
      const day = weekStart.getDay();
      const offsetToMonday = day === 0 ? -6 : 1 - day;
      weekStart.setDate(weekStart.getDate() + offsetToMonday);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return purchaseStart >= weekStart && purchaseStart <= toDayEnd(weekEnd);
    }

    if (purchaseDateFilter === "thismonth") {
      return purchaseStart.getFullYear() === now.getFullYear() && purchaseStart.getMonth() === now.getMonth();
    }

    if (purchaseDateFilter === "custom") {
      const fromDate = parseInputDate(purchaseDateFrom, false);
      const toDate = parseInputDate(purchaseDateTo, true);
      if (!fromDate && !toDate) return true;
      if (fromDate && purchaseStart < fromDate) return false;
      if (toDate && purchaseStart > toDate) return false;
      return true;
    }

    return true;
  };

  const filteredRows = enrichedRows.filter((row) => {
    if (!matchContains(row.firstname, params?.firstName)) return false;
    if (!matchContains(row.lastname, params?.lastName)) return false;
    if (!matchContains(row.email, params?.email)) return false;

    const requestedCard = normalizeCardNumber(params?.cardNumber);
    if (requestedCard) {
      const currentCard = normalizeCardNumber(row.cardno || row.cardid);
      if (!currentCard.includes(requestedCard)) return false;
    }

    if (Number.isFinite(requestedAccountId)) {
      const accountId = parseInt(String(row.accountid || ""), 10);
      if (!Number.isFinite(accountId) || accountId !== requestedAccountId) return false;
    }

    if (minBalanceOre != null) {
      const balance = Number(row.balance);
      if (!Number.isFinite(balance) || balance < minBalanceOre) return false;
    }

    if (expiryFilter !== "all") {
      const expiryDate = parseGiftcardExpiryDate(row.expires);
      const hasCard = normalizeCardholderText(row.cardno) || row.cardid != null;
      if (!hasCard) return false;
      const isExpired = expiryDate ? expiryDate < new Date() : false;
      if (expiryFilter === "expired" && (!expiryDate || !isExpired)) return false;
      if (expiryFilter === "active" && isExpired) return false;
    }

    if (!isWithinPurchaseDate(row)) return false;

    return true;
  });

  const direction = sortDir === "DESC" ? -1 : 1;
  const statusOrder = {
    active: 0,
    blocked: 1,
    expired: 2,
    "": 3,
  };
  const getSortValue = (row, key) => {
    switch (key) {
      case "email":
        return normalizeCardholderText(row.email).toLowerCase();
      case "cardNo":
        return normalizeCardNumber(row.cardno || row.cardid);
      case "balance": {
        const val = Number(row.balance);
        return Number.isFinite(val) ? val : null;
      }
      case "expiry": {
        const dt = parseGiftcardExpiryDate(row.expires);
        return dt ? dt.valueOf() : null;
      }
      case "phone":
        return normalizeCardholderText(row.phone).toLowerCase();
      case "status": {
        const status = normalizeCardholderStatus(row.isblocked, row.expires);
        return statusOrder[status] ?? 3;
      }
      case "firstTransactionDate": {
        const dt = parseGiftcardDate(row.firstTransactionDate);
        return dt ? dt.valueOf() : null;
      }
      case "firstTransactionRetailstore":
        return normalizeCardholderText(row.firstTransactionRetailstore).toLowerCase();
      case "lastTransactionDate": {
        const dt = parseGiftcardDate(row.lastTransactionDate);
        return dt ? dt.valueOf() : null;
      }
      case "lastTransactionRetailstore":
        return normalizeCardholderText(row.lastTransactionRetailstore).toLowerCase();
      case "name":
      default:
        return `${normalizeCardholderText(row.lastname).toLowerCase()}|${normalizeCardholderText(row.firstname).toLowerCase()}`;
    }
  };

  filteredRows.sort((a, b) => {
    const valueA = getSortValue(a, normalizedSort || "name");
    const valueB = getSortValue(b, normalizedSort || "name");
    const isEmptyA = valueA == null || valueA === "";
    const isEmptyB = valueB == null || valueB === "";
    if (isEmptyA && isEmptyB) return 0;
    if (isEmptyA) return 1;
    if (isEmptyB) return -1;

    if (typeof valueA === "number" && typeof valueB === "number") {
      if (valueA === valueB) return 0;
      return (valueA < valueB ? -1 : 1) * direction;
    }

    const compared = String(valueA).localeCompare(String(valueB), "sv");
    if (compared === 0) return 0;
    return compared * direction;
  });

  const totalCount = filteredRows.length;
  const selectedRows = exportAll ? filteredRows : filteredRows.slice(offset, offset + safePageSize);
  const cardholders = selectedRows.map(mapDbCardholderRow);
  return {
    cardholders,
    totalCount,
    page: exportAll ? 1 : safePage,
    pageSize: exportAll ? totalCount : safePageSize,
  };
}

function normalizeGiftcardFilters(body) {
  const minBalanceRaw = body?.minBalanceOre;
  const minBalanceOre = Number(minBalanceRaw);
  const expiry = String(body?.expiryFilter || "").toLowerCase();
  const expiryFilter = expiry === "expired" || expiry === "active" ? expiry : "all";
  return {
    minBalanceOre: Number.isFinite(minBalanceOre) && minBalanceOre > 0 ? minBalanceOre : null,
    expiryFilter,
  };
}

function toInt32(value, fallback = -1) {
  const num = parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(num)) return fallback;
  if (num < -2147483648 || num > 2147483647) return fallback;
  return num;
}

function normalizeGiftcardSort(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  switch (key) {
    case "cardnumber":
      return "cardNumber";
    case "balance":
      return "balance";
    case "status":
      return "status";
    case "expiresat":
      return "expiresAt";
    case "firsttransactiondate":
      return "firstTransactionDate";
    case "lasttransactiondate":
      return "lastTransactionDate";
    default:
      return null;
  }
}

function normalizeSortDir(value) {
  return String(value || "").toLowerCase() === "desc" ? "DESC" : "ASC";
}

function buildGiftcardOrderBy(sortBy, sortDir, cardNumberExpr) {
  const dir = sortDir === "DESC" ? "DESC" : "ASC";
  switch (sortBy) {
    case "balance":
      return `COALESCE(va.balance, 0) ${dir}, vc.id DESC`;
    case "status":
      return `CASE WHEN vc.isblocked = 1 THEN 1 WHEN vc.expires IS NOT NULL AND vc.expires < GETDATE() THEN 2 ELSE 3 END ${dir}, vc.id DESC`;
    case "expiresAt":
      return `CASE WHEN vc.expires IS NULL THEN 1 ELSE 0 END ASC, vc.expires ${dir}, vc.id DESC`;
    case "firstTransactionDate":
      return `CASE WHEN first_tx.first_transaction_date IS NULL THEN 1 ELSE 0 END ASC, first_tx.first_transaction_date ${dir}, vc.id DESC`;
    case "lastTransactionDate":
      return `CASE WHEN last_tx.last_transaction_date IS NULL THEN 1 ELSE 0 END ASC, last_tx.last_transaction_date ${dir}, vc.id DESC`;
    case "cardNumber":
    default:
      return `${cardNumberExpr} ${dir}, vc.id DESC`;
  }
}

function normalizeCardholderSort(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  switch (key) {
    case "name":
      return "name";
    case "email":
      return "email";
    case "cardno":
      return "cardNo";
    case "balance":
      return "balance";
    case "expiry":
      return "expiry";
    case "phone":
      return "phone";
    case "status":
      return "status";
    case "firsttransactiondate":
    case "purchasedate":
      return "firstTransactionDate";
    case "firsttransactionretailstore":
    case "purchaselocation":
      return "firstTransactionRetailstore";
    case "lasttransactiondate":
    case "latesttransaction":
      return "lastTransactionDate";
    case "lasttransactionretailstore":
    case "latesttransactionlocation":
      return "lastTransactionRetailstore";
    default:
      return null;
  }
}

function buildCardholderOrderBy(sortBy, sortDir, cardNumberExpr, fallbackIdExpr = "cs.customerId") {
  const dir = sortDir === "DESC" ? "DESC" : "ASC";
  switch (sortBy) {
    case "email":
      return `c.email ${dir}, ${fallbackIdExpr} DESC`;
    case "cardNo":
      return `${cardNumberExpr} ${dir}, ${fallbackIdExpr} DESC`;
    case "balance":
      return `COALESCE(best.balance, 0) ${dir}, ${fallbackIdExpr} DESC`;
    case "expiry":
      return `CASE WHEN card.expires IS NULL THEN 1 ELSE 0 END ASC, card.expires ${dir}, ${fallbackIdExpr} DESC`;
    case "phone":
      return `${fallbackIdExpr} ${dir}`;
    case "name":
    default:
      return `c.lastname ${dir}, c.firstname ${dir}, ${fallbackIdExpr} DESC`;
  }
}

function parseGiftcardExpiryDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw || raw === "&nbsp;" || raw === "\u00a0" || raw === "-") return null;
  const direct = new Date(raw);
  if (!Number.isNaN(direct.valueOf())) return direct;

  const dmy = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})(?:\s|T|$)/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  const ymd = raw.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:\s|T|$)/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    return new Date(year, month, day);
  }

  return null;
}

function parseGiftcardDate(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.valueOf())) return direct;
  return null;
}

function pickPreferredGiftcard(existing, candidate) {
  if (!existing) return candidate;
  if (!candidate) return existing;

  const existingExpiry = parseGiftcardExpiryDate(existing.expiresAt);
  const candidateExpiry = parseGiftcardExpiryDate(candidate.expiresAt);
  const existingHasExpiry = !!existingExpiry;
  const candidateHasExpiry = !!candidateExpiry;

  if (existingHasExpiry !== candidateHasExpiry) {
    return candidateHasExpiry ? candidate : existing;
  }

  const existingCreated = parseGiftcardDate(existing.createdAt);
  const candidateCreated = parseGiftcardDate(candidate.createdAt);
  if (existingCreated && candidateCreated) {
    return candidateCreated > existingCreated ? candidate : existing;
  }
  if (candidateCreated && !existingCreated) return candidate;
  if (existingCreated && !candidateCreated) return existing;

  if (existingExpiry && candidateExpiry) {
    return candidateExpiry > existingExpiry ? candidate : existing;
  }

  return existing;
}

function dedupeGiftcards(giftcards) {
  const map = new Map();
  let fallbackIndex = 0;
  for (const gc of giftcards || []) {
    const keyRaw = String(gc.cardNumber || gc.id || "").trim();
    const key = keyRaw || `__row_${fallbackIndex++}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, gc);
    } else {
      map.set(key, pickPreferredGiftcard(existing, gc));
    }
  }
  return Array.from(map.values());
}

function applyGiftcardFilters(giftcards, filters) {
  if (!filters) return giftcards;
  const minBalance = filters.minBalanceOre;
  const expiryFilter = filters.expiryFilter || "all";
  if (!minBalance && expiryFilter === "all") return giftcards;

  const now = new Date();
  return giftcards.filter((gc) => {
    if (minBalance && (gc.balance || 0) < minBalance) return false;
    if (expiryFilter !== "all") {
      const expiryDate = parseGiftcardExpiryDate(gc.expiresAt);
      const isExpired = expiryDate ? expiryDate < now : false;
      if (expiryFilter === "expired" && !isExpired) return false;
      if (expiryFilter === "active" && isExpired) return false;
    }
    return true;
  });
}

function normalizeAccountIds(values) {
  const ids = [];
  const seen = new Set();
  for (const value of values || []) {
    const parsed = parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) continue;
    if (seen.has(parsed)) continue;
    seen.add(parsed);
    ids.push(parsed);
  }
  return ids;
}

function normalizeCardNumber(value) {
  return String(value || "").trim().replace(/[\s-]+/g, "");
}

function resolveAccountOverride(session, cardNumber) {
  const overrides = session?.cardAccountOverrides;
  if (!overrides || !cardNumber) return null;
  const raw = String(cardNumber);
  const normalized = normalizeCardNumber(raw);
  return overrides[normalized] || overrides[raw] || null;
}

function chunkArray(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

async function getTransactionSummaryByAccountIds(accountIds) {
  const ids = normalizeAccountIds(accountIds);
  if (ids.length === 0) return new Map();

  const summaryByAccount = new Map();
  const chunks = chunkArray(ids, 500);

  for (const chunk of chunks) {
    const params = chunk.map((id, index) => ({
      name: `accountId${index}`,
      type: sql.Int,
      value: id,
    }));
    const valuesSql = params.map((p) => `(@${p.name})`).join(", ");
    const rows = await query(
      `WITH requested(accountid) AS (
         SELECT DISTINCT v.accountid
         FROM (VALUES ${valuesSql}) v(accountid)
       ),
       tx AS (
         SELECT
           vt.accountid,
           vt.startdate,
           vt.transactiontypeid,
           vt.title,
           vt.retailstore_name,
           ROW_NUMBER() OVER (PARTITION BY vt.accountid ORDER BY vt.startdate ASC, vt.id ASC) AS rn_first,
           ROW_NUMBER() OVER (PARTITION BY vt.accountid ORDER BY vt.startdate DESC, vt.id DESC) AS rn_last
         FROM view_transaction vt
         INNER JOIN requested r
           ON r.accountid = vt.accountid
       )
       SELECT
         r.accountid AS accountid,
         MAX(CASE WHEN tx.rn_first = 1 THEN tx.startdate END) AS first_transaction_date,
         MAX(CASE WHEN tx.rn_first = 1 THEN tx.retailstore_name END) AS first_transaction_retailstore,
         MAX(CASE WHEN tx.rn_last = 1 THEN tx.startdate END) AS last_transaction_date,
         MAX(CASE WHEN tx.rn_last = 1 THEN tx.transactiontypeid END) AS last_transaction_type_id,
         MAX(CASE WHEN tx.rn_last = 1 THEN tx.title END) AS last_transaction_title,
         MAX(CASE WHEN tx.rn_last = 1 THEN tx.retailstore_name END) AS last_transaction_retailstore
       FROM requested r
       LEFT JOIN tx
         ON tx.accountid = r.accountid
       GROUP BY r.accountid`,
      params
    );

    for (const row of rows || []) {
      summaryByAccount.set(String(row.accountid), {
        firstTransactionDate: row.first_transaction_date ? String(row.first_transaction_date) : "",
        firstTransactionRetailstore: row.first_transaction_retailstore ? String(row.first_transaction_retailstore) : "",
        lastTransactionDate: row.last_transaction_date ? String(row.last_transaction_date) : "",
        lastTransactionType: row.last_transaction_type_id != null ? String(row.last_transaction_type_id) : "",
        lastTransactionTitle: row.last_transaction_title ? String(row.last_transaction_title) : "",
        lastTransactionRetailstore: row.last_transaction_retailstore ? String(row.last_transaction_retailstore) : "",
      });
    }
  }

  return summaryByAccount;
}

async function resolveAccountIdsForCardNumbers(supportId, cardNumbers) {
  const cleanSupportId = parseInt(String(supportId || ""), 10);
  if (!Number.isFinite(cleanSupportId)) return new Map();

  const normalizedCards = [];
  const seen = new Set();
  for (const card of cardNumbers || []) {
    const normalized = normalizeCardNumber(card);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    normalizedCards.push(normalized);
  }
  if (normalizedCards.length === 0) return new Map();

  const map = new Map();
  const chunks = chunkArray(normalizedCards, 500);

  for (const chunk of chunks) {
    const params = [
      { name: "supportId", type: sql.Int, value: cleanSupportId },
      ...chunk.map((card, index) => ({
        name: `cardNo${index}`,
        type: sql.VarChar,
        value: card,
      })),
    ];
    const placeholders = chunk.map((_, index) => `@cardNo${index}`).join(", ");
    const rows = await query(
      `SELECT vc.accountid, vc.shortcardnumber, vc.shortcardnumber2
       FROM view_card vc
       WHERE vc.supportid = @supportId
         AND (vc.shortcardnumber IN (${placeholders}) OR vc.shortcardnumber2 IN (${placeholders}))`,
      params
    );

    for (const row of rows || []) {
      const accountId = row.accountid != null ? String(row.accountid) : "";
      if (!accountId) continue;
      const short1 = normalizeCardNumber(row.shortcardnumber);
      const short2 = normalizeCardNumber(row.shortcardnumber2);
      if (short1) map.set(short1, accountId);
      if (short2) map.set(short2, accountId);
    }
  }

  return map;
}

async function enrichGiftcardsWithTransactionSummary(session, giftcards) {
  if (!giftcards || giftcards.length === 0) return giftcards;
  try {
    const cardNumberToAccount = await resolveAccountIdsForCardNumbers(
      session?.selectedCustomerId,
      giftcards.map((gc) => gc.cardNumber)
    );

    const accountIds = giftcards.map((gc) => gc.accountId);
    for (const accountId of cardNumberToAccount.values()) {
      accountIds.push(accountId);
    }

    const summaryByAccount = await getTransactionSummaryByAccountIds(accountIds);
    if (summaryByAccount.size === 0) return giftcards;
    return giftcards.map((gc) => {
      let accountId = parseInt(String(gc.accountId), 10);
      if (!Number.isFinite(accountId)) {
        const normalizedCard = normalizeCardNumber(gc.cardNumber);
        const mapped = normalizedCard ? cardNumberToAccount.get(normalizedCard) : null;
        accountId = mapped ? parseInt(mapped, 10) : NaN;
      }
      if (!Number.isFinite(accountId)) return gc;
      const summary = summaryByAccount.get(String(accountId));
      if (!summary) return gc;
      return { ...gc, ...summary };
    });
  } catch (error) {
    console.log("[giftcards] Failed to load transaction summary:", error);
    return giftcards;
  }
}

async function listGiftcardsFromDb(session, pageSize = 100, page = 1, queryText = "", filterInput = {}) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) return [];
  const safePageSize = Math.min(Math.max(parseInt(pageSize, 10) || 100, 1), 500);
  const safePage = Math.max(parseInt(page, 10) || 1, 1);
  const offset = (safePage - 1) * safePageSize;
  const q = String(queryText || "").trim();
  const qNormalized = q.replace(/[\s-]+/g, "");
  const hasQuery = q.length > 0;
  const normalizedFilters = normalizeGiftcardFilters(filterInput);
  const normalizedSort = normalizeGiftcardSort(filterInput?.sortBy) || "cardNumber";
  const sortDir = normalizeSortDir(filterInput?.sortDir);
  const cardNumberExpr = buildCardNumberExpression("vc");
  const needsTxSort = normalizedSort === "firstTransactionDate" || normalizedSort === "lastTransactionDate";
  const txApplies = needsTxSort
    ? `OUTER APPLY (
         SELECT TOP 1 t.startdate AS first_transaction_date
         FROM [transaction] t
         WHERE t.accountid = vc.accountid
         ORDER BY t.startdate ASC, t.id ASC
       ) first_tx
       OUTER APPLY (
         SELECT TOP 1
           t.startdate AS last_transaction_date,
           t.transactiontypeid AS last_transaction_type_id,
           t.title AS last_transaction_title
         FROM [transaction] t
         WHERE t.accountid = vc.accountid
         ORDER BY t.startdate DESC, t.id DESC
       ) last_tx`
    : "";
  const orderBy = buildGiftcardOrderBy(normalizedSort, sortDir, cardNumberExpr);
  const whereFilters = [];
  const params = [
    { name: "supportId", type: sql.Int, value: supportId },
    { name: "offset", type: sql.Int, value: offset },
    { name: "pageSize", type: sql.Int, value: safePageSize },
  ];
  if (hasQuery) {
    whereFilters.push(`(${buildCardNumberLikeFilter("vc", "queryLike")} OR vc.id = @cardId)`);
    params.push({ name: "queryLike", type: sql.VarChar, value: `%${qNormalized || q}%` });
    const cardId = toInt32(qNormalized || q, -1);
    params.push({ name: "cardId", type: sql.Int, value: cardId });
  }

  const minBalance = Number(normalizedFilters?.minBalanceOre);
  if (Number.isFinite(minBalance) && minBalance > 0) {
    whereFilters.push("COALESCE(va.balance, 0) >= @minBalance");
    params.push({ name: "minBalance", type: sql.Int, value: minBalance });
  }
  const expiryFilter = normalizedFilters?.expiryFilter;
  if (expiryFilter === "expired") {
    whereFilters.push("vc.expires IS NOT NULL AND vc.expires < GETDATE()");
  } else if (expiryFilter === "active") {
    whereFilters.push("(vc.expires IS NULL OR vc.expires >= GETDATE())");
  }

  const whereQuery = whereFilters.length ? `AND ${whereFilters.join(" AND ")}` : "";

  const countRows = await query(
    `SELECT COUNT(1) AS total
     FROM view_card vc
     LEFT JOIN view_account va
       ON va.id = vc.accountid AND va.supportid = vc.supportid
     WHERE vc.supportid = @supportId
     ${whereQuery}`,
    params.filter((p) => p.name !== "offset" && p.name !== "pageSize")
  );
  const totalCount = countRows?.[0]?.total || 0;

  const rows = await query(
    `SELECT
        vc.id AS cardid,
        vc.accountid AS accountid,
        ${cardNumberExpr} AS cardno,
        vc.expires AS expires,
        vc.isblocked AS isblocked,
        vc.date AS created,
        va.balance AS balance
     FROM view_card vc
     LEFT JOIN view_account va
       ON va.id = vc.accountid AND va.supportid = vc.supportid
     ${txApplies}
     WHERE vc.supportid = @supportId
     ${whereQuery}
     ORDER BY ${orderBy}
     OFFSET @offset ROWS
     FETCH NEXT @pageSize ROWS ONLY`,
    params
  );

  const giftcards = (rows || []).map((row) => {
    const expiresAt = row.expires ? new Date(row.expires) : null;
    const isExpired = expiresAt ? expiresAt < new Date() : false;
    const status = row.isblocked ? "blocked" : isExpired ? "expired" : "active";
    const cardNumber = row.cardno || String(row.cardid);
    return {
      id: cardNumber,
      cardNumber,
      accountId: String(row.accountid || ""),
      balance: row.balance || 0,
      status,
      expiresAt: row.expires ? String(row.expires) : "",
      createdAt: row.created ? String(row.created) : "",
    };
  });

  const uniqueGiftcards = dedupeGiftcards(giftcards);
  const enrichedGiftcards = await enrichGiftcardsWithTransactionSummary(session, uniqueGiftcards);
  const finalTotalCount = hasQuery ? enrichedGiftcards.length : totalCount;
  return { giftcards: enrichedGiftcards, totalCount: finalTotalCount, page: safePage, pageSize: safePageSize };
}

export async function getGiftcardDetailsFromDb(session, cardNumber) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId) || !cardNumber) return null;

  const cardId = toInt32(cardNumber, -1);
  const params = [
    { name: "supportId", type: sql.Int, value: supportId },
    { name: "cardNo", type: sql.VarChar, value: String(cardNumber) },
    { name: "cardId", type: sql.Int, value: cardId },
  ];

  const cardNumberExpr = buildCardNumberExpression("vc");
  const rows = await query(
    `SELECT TOP 1
        vc.id AS cardid,
        vc.accountid AS accountid,
        ${cardNumberExpr} AS cardno,
        vc.expires AS expires,
        vc.isblocked AS isblocked,
        vc.date AS created,
        va.balance AS balance,
        vcu.id AS customerid,
        vcu.firstname AS firstname,
        vcu.lastname AS lastname,
        vcu.email AS email
     FROM view_card vc
     LEFT JOIN view_account va
       ON va.id = vc.accountid AND va.supportid = vc.supportid
     LEFT JOIN view_customer vcu
       ON vcu.accountId = vc.accountid AND vcu.supportid = vc.supportid
     WHERE vc.supportid = @supportId
       AND (vc.shortcardnumber2 = @cardNo OR vc.shortcardnumber = @cardNo OR vc.id = @cardId)
     ORDER BY
       CASE
         WHEN vc.shortcardnumber2 = @cardNo OR vc.shortcardnumber = @cardNo THEN 0
         ELSE 1
       END,
       vc.id DESC`,
    params
  );

  if (!rows || rows.length === 0) return null;
  const row = rows[0];
  const expiresAt = row.expires ? new Date(row.expires) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const status = row.isblocked ? "blocked" : isExpired ? "expired" : "active";

  const overrideAccountIdRaw = resolveAccountOverride(session, cardNumber);
  const overrideAccountId = toInt32(overrideAccountIdRaw, NaN);
  const resolvedAccountId = Number.isFinite(overrideAccountId) ? overrideAccountId : row.accountid;

  let resolvedBalance = row.balance || 0;
  if (Number.isFinite(overrideAccountId) && String(overrideAccountId) !== String(row.accountid)) {
    try {
      const balanceRows = await query(
        `SELECT TOP 1 va.balance AS balance
         FROM view_account va
         WHERE va.id = @accountId AND va.supportid = @supportId`,
        [
          { name: "accountId", type: sql.Int, value: overrideAccountId },
          { name: "supportId", type: sql.Int, value: supportId },
        ]
      );
      if (balanceRows && balanceRows.length > 0 && balanceRows[0].balance != null) {
        resolvedBalance = balanceRows[0].balance;
      }
    } catch (error) {
      console.log("[giftcard] Failed to resolve balance override:", error);
    }
  }

  const txRows = await query(
    `SELECT TOP 200
        t.id AS id,
        t.accountid AS accountid,
        t.amount AS amount,
        t.transactiontypeid AS type,
        t.title AS title,
        t.startdate AS startdate,
        t.guid AS guid,
        t.receiptid AS receiptid
     FROM [transaction] t
     WHERE t.accountid = @accountId
     ORDER BY t.startdate DESC`,
    [{ name: "accountId", type: sql.Int, value: resolvedAccountId }]
  );

  const transactions = (txRows || []).map((tx) => ({
    id: String(tx.id),
    accountId: String(tx.accountid),
    amount: tx.amount || 0,
    type: tx.type != null ? String(tx.type) : "",
    description: tx.title || "",
    date: tx.startdate ? String(tx.startdate) : "",
    receiptGuid: tx.guid || undefined,
    receiptId: tx.receiptid != null ? String(tx.receiptid) : undefined,
  }));

  let customerExtras = {};
  const mapCustomerExtras = (extra) => ({
    street: extra?.street || "",
    city: extra?.city || "",
    postalcode: extra?.postalcode || "",
    country: extra?.country || "",
    company: extra?.company || "",
    phone1: extra?.phone1 || "",
    phone2: extra?.phone2 || "",
  });
  try {
    const accountId = parseInt(resolvedAccountId, 10);
    let customerId = row.customerid ? parseInt(row.customerid, 10) : NaN;

    if (!Number.isFinite(customerId) && Number.isFinite(accountId)) {
      const viewRows = await query(
        `SELECT TOP 1 id
         FROM view_customer
         WHERE accountid = @accountId`,
        [{ name: "accountId", type: sql.Int, value: accountId }]
      );
      if (viewRows && viewRows.length > 0) {
        customerId = parseInt(viewRows[0].id, 10);
      }
    }

    if (!Number.isFinite(customerId) && Number.isFinite(accountId)) {
      const linkRows = await query(
        `SELECT TOP 1 customerid
         FROM customer_account
         WHERE accountid = @accountId`,
        [{ name: "accountId", type: sql.Int, value: accountId }]
      );
      if (linkRows && linkRows.length > 0) {
        customerId = parseInt(linkRows[0].customerid, 10);
      }
    }

    let customerRows = [];
    if (Number.isFinite(customerId)) {
      customerRows = await query(
        `SELECT TOP 1 street, city, postalcode, country, company, phone1, phone2
         FROM customer
         WHERE id = @customerId`,
        [{ name: "customerId", type: sql.Int, value: customerId }]
      );
    } else if (row.email) {
      customerRows = await query(
        `SELECT TOP 1 street, city, postalcode, country, company, phone1, phone2
         FROM customer
         WHERE email = @email`,
        [{ name: "email", type: sql.VarChar, value: String(row.email) }]
      );
    }

    if (customerRows && customerRows.length > 0) {
      customerExtras = mapCustomerExtras(customerRows[0]);
    }
  } catch (error) {
    console.log("[giftcard] Customer details lookup failed:", error);
  }

  const hasCustomerExtras = Object.values(customerExtras).some((value) => {
    if (!value) return false;
    const trimmed = String(value).trim();
    return trimmed && trimmed !== "&nbsp;" && trimmed !== "\u00a0";
  });
  const hasCustomerBase = !!(row.firstname || row.lastname || row.email);
  const hasCustomerData = hasCustomerBase || hasCustomerExtras;

  return {
    id: row.cardno || String(row.cardid),
    cardNumber: row.cardno || String(row.cardid),
    accountId: String(resolvedAccountId || ""),
    balance: resolvedBalance || 0,
    status,
    expiresAt: row.expires ? String(row.expires) : "",
    createdAt: row.created ? String(row.created) : "",
    transactions,
    customer: hasCustomerData ? {
      id: "",
      firstName: row.firstname || "",
      lastName: row.lastname || "",
      email: row.email || "",
      ...customerExtras,
    } : undefined,
  };
}
export async function loginBizdesk({ username, password, supportId }) {
  try {
    const loginVersion = "node-express-2026-02-27";
    const explicitSupportId = supportId ? String(supportId) : null;
    let cookieMap = {};
    let chosenSupportId = supportId || null;
    const updateCookies = (headers) => {
      cookieMap = { ...cookieMap, ...extractCookies(headers) };
    };
    const cookieHeader = () => buildCookieHeader(cookieMap);

    const getResponse = await fetchWithTimeout(`${AUTH_BASE_URL}/bizdesk/login`, {
      method: "GET",
      redirect: "manual",
    }, TIMEOUT_MS);

    const html = await decodeResponseText(getResponse);
    updateCookies(getResponse.headers);
    const formFields = parseFormFields(html);
    const formAction = extractFormAction(html, "/bizdesk/login");

    const formData = buildFormData(formFields, {
      "__LASTFOCUS": "",
      "__EVENTTARGET": "btnLogin",
      "__EVENTARGUMENT": "",
      "frmUsername": username,
      "frmPassword": password,
    });

    const loginPageUrl = `${AUTH_BASE_URL}/bizdesk/login`;
    const postUrl = new URL(formAction, loginPageUrl).toString();
    let postResponse = await fetchWithTimeout(postUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookieHeader(),
        "User-Agent": USER_AGENT,
        "Referer": `${AUTH_BASE_URL}/bizdesk/login`,
        "Origin": AUTH_BASE_URL,
      },
      redirect: "manual",
      body: formData.toString(),
    }, TIMEOUT_MS);

    let currentHtml = await decodeResponseText(postResponse);
    updateCookies(postResponse.headers);

    const loginError = isLoginForm(currentHtml) && !isRoleSelectionForm(currentHtml);

    let location = postResponse.headers.get("location") || "";
    let selectedCustomerId = extractCustomerIdFromUrl(postResponse.url)
      || extractCustomerIdFromLocation(location)
      || extractCustomerIdFromHtml(currentHtml);

    async function followLocationIfNeeded(loc) {
      if (!loc) return;
      const targetUrl = loc.startsWith("http") ? loc : `${AUTH_BASE_URL}${loc}`;
      const resp = await fetchWithTimeout(targetUrl, {
        method: "GET",
        headers: { "Cookie": cookieHeader(), "User-Agent": USER_AGENT },
        redirect: "follow",
      }, TIMEOUT_MS);
      const htmlFollow = await decodeResponseText(resp);
      updateCookies(resp.headers);
      selectedCustomerId = selectedCustomerId
        || extractCustomerIdFromUrl(resp.url)
        || extractCustomerIdFromHtml(htmlFollow);
    }

    if (postResponse.status === 200 && /frmRoles|btnSetRole/i.test(currentHtml)) {
      const roleSelect = extractSelectByToken(currentHtml, "frmRoles");
      const roleOptions = roleSelect?.options || extractSelectOptionsByName(currentHtml, "frmRoles");
      const roleValue = findRoleValueFromOptions(roleOptions) || "3";
      const roleFieldName = roleSelect?.name || "frmRoles";
      const roleTarget = findPostbackTargetById(currentHtml, "btnSetRole") || "btnSetRole";
      const hidden2 = parseFormFields(currentHtml);
      const formAction2 = extractFormAction(currentHtml, "/bizdesk/login");
      const form2 = buildFormData(hidden2, {
        "__LASTFOCUS": "",
        "__EVENTTARGET": roleTarget,
        "__EVENTARGUMENT": "",
        [roleFieldName]: roleValue,
      });

      const postUrl2 = new URL(formAction2, loginPageUrl).toString();
      postResponse = await fetchWithTimeout(postUrl2, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookieHeader(),
          "User-Agent": USER_AGENT,
          "Referer": `${AUTH_BASE_URL}/bizdesk/login`,
          "Origin": AUTH_BASE_URL,
        },
        redirect: "manual",
        body: form2.toString(),
      }, TIMEOUT_MS);
      currentHtml = await decodeResponseText(postResponse);
      updateCookies(postResponse.headers);
      location = postResponse.headers.get("location") || "";
      selectedCustomerId = selectedCustomerId
        || extractCustomerIdFromUrl(postResponse.url)
        || extractCustomerIdFromLocation(location)
        || extractCustomerIdFromHtml(currentHtml);
      if (!selectedCustomerId && chosenSupportId) {
        selectedCustomerId = chosenSupportId;
      }
    }

    const supportSelect = extractSelectByToken(currentHtml, "DropDownListSupport");
    const supportOptions = supportSelect?.options || extractSelectOptionsByName(currentHtml, "DropDownListSupport");
    const supportFieldName = supportSelect?.name || "DropDownListSupport";
    const supportTarget = postResponse.status === 200
      ? (findPostbackTargetById(currentHtml, "LinkButtonSupport") || findSupportPostbackTarget(currentHtml))
      : null;
    if (supportOptions.length > 0 && supportTarget) {
      chosenSupportId = chosenSupportId || (supportOptions.length === 1 ? supportOptions[0].value : null);
      if (chosenSupportId && !supportOptions.some((opt) => opt.value === String(chosenSupportId))) {
        chosenSupportId = null;
      }
      if (!chosenSupportId) {
        return { success: false, needsSupportSelection: true, supportOptions, loginVersion };
      }

      const hidden3 = parseFormFields(currentHtml);
      const formAction3 = extractFormAction(currentHtml, "/bizdesk/login");
      const form3 = buildFormData(hidden3, {
        "__LASTFOCUS": "",
        "__EVENTTARGET": supportTarget,
        "__EVENTARGUMENT": "",
        [supportFieldName]: chosenSupportId,
      });

      const postUrl3 = new URL(formAction3, loginPageUrl).toString();
      postResponse = await fetchWithTimeout(postUrl3, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Cookie": cookieHeader(),
          "User-Agent": USER_AGENT,
          "Referer": `${AUTH_BASE_URL}/bizdesk/login`,
          "Origin": AUTH_BASE_URL,
        },
        redirect: "manual",
        body: form3.toString(),
      }, TIMEOUT_MS);
      currentHtml = await decodeResponseText(postResponse);
      updateCookies(postResponse.headers);
      location = postResponse.headers.get("location") || "";
      selectedCustomerId = selectedCustomerId
        || extractCustomerIdFromUrl(postResponse.url)
        || extractCustomerIdFromLocation(location)
        || extractCustomerIdFromHtml(currentHtml);
      if (!selectedCustomerId && chosenSupportId) {
        selectedCustomerId = String(chosenSupportId);
      }
    }

    if (location) {
      await followLocationIfNeeded(location);
    }

    if (!cookieMap[".bizdesk"]) {
      if (loginError) {
        return { success: false, error: "Felaktiga inloggningsuppgifter", loginVersion };
      }
      const dbResult = await loginFromDb({ username, password, supportId: chosenSupportId || supportId });
      if (dbResult.success || dbResult.needsSupportSelection) {
        return dbResult;
      }
      return { success: false, error: "Inloggningen misslyckades", loginVersion };
    }

    let needsCustomer = false;
    let customerOptions = [];

    try {
      let hadTimeout = false;
      const fetchCustomerOptions = async (url) => {
        try {
          const resp = await fetchWithTimeout(url, {
            method: "GET",
            headers: { "Cookie": cookieHeader(), "User-Agent": USER_AGENT },
            redirect: "follow",
          }, TIMEOUT_MS);
          const htmlResp = await decodeResponseText(resp);
          updateCookies(resp.headers);
          const options = extractCustomerOptionsFromHtml(htmlResp);
          const invalid = resp.status >= 400 || isLoginForm(htmlResp);
          return { resp, html: htmlResp, options, invalid, timedOut: false };
        } catch (error) {
          hadTimeout = true;
          console.log(`[login] fetchCustomerOptions timeout for ${url}:`, error);
          return { resp: null, html: "", options: [], invalid: false, timedOut: true };
        }
      };

      const baseResult = await fetchCustomerOptions(`${AUTH_BASE_URL}/bizdesk/default.aspx`);
      const baseOptions = baseResult.options;

      let selectedOptions = [];
      let selectedInvalid = false;
      if (selectedCustomerId) {
        const selectedResult = await fetchCustomerOptions(`${AUTH_BASE_URL}/bizdesk/${selectedCustomerId}/default.aspx`);
        selectedOptions = selectedResult.options;
        selectedInvalid = selectedResult.invalid;
      }

      const mergedMap = new Map();
      for (const opt of baseOptions) {
        if (opt.value) mergedMap.set(opt.value, opt);
      }
      for (const opt of selectedOptions) {
        if (opt.value && !mergedMap.has(opt.value)) mergedMap.set(opt.value, opt);
      }
      customerOptions = Array.from(mergedMap.values());

      if (selectedCustomerId && selectedInvalid && !(explicitSupportId && String(selectedCustomerId) === explicitSupportId)) {
        customerOptions = customerOptions.filter((o) => o.value !== selectedCustomerId);
        selectedCustomerId = null;
        needsCustomer = true;
      }

      if (selectedCustomerId && customerOptions.length > 0 && !customerOptions.some((o) => o.value === selectedCustomerId)) {
        selectedCustomerId = null;
      }

      if (!selectedCustomerId && customerOptions.length === 1 && customerOptions[0].value) {
        selectedCustomerId = customerOptions[0].value;
        needsCustomer = false;
      } else if (customerOptions.length > 1) {
        needsCustomer = true;
      }

      const shouldSkipCardaccountValidation = explicitSupportId
        && String(selectedCustomerId) === explicitSupportId
        && customerOptions.length === 0;
      if (!hadTimeout && selectedCustomerId && !shouldSkipCardaccountValidation) {
        try {
          let findResp = await fetchWithTimeout(`${AUTH_BASE_URL}/bizdesk/${selectedCustomerId}/cardaccount_find`, {
            method: "GET",
            headers: { "Cookie": cookieHeader(), "User-Agent": USER_AGENT },
            redirect: "manual",
          }, TIMEOUT_MS);
          updateCookies(findResp.headers);
          if (findResp.status === 301 || findResp.status === 302) {
            const loc = findResp.headers.get("location");
            const fullLoc = loc?.startsWith("http") ? loc : `${AUTH_BASE_URL}${loc}`;
            if (fullLoc) {
              findResp = await fetchWithTimeout(fullLoc, {
                method: "GET",
                headers: { "Cookie": cookieHeader(), "User-Agent": USER_AGENT },
                redirect: "manual",
              }, TIMEOUT_MS);
              updateCookies(findResp.headers);
            }
          }

          let findInvalid = false;
          if (!findInvalid && findResp.status >= 400) {
            findInvalid = true;
          }

          if (!findInvalid) {
            const findHtml = await decodeResponseText(findResp);
            if (isLoginForm(findHtml)) {
              findInvalid = true;
            } else {
              const findFields = parseHiddenFields(findHtml);
              if (!findFields["__VIEWSTATE"]) {
                findInvalid = true;
              }
            }
          }

          if (findInvalid) {
            customerOptions = customerOptions.filter((o) => o.value !== selectedCustomerId);
            selectedCustomerId = null;
            needsCustomer = true;
            if (customerOptions.length === 1 && customerOptions[0].value) {
              selectedCustomerId = customerOptions[0].value;
              needsCustomer = false;
            }
          }
        } catch (err) {
          console.log("[login] validateCardAccountFind error", err);
        }
      }
    } catch (err) {
      console.error("[login] Customer detection error:", err);
      needsCustomer = true;
    }

    // DB fallback if Bizdesk does not expose customer list
    if (!selectedCustomerId || (customerOptions.length === 0 && !cookieMap[".bizdesk"])) {
      const dbOptions = await getCustomerOptionsFromDb(username);
      if (dbOptions.length > 0) {
        if (customerOptions.length === 0) {
          customerOptions = dbOptions;
        }
        if (!selectedCustomerId && dbOptions.length === 1) {
          selectedCustomerId = dbOptions[0].value;
          needsCustomer = false;
        } else if (!selectedCustomerId && dbOptions.length > 1) {
          needsCustomer = true;
        }
      }
    }

    if (!selectedCustomerId && explicitSupportId && cookieMap[".bizdesk"]) {
      selectedCustomerId = explicitSupportId;
      needsCustomer = false;
    }

    if (!selectedCustomerId) {
      needsCustomer = true;
    }

    const sessionData = {
      cookies: buildCookieHeader(cookieMap),
      selectedCustomerId: selectedCustomerId || null,
      needsCustomer: !!needsCustomer,
      customerOptions: customerOptions || [],
      loginVersion,
    };

    return {
      success: true,
      role: "Kundsupport",
      needsCustomer: sessionData.needsCustomer,
      selectedCustomerId: sessionData.selectedCustomerId,
      customerOptions: sessionData.customerOptions,
      cookies: sessionData.cookies,
      loginVersion,
      authSource: "bizdesk",
    };
  } catch (error) {
    const dbResult = await loginFromDb({ username, password, supportId });
    if (dbResult.success || dbResult.needsSupportSelection) {
      return dbResult;
    }
    return { success: false, error: "Login gateway error", details: String(error) };
  }
}
export async function getReportFilters(session) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) throw new Error("Ingen kund vald");

  const dateRegions = [
    { value: "today", label: "Idag" },
    { value: "yesterday", label: "Ig\u00e5r" },
    { value: "week", label: "Denna vecka" },
    { value: "last week", label: "F\u00f6rra veckan" },
    { value: "month", label: "Denna m\u00e5nad" },
    { value: "last month", label: "F\u00f6rra m\u00e5naden" },
    { value: "year", label: "I \u00e5r" },
    { value: "last year", label: "F\u00f6rra \u00e5ret" },
  ];

  const transactionTypes = [
    { value: "all", label: "Alla" },
    { value: "purchase", label: "K\u00f6p" },
    { value: "deposit", label: "Ins\u00e4ttning" },
    { value: "buyback", label: "\u00c5terk\u00f6p" },
    { value: "clearing", label: "Avr\u00e4kning" },
  ];

  const retailstores = await getRetailstoresForReport(supportId);
  const retailstoreOptions = [{ value: "all", label: "Alla" }, ...retailstores];
  const balanceRetailstoreRows = await query(
    `SELECT DISTINCT
        COALESCE(NULLIF(LTRIM(RTRIM(vt.retailstore_name)), ''), 'Okänt säljställe') AS retailstoreName
     FROM view_transaction vt
     WHERE vt.supportid = @supportId
     ORDER BY COALESCE(NULLIF(LTRIM(RTRIM(vt.retailstore_name)), ''), 'Okänt säljställe')`,
    [{ name: "supportId", type: sql.Int, value: supportId }]
  );
  const balanceRetailstores = [
    { value: "all", label: "Alla" },
    ...(balanceRetailstoreRows || []).map((row) => {
      const retailstoreName = String(row.retailstoreName || "").trim() || "Okänt säljställe";
      return { value: retailstoreName, label: retailstoreName };
    }),
  ];
  const presentcardAccountRows = await query(
    `SELECT DISTINCT
        vpt.cardname AS accountName
     FROM account a
     INNER JOIN view_poolcardtype vpt
       ON vpt.id = a.poolcardtypeid
      AND vpt.supportid = @supportId
     WHERE vpt.cardname IS NOT NULL
       AND LTRIM(RTRIM(vpt.cardname)) <> ''
     ORDER BY vpt.cardname`,
    [{ name: "supportId", type: sql.Int, value: supportId }]
  );
  const presentcardAccounts = [
    { value: "all", label: "Alla" },
    ...(presentcardAccountRows || []).map((row) => {
      const accountName = String(row.accountName || "").trim();
      return { value: accountName, label: accountName };
    }),
  ];

  return { dateRegions, transactionTypes, retailstores: retailstoreOptions, presentcardAccounts, balanceRetailstores };
}

export async function getBalanceReport(session, filters) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const asOfDateInput = String(filters?.asOfDate || "").trim();
  let asOfDate = null;
  let asOfDateEnd = null;
  if (asOfDateInput) {
    const parsed = new Date(asOfDateInput.includes("T") ? asOfDateInput : `${asOfDateInput}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) {
      return { success: false, error: "Ogiltigt datum" };
    }
    asOfDate = parsed;
    asOfDateEnd = new Date(parsed);
    asOfDateEnd.setDate(asOfDateEnd.getDate() + 1);
  }

  const expiryStatusInput = String(filters?.expiryStatus || "").toLowerCase();
  const expiryStatus = expiryStatusInput === "expired" || expiryStatusInput === "active" ? expiryStatusInput : "all";
  const viewModeInput = String(filters?.viewMode || "").toLowerCase();
  const viewMode = viewModeInput === "summary" ? "summary" : "per-card";
  const includeZeroBalance = filters?.includeZeroBalance === undefined
    ? true
    : String(filters.includeZeroBalance).toLowerCase() !== "false";
  const includeLatestTransaction = String(filters?.includeLatestTransaction || "").toLowerCase() === "true";
  const pageSizeRaw = parseInt(filters?.pageSize, 10);
  const pageSize = Math.min(Math.max(pageSizeRaw || 100, 1), 500);
  const pageRaw = parseInt(filters?.page, 10);
  const page = Math.max(pageRaw || 1, 1);
  const offset = (page - 1) * pageSize;

  const now = new Date();
  const expiryDate = asOfDate || now;
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const useCurrentBalances = !asOfDate || asOfDate >= todayStart;

  if (useCurrentBalances) {
    const whereParts = [
      "card.cardNumber IS NOT NULL",
      "card.cardNumber <> ''",
    ];
    const baseParams = [
      { name: "supportId", type: sql.Int, value: supportId },
      { name: "expiryDate", type: sql.DateTime, value: expiryDate },
    ];

    if (expiryStatus === "expired") {
      whereParts.push("card.expires IS NOT NULL AND card.expires < @expiryDate");
    } else if (expiryStatus === "active") {
      whereParts.push("(card.expires IS NULL OR card.expires >= @expiryDate)");
    }
    if (!includeZeroBalance) {
      whereParts.push("COALESCE(s.balance, 0) <> 0");
    }

    const baseCte = `
      WITH account_scope AS (
        SELECT
          a.id AS accountId,
          a.balance AS balance,
          vpt.cardname AS accountName
        FROM account a
        INNER JOIN view_poolcardtype vpt
          ON vpt.id = a.poolcardtypeid
         AND vpt.supportid = @supportId
      )
    `;
    const totalFrom = `
      FROM account_scope s
      OUTER APPLY (
        SELECT TOP 1
          COALESCE(NULLIF(c.shortcardnumber2, ''), NULLIF(c.shortcardnumber, '')) AS cardNumber,
          c.expires AS expires
        FROM card c
        WHERE c.accountid = s.accountId
        ORDER BY c.id DESC
      ) card
      WHERE ${whereParts.join(" AND ")}
    `;
    const dataFrom = `
      FROM account_scope s
      OUTER APPLY (
        SELECT TOP 1
          COALESCE(NULLIF(c.shortcardnumber2, ''), NULLIF(c.shortcardnumber, '')) AS cardNumber,
          c.expires AS expires
        FROM card c
        WHERE c.accountid = s.accountId
        ORDER BY c.id DESC
      ) card
      ${includeLatestTransaction ? `
      OUTER APPLY (
        SELECT TOP 1
          t.startdate AS lastTransactionDate,
          COALESCE(NULLIF(t.title, ''), ett.name) AS lastTransactionTitle
        FROM [transaction] t
        LEFT JOIN enum_transaction_transactiontypeid ett ON ett.id = t.transactiontypeid
        WHERE t.accountid = s.accountId
        ORDER BY t.startdate DESC, t.id DESC
      ) last_tx` : ""}
      WHERE ${whereParts.join(" AND ")}
    `;

    const totalRows = await query(
      `${baseCte}
       SELECT COUNT(1) AS totalCount, SUM(COALESCE(s.balance, 0)) AS totalBalance
       ${totalFrom}`,
      baseParams
    );
    const totalBalance = Number(totalRows?.[0]?.totalBalance || 0);
    const totalCount = Number(totalRows?.[0]?.totalCount || 0);

    let rows = [];
    if (viewMode !== "summary") {
      const latestSelect = includeLatestTransaction
        ? `,
           last_tx.lastTransactionDate AS lastTransactionDate,
           last_tx.lastTransactionTitle AS lastTransactionTitle`
        : "";
      rows = await query(
        `${baseCte}
         SELECT
           card.cardNumber AS cardNumber,
           s.accountId AS accountId,
           s.balance AS balance,
           s.accountName AS accountName,
           card.expires AS expires${latestSelect}
         ${dataFrom}
         ORDER BY expires DESC, cardNumber
         OFFSET @offset ROWS
         FETCH NEXT @pageSize ROWS ONLY`,
        [
          ...baseParams,
          { name: "offset", type: sql.Int, value: offset },
          { name: "pageSize", type: sql.Int, value: pageSize },
        ]
      );
    }

    const formattedRows = (rows || []).map((row) => ({
      cardNumber: row.cardNumber ? String(row.cardNumber) : "",
      balance: Number(row.balance || 0),
      expires: row.expires ? new Date(row.expires).toISOString() : "",
      accountName: row.accountName ? String(row.accountName) : "",
      accountId: row.accountId ? String(row.accountId) : "",
      lastTransactionDate: row.lastTransactionDate ? new Date(row.lastTransactionDate).toISOString() : "",
      lastTransactionTitle: row.lastTransactionTitle ? String(row.lastTransactionTitle) : "",
    }));

    return { success: true, rows: formattedRows, totalBalance, totalCount, page, pageSize };
  }

  const whereParts = [
    "card.cardNumber IS NOT NULL",
    "card.cardNumber <> ''",
  ];
  const baseParams = [
    { name: "supportId", type: sql.Int, value: supportId },
    { name: "expiryDate", type: sql.DateTime, value: expiryDate },
    { name: "asOfDateEnd", type: sql.DateTime, value: asOfDateEnd },
  ];

  if (expiryStatus === "expired") {
    whereParts.push("card.expires IS NOT NULL AND card.expires < @expiryDate");
  } else if (expiryStatus === "active") {
    whereParts.push("(card.expires IS NULL OR card.expires >= @expiryDate)");
  }
  if (!includeZeroBalance) {
    whereParts.push("COALESCE(b.balance, 0) <> 0");
  }

  const baseQuery = `
    WITH account_scope AS (
      SELECT
        a.id AS accountId,
        a.poolcardtypeid AS poolcardtypeid,
        vpt.cardname AS accountName
      FROM account a
      INNER JOIN view_poolcardtype vpt
        ON vpt.id = a.poolcardtypeid
       AND vpt.supportid = @supportId
    ),
    balance_scope AS (
      SELECT
        t.accountid AS accountId,
        SUM(t.amount) AS balance
      FROM [transaction] t
      INNER JOIN account_scope s ON s.accountId = t.accountid
      WHERE t.startdate < @asOfDateEnd
      GROUP BY t.accountid
    )
  `;
  const totalFrom = `
    FROM account_scope s
    LEFT JOIN balance_scope b ON b.accountId = s.accountId
    OUTER APPLY (
      SELECT TOP 1
        COALESCE(NULLIF(c.shortcardnumber2, ''), NULLIF(c.shortcardnumber, '')) AS cardNumber,
        c.expires AS expires
      FROM card c
      WHERE c.accountid = s.accountId
      ORDER BY c.id DESC
    ) card
    WHERE ${whereParts.join(" AND ")}
  `;
  const dataFrom = `
    FROM account_scope s
    LEFT JOIN balance_scope b ON b.accountId = s.accountId
    OUTER APPLY (
      SELECT TOP 1
        COALESCE(NULLIF(c.shortcardnumber2, ''), NULLIF(c.shortcardnumber, '')) AS cardNumber,
        c.expires AS expires
      FROM card c
      WHERE c.accountid = s.accountId
      ORDER BY c.id DESC
    ) card
    ${includeLatestTransaction ? `
    OUTER APPLY (
      SELECT TOP 1
        t.startdate AS lastTransactionDate,
        COALESCE(NULLIF(t.title, ''), ett.name) AS lastTransactionTitle
      FROM [transaction] t
      LEFT JOIN enum_transaction_transactiontypeid ett ON ett.id = t.transactiontypeid
      WHERE t.accountid = s.accountId
        AND t.startdate < @asOfDateEnd
      ORDER BY t.startdate DESC, t.id DESC
    ) last_tx` : ""}
    WHERE ${whereParts.join(" AND ")}
  `;

  const totalRows = await query(
    `${baseQuery}
     SELECT COUNT(1) AS totalCount, SUM(COALESCE(b.balance, 0)) AS totalBalance
     ${totalFrom}`,
    baseParams
  );
  const totalBalance = Number(totalRows?.[0]?.totalBalance || 0);
  const totalCount = Number(totalRows?.[0]?.totalCount || 0);

  let rows = [];
  if (viewMode !== "summary") {
    const latestSelect = includeLatestTransaction
      ? `,
         last_tx.lastTransactionDate AS lastTransactionDate,
         last_tx.lastTransactionTitle AS lastTransactionTitle`
      : "";
    rows = await query(
      `${baseQuery}
       SELECT
         card.cardNumber AS cardNumber,
         s.accountId AS accountId,
         COALESCE(b.balance, 0) AS balance,
         s.accountName AS accountName,
         card.expires AS expires${latestSelect}
       ${dataFrom}
       ORDER BY expires DESC, cardNumber
       OFFSET @offset ROWS
       FETCH NEXT @pageSize ROWS ONLY`,
      [
        ...baseParams,
        { name: "offset", type: sql.Int, value: offset },
        { name: "pageSize", type: sql.Int, value: pageSize },
      ]
    );
  }

  const formattedRows = (rows || []).map((row) => ({
    cardNumber: row.cardNumber ? String(row.cardNumber) : "",
    balance: Number(row.balance || 0),
    expires: row.expires ? new Date(row.expires).toISOString() : "",
    accountName: row.accountName ? String(row.accountName) : "",
    accountId: row.accountId ? String(row.accountId) : "",
    lastTransactionDate: row.lastTransactionDate ? new Date(row.lastTransactionDate).toISOString() : "",
    lastTransactionTitle: row.lastTransactionTitle ? String(row.lastTransactionTitle) : "",
  }));

  return { success: true, rows: formattedRows, totalBalance, totalCount, page, pageSize };
}

export async function getBalanceByRetailstoreReport(session, filters) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const asOfDateInput = String(filters?.asOfDate || "").trim();
  let asOfDateEnd = null;
  if (asOfDateInput) {
    const parsed = new Date(asOfDateInput.includes("T") ? asOfDateInput : `${asOfDateInput}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) {
      return { success: false, error: "Ogiltigt datum" };
    }
    asOfDateEnd = new Date(parsed);
    asOfDateEnd.setDate(asOfDateEnd.getDate() + 1);
  } else {
    asOfDateEnd = new Date();
    asOfDateEnd.setDate(asOfDateEnd.getDate() + 1);
  }

  const selectedRetailstores = normalizeSelectionArray(filters?.retailstores);
  const selectedPresentcardAccounts = normalizeSelectionArray(filters?.presentcardAccounts);
  const selectedTransactionTitles = normalizeSelectionArray(filters?.transactionTitles)
    .map((value) => normalizeRetailstoreBalanceTransactionTitle(value))
    .filter(Boolean);
  const includeTransactionTitle = selectedTransactionTitles.length > 0;
  const params = [
    { name: "supportId", type: sql.Int, value: supportId },
    { name: "asOfDateEnd", type: sql.DateTime, value: asOfDateEnd },
  ];
  const whereParts = [
    "vt.supportid = @supportId",
    "vt.startdate < @asOfDateEnd",
  ];

  if (selectedRetailstores.length > 0) {
    const { params: storeParams, placeholders } = buildSqlInList("retailstoreName", selectedRetailstores, sql.NVarChar);
    whereParts.push(`COALESCE(NULLIF(LTRIM(RTRIM(vt.retailstore_name)), ''), 'Okänt säljställe') IN (${placeholders.join(", ")})`);
    params.push(...storeParams);
  }
  if (selectedPresentcardAccounts.length > 0) {
    const { params: accountParams, placeholders } = buildSqlInList("presentcardAccount", selectedPresentcardAccounts, sql.NVarChar);
    whereParts.push(`vt.poolcardtype_cardname IN (${placeholders.join(", ")})`);
    params.push(...accountParams);
  }
  if (selectedTransactionTitles.length > 0) {
    const { params: titleParams, placeholders } = buildSqlInList("transactionTitle", selectedTransactionTitles, sql.NVarChar);
    whereParts.push(`vt.title IN (${placeholders.join(", ")})`);
    params.push(...titleParams);
  }

  const rows = await query(
    `WITH filtered_transactions AS (
       SELECT
         COALESCE(NULLIF(LTRIM(RTRIM(vt.retailstore_name)), ''), 'Okänt säljställe') AS retailstoreName,
         vt.title AS transactionTitle,
         COALESCE(vt.amount, 0) AS amount,
         vt.startdate AS startdate
       FROM view_transaction vt
       WHERE ${whereParts.join(" AND ")}
     ),
     latest_transactions AS (
       SELECT
         retailstoreName,
         transactionTitle AS lastTransactionTitle,
         startdate AS lastTransactionDate,
         ROW_NUMBER() OVER (
           PARTITION BY retailstoreName
           ORDER BY startdate DESC, transactionTitle DESC
         ) AS rowNumber
       FROM filtered_transactions
     )
     SELECT
       ft.retailstoreName,
       ${includeTransactionTitle ? "ft.transactionTitle," : ""}
       SUM(ft.amount) / 100.0 AS balance,
       lt.lastTransactionDate AS lastTransactionDate,
       lt.lastTransactionTitle AS lastTransactionTitle
     FROM filtered_transactions ft
     LEFT JOIN latest_transactions lt
       ON lt.retailstoreName = ft.retailstoreName
      AND lt.rowNumber = 1
     GROUP BY
       ft.retailstoreName,
       lt.lastTransactionDate,
       lt.lastTransactionTitle
       ${includeTransactionTitle ? ", ft.transactionTitle" : ""}
     HAVING SUM(ft.amount) <> 0
     ORDER BY
       ft.retailstoreName
       ${includeTransactionTitle ? ", ft.transactionTitle" : ""}`,
    params
  );

  const formattedRows = (rows || []).map((row) => ({
    retailstoreName: normalizeString(row.retailstoreName) || "Okänt säljställe",
    balance: Number(row.balance || 0),
    transactionTitle: normalizeString(row.transactionTitle),
    lastTransactionDate: row.lastTransactionDate ? new Date(row.lastTransactionDate).toISOString() : "",
    lastTransactionTitle: normalizeString(row.lastTransactionTitle),
  }));
  const totalBalance = formattedRows.reduce((sum, row) => sum + row.balance, 0);

  return {
    success: true,
    rows: formattedRows,
    totalBalance,
    totalCount: formattedRows.length,
  };
}

function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildSqlInList(prefix, values, type = sql.NVarChar) {
  const params = [];
  const placeholders = [];
  for (let idx = 0; idx < values.length; idx++) {
    const name = `${prefix}${idx}`;
    params.push({ name, type, value: values[idx] });
    placeholders.push(`@${name}`);
  }
  return { params, placeholders };
}

function normalizeString(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeDeliveryStatus(value) {
  return normalizeString(value).toLowerCase();
}

function isGiftCardDeliveryCancelled(status) {
  const normalized = normalizeDeliveryStatus(status);
  return normalized.includes("cancel");
}

function isGiftCardDeliverySent(status, deliveredAtUtc) {
  if (normalizeString(deliveredAtUtc)) return true;
  const normalized = normalizeDeliveryStatus(status);
  return normalized.includes("sent") || normalized.includes("deliver");
}

function buildImmediateSchedulePayload() {
  const now = new Date();
  // API rejects past timestamps; schedule at least one minute ahead.
  now.setMinutes(now.getMinutes() + 1);
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  };
}

function buildGiftcardV3Url(path) {
  const base = String(GIFTCARD_V3_API_BASE_URL || "").replace(/\/+$/, "");
  if (path.startsWith("/")) return `${base}${path}`;
  return `${base}/${path}`;
}

async function callGiftcardV3Api(path, { method = "GET", body } = {}) {
  const response = await fetch(buildGiftcardV3Url(path), {
    method,
    headers: {
      accept: "application/json",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
    payload: parseJsonSafe(text),
  };
}

function getGiftcardV3ErrorMessage(response, fallback) {
  const payload = response?.payload || {};
  const message = normalizeString(payload.message || payload.error || payload.detail || payload.title);
  if (message) return message;
  const raw = normalizeString(response?.text);
  if (raw) return raw;
  return fallback;
}

function getMappedGiftcardV3CompanyIds(supportId) {
  const raw = normalizeString(process.env.GIFTCARD_V3_SUPPORT_COMPANY_MAP);
  if (!raw || !Number.isFinite(supportId)) return [];

  // Format: "69195=companyId1,companyId2;80057=companyId3"
  const entries = raw
    .split(";")
    .map((part) => normalizeString(part))
    .filter(Boolean);

  for (const entry of entries) {
    const [left, right] = entry.split("=");
    const mappedSupportId = parseInt(normalizeString(left), 10);
    if (!Number.isFinite(mappedSupportId) || mappedSupportId !== supportId) continue;
    return Array.from(
      new Set(
        normalizeString(right)
          .split(",")
          .map((id) => normalizeString(id))
          .filter(Boolean)
      )
    );
  }

  return [];
}

function normalizeMatchText(value) {
  return normalizeString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function extractMatchTokens(value) {
  return Array.from(
    new Set(
      normalizeMatchText(value)
        .split(/[^a-z0-9]+/g)
        .map((token) => token.trim())
        .filter((token) => token.length >= 3)
    )
  );
}

async function getSelectedCustomerLabel(session) {
  const sessionLabel = normalizeString(session?.selectedCustomerLabel);
  if (sessionLabel) return sessionLabel;

  const selectedCustomerId = normalizeString(session?.selectedCustomerId);
  if (!selectedCustomerId) return "";
  const customerOptions = Array.isArray(session?.customerOptions) ? session.customerOptions : [];
  for (const option of customerOptions) {
    if (normalizeString(option?.value) !== selectedCustomerId) continue;
    const label = normalizeString(option?.label);
    if (label) return label;
  }

  const supportId = parseInt(selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) return "";

  try {
    const rows = await query(
      `SELECT TOP 1 friendlyname, name
       FROM pool
       WHERE id = @supportId`,
      [{ name: "supportId", type: sql.Int, value: supportId }]
    );
    const row = rows?.[0] || {};
    return normalizeString(row.friendlyname || row.name);
  } catch {
    return "";
  }
}

async function getGiftcardV3CompaniesByIds(companyIds) {
  const ids = Array.from(new Set((companyIds || []).map((id) => normalizeString(id)).filter(Boolean)));
  if (ids.length === 0) return [];

  const { params, placeholders } = buildSqlInList("companyLookup", ids, sql.NVarChar);
  const rows = await query(
    `SELECT
        CAST(c.id AS nvarchar(64)) AS companyId,
        c.companyName AS companyName
     FROM GiftcardV3.dbo.companies c
     WHERE CAST(c.id AS nvarchar(64)) IN (${placeholders.join(", ")})`,
    params
  );

  return (rows || []).map((row) => ({
    companyId: normalizeString(row.companyId),
    companyName: normalizeString(row.companyName),
  }));
}

async function narrowCompanyIdsBySelectedCustomerLabel(session, companyIds, companies = []) {
  const baseCompanyIds = Array.from(new Set((companyIds || []).map((id) => normalizeString(id)).filter(Boolean)));
  if (baseCompanyIds.length <= 1) return baseCompanyIds;

  const selectedCustomerLabel = await getSelectedCustomerLabel(session);
  const labelMatch = normalizeMatchText(selectedCustomerLabel);
  const labelTokens = extractMatchTokens(selectedCustomerLabel);
  if (!labelMatch || labelTokens.length === 0) return baseCompanyIds;

  let candidateCompanies = Array.isArray(companies)
    ? companies.map((company) => ({
      companyId: normalizeString(company?.companyId),
      companyName: normalizeString(company?.companyName),
    })).filter((company) => company.companyId)
    : [];

  if (candidateCompanies.length === 0) {
    try {
      candidateCompanies = await getGiftcardV3CompaniesByIds(baseCompanyIds);
    } catch {
      candidateCompanies = [];
    }
  }

  if (candidateCompanies.length === 0) return baseCompanyIds;

  const narrowedCompanyIds = Array.from(
    new Set(
      candidateCompanies
        .filter((company) => {
          const companyNameMatch = normalizeMatchText(company.companyName);
          if (!companyNameMatch) return false;
          if (companyNameMatch.includes(labelMatch) || labelMatch.includes(companyNameMatch)) return true;
          return labelTokens.some((token) => companyNameMatch.includes(token));
        })
        .map((company) => company.companyId)
        .filter(Boolean)
    )
  );

  return narrowedCompanyIds.length > 0 ? narrowedCompanyIds : baseCompanyIds;
}

async function getAllowedGiftcardV3CompanyIds(session) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  const mappedCompanyIds = getMappedGiftcardV3CompanyIds(supportId);
  if (mappedCompanyIds.length > 0) {
    const narrowedMappedIds = await narrowCompanyIdsBySelectedCustomerLabel(session, mappedCompanyIds);
    return { success: true, companyIds: narrowedMappedIds, source: "env-map" };
  }

  const access = await resolveGiftcardMakerCompanies(session);
  if (!access.success) {
    return { success: false, error: access.error || "Kunde inte hitta företag för kunden" };
  }

  const companyIds = Array.from(
    new Set((access.companyIds || []).map((value) => normalizeString(value)).filter(Boolean))
  );
  if (companyIds.length === 0) {
    return { success: false, error: "Kunde inte hitta företag för kunden" };
  }

  const narrowedCompanyIds = await narrowCompanyIdsBySelectedCustomerLabel(
    session,
    companyIds,
    Array.isArray(access.companies) ? access.companies : []
  );

  return { success: true, companyIds: narrowedCompanyIds };
}

async function getLatestDashboardGiftcardSales(session, limit = 25) {
  const access = await getAllowedGiftcardV3CompanyIds(session);
  if (!access.success) return access;

  const { params: companyParams, placeholders } = buildSqlInList("companyId", access.companyIds, sql.NVarChar);
  const rows = await query(
    `SELECT TOP (@limit)
        CAST(o.id AS nvarchar(64)) AS orderId,
        CAST(ogc.id AS nvarchar(64)) AS giftCardId,
        ogc.cardNumber AS cardNumber,
        ogc.createdAtUtc AS createdAtUtc,
        ogc.recipientName AS recipientName,
        ogc.recipientEmail AS recipientEmail,
        ogc.senderName AS senderName,
        ogc.amountMinor AS amountMinor,
        ogc.deliveryStatus AS deliveryStatus,
        ogc.scheduledDeliveryUtc AS scheduledDeliveryUtc,
        ogc.deliveredAtUtc AS deliveredAtUtc,
        c.companyName AS companyName,
        ogc.message AS message
     FROM GiftcardV3.dbo.orders o
     INNER JOIN GiftcardV3.dbo.order_gift_cards ogc ON ogc.orderId = o.id
     LEFT JOIN GiftcardV3.dbo.companies c ON c.id = o.companyId
     WHERE CAST(o.companyId AS nvarchar(64)) IN (${placeholders.join(", ")})
     ORDER BY COALESCE(
       TRY_CONVERT(datetime2, ogc.createdAtUtc),
       TRY_CONVERT(datetime2, ogc.scheduledDeliveryUtc),
       TRY_CONVERT(datetime2, ogc.deliveredAtUtc)
     ) DESC,
     CAST(ogc.id AS nvarchar(64)) DESC`,
    [{ name: "limit", type: sql.Int, value: limit }, ...companyParams]
  );

  const mapped = (rows || []).map((row, idx) => {
    const orderId = normalizeString(row.orderId);
    const giftCardId = normalizeString(row.giftCardId);
    return {
      id: `${orderId || "order"}:${giftCardId || idx}`,
      orderId,
      giftCardId,
      cardNumber: normalizeString(row.cardNumber),
      createdAtUtc: normalizeString(row.createdAtUtc),
      recipientName: normalizeString(row.recipientName),
      recipientEmail: normalizeString(row.recipientEmail),
      senderName: normalizeString(row.senderName),
      amount: normalizeAmount(row.amountMinor) / 100,
      deliveryStatus: normalizeString(row.deliveryStatus),
      scheduledDeliveryUtc: normalizeString(row.scheduledDeliveryUtc),
      deliveredAtUtc: normalizeString(row.deliveredAtUtc),
      companyName: normalizeString(row.companyName),
      message: normalizeString(row.message),
    };
  });

  return { success: true, rows: mapped };
}

async function getDashboardGiftCardForAction(session, orderId, giftCardId) {
  const normalizedOrderId = normalizeString(orderId);
  const normalizedGiftCardId = normalizeString(giftCardId);
  if (!normalizedOrderId || !normalizedGiftCardId) {
    return { success: false, error: "orderId och giftCardId är obligatoriska" };
  }

  const access = await getAllowedGiftcardV3CompanyIds(session);
  if (!access.success) return access;

  const { params: companyParams, placeholders } = buildSqlInList("companyId", access.companyIds, sql.NVarChar);
  const rows = await query(
    `SELECT TOP 1
        CAST(o.id AS nvarchar(64)) AS orderId,
        CAST(ogc.id AS nvarchar(64)) AS giftCardId,
        CAST(o.companyId AS nvarchar(64)) AS companyId,
        ogc.clientItemId AS clientItemId,
        ogc.designId AS designId,
        ogc.amountMinor AS amountMinor,
        ogc.deliveryType AS deliveryType,
        ogc.recipientName AS recipientName,
        ogc.deliveryStatus AS deliveryStatus,
        ogc.deliveredAtUtc AS deliveredAtUtc,
        ogc.scheduledDeliveryUtc AS scheduledDeliveryUtc,
        ogc.recipientEmail AS recipientEmail,
        ogc.senderName AS senderName,
        ogc.message AS message,
        ogc.physicalAddressJson AS physicalAddressJson,
        ogc.scheduledDeliveryJson AS scheduledDeliveryJson,
        ogc.netsPaymentId AS netsPaymentId,
        ogc.cardNumber AS cardNumber
     FROM GiftcardV3.dbo.orders o
     INNER JOIN GiftcardV3.dbo.order_gift_cards ogc ON ogc.orderId = o.id
     WHERE CAST(o.id AS nvarchar(64)) = @orderId
       AND CAST(ogc.id AS nvarchar(64)) = @giftCardId
       AND CAST(o.companyId AS nvarchar(64)) IN (${placeholders.join(", ")})`,
    [
      { name: "orderId", type: sql.NVarChar, value: normalizedOrderId },
      { name: "giftCardId", type: sql.NVarChar, value: normalizedGiftCardId },
      ...companyParams,
    ]
  );

  if (!rows || rows.length === 0) {
    return { success: false, error: "Beställningen kunde inte hittas för vald kund" };
  }

  const row = rows[0];
  return {
    success: true,
    row: {
      orderId: normalizeString(row.orderId),
      giftCardId: normalizeString(row.giftCardId),
      companyId: normalizeString(row.companyId),
      clientItemId: normalizeString(row.clientItemId),
      designId: normalizeString(row.designId),
      amountMinor: normalizeAmount(row.amountMinor),
      deliveryType: normalizeString(row.deliveryType).toLowerCase(),
      recipientName: normalizeString(row.recipientName),
      deliveryStatus: normalizeString(row.deliveryStatus),
      deliveredAtUtc: normalizeString(row.deliveredAtUtc),
      scheduledDeliveryUtc: normalizeString(row.scheduledDeliveryUtc),
      recipientEmail: normalizeString(row.recipientEmail),
      senderName: normalizeString(row.senderName),
      message: normalizeString(row.message),
      physicalAddressJson: normalizeString(row.physicalAddressJson),
      scheduledDeliveryJson: normalizeString(row.scheduledDeliveryJson),
      netsPaymentId: normalizeString(row.netsPaymentId),
      cardNumber: normalizeString(row.cardNumber),
    },
  };
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseResendEmailTargets(card, options = {}) {
  const sendToOriginal = options.sendToOriginal !== false;
  const manualEmail = normalizeString(options.manualEmail).toLowerCase();
  const originalEmail = normalizeString(card.recipientEmail).toLowerCase();
  const targets = [];

  if (sendToOriginal && originalEmail) {
    if (!isValidEmail(originalEmail)) {
      return { success: false, error: "Kortets ursprungliga e-postadress är ogiltig." };
    }
    targets.push(originalEmail);
  }

  if (manualEmail) {
    if (!isValidEmail(manualEmail)) {
      return { success: false, error: "Den manuella e-postadressen är ogiltig." };
    }
    targets.push(manualEmail);
  }

  const uniqueTargets = Array.from(new Set(targets));
  if (uniqueTargets.length === 0) {
    return { success: false, error: "Välj minst en e-postadress att skicka till." };
  }

  return { success: true, emails: uniqueTargets };
}

async function insertResendGiftCardClone(card, recipientEmail) {
  const newGiftCardId = crypto.randomBytes(16).toString("hex");
  const fallbackClientItemId = crypto.randomBytes(8).toString("hex");
  const baseClientItemId = normalizeString(card.clientItemId) || fallbackClientItemId;
  const newClientItemId = `${baseClientItemId}-resend-${Date.now()}`;
  const nowIso = new Date().toISOString();
  const cardNumberRaw = normalizeString(card.cardNumber);
  const cardNumberValue = /^\d+$/.test(cardNumberRaw) ? cardNumberRaw : null;

  await query(
    `INSERT INTO GiftcardV3.dbo.order_gift_cards (
        id,
        orderId,
        clientItemId,
        designId,
        amountMinor,
        deliveryType,
        recipientName,
        recipientEmail,
        senderName,
        message,
        physicalAddressJson,
        scheduledDeliveryJson,
        createdAtUtc,
        deliveryStatus,
        scheduledDeliveryUtc,
        deliveredAtUtc,
        netsPaymentId,
        cardNumber
     ) VALUES (
        @id,
        @orderId,
        @clientItemId,
        @designId,
        @amountMinor,
        @deliveryType,
        @recipientName,
        @recipientEmail,
        @senderName,
        @message,
        @physicalAddressJson,
        @scheduledDeliveryJson,
        @createdAtUtc,
        @deliveryStatus,
        @scheduledDeliveryUtc,
        @deliveredAtUtc,
        @netsPaymentId,
        @cardNumber
     )`,
    [
      { name: "id", type: sql.NVarChar, value: newGiftCardId },
      { name: "orderId", type: sql.NVarChar, value: normalizeString(card.orderId) },
      { name: "clientItemId", type: sql.NVarChar, value: newClientItemId },
      { name: "designId", type: sql.NVarChar, value: normalizeString(card.designId) },
      { name: "amountMinor", type: sql.Int, value: normalizeAmount(card.amountMinor) },
      { name: "deliveryType", type: sql.NVarChar, value: "digital" },
      { name: "recipientName", type: sql.NVarChar, value: normalizeString(card.recipientName) || "Mottagare" },
      { name: "recipientEmail", type: sql.NVarChar, value: recipientEmail },
      { name: "senderName", type: sql.NVarChar, value: normalizeString(card.senderName) || "Avsändare" },
      { name: "message", type: sql.NVarChar, value: normalizeString(card.message) || null },
      { name: "physicalAddressJson", type: sql.NVarChar, value: null },
      { name: "scheduledDeliveryJson", type: sql.NVarChar, value: null },
      { name: "createdAtUtc", type: sql.NVarChar, value: nowIso },
      { name: "deliveryStatus", type: sql.NVarChar, value: "Immediate" },
      { name: "scheduledDeliveryUtc", type: sql.NVarChar, value: null },
      { name: "deliveredAtUtc", type: sql.NVarChar, value: null },
      { name: "netsPaymentId", type: sql.NVarChar, value: normalizeString(card.netsPaymentId) || null },
      { name: "cardNumber", type: sql.BigInt, value: cardNumberValue },
    ]
  );

  return { giftCardId: newGiftCardId, recipientEmail };
}

async function deleteGiftCardRowById(giftCardId) {
  if (!giftCardId) return;
  await query(
    `DELETE FROM GiftcardV3.dbo.order_gift_cards
     WHERE id = @giftCardId`,
    [{ name: "giftCardId", type: sql.NVarChar, value: giftCardId }]
  );
}

async function scheduleGiftCardImmediate(orderId, giftCardId) {
  const scheduledDelivery = buildImmediateSchedulePayload();
  const response = await callGiftcardV3Api(
    `/api/orders/${encodeURIComponent(orderId)}/gift-cards/${encodeURIComponent(giftCardId)}/schedule`,
    {
      method: "PATCH",
      body: { scheduledDelivery },
    }
  );

  return { response };
}

export async function resendDashboardGiftCard(session, { orderId, giftCardId, sendToOriginal = true, manualEmail = "" } = {}) {
  const cardResult = await getDashboardGiftCardForAction(session, orderId, giftCardId);
  if (!cardResult.success) return cardResult;

  const card = cardResult.row;
  if (card.deliveryType && card.deliveryType !== "digital") {
    return { success: false, error: "Endast digitala presentkort kan skickas om via e-post." };
  }

  const targetsResult = parseResendEmailTargets(card, { sendToOriginal, manualEmail });
  if (!targetsResult.success) return targetsResult;

  const sentTo = [];
  for (const email of targetsResult.emails) {
    const clone = await insertResendGiftCardClone(card, email);
    const { response } = await scheduleGiftCardImmediate(card.orderId, clone.giftCardId);

    if (!response.ok) {
      try {
        await deleteGiftCardRowById(clone.giftCardId);
      } catch (cleanupError) {
        console.log("[dashboard] Could not cleanup failed resend row:", cleanupError?.message || cleanupError);
      }
      return {
        success: false,
        status: response.status,
        error: `${email}: ${getGiftcardV3ErrorMessage(response, "Kunde inte skicka om presentkortet")}`,
      };
    }

    sentTo.push(email);
  }

  return {
    success: true,
    sentTo,
    count: sentTo.length,
  };
}

export async function cancelDashboardGiftCard(session, { orderId, giftCardId }) {
  const cardResult = await getDashboardGiftCardForAction(session, orderId, giftCardId);
  if (!cardResult.success) return cardResult;

  const card = cardResult.row;
  if (isGiftCardDeliverySent(card.deliveryStatus, card.deliveredAtUtc)) {
    return { success: false, error: "Presentkortet är redan utskickat och kan inte avbrytas." };
  }
  if (isGiftCardDeliveryCancelled(card.deliveryStatus)) {
    return { success: true, alreadyCancelled: true };
  }

  const response = await callGiftcardV3Api(
    `/api/orders/${encodeURIComponent(card.orderId)}/gift-cards/${encodeURIComponent(card.giftCardId)}/cancel-scheduled`,
    { method: "POST" }
  );

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: getGiftcardV3ErrorMessage(response, "Kunde inte avbryta presentkortet"),
    };
  }

  return {
    success: true,
    status: response.status,
    payload: response.payload || null,
  };
}

export async function getDashboardOverview(session, options) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const opts = options && typeof options === "object" ? options : { period: options };

  const normalizedPeriod = ["last_7_days", "last_calendar_week", "last_calendar_month", "last_365_days", "last_calendar_year", "custom"].includes(String(opts?.period || ""))
    ? String(opts.period)
    : "last_7_days";
  const normalizedComparison = ["previous_week", "previous_month", "same_period_last_year", "custom"].includes(
    String(opts?.comparison || "")
  )
    ? String(opts.comparison)
    : "same_period_last_year";
  const rawMultiples = parseInt(String(opts?.multiples || 2), 10);
  const multiples = Number.isFinite(rawMultiples) ? Math.min(5, Math.max(2, rawMultiples)) : 2;

  const parseDateOnly = (value) => {
    const text = String(value || "").trim().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
    const [y, m, d] = text.split("-").map((part) => parseInt(part, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    const parsed = new Date(y, m - 1, d);
    if (Number.isNaN(parsed.valueOf())) return null;
    return parsed;
  };

  const startOfDay = (date) => {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next;
  };

  const addDays = (date, days) => {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  };

  const addMonths = (date, months) => {
    const next = new Date(date);
    next.setMonth(next.getMonth() + months);
    return next;
  };

  const addYears = (date, years) => {
    const next = new Date(date);
    next.setFullYear(next.getFullYear() + years);
    return next;
  };

  const buildRange = (key, label, shortLabel, fromDate, toDate) => {
    const displayFrom = startOfDay(fromDate);
    const displayTo = startOfDay(toDate);
    const queryFrom = startOfDay(fromDate);
    const queryTo = addDays(startOfDay(toDate), 1);
    return { key, label, shortLabel, displayFrom, displayTo, queryFrom, queryTo };
  };

  const getCurrentLabel = (periodValue) => {
    if (periodValue === "last_calendar_week") return "Senaste kalenderveckan";
    if (periodValue === "last_calendar_month") return "Senaste kalendermånaden";
    if (periodValue === "last_365_days") return "Senaste 365 dagarna";
    if (periodValue === "last_calendar_year") return "Senaste kalenderåret";
    if (periodValue === "custom") return "Vald period";
    return "Senaste 7 dagarna";
  };

  const getComparisonLabel = (comparisonValue, periodValue, index) => {
    if (comparisonValue === "previous_week") {
      return index === 1 ? "Veckan före" : `${index} veckor före`;
    }
    if (comparisonValue === "previous_month") {
      return index === 1 ? "Månaden före" : `${index} månader före`;
    }
    if (comparisonValue === "custom") {
      return index === 1 ? "Egen jämförelseperiod" : `Egen jämförelseperiod ${index}`;
    }
    if (index === 1 && periodValue === "last_calendar_week") return "Samma kalendervecka förra året";
    if (index === 1 && periodValue === "last_calendar_month") return "Samma kalendermånad förra året";
    if (index === 1) return "Samma period förra året";
    return `Samma period ${index} år tillbaka`;
  };

  const getComparisonShortLabel = (comparisonValue, index) => {
    if (comparisonValue === "previous_week") return `-${index} v`;
    if (comparisonValue === "previous_month") return `-${index} mån`;
    if (comparisonValue === "custom") return `Jmf ${index}`;
    return `-${index} år`;
  };

  const now = new Date();
  const today = startOfDay(now);
  const currentDayOfWeek = today.getDay() || 7;
  const startOfCurrentWeek = addDays(today, -(currentDayOfWeek - 1));
  const startOfLastCalendarWeek = addDays(startOfCurrentWeek, -7);
  const endOfLastCalendarWeek = addDays(startOfCurrentWeek, -1);
  const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfLastCalendarMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const endOfLastCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  const startOfLastCalendarYear = new Date(today.getFullYear() - 1, 0, 1);
  const endOfLastCalendarYear = new Date(today.getFullYear() - 1, 11, 31);

  let currentFrom = addDays(today, -6);
  let currentTo = today;

  if (normalizedPeriod === "last_calendar_week") {
    currentFrom = startOfLastCalendarWeek;
    currentTo = endOfLastCalendarWeek;
  } else if (normalizedPeriod === "last_calendar_month") {
    currentFrom = startOfLastCalendarMonth;
    currentTo = endOfLastCalendarMonth;
  } else if (normalizedPeriod === "last_365_days") {
    currentFrom = addDays(today, -364);
    currentTo = today;
  } else if (normalizedPeriod === "last_calendar_year") {
    currentFrom = startOfLastCalendarYear;
    currentTo = endOfLastCalendarYear;
  }

  if (normalizedPeriod === "custom") {
    const customCurrentFrom = parseDateOnly(opts?.currentFrom);
    const customCurrentTo = parseDateOnly(opts?.currentTo);
    if (!customCurrentFrom || !customCurrentTo) {
      return { success: false, error: "Välj ett giltigt datumintervall för Period." };
    }
    if (customCurrentFrom > customCurrentTo) {
      return { success: false, error: "Startdatum måste vara före eller samma som slutdatum i Period." };
    }
    currentFrom = customCurrentFrom;
    currentTo = customCurrentTo;
  }

  const currentRange = buildRange("current", getCurrentLabel(normalizedPeriod), "Nu", currentFrom, currentTo);

  const compareRanges = [];
  const compareCount = Math.max(0, multiples - 1);

  if (normalizedComparison === "custom") {
    const customCompareFrom = parseDateOnly(opts?.compareFrom);
    const customCompareTo = parseDateOnly(opts?.compareTo);
    if (!customCompareFrom || !customCompareTo) {
      return { success: false, error: "Välj ett giltigt datumintervall för jämförelseperioden." };
    }
    if (customCompareFrom > customCompareTo) {
      return { success: false, error: "Startdatum måste vara före eller samma som slutdatum i jämförelseperioden." };
    }

    const firstCompare = buildRange(
      "compare-1",
      getComparisonLabel(normalizedComparison, normalizedPeriod, 1),
      getComparisonShortLabel(normalizedComparison, 1),
      customCompareFrom,
      customCompareTo
    );

    const deltaFromMs = currentRange.displayFrom.getTime() - firstCompare.displayFrom.getTime();
    const deltaToMs = currentRange.displayTo.getTime() - firstCompare.displayTo.getTime();

    for (let index = 1; index <= compareCount; index += 1) {
      const compareFrom = new Date(currentRange.displayFrom.getTime() - deltaFromMs * index);
      const compareTo = new Date(currentRange.displayTo.getTime() - deltaToMs * index);
      compareRanges.push(
        buildRange(
          `compare-${index}`,
          getComparisonLabel(normalizedComparison, normalizedPeriod, index),
          getComparisonShortLabel(normalizedComparison, index),
          compareFrom,
          compareTo
        )
      );
    }
  } else {
    for (let index = 1; index <= compareCount; index += 1) {
      let compareFrom = new Date(currentRange.displayFrom);
      let compareTo = new Date(currentRange.displayTo);

      if (normalizedComparison === "previous_week") {
        compareFrom = addDays(compareFrom, -7 * index);
        compareTo = addDays(compareTo, -7 * index);
      } else if (normalizedComparison === "previous_month") {
        compareFrom = addMonths(compareFrom, -index);
        compareTo = addMonths(compareTo, -index);
      } else {
        compareFrom = addYears(compareFrom, -index);
        compareTo = addYears(compareTo, -index);
      }

      compareRanges.push(
        buildRange(
          `compare-${index}`,
          getComparisonLabel(normalizedComparison, normalizedPeriod, index),
          getComparisonShortLabel(normalizedComparison, index),
          compareFrom,
          compareTo
        )
      );
    }
  }

  const seriesRanges = [currentRange, ...compareRanges];

  const latestSalesLimitRaw = parseInt(options?.latestSalesLimit, 10);
  const latestSalesLimit = Math.min(Math.max(latestSalesLimitRaw || 25, 25), 100);

  let latestSales = [];
  try {
    const latestSalesResult = await getLatestDashboardGiftcardSales(session, latestSalesLimit);
    if (latestSalesResult.success) {
      latestSales = latestSalesResult.rows || [];
    } else {
      console.log("[dashboard] latest sales from GiftcardV3 skipped:", latestSalesResult.error);
    }
  } catch (error) {
    console.log("[dashboard] latest sales from GiftcardV3 failed:", error?.message || error);
  }

  let comparisonSeries = seriesRanges.map((range) => ({
    key: range.key,
    label: range.label,
    shortLabel: range.shortLabel,
    from: range.displayFrom.toISOString(),
    to: range.displayTo.toISOString(),
    depositsAmount: 0,
    depositsCount: 0,
    purchasesAmount: 0,
    purchasesCount: 0,
  }));

  try {
    const rangeParams = [{ name: "supportId", type: sql.Int, value: supportId }];
    const valueRows = [];
    for (let index = 0; index < seriesRanges.length; index += 1) {
      const range = seriesRanges[index];
      rangeParams.push(
        { name: `rangeKey${index}`, type: sql.NVarChar, value: range.key },
        { name: `rangeLabel${index}`, type: sql.NVarChar, value: range.label },
        { name: `rangeShort${index}`, type: sql.NVarChar, value: range.shortLabel },
        { name: `rangeFrom${index}`, type: sql.DateTime, value: range.queryFrom },
        { name: `rangeTo${index}`, type: sql.DateTime, value: range.queryTo },
        { name: `rangeFromDisplay${index}`, type: sql.DateTime, value: range.displayFrom },
        { name: `rangeToDisplay${index}`, type: sql.DateTime, value: range.displayTo }
      );
      valueRows.push(
        `(${index}, @rangeKey${index}, @rangeLabel${index}, @rangeShort${index}, @rangeFrom${index}, @rangeTo${index}, @rangeFromDisplay${index}, @rangeToDisplay${index})`
      );
    }

    const rows = await query(
      `WITH ranges([idx], [seriesKey], [seriesLabel], [seriesShortLabel], [fromDate], [toDate], [fromDisplay], [toDisplay]) AS (
         SELECT *
         FROM (VALUES
           ${valueRows.join(",\n           ")}
         ) AS source([idx], [seriesKey], [seriesLabel], [seriesShortLabel], [fromDate], [toDate], [fromDisplay], [toDisplay])
       )
       SELECT
         r.[idx] AS idx,
         r.[seriesKey] AS seriesKey,
         r.[seriesLabel] AS seriesLabel,
         r.[seriesShortLabel] AS seriesShortLabel,
         r.[fromDisplay] AS fromDisplay,
         r.[toDisplay] AS toDisplay,
         SUM(CASE WHEN t.title LIKE 'Ins%' THEN t.amount ELSE 0 END) AS depositsAmount,
         SUM(CASE WHEN t.title LIKE 'Ins%' THEN 1 ELSE 0 END) AS depositsCount,
         SUM(CASE WHEN t.title LIKE 'K%p' THEN ABS(t.amount) ELSE 0 END) AS purchasesAmount,
         SUM(CASE WHEN t.title LIKE 'K%p' THEN 1 ELSE 0 END) AS purchasesCount
       FROM ranges r
       LEFT JOIN view_transaction t
         ON t.supportid = @supportId
        AND t.startdate >= r.[fromDate]
        AND t.startdate < r.[toDate]
       GROUP BY
         r.[idx],
         r.[seriesKey],
         r.[seriesLabel],
         r.[seriesShortLabel],
         r.[fromDisplay],
         r.[toDisplay]
       ORDER BY r.[idx]`,
      rangeParams
    );

    comparisonSeries = (rows || []).map((row) => ({
      key: normalizeString(row.seriesKey),
      label: normalizeString(row.seriesLabel),
      shortLabel: normalizeString(row.seriesShortLabel),
      from: new Date(row.fromDisplay).toISOString(),
      to: new Date(row.toDisplay).toISOString(),
      depositsAmount: Number(row.depositsAmount || 0),
      depositsCount: Number(row.depositsCount || 0),
      purchasesAmount: Number(row.purchasesAmount || 0),
      purchasesCount: Number(row.purchasesCount || 0),
    }));
  } catch (error) {
    console.log("[dashboard] DB period summary failed, returning zeroed series:", error?.message || error);
  }

  let depositsTotal = 0;
  let expiredTotal = 0;
  try {
    const totalsRows = await query(
      `SELECT SUM(CASE WHEN t.title LIKE 'Ins%' THEN t.amount ELSE 0 END) AS depositsTotal
       FROM view_transaction t
       WHERE t.supportid = @supportId`,
      [{ name: "supportId", type: sql.Int, value: supportId }]
    );

    const expiredRows = await query(
      `SELECT SUM(a.balance) AS expiredBalance
       FROM view_transaction t
       INNER JOIN card c ON t.accountid = c.accountid
       INNER JOIN account a ON t.accountid = a.id
       WHERE t.supportid = @supportId
         AND t.title LIKE 'Ins%'
         AND c.expires < @now`,
      [
        { name: "supportId", type: sql.Int, value: supportId },
        { name: "now", type: sql.DateTime, value: now },
      ]
    );

    const closedRows = await query(
      `SELECT SUM(amount) AS closedSum
       FROM view_transaction t
       WHERE t.supportid = @supportId
         AND t.title LIKE 'Avslut%'`,
      [{ name: "supportId", type: sql.Int, value: supportId }]
    );

    const totals = totalsRows?.[0] || {};
    const expired = expiredRows?.[0] || {};
    const closed = closedRows?.[0] || {};
    depositsTotal = Number(totals.depositsTotal || 0);
    const expiredBalance = Number(expired.expiredBalance || 0);
    const closedSum = Number(closed.closedSum || 0);
    expiredTotal = expiredBalance + Math.abs(closedSum);
  } catch (error) {
    console.log("[dashboard] DB totals failed, returning partial overview:", error?.message || error);
  }

  const currentSeries = comparisonSeries[0] || {};
  const previousSeries = comparisonSeries[1] || comparisonSeries[0] || {};

  return {
    success: true,
    latestSales,
    stats: {
      deposits: {
        current: Number(currentSeries.depositsAmount || 0),
        previous: Number(previousSeries.depositsAmount || 0),
        total: depositsTotal,
        countCurrent: Number(currentSeries.depositsCount || 0),
        countPrevious: Number(previousSeries.depositsCount || 0),
      },
      purchases: {
        current: Number(currentSeries.purchasesAmount || 0),
        previous: Number(previousSeries.purchasesAmount || 0),
        countCurrent: Number(currentSeries.purchasesCount || 0),
        countPrevious: Number(previousSeries.purchasesCount || 0),
      },
      expired: {
        total: expiredTotal,
      },
      comparison: {
        mode: normalizedComparison,
        multiples,
        series: comparisonSeries,
      },
      dateRange: {
        currentFrom: String(currentSeries.from || currentRange.displayFrom.toISOString()),
        currentTo: String(currentSeries.to || currentRange.displayTo.toISOString()),
        previousFrom: String(previousSeries.from || currentRange.displayFrom.toISOString()),
        previousTo: String(previousSeries.to || currentRange.displayTo.toISOString()),
      },
    },
  };
}

async function getTransactionsFromDb(session, filters) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const dateValue = filters?.dateRegion?.value || "year";
  const dateRange = calculateDateRange(dateValue);
  const fromDate = new Date(dateRange.from);
  const toDate = new Date(dateRange.to);
  if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf())) {
    return { success: false, error: "Ogiltigt datumintervall" };
  }
  const toExclusive = new Date(toDate);
  toExclusive.setDate(toExclusive.getDate() + 1);

  const transactionTypeInput = filters?.transactionType?.value ?? filters?.transactionType ?? "";
  const transactionTitle = normalizeReportTransactionType(transactionTypeInput);
  const transactionTitleAlt = transactionTitle
    ? transactionTitle.normalize("NFD").replace(/\p{Diacritic}/gu, "")
    : "";

  const retailstoreInput = filters?.retailstoreId ?? filters?.retailstore?.value ?? "";
  const retailstoreId = parseInt(String(retailstoreInput), 10);

  const whereParts = [
    "t.startdate >= @fromDate",
    "t.startdate < @toDate",
    "t.title <> 'Kortaktivering'",
  ];
  const params = [
    { name: "supportId", type: sql.Int, value: supportId },
    { name: "fromDate", type: sql.DateTime, value: fromDate },
    { name: "toDate", type: sql.DateTime, value: toExclusive },
  ];

  if (transactionTitle) {
    if (transactionTitleAlt && transactionTitleAlt !== transactionTitle) {
      whereParts.push("(t.title = @transactionTitle OR t.title = @transactionTitleAlt)");
      params.push({ name: "transactionTitleAlt", type: sql.VarChar, value: transactionTitleAlt });
    } else {
      whereParts.push("t.title = @transactionTitle");
    }
    params.push({ name: "transactionTitle", type: sql.VarChar, value: transactionTitle });
  }

  if (Number.isFinite(retailstoreId)) {
    whereParts.push("w.retailstoreid = @retailstoreId");
    params.push({ name: "retailstoreId", type: sql.Int, value: retailstoreId });
  }

  const rows = await query(
    `SELECT
        t.id AS transactionId,
        t.startdate AS startdate,
        t.title AS title,
        t.amount AS amount,
        t.accountid AS accountid,
        t.guid AS guid,
        t.receiptid AS receiptid,
        w.retailstoreid AS retailstoreid,
        rs.name AS retailstorename,
        rs.friendlyname AS retailstorefriendlyname,
        cardinfo.shortcardnumber AS shortcardnumber,
        cardinfo.shortcardnumber2 AS shortcardnumber2
     FROM [transaction] t
     INNER JOIN view_account va ON va.id = t.accountid AND va.supportid = @supportId
     LEFT JOIN workstation w ON w.id = t.workstationid
     LEFT JOIN retailstore rs ON rs.id = w.retailstoreid
     OUTER APPLY (
       SELECT TOP 1 c.shortcardnumber, c.shortcardnumber2
       FROM card c
       WHERE c.accountid = t.accountid
       ORDER BY c.id DESC
     ) cardinfo
     WHERE ${whereParts.join(" AND ")}
     ORDER BY t.startdate DESC`,
    params
  );

  const transactions = (rows || []).map((row) => {
    const cardNo = String(row.shortcardnumber2 || row.shortcardnumber || "").trim();
    const retailstoreName = row.retailstorefriendlyname || row.retailstorename || "";
    const hasReceipt = !!(row.guid || row.receiptid);
    return {
      Datum: formatReportDate(row.startdate),
      Beskrivning: row.title || "",
      Belopp: formatReportAmount(row.amount),
      Kortnummer: cardNo,
      Konto: row.accountid != null ? String(row.accountid) : "",
      "S\u00e4ljst\u00e4lle": retailstoreName || "",
      __transactionId: row.transactionId != null ? String(row.transactionId) : "",
      __hasReceipt: hasReceipt ? "true" : "false",
    };
  });

  return { success: true, transactions };
}

async function getTransactionsFromBizdesk(session, filters) {
  const customerId = session.selectedCustomerId;
  if (!customerId) throw new Error("Ingen kund vald");
  const reportUrl = `${AUTH_BASE_URL}/bizdesk/${customerId}/report_transactions`;
  const ua = USER_AGENT;
  let currentCookies = session.cookies;

  const resp1 = await fetch(`${reportUrl}.aspx`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "follow" });
  const html1 = await decodeResponseText(resp1);
  const fields1 = parseHiddenFields(html1);

  if (!fields1["__VIEWSTATE"]) {
    throw new Error("Kunde inte ladda rapportsidan");
  }

  const dateValue = filters?.dateRegion?.value || "year";
  const dateLabel = filters?.dateRegion?.label || "I år";
  const dateRange = calculateDateRange(dateValue);
  const transactionTypeValue = filters?.transactionType?.value || "0";
  const transactionTypeLabel = filters?.transactionType?.label || (transactionTypeValue === "0" ? "Alla" : String(transactionTypeValue));

  const form2 = new URLSearchParams();
  if (fields1["ctl00_RadScriptManager1_TSM"]) form2.append("ctl00_RadScriptManager1_TSM", fields1["ctl00_RadScriptManager1_TSM"]);
  form2.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$btnAdvancedSearch");
  form2.append("__EVENTARGUMENT", "");
  if (fields1["__VIEWSTATE"]) form2.append("__VIEWSTATE", fields1["__VIEWSTATE"]);
  if (fields1["__VIEWSTATEGENERATOR"]) form2.append("__VIEWSTATEGENERATOR", fields1["__VIEWSTATEGENERATOR"]);
  if (fields1["__EVENTVALIDATION"]) form2.append("__EVENTVALIDATION", fields1["__EVENTVALIDATION"]);
  appendReportFormFields(form2, {
    dateLabel,
    dateValue,
    transactionType: transactionTypeValue,
    transactionTypeLabel,
    status: filters?.status || "",
    terminalType: filters?.terminalType || "",
    showOfflineTrans: filters?.showOfflineTrans || "2",
  });

  const resp2 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form2.toString() });
  const html2 = await decodeResponseText(resp2);
  const fields2 = parseHiddenFields(html2);
  const calendarState = {
    from: {
      calendarSD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_calendar_SD"],
      calendarAD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_calendar_AD"],
      clientState: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_ClientState"],
    },
    to: {
      calendarSD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateTo_calendar_SD"],
      calendarAD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateTo_calendar_AD"],
      clientState: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateTo_ClientState"],
    },
  };

  const form3 = new URLSearchParams();
  if (fields2["ctl00_RadScriptManager1_TSM"]) form3.append("ctl00_RadScriptManager1_TSM", fields2["ctl00_RadScriptManager1_TSM"]);
  form3.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$btnSearch");
  form3.append("__EVENTARGUMENT", "");
  if (fields2["__VIEWSTATE"]) form3.append("__VIEWSTATE", fields2["__VIEWSTATE"]);
  if (fields2["__VIEWSTATEGENERATOR"]) form3.append("__VIEWSTATEGENERATOR", fields2["__VIEWSTATEGENERATOR"]);
  if (fields2["__EVENTVALIDATION"]) form3.append("__EVENTVALIDATION", fields2["__EVENTVALIDATION"]);
  appendReportFormFields(form3, {
    dateLabel,
    dateValue,
    transactionType: transactionTypeValue,
    transactionTypeLabel,
    status: filters?.status || "",
    terminalType: filters?.terminalType || "",
    showOfflineTrans: filters?.showOfflineTrans || "2",
  });
  appendAdvancedSearchFields(form3, { dateRange, calendarState });

  const resp3 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form3.toString() });
  const html3 = await decodeResponseText(resp3);

  const transactions = parseRadGridTable(html3);
  return { success: true, transactions };
}

export async function getTransactions(session, filters) {
  try {
    return await getTransactionsFromDb(session, filters);
  } catch (error) {
    console.error("Report transactions DB error:", error);
    return { success: false, error: "Kunde inte h\u00e4mta rapport" };
  }
}

export async function getGiftcardMakerSession(session) {
  return await resolveGiftcardMakerCompanies(session);
}
export async function getReceiptGuid(session, { transactionId, cardNumber, dateRegion }) {
  const customerId = session.selectedCustomerId;
  if (!customerId) throw new Error("Ingen kund vald");

  const txId = toInt32(transactionId, NaN);
  if (Number.isFinite(txId)) {
    try {
      const rows = await query(
        `SELECT TOP 1 guid
         FROM [transaction]
         WHERE id = @transactionId`,
        [{ name: "transactionId", type: sql.Int, value: txId }]
      );
      const guid = rows?.[0]?.guid;
      if (guid) {
        return { success: true, guid: String(guid) };
      }
    } catch (error) {
      console.log("[report] Receipt GUID DB lookup failed:", error);
    }
  }

  if (!cardNumber) {
    return { success: false, error: "Kunde inte hitta kvitto" };
  }

  const reportUrl = `${AUTH_BASE_URL}/bizdesk/${customerId}/report_transactions`;
  const dateValue = dateRegion?.value || "year";
  const dateLabel = dateRegion?.label || "I år";
  const dateRange = calculateDateRange(dateValue);
  let currentCookies = session.cookies;

  const resp1 = await fetch(`${reportUrl}.aspx`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": USER_AGENT }, redirect: "follow" });
  const html1 = await decodeResponseText(resp1);
  currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp1.headers) });
  const fields1 = parseHiddenFields(html1);

  if (!fields1["__VIEWSTATE"]) {
    return { success: false, error: "Kunde inte ladda rapportsidan" };
  }

  const form2 = new URLSearchParams();
  if (fields1["ctl00_RadScriptManager1_TSM"]) form2.append("ctl00_RadScriptManager1_TSM", fields1["ctl00_RadScriptManager1_TSM"]);
  form2.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$btnAdvancedSearch");
  form2.append("__EVENTARGUMENT", "");
  if (fields1["__VIEWSTATE"]) form2.append("__VIEWSTATE", fields1["__VIEWSTATE"]);
  if (fields1["__VIEWSTATEGENERATOR"]) form2.append("__VIEWSTATEGENERATOR", fields1["__VIEWSTATEGENERATOR"]);
  if (fields1["__EVENTVALIDATION"]) form2.append("__EVENTVALIDATION", fields1["__EVENTVALIDATION"]);
  appendReportFormFields(form2, { dateLabel, dateValue });

  const resp2 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": USER_AGENT, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form2.toString() });
  const html2 = await decodeResponseText(resp2);
  currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp2.headers) });
  const fields2 = parseHiddenFields(html2);
  const calendarState = {
    from: {
      calendarSD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_calendar_SD"],
      calendarAD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_calendar_AD"],
      clientState: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateFrom_ClientState"],
    },
    to: {
      calendarSD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateTo_calendar_SD"],
      calendarAD: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateTo_calendar_AD"],
      clientState: fields2["ctl00_MPSPage_ContentPlaceHolder_frmDateTo_ClientState"],
    },
  };

  const form3 = new URLSearchParams();
  if (fields2["ctl00_RadScriptManager1_TSM"]) form3.append("ctl00_RadScriptManager1_TSM", fields2["ctl00_RadScriptManager1_TSM"]);
  form3.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$btnSearch");
  form3.append("__EVENTARGUMENT", "");
  if (fields2["__VIEWSTATE"]) form3.append("__VIEWSTATE", fields2["__VIEWSTATE"]);
  if (fields2["__VIEWSTATEGENERATOR"]) form3.append("__VIEWSTATEGENERATOR", fields2["__VIEWSTATEGENERATOR"]);
  if (fields2["__EVENTVALIDATION"]) form3.append("__EVENTVALIDATION", fields2["__EVENTVALIDATION"]);
  appendReportFormFields(form3, { dateLabel, dateValue });
  appendAdvancedSearchFields(form3, { dateRange, calendarState });
  form3.set("ctl00$MPSPage_ContentPlaceHolder$frmCardNo", cardNumber);

  const resp3 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": USER_AGENT, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form3.toString() });
  const html3 = await decodeResponseText(resp3);
  currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp3.headers) });
  const fields3 = parseHiddenFields(html3);
  const searchResults = parseRadGridTable(html3);
  if (searchResults.length === 0) {
    return { success: false, error: "Inga transaktioner hittades" };
  }

  const form4 = new URLSearchParams();
  if (fields3["ctl00_RadScriptManager1_TSM"]) form4.append("ctl00_RadScriptManager1_TSM", fields3["ctl00_RadScriptManager1_TSM"]);
  form4.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$RadGridTransaction");
  form4.append("__EVENTARGUMENT", "RowClick;0");
  if (fields3["__VIEWSTATE"]) form4.append("__VIEWSTATE", fields3["__VIEWSTATE"]);
  if (fields3["__VIEWSTATEGENERATOR"]) form4.append("__VIEWSTATEGENERATOR", fields3["__VIEWSTATEGENERATOR"]);
  if (fields3["__EVENTVALIDATION"]) form4.append("__EVENTVALIDATION", fields3["__EVENTVALIDATION"]);
  appendReportFormFields(form4, { dateLabel: dateRegion?.label || "Denna vecka", dateValue });
  appendAdvancedSearchFields(form4, { dateRange, calendarState });
  form4.append("ctl00$MPSPage_ContentPlaceHolder$RadGridTransaction$ctl00$ctl03$ctl01$PageSizeComboBox", "10");
  form4.append("ctl00_MPSPage_ContentPlaceHolder_RadGridTransaction_ctl00_ctl03_ctl01_PageSizeComboBox_ClientState", "");
  form4.set("ctl00_MPSPage_ContentPlaceHolder_RadGridTransaction_ClientState",
    JSON.stringify({"selectedIndexes":["0"],"selectedCellsIndexes":[],"unselectableItemsIndexes":[],"reorderedColumns":[],"expandedItems":[],"expandedGroupItems":[],"expandedFilterItems":[],"deletedItems":[],"hidedColumns":[],"showedColumns":[],"groupColsState":{},"hierarchyState":{},"popUpLocations":{},"draggedItemsIndexes":[]})
  );

  await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": USER_AGENT, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form4.toString() });

  const receiptUrl = `${AUTH_BASE_URL}/bizdesk/${customerId}/pop_transaction_receipt`;
  const resp5 = await fetch(receiptUrl, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": USER_AGENT, "Referer": reportUrl }, redirect: "follow" });
  const receiptHtml = await decodeResponseText(resp5);

  const guidMatch = receiptHtml.match(/receipt\/?\?guid=([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (guidMatch) {
    return { success: true, guid: guidMatch[1] };
  }

  const anyGuid = receiptHtml.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
  if (anyGuid) {
    return { success: true, guid: anyGuid[1] };
  }

  return { success: false, error: "Kunde inte hitta kvitto-GUID" };
}
export async function searchCardholders(session, body) {
  const customerId = session.selectedCustomerId;
  if (!customerId || session.needsCustomer) {
    return { success: false, error: "Ingen kund vald" };
  }

  const sortBy = normalizeCardholderSort(body?.sortBy);
  const hasSort = !!sortBy;
  const hasQuery = !!(body?.showAll || body?.firstName || body?.lastName || body?.email || body?.cardNumber || body?.cardAccount);
  if (session.authSource === "db" || hasSort || hasQuery) {
    try {
      const dbResults = await searchCardholdersFromDb(session, body || {});
      return { success: true, ...dbResults };
    } catch (error) {
      console.log("[cardholder] DB search failed, falling back to Bizdesk:", error?.message || error);
      if (session.authSource === "db") {
        return { success: false, error: "Databas ej tillgänglig för denna inloggning" };
      }
    }
  }

  const showAll = body?.showAll === true || body?.showAll === "true";
  const ua = USER_AGENT;
  let currentCookies = session.cookies;

  const mergeCk = (existing, newCookies) => {
    if (Object.keys(newCookies).length === 0) return existing;
    const parsed = Object.fromEntries(existing.split('; ').map(c => { const [k,...v] = c.split('='); return [k, v.join('=')]; }));
    return buildCookieHeader({ ...parsed, ...newCookies });
  };
  const tryDbFallback = async () => {
    try {
      const dbResults = await searchCardholdersFromDb(session, body || {});
      return { success: true, ...dbResults };
    } catch (error) {
      console.log("[cardholder] DB fallback unavailable:", error?.message || error);
      return null;
    }
  };

  const defaultResp = await fetch(`${AUTH_BASE_URL}/bizdesk/${customerId}/default.aspx`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
  await defaultResp.text();
  currentCookies = mergeCk(currentCookies, extractCookies(defaultResp.headers));
  if (defaultResp.status === 301 || defaultResp.status === 302) {
    const loc = defaultResp.headers.get("location");
    const fullLoc = loc?.startsWith("http") ? loc : `${AUTH_BASE_URL}${loc}`;
    const dr2 = await fetch(fullLoc, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
    await dr2.text();
    currentCookies = mergeCk(currentCookies, extractCookies(dr2.headers));
  }

  let resp1 = await fetch(`${AUTH_BASE_URL}/bizdesk/${customerId}/cardholder_find`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
  currentCookies = mergeCk(currentCookies, extractCookies(resp1.headers));

  if (resp1.status === 301 || resp1.status === 302) {
    const redirectUrl = resp1.headers.get("location");
    await resp1.text();
    if (redirectUrl?.includes("error")) {
      const fallback = await tryDbFallback();
      if (fallback) return fallback;
      return { success: false, error: "Kunde inte öppna kortinnehavarvyn i Bizdesk" };
    }
    const fullRedirectUrl = redirectUrl?.startsWith("http") ? redirectUrl : `${AUTH_BASE_URL}${redirectUrl}`;
    resp1 = await fetch(fullRedirectUrl, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
    currentCookies = mergeCk(currentCookies, extractCookies(resp1.headers));
  }

  if (resp1.status >= 400) {
    const fallback = await tryDbFallback();
    if (fallback) return fallback;
    return { success: false, error: "Kunde inte läsa kortinnehavare från Bizdesk" };
  }

  const html1 = await decodeResponseText(resp1);
  const fields1 = parseHiddenFields(html1);
  if (!fields1["__VIEWSTATE"]) {
    const fallback = await tryDbFallback();
    if (fallback) return fallback;
    return { success: false, error: "Kunde inte läsa kortinnehavare från Bizdesk" };
  }

  const workingFindUrl = `${AUTH_BASE_URL}/bizdesk/${customerId}/cardholder_find`;
  const formActionMatch = html1.match(/<form[^>]+action=\"([^\"]+)\"/i);
  const formAction = formActionMatch ? new URL(formActionMatch[1], `${AUTH_BASE_URL}/bizdesk/${customerId}/cardholder_find.aspx`).toString() : workingFindUrl;

  const formFields = parseFormFields(html1);
  formFields["__EVENTTARGET"] = "ctl00$MPSPage_ContentPlaceHolder$btnSearch";
  formFields["__EVENTARGUMENT"] = "";

  const form2 = new URLSearchParams();
  for (const [key, val] of Object.entries(formFields)) {
    form2.append(key, val ?? "");
  }

  const resp2 = await fetch(formAction, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": workingFindUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form2.toString() });
  const html2 = await decodeResponseText(resp2);
  currentCookies = mergeCk(currentCookies, extractCookies(resp2.headers));

  const allCardholders = parseCardholderTable(html2);
  let infoText = tryGetInfoPartText(html2);
  let currentPage = tryGetCurrentPageFromHtml(html2);

  if (showAll) {
    const seenKeys = new Set();
    for (const ch of allCardholders) {
      seenKeys.add(makeKey(ch));
    }

    let currentPageHtml = html2;
    let pager = extractPagerSubmitNames(currentPageHtml);
    let safety = 0;
    while (pager.next && safety < 500) {
      const pageFields = parseFormFields(currentPageHtml);
      pageFields["__EVENTTARGET"] = "";
      pageFields["__EVENTARGUMENT"] = "";
      pageFields[pager.next] = " ";

      const pageForm = new URLSearchParams();
      for (const [key, val] of Object.entries(pageFields)) {
        pageForm.append(key, val ?? "");
      }

      const pageResp = await fetch(formAction, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": workingFindUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: pageForm.toString() });
      currentPageHtml = await decodeResponseText(pageResp);
      currentCookies = mergeCk(currentCookies, extractCookies(pageResp.headers));
      const pageCardholders = parseCardholderTable(currentPageHtml);
      infoText = tryGetInfoPartText(currentPageHtml) || infoText;
      currentPage = tryGetCurrentPageFromHtml(currentPageHtml) ?? currentPage;
      let added = 0;
      for (const row of pageCardholders) {
        const key = makeKey(row);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        allCardholders.push(row);
        added++;
      }
      if (added === 0) break;
      pager = extractPagerSubmitNames(currentPageHtml);
      safety++;
    }
  }

  const enrichPromises = allCardholders.map(async (ch) => {
    const cardNo = ch["Kortnr"] || ch["Kortnummer"];
    if (!cardNo || cardNo === "&nbsp;" || cardNo === "\u00a0") return ch;
    try {
      const mpsResp = await fetch(`${MPS2_BASE_URL}/Identifier/History?identifier=${encodeURIComponent(cardNo)}&terminalId=d0091f52-5fc8-40e0-b8fe-0cc898478e71`, {
        method: "GET", headers: { "Content-Type": "application/json" },
      });
      if (mpsResp.ok) {
        const mpsData = await mpsResp.json();
        if (mpsData?.Success && mpsData?.Data) {
          ch["Saldo"] = String(mpsData.Data.balance || 0);
          if (mpsData.Data.identifier?.expires) ch["Utgångsdatum"] = mpsData.Data.identifier.expires;
          if (mpsData.Data.identifier?.blocked !== undefined) ch["Spärrat"] = String(mpsData.Data.identifier.blocked);
        }
      }
    } catch (e) {
      console.log("MPS2 enrich failed for", cardNo, e);
    }
    return ch;
  });
  const enrichedCardholders = await Promise.all(enrichPromises);

  const infoCounts = parseInfoCounts(infoText);
  const totalCount = infoCounts.totalItems || enrichedCardholders.length;
  const meta = {
    infoText,
    totalItems: infoCounts.totalItems,
    pages: infoCounts.pages,
    currentPage,
    returned: allCardholders.length,
    unique: enrichedCardholders.length,
  };

  return {
    success: true,
    cardholders: enrichedCardholders,
    totalCount,
    page: currentPage,
    pageSize: enrichedCardholders.length,
    meta,
  };
}

export async function assignExistingCardToCardholder(session, { customerId, accountId, cardNumber }) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const customerIdNum = toInt32(customerId, null);
  const accountIdNum = toInt32(accountId, null);
  const normalizedCardNo = normalizeCardNumber(cardNumber);

  if (!Number.isFinite(customerIdNum) || !Number.isFinite(accountIdNum)) {
    return { success: false, error: "Ogiltig kortinnehavare eller konto" };
  }

  if (!normalizedCardNo) {
    return { success: false, error: "Ogiltigt kortnummer" };
  }

  const scopedAccountRows = await query(
    `SELECT TOP 1 ca.customerid AS customerid, ca.accountid AS accountid
     FROM customer_account ca
     INNER JOIN account a ON a.id = ca.accountid
     INNER JOIN view_poolcardtype vpt
       ON vpt.id = a.poolcardtypeid
      AND vpt.supportid = @supportId
     WHERE ca.customerid = @customerId
       AND ca.accountid = @accountId`,
    [
      { name: "supportId", type: sql.Int, value: supportId },
      { name: "customerId", type: sql.Int, value: customerIdNum },
      { name: "accountId", type: sql.Int, value: accountIdNum },
    ]
  );

  if (!scopedAccountRows?.length) {
    return { success: false, error: "Kunde inte hitta kortinnehavarens konto" };
  }

  const existingCardsOnAccount = await query(
    `SELECT TOP 1 c.id
     FROM card c
     WHERE c.accountid = @accountId
     ORDER BY c.id DESC`,
    [{ name: "accountId", type: sql.Int, value: accountIdNum }]
  );

  if (existingCardsOnAccount.length > 0) {
    return { success: false, error: "Kortinnehavaren har redan ett kort kopplat" };
  }

  const matchingCardRows = await query(
    `SELECT TOP 2
        c.id AS cardid,
        c.accountid AS accountid,
        c.customerid AS customerid
     FROM card c
     WHERE LTRIM(RTRIM(c.shortcardnumber2)) = @cardNo
        OR LTRIM(RTRIM(c.shortcardnumber)) = @cardNo
     ORDER BY c.id DESC`,
    [{ name: "cardNo", type: sql.VarChar, value: normalizedCardNo }]
  );

  if (!matchingCardRows.length) {
    return { success: false, error: "Kortnumret finns inte i databasen" };
  }

  if (matchingCardRows.length > 1) {
    return { success: false, error: "Flera kort hittades med samma kortnummer" };
  }

  const cardRow = matchingCardRows[0];
  const cardAccountIdNum = toInt32(cardRow.accountid, null);
  const cardCustomerIdNum = toInt32(cardRow.customerid, null);
  let sourceAccountIdForMove = null;

  if (Number.isFinite(cardAccountIdNum)) {
    if (cardAccountIdNum === accountIdNum) {
      return { success: true, accountId: String(accountIdNum), customerId: String(customerIdNum), cardNumber: normalizedCardNo };
    }

    if (Number.isFinite(cardCustomerIdNum)) {
      return { success: false, error: "Kortet har redan en kortinnehavare kopplad" };
    }

    const sourceAccountCustomerLinks = await query(
      `SELECT TOP 1 ca.customerid
       FROM customer_account ca
       WHERE ca.accountid = @sourceAccountId`,
      [{ name: "sourceAccountId", type: sql.Int, value: cardAccountIdNum }]
    );
    if (sourceAccountCustomerLinks.length > 0) {
      return { success: false, error: "Kortkontot är redan kopplat till en kortinnehavare" };
    }

    const sourceAccountTransactions = await query(
      `SELECT TOP 1 t.id
       FROM [transaction] t
       WHERE t.accountid = @sourceAccountId
       ORDER BY t.id DESC`,
      [{ name: "sourceAccountId", type: sql.Int, value: cardAccountIdNum }]
    );
    if (sourceAccountTransactions.length > 0) {
      return { success: false, error: "Kortkontot har transaktioner och kan inte kopplas om" };
    }

    sourceAccountIdForMove = cardAccountIdNum;
  }

  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  let shouldRollback = false;

  try {
    await transaction.begin();
    shouldRollback = true;

    const request = new sql.Request(transaction);
    request.input("accountId", sql.Int, accountIdNum);
    request.input("customerId", sql.Int, customerIdNum);
    request.input("cardId", sql.Int, cardRow.cardid);
    request.input("sourceAccountId", sql.Int, sourceAccountIdForMove);
    request.input("allowSourceMove", sql.Bit, sourceAccountIdForMove != null ? 1 : 0);

    const updateResult = await request.query(
      `UPDATE c
       SET c.accountid = @accountId,
           c.customerid = @customerId
       FROM card c
       WHERE c.id = @cardId
         AND (
           c.accountid IS NULL
           OR (@allowSourceMove = 1 AND c.accountid = @sourceAccountId)
         )
         AND c.customerid IS NULL
         AND (
           @allowSourceMove = 0
           OR NOT EXISTS (
             SELECT 1
             FROM customer_account ca
             WHERE ca.accountid = @sourceAccountId
           )
         )
         AND (
           @allowSourceMove = 0
           OR NOT EXISTS (
             SELECT 1
             FROM [transaction] t
             WHERE t.accountid = @sourceAccountId
           )
         )
         AND NOT EXISTS (
           SELECT 1
           FROM card existing
           WHERE existing.accountid = @accountId
             AND existing.id <> @cardId
         );
       SELECT @@ROWCOUNT AS affected;`
    );

    const affected = Number(updateResult.recordset?.[0]?.affected || 0);
    if (affected !== 1) {
      await transaction.rollback();
      shouldRollback = false;
      return { success: false, error: "Kunde inte koppla kortet. Kontrollera att kontot fortfarande saknar kort." };
    }

    await transaction.commit();
    shouldRollback = false;
    return {
      success: true,
      accountId: String(accountIdNum),
      customerId: String(customerIdNum),
      cardNumber: normalizedCardNo,
    };
  } catch (error) {
    try {
      if (shouldRollback) {
        await transaction.rollback();
      }
    } catch {
      // ignore rollback failure
    }
    console.error("Assign existing card error:", error);
    return { success: false, error: "Kunde inte koppla kortet" };
  }
}
export async function listGiftcards(session, body) {
  const customerId = session.selectedCustomerId;
  if (!customerId || session.needsCustomer) {
    return { success: false, error: "Ingen kund vald" };
  }

  const queryText = body?.query || body?.cardNumber || body?.search;
  const filterOptions = normalizeGiftcardFilters(body);
  const sortBy = normalizeGiftcardSort(body?.sortBy);
  const hasSort = !!sortBy;
  if (queryText) {
    const dbGiftcards = await listGiftcardsFromDb(session, body?.pageSize, body?.page, queryText, body);
    return { success: true, ...dbGiftcards };
  }

  if (session.authSource === "db" || hasSort) {
    const dbGiftcards = await listGiftcardsFromDb(session, body?.pageSize, body?.page, queryText, body);
    return { success: true, ...dbGiftcards };
  }

  const showAll = body?.showAll !== false;
  const ua = USER_AGENT;
  let currentCookies = session.cookies;

  const mergeCk = (existing, newCookies) => {
    if (Object.keys(newCookies).length === 0) return existing;
    const parsed = Object.fromEntries(existing.split('; ').map(c => { const [k,...v] = c.split('='); return [k, v.join('=')]; }));
    return buildCookieHeader({ ...parsed, ...newCookies });
  };

  const defaultResp = await fetch(`${AUTH_BASE_URL}/bizdesk/${customerId}/default.aspx`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
  await defaultResp.text();
  currentCookies = mergeCk(currentCookies, extractCookies(defaultResp.headers));
  if (defaultResp.status === 301 || defaultResp.status === 302) {
    const loc = defaultResp.headers.get("location");
    const fullLoc = loc?.startsWith("http") ? loc : `${AUTH_BASE_URL}${loc}`;
    const dr2 = await fetch(fullLoc, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
    await dr2.text();
    currentCookies = mergeCk(currentCookies, extractCookies(dr2.headers));
  }

  let resp1 = await fetch(`${AUTH_BASE_URL}/bizdesk/${customerId}/cardaccount_find`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
  currentCookies = mergeCk(currentCookies, extractCookies(resp1.headers));

  if (resp1.status === 301 || resp1.status === 302) {
    const redirectUrl = resp1.headers.get("location");
    await resp1.text();
    if (redirectUrl?.includes("error")) {
      const dbGiftcards = await listGiftcardsFromDb(session, body?.pageSize, body?.page, queryText, body);
      return { success: true, ...dbGiftcards };
    }
    const fullRedirectUrl = redirectUrl?.startsWith("http") ? redirectUrl : `${AUTH_BASE_URL}${redirectUrl}`;
    resp1 = await fetch(fullRedirectUrl, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "manual" });
    currentCookies = mergeCk(currentCookies, extractCookies(resp1.headers));
  }

  if (resp1.status >= 400) {
    const dbGiftcards = await listGiftcardsFromDb(session, body?.pageSize, body?.page, queryText, body);
    return { success: true, ...dbGiftcards };
  }

  const html1 = await decodeResponseText(resp1);
  const fields1 = parseHiddenFields(html1);
  if (!fields1["__VIEWSTATE"]) {
    const dbGiftcards = await listGiftcardsFromDb(session, body?.pageSize, body?.page, queryText, body);
    return { success: true, ...dbGiftcards };
  }

  const workingFindUrl = `${AUTH_BASE_URL}/bizdesk/${customerId}/cardaccount_find`;
  const formActionMatch = html1.match(/<form[^>]+action=\"([^\"]+)\"/i);
  const formAction = formActionMatch ? new URL(formActionMatch[1], `${AUTH_BASE_URL}/bizdesk/${customerId}/cardaccount_find.aspx`).toString() : workingFindUrl;

  const formFields = parseFormFields(html1);
  const clearPatterns = [
    /SearchPoolcardtype/i,
    /SearchPool/i,
    /SearchRetailstore/i,
    /Poolcardtype/i,
    /frmCardtype/i,
    /frmStatus/i,
    /frmDateFrom/i,
    /frmDateTo/i,
    /frmAmountFrom/i,
    /frmAmountTo/i,
    /frmShowOfflineTrans/i,
    /frmTransactiontype/i,
    /frmTerminalType/i,
  ];
  for (const key of Object.keys(formFields)) {
    if (clearPatterns.some((re) => re.test(key))) {
      formFields[key] = "";
    }
  }
  formFields["__EVENTTARGET"] = "ctl00$MPSPage_ContentPlaceHolder$btnSearch";
  formFields["__EVENTARGUMENT"] = "";

  const form2 = new URLSearchParams();
  for (const [key, val] of Object.entries(formFields)) {
    form2.append(key, val ?? "");
  }

  const resp2 = await fetch(formAction, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": workingFindUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form2.toString() });
  const html2 = await decodeResponseText(resp2);
  currentCookies = mergeCk(currentCookies, extractCookies(resp2.headers));

  let allGiftcards = parseGiftcardsFromCardAccountFindHtml(html2);
  let infoText = tryGetInfoPartText(html2);
  let currentPage = tryGetCurrentPageFromHtml(html2);

  if (showAll) {
    const seenCards = new Set();
    for (const gc of allGiftcards) {
      const key = (gc.cardNo || gc.accountNo || "").trim();
      if (key) seenCards.add(key);
    }

    let currentPageHtml = html2;
    let pager = extractPagerSubmitNames(currentPageHtml);
    const doPostTargets = extractDoPostBackTargets(currentPageHtml);
    let safety = 0;
    while (pager.next && safety < 500) {
      const pageFields = parseFormFields(currentPageHtml);
      pageFields["__EVENTTARGET"] = "";
      pageFields["__EVENTARGUMENT"] = "";
      pageFields[pager.next] = " ";

      const pageForm = new URLSearchParams();
      for (const [key, val] of Object.entries(pageFields)) {
        pageForm.append(key, val ?? "");
      }

      const pageResp = await fetch(formAction, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": workingFindUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: pageForm.toString() });
      currentPageHtml = await decodeResponseText(pageResp);
      currentCookies = mergeCk(currentCookies, extractCookies(pageResp.headers));

      const pageGiftcards = parseGiftcardsFromCardAccountFindHtml(currentPageHtml);
      infoText = tryGetInfoPartText(currentPageHtml) || infoText;
      currentPage = tryGetCurrentPageFromHtml(currentPageHtml) ?? currentPage;
      let added = 0;
      for (const gc of pageGiftcards) {
        const key = (gc.cardNo || gc.accountNo || "").trim();
        if (!key || seenCards.has(key)) continue;
        seenCards.add(key);
        added++;
      }
      allGiftcards = allGiftcards.concat(pageGiftcards);
      if (added === 0) break;
      pager = extractPagerSubmitNames(currentPageHtml);
      safety++;
    }

    if (!pager.next && doPostTargets.length > 0) {
      const targets = extractDoPostBackTargets(currentPageHtml);
      for (const target of targets) {
        const pageFields = parseHiddenFields(currentPageHtml);
        if (!pageFields["__VIEWSTATE"]) break;
        const pageForm = new URLSearchParams();
        if (pageFields["ctl00_RadScriptManager1_TSM"]) pageForm.append("ctl00_RadScriptManager1_TSM", pageFields["ctl00_RadScriptManager1_TSM"]);
        pageForm.append("__EVENTTARGET", target.target);
        pageForm.append("__EVENTARGUMENT", target.argument || "");
        if (pageFields["__VIEWSTATE"]) pageForm.append("__VIEWSTATE", pageFields["__VIEWSTATE"]);
        if (pageFields["__VIEWSTATEGENERATOR"]) pageForm.append("__VIEWSTATEGENERATOR", pageFields["__VIEWSTATEGENERATOR"]);
        if (pageFields["__EVENTVALIDATION"]) pageForm.append("__EVENTVALIDATION", pageFields["__EVENTVALIDATION"]);
        pageForm.append("ctl00$mdRadMenu", "");

        const pageResp = await fetch(formAction, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": workingFindUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: pageForm.toString() });
        currentPageHtml = await decodeResponseText(pageResp);
        currentCookies = mergeCk(currentCookies, extractCookies(pageResp.headers));
        const pageGiftcards = parseGiftcardsFromCardAccountFindHtml(currentPageHtml);
        infoText = tryGetInfoPartText(currentPageHtml) || infoText;
        currentPage = tryGetCurrentPageFromHtml(currentPageHtml) ?? currentPage;
        let added = 0;
        for (const gc of pageGiftcards) {
          const key = (gc.cardNo || gc.accountNo || "").trim();
          if (!key || seenCards.has(key)) continue;
          seenCards.add(key);
          added++;
        }
        allGiftcards = allGiftcards.concat(pageGiftcards);
        if (added === 0) break;
      }
    }
  }

  const giftcards = allGiftcards.map((gc) => {
    const balanceRaw = gc["Saldo"] || gc["Balance"] || gc["Kortsaldo"] || "0";
    const balance = parseInt(balanceRaw, 10) || 0;
    const cardNumber = gc.cardNo || gc["Kortnummer"] || gc["Card number"] || "";
    return {
      id: gc["Kontoid"] || gc["Account id"] || gc.accountNo || cardNumber,
      cardNumber,
      accountId: gc.accountNo || gc["Kontoid"] || "",
      balance,
      status: (gc["Status"] || "").toLowerCase().includes("spärr") ? "blocked" : "active",
      expiresAt: gc["Utgångsdatum"] || gc["Expires"] || "",
      createdAt: gc["Datum"] || "",
    };
  });

  const uniqueGiftcards = dedupeGiftcards(giftcards);
  const filteredGiftcards = applyGiftcardFilters(uniqueGiftcards, filterOptions);
  const enrichedGiftcards = await enrichGiftcardsWithTransactionSummary(session, filteredGiftcards);
  const infoCounts = parseInfoCounts(infoText);
  const meta = {
    infoText,
    totalItems: infoCounts.totalItems,
    pages: infoCounts.pages,
    currentPage,
    returned: enrichedGiftcards.length,
  };

  return {
    success: true,
    giftcards: enrichedGiftcards,
    totalCount: enrichedGiftcards.length,
    page: currentPage,
    pageSize: enrichedGiftcards.length,
    meta,
  };
}

export async function listRetailstoresForAccount(session, accountId) {
  if (!accountId) {
    return { success: false, error: "Missing accountId" };
  }

  const accountIdNum = parseInt(accountId, 10);
  if (!Number.isFinite(accountIdNum)) {
    return { success: false, error: "Invalid accountId" };
  }

  const accountRows = await query(
    `SELECT TOP 1 a.id AS accountId, a.poolcardtypeid, pct.poolid, pct.allretailstore
     FROM account a
     LEFT JOIN poolcardtype pct ON pct.id = a.poolcardtypeid
     WHERE a.id = @accountId`,
    [{ name: "accountId", type: sql.Int, value: accountIdNum }]
  );

  if (!accountRows || accountRows.length === 0) {
    return { success: false, error: "Kunde inte hitta konto" };
  }

  const poolcardtypeId = accountRows[0].poolcardtypeid;
  const poolId = accountRows[0].poolid;
  const allRetailstore = !!accountRows[0].allretailstore;

  let storeRows = [];
  if (allRetailstore && Number.isFinite(poolId)) {
    storeRows = await query(
      `SELECT rs.id, rs.name, rs.friendlyname
       FROM retailstore rs
       WHERE rs.poolid = @poolId
         AND (rs.inactive IS NULL OR rs.inactive = 0)
       ORDER BY rs.friendlyname, rs.name, rs.id`,
      [{ name: "poolId", type: sql.Int, value: poolId }]
    );
  } else if (Number.isFinite(poolcardtypeId)) {
    storeRows = await query(
      `SELECT DISTINCT rs.id, rs.name, rs.friendlyname
       FROM poolcardtype_retailstore pcr
       INNER JOIN retailstore rs ON rs.id = pcr.retailstoreid
       WHERE pcr.poolcardtypeid = @poolcardtypeId
         AND (pcr.inactive IS NULL OR pcr.inactive = 0)
         AND (rs.inactive IS NULL OR rs.inactive = 0)
       ORDER BY rs.friendlyname, rs.name, rs.id`,
      [{ name: "poolcardtypeId", type: sql.Int, value: poolcardtypeId }]
    );
  }

  if (!storeRows || storeRows.length === 0) {
    return { success: true, retailstores: [] };
  }

  const storeParams = storeRows.map((row, idx) => ({
    name: `storeId${idx}`,
    type: sql.Int,
    value: row.id,
  }));
  const storePlaceholders = storeParams.map((p) => `@${p.name}`).join(", ");
  const workstationRows = await query(
    `SELECT id, retailstoreid, name, terminalid, isdefault
     FROM workstation
     WHERE retailstoreid IN (${storePlaceholders})
       AND terminalid IS NOT NULL
     ORDER BY retailstoreid, isdefault DESC, name, id`,
    storeParams
  );

  const workstationsByStore = new Map();
  for (const ws of workstationRows || []) {
    const storeId = String(ws.retailstoreid);
    if (!workstationsByStore.has(storeId)) workstationsByStore.set(storeId, []);
    workstationsByStore.get(storeId).push({
      id: String(ws.id),
      name: ws.name || `Terminal ${ws.id}`,
      terminalId: ws.terminalid,
      isDefault: !!ws.isdefault,
    });
  }

  const retailstores = storeRows.map((store) => {
    const id = String(store.id);
    const name = store.friendlyname || store.name || id;
    const workstations = workstationsByStore.get(id) || [];
    const defaultWs = workstations.find((ws) => ws.isDefault) || workstations[0];
    return {
      id,
      name,
      workstations,
      defaultWorkstationId: defaultWs?.id,
      defaultTerminalId: defaultWs?.terminalId,
    };
  });

  return { success: true, retailstores };
}
function buildDateInputClientState(date) {
  return `{\"enabled\":true,\"emptyMessage\":\"\",\"validationText\":\"${date}\",\"valueAsString\":\"${date}T00:00:00\",\"minDateStr\":\"1000-01-01-00-00-00\",\"maxDateStr\":\"9999-12-31-00-00-00\",\"lastSetTextBoxValue\":\"${date}\"}`;
}

async function adjustGiftcardBalanceInDb(session, { cardNumber, amount, workstationId, operatorId }) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }

  const normalizedCardNo = normalizeCardNumber(cardNumber);
  if (!normalizedCardNo) {
    return { success: false, error: "Ogiltigt kortnummer" };
  }

  const amountInt = parseInt(String(amount), 10);
  if (!Number.isFinite(amountInt) || amountInt === 0) {
    return { success: false, error: "Ogiltigt belopp" };
  }

  const rows = await query(
    `SELECT TOP 1 vc.id AS cardid, vc.accountid AS accountid
     FROM view_card vc
     WHERE vc.supportid = @supportId
       AND (
         LTRIM(RTRIM(vc.shortcardnumber2)) = @cardNo
         OR LTRIM(RTRIM(vc.shortcardnumber)) = @cardNo
         OR vc.id = @cardId
       )
     ORDER BY
       CASE
         WHEN vc.shortcardnumber2 = @cardNo OR vc.shortcardnumber = @cardNo THEN 0
         ELSE 1
       END,
       vc.id DESC`,
    [
      { name: "supportId", type: sql.Int, value: supportId },
      { name: "cardNo", type: sql.VarChar, value: normalizedCardNo },
      { name: "cardId", type: sql.Int, value: toInt32(normalizedCardNo, -1) },
    ]
  );

  const cardId = rows?.[0]?.cardid;
  const accountId = rows?.[0]?.accountid;
  if (!cardId || !accountId) {
    return { success: false, error: "Kunde inte hitta kortet" };
  }

  const beforeRows = await query(
    `SELECT balance FROM account WHERE id = @accountId`,
    [{ name: "accountId", type: sql.Int, value: accountId }]
  );
  const beforeBalance = beforeRows?.[0]?.balance;

  const now = new Date();
  const opId = String(operatorId || session?.username || "Backoffice").slice(0, 32);
  const wsId = toInt32(workstationId, null);

  const execRows = await query(
    `DECLARE @id int, @errorcode int;
     EXEC oncard.sp_AddTransaction
       @amount = @amount,
       @accountid = @accountid,
       @startdate = @startdate,
       @stopdate = @stopdate,
       @cardid = @cardid,
       @workstationid = @workstationid,
       @receiptid = @receiptid,
       @transactiontypeid = @transactiontypeid,
       @operatorid = @operatorid,
       @vat = @vat,
       @loyaltyamount = @loyaltyamount,
       @id = @id OUTPUT,
       @errorcode = @errorcode OUTPUT;
     SELECT @id AS id, @errorcode AS errorcode;`,
    [
      { name: "amount", type: sql.Int, value: amountInt },
      { name: "accountid", type: sql.Int, value: accountId },
      { name: "startdate", type: sql.DateTime, value: now },
      { name: "stopdate", type: sql.DateTime, value: null },
      { name: "cardid", type: sql.Int, value: cardId },
      { name: "workstationid", type: sql.Int, value: wsId },
      { name: "receiptid", type: sql.Int, value: null },
      { name: "transactiontypeid", type: sql.Int, value: 2 },
      { name: "operatorid", type: sql.VarChar, value: opId },
      { name: "vat", type: sql.Int, value: 0 },
      { name: "loyaltyamount", type: sql.Int, value: 0 },
    ]
  );

  const errorCode = execRows?.[0]?.errorcode;
  if (Number.isFinite(errorCode) && Number(errorCode) !== 0) {
    return { success: false, error: `Transaktionen misslyckades (kod ${errorCode})` };
  }

  let finalBalance = beforeBalance;
  const afterRows = await query(
    `SELECT balance FROM account WHERE id = @accountId`,
    [{ name: "accountId", type: sql.Int, value: accountId }]
  );
  const afterBalance = afterRows?.[0]?.balance;

  if (Number.isFinite(afterBalance)) {
    finalBalance = afterBalance;
  }

  if (Number.isFinite(beforeBalance) && Number.isFinite(afterBalance)) {
    if (afterBalance === beforeBalance && amountInt !== 0) {
      const updated = beforeBalance + amountInt;
      await query(
        `UPDATE account SET balance = @balance WHERE id = @accountId`,
        [
          { name: "balance", type: sql.Int, value: updated },
          { name: "accountId", type: sql.Int, value: accountId },
        ]
      );
      finalBalance = updated;
    }
  }

  return {
    success: true,
    accountId: String(accountId),
    balance: Number.isFinite(finalBalance) ? finalBalance : null,
    transactionId: execRows?.[0]?.id != null ? String(execRows[0].id) : null,
  };
}

async function updateCardExpiryInDb(session, { cardNumber, newExpiryDate }) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }
  const normalizedCardNo = normalizeCardNumber(cardNumber);
  if (!normalizedCardNo) {
    return { success: false, error: "Ogiltigt kortnummer" };
  }
  const dateStr = String(newExpiryDate || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { success: false, error: "Ogiltigt datumformat" };
  }

  const rows = await query(
    `SELECT TOP 1 vc.id AS cardid
     FROM view_card vc
     WHERE vc.supportid = @supportId
       AND (
         LTRIM(RTRIM(vc.shortcardnumber2)) = @cardNo
         OR LTRIM(RTRIM(vc.shortcardnumber)) = @cardNo
         OR vc.id = @cardId
       )
     ORDER BY vc.id DESC`,
    [
      { name: "supportId", type: sql.Int, value: supportId },
      { name: "cardNo", type: sql.VarChar, value: normalizedCardNo },
      { name: "cardId", type: sql.Int, value: toInt32(normalizedCardNo, -1) },
    ]
  );

  const cardId = rows?.[0]?.cardid;
  if (!cardId) {
    return { success: false, error: "Kunde inte hitta kortet" };
  }

  const updateRows = await query(
    `UPDATE card
     SET expires = CONVERT(date, @expiryDate, 23)
     WHERE id = @cardId;
     SELECT @@ROWCOUNT AS rows;`,
    [
      { name: "expiryDate", type: sql.VarChar, value: dateStr },
      { name: "cardId", type: sql.Int, value: cardId },
    ]
  );

  const updated = updateRows?.[0]?.rows;
  if (!updated) {
    return { success: false, error: "Kunde inte uppdatera utgångsdatum" };
  }

  return { success: true };
}

export async function updateExpiry(session, { cardNumber, newExpiryDate }) {
  const customerId = session.selectedCustomerId;
  if (!customerId) return { success: false, error: "Ingen kund vald" };
  const dbResult = await updateCardExpiryInDb(session, { cardNumber, newExpiryDate });
  return dbResult;
  const ua = USER_AGENT;
  let currentCookies = session.cookies;

  try {
    const reportUrl = `${AUTH_BASE_URL}/bizdesk/${customerId}/report_transactions`;

    const resp1 = await fetch(`${reportUrl}.aspx`, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua }, redirect: "follow" });
    const html1 = await decodeResponseText(resp1);
    currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp1.headers) });
    const fields1 = parseHiddenFields(html1);

    if (!fields1["__VIEWSTATE"]) {
      return { success: false, error: "Kunde inte ladda rapportsidan" };
    }

    const form2 = new URLSearchParams();
    if (fields1["ctl00_RadScriptManager1_TSM"]) form2.append("ctl00_RadScriptManager1_TSM", fields1["ctl00_RadScriptManager1_TSM"]);
    form2.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$btnAdvancedSearch");
    form2.append("__EVENTARGUMENT", "");
    if (fields1["__VIEWSTATE"]) form2.append("__VIEWSTATE", fields1["__VIEWSTATE"]);
    if (fields1["__VIEWSTATEGENERATOR"]) form2.append("__VIEWSTATEGENERATOR", fields1["__VIEWSTATEGENERATOR"]);
    if (fields1["__EVENTVALIDATION"]) form2.append("__EVENTVALIDATION", fields1["__EVENTVALIDATION"]);
    appendReportFormFields(form2, { dateLabel: "I år", dateValue: "year" });

    const resp2 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form2.toString() });
    const html2 = await decodeResponseText(resp2);
    currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp2.headers) });
    const fields2 = parseHiddenFields(html2);

    const form3 = new URLSearchParams();
    if (fields2["ctl00_RadScriptManager1_TSM"]) form3.append("ctl00_RadScriptManager1_TSM", fields2["ctl00_RadScriptManager1_TSM"]);
    form3.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$btnSearch");
    form3.append("__EVENTARGUMENT", "");
    if (fields2["__VIEWSTATE"]) form3.append("__VIEWSTATE", fields2["__VIEWSTATE"]);
    if (fields2["__VIEWSTATEGENERATOR"]) form3.append("__VIEWSTATEGENERATOR", fields2["__VIEWSTATEGENERATOR"]);
    if (fields2["__EVENTVALIDATION"]) form3.append("__EVENTVALIDATION", fields2["__EVENTVALIDATION"]);
    appendReportFormFields(form3, { dateLabel: "I år", dateValue: "year" });
    appendAdvancedSearchFields(form3);
    form3.set("ctl00$MPSPage_ContentPlaceHolder$frmCardNo", cardNumber);

    const resp3 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form3.toString() });
    const html3 = await decodeResponseText(resp3);
    currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp3.headers) });
    const fields3 = parseHiddenFields(html3);

    const form4 = new URLSearchParams();
    if (fields3["ctl00_RadScriptManager1_TSM"]) form4.append("ctl00_RadScriptManager1_TSM", fields3["ctl00_RadScriptManager1_TSM"]);
    form4.append("__EVENTTARGET", "ctl00$MPSPage_ContentPlaceHolder$RadGridTransaction");
    form4.append("__EVENTARGUMENT", "RowClick;0");
    if (fields3["__VIEWSTATE"]) form4.append("__VIEWSTATE", fields3["__VIEWSTATE"]);
    if (fields3["__VIEWSTATEGENERATOR"]) form4.append("__VIEWSTATEGENERATOR", fields3["__VIEWSTATEGENERATOR"]);
    if (fields3["__EVENTVALIDATION"]) form4.append("__EVENTVALIDATION", fields3["__EVENTVALIDATION"]);
    appendReportFormFields(form4, { dateLabel: "Denna vecka", dateValue: "week" });
    appendAdvancedSearchFields(form4);
    form4.append("ctl00$MPSPage_ContentPlaceHolder$RadGridTransaction$ctl00$ctl03$ctl01$PageSizeComboBox", "10");
    form4.append("ctl00_MPSPage_ContentPlaceHolder_RadGridTransaction_ctl00_ctl03_ctl01_PageSizeComboBox_ClientState", "");
    form4.set("ctl00_MPSPage_ContentPlaceHolder_RadGridTransaction_ClientState",
      JSON.stringify({"selectedIndexes":["0"],"selectedCellsIndexes":[],"unselectableItemsIndexes":[],"reorderedColumns":[],"expandedItems":[],"expandedGroupItems":[],"expandedFilterItems":[],"deletedItems":[],"hidedColumns":[],"showedColumns":[],"groupColsState":{},"hierarchyState":{},"popUpLocations":{},"draggedItemsIndexes":[]})
    );

    const resp4 = await fetch(reportUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": reportUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: form4.toString() });
    const html4 = await decodeResponseText(resp4);
    currentCookies = buildCookieHeader({ ...Object.fromEntries(currentCookies.split("; ").map(c => c.split("="))), ...extractCookies(resp4.headers) });

    const detailUrlMatch = html4.match(/window\.open\('([^']+cardaccount_detail[^']+)'/i);
    const detailUrl = detailUrlMatch ? detailUrlMatch[1] : `${AUTH_BASE_URL}/bizdesk/${customerId}/cardaccount_detail`;
    const detailResp = await fetch(detailUrl, { method: "GET", headers: { "Cookie": currentCookies, "User-Agent": ua, "Referer": reportUrl }, redirect: "follow" });
    const detailHtml = await decodeResponseText(detailResp);

    const detailFields = parseHiddenFields(detailHtml);
    if (!detailFields["__VIEWSTATE"]) {
      return { success: false, error: "Kunde inte ladda kortdetaljer." };
    }

    const expiryFieldMatch = detailHtml.match(/name=\"([^\"]*(?:[Ee]xpires|[Ee]xpiry)[^\"]*)\"/i);
    const expiryFieldName = expiryFieldMatch ? expiryFieldMatch[1] : "ctl00$MPSPage_ContentPlaceHolder$frmExpires";
    const saveButtonMatch = detailHtml.match(/name=\"([^\"]*(?:btnSave|btn_save|Save)[^\"]*)\"/i);
    const saveButtonName = saveButtonMatch ? saveButtonMatch[1] : "ctl00$MPSPage_ContentPlaceHolder$btnSave";

    const updateForm = new URLSearchParams();
    if (detailFields["ctl00_RadScriptManager1_TSM"]) updateForm.append("ctl00_RadScriptManager1_TSM", detailFields["ctl00_RadScriptManager1_TSM"]);
    updateForm.append("__EVENTTARGET", saveButtonName);
    updateForm.append("__EVENTARGUMENT", "");
    if (detailFields["__VIEWSTATE"]) updateForm.append("__VIEWSTATE", detailFields["__VIEWSTATE"]);
    if (detailFields["__VIEWSTATEGENERATOR"]) updateForm.append("__VIEWSTATEGENERATOR", detailFields["__VIEWSTATEGENERATOR"]);
    if (detailFields["__EVENTVALIDATION"]) updateForm.append("__EVENTVALIDATION", detailFields["__EVENTVALIDATION"]);

    const inputRegex = /<input[^>]+name=\"([^\"]+)\"[^>]*value=\"([^\"]*)\"[^>]*>/gi;
    let inputMatch;
    const existingFields = new Set();
    const skippedFields = new Set(["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "__EVENTTARGET", "__EVENTARGUMENT"]);
    while ((inputMatch = inputRegex.exec(detailHtml)) !== null) {
      const fieldName = inputMatch[1];
      let fieldValue = inputMatch[2];
      if (skippedFields.has(fieldName)) continue;
      if (fieldName.toLowerCase().includes('expires') || fieldName.toLowerCase().includes('expiry')) {
        if (fieldName.includes('dateInput') || fieldName === expiryFieldName) fieldValue = newExpiryDate;
        if (fieldName.includes('ClientState')) fieldValue = buildDateInputClientState(newExpiryDate);
      }
      if (!existingFields.has(fieldName)) {
        updateForm.append(fieldName, decodeHtmlEntities(fieldValue));
        existingFields.add(fieldName);
      }
    }

    const selectRegex = /<select[^>]+name=\"([^\"]+)\"[^>]*>[\\s\\S]*?<option[^>]*selected[^>]*value=\"([^\"]*)\"[^>]*>/gi;
    let selectMatch;
    while ((selectMatch = selectRegex.exec(detailHtml)) !== null) {
      if (!existingFields.has(selectMatch[1])) {
        updateForm.append(selectMatch[1], decodeHtmlEntities(selectMatch[2]));
        existingFields.add(selectMatch[1]);
      }
    }

    if (!existingFields.has(expiryFieldName)) updateForm.append(expiryFieldName, newExpiryDate);

    const updateResponse = await fetch(detailUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "Cookie": currentCookies, "User-Agent": ua, "Referer": detailUrl, "Origin": AUTH_BASE_URL }, redirect: "follow", body: updateForm.toString() });
    const updateResultHtml = await decodeResponseText(updateResponse);

    const errorMatch = updateResultHtml.match(/class=\"[^\"]*error[^\"]*\"[^>]*>([\s\S]*?)<\/?/i);
    if (errorMatch && errorMatch[1].trim()) {
      return { success: false, error: decodeHtmlEntities(errorMatch[1].trim()) };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: "Kunde inte uppdatera utgångsdatum", details: String(error) };
  }
}

export async function adjustGiftcardBalance(session, { cardNumber, amount, workstationId, operatorId }) {
  return await adjustGiftcardBalanceInDb(session, { cardNumber, amount, workstationId, operatorId });
}

export async function updateCardBlockStatus(session, { cardNumber, isBlocked }) {
  const supportId = parseInt(session?.selectedCustomerId, 10);
  if (!Number.isFinite(supportId)) {
    return { success: false, error: "Ingen kund vald" };
  }
  const normalizedCardNo = normalizeCardNumber(cardNumber);
  if (!normalizedCardNo) {
    return { success: false, error: "Ogiltigt kortnummer" };
  }

  try {
    const rows = await query(
      `SELECT TOP 1 vc.id AS cardid
       FROM view_card vc
       WHERE vc.supportid = @supportId
         AND (
           LTRIM(RTRIM(vc.shortcardnumber2)) = @cardNo
           OR LTRIM(RTRIM(vc.shortcardnumber)) = @cardNo
           OR vc.id = @cardId
         )
       ORDER BY vc.id DESC`,
      [
        { name: "supportId", type: sql.Int, value: supportId },
        { name: "cardNo", type: sql.VarChar, value: normalizedCardNo },
        { name: "cardId", type: sql.Int, value: toInt32(normalizedCardNo, -1) },
      ]
    );

    const cardId = rows?.[0]?.cardid;
    if (!cardId) {
      return { success: false, error: "Kunde inte hitta kortet" };
    }

    const updateRows = await query(
      `UPDATE card
       SET isblocked = @isBlocked
       WHERE id = @cardId;
       SELECT @@ROWCOUNT AS rows;`,
      [
        { name: "isBlocked", type: sql.Bit, value: isBlocked ? 1 : 0 },
        { name: "cardId", type: sql.Int, value: cardId },
      ]
    );

    const updated = updateRows?.[0]?.rows;
    if (!updated) {
      return { success: false, error: "Kunde inte uppdatera kortstatus" };
    }

    return { success: true };
  } catch (error) {
    console.error("Update card block status error:", error);
    return { success: false, error: "Kunde inte uppdatera kortstatus", details: String(error) };
  }
}

export async function getCustomerOptionsLive(session) {
  const urls = [];
  if (session.selectedCustomerId) urls.push(`${AUTH_BASE_URL}/bizdesk/${session.selectedCustomerId}/default.aspx`);
  urls.push(`${AUTH_BASE_URL}/bizdesk/default.aspx`);

  for (const url of urls) {
    try {
      const resp = await fetchWithTimeout(url, {
        method: "GET",
        headers: { "Cookie": session.cookies, "User-Agent": USER_AGENT },
        redirect: "follow",
      }, TIMEOUT_MS);
      const html = await decodeResponseText(resp);
      const options = extractCustomerOptionsFromHtml(html);
      if (options.length > 0) return options;
    } catch (error) {
      console.log(`[customers] Failed to fetch options from ${url}:`, error);
    }
  }
  const dbOptions = await getCustomerOptionsFromDb(session.username);
  return dbOptions || [];
}
