import { getGiftcardMakerSession } from "./bizdesk.js";
import { query, sql } from "./db.js";

const DEFAULT_TEMPLATES_URL = "https://presentkort-api.microdeb.se/api/GiftCard/templates";
const DEFAULT_DATA_URL = "https://presentkort-api.microdeb.se/api/GiftCard/data";
const DEFAULT_COMPANIES_URL = "https://presentkort-api.microdeb.se/api/companies";

const COMPANY_ID_KEYS = new Set(["companyid", "company_id", "id"]);
const OPERATOR_ID_KEYS = new Set(["operatorid", "operator_id"]);
const EXPOSED_COMPANY_FIELDS = [
  "id",
  "companyId",
  "companyNumber",
  "companyName",
  "companyActive",
  "companyEmail",
  "companyHelpLineEmail",
  "companyPhone",
  "companyUrl",
  "companyLogoFileName",
  "companyAddressInformation",
  "copyOfPdfGiftCardTo",
  "copyOfReceiptTo",
  "maximumMsgTextLimit",
  "backgroundImageUrl",
  "trackingCode",
  "companyCustomStyle",
  "companyStyleUrl",
  "bannerHtml",
  "companyFooterHtml",
  "linkToPolicy",
  "templatePreview",
  "formBackgroundColor",
  "showCompanyEmail",
  "showCompanyContactNumber",
  "customerEmailTemplate",
  "paymentPlatform",
  "paymentTestMode",
  "companyAmountJson",
  "minimumAmountLimit",
  "maximumAmountLimit",
  "microdebSwishApiKey",
  "swedbankAuthToken",
  "swedbankPayeeIdToken",
  "netsSecretApiKey",
  "netsCheckoutKey",
  "canSendHome",
  "deliveryCharges",
  "giftCardNumberLatest",
  "allowMultipleCards",
  "createdAtUtc",
  "updatedAtUtc",
  "support_id",
];

const DEFAULT_GIFTCARD_DATA = {
  amount: "100.00",
  value: "100.00",
  identifier: "1234567890123456",
  shortpass: "ABCD12",
  validTo: "2030-12-31",
};

function getGiftcardMakerUrls() {
  return {
    templatesUrl: process.env.GIFTCARD_TEMPLATES_URL || DEFAULT_TEMPLATES_URL,
    dataUrl: process.env.GIFTCARD_DATA_URL || DEFAULT_DATA_URL,
    companiesUrl: process.env.GIFTCARD_COMPANIES_URL || DEFAULT_COMPANIES_URL,
  };
}

function parseScalar(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function appendQueryParameter(url, parameterName, parameterValue) {
  if (!url || !parameterName) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(parameterName)}=${encodeURIComponent(parameterValue || "")}`;
}

function urlHasAnyQueryParameter(url, parameterNames) {
  if (!url || !parameterNames || parameterNames.length === 0) return false;
  try {
    const parsed = new URL(url);
    return parameterNames.some((name) => parsed.searchParams.has(name));
  } catch {
    return false;
  }
}

function getResponseContentType(response) {
  return response.headers.get("content-type") || "application/json; charset=utf-8";
}

async function fetchUpstreamText(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      accept: "application/json",
      ...(options.headers || {}),
    },
  });

  return {
    response,
    text: await response.text(),
  };
}

async function resolveGiftcardMakerAccess(session) {
  if (!session?.selectedCustomerId) {
    return { success: false, error: "Ingen kund vald" };
  }

  const result = await getGiftcardMakerSession(session);
  if (!result.success) {
    return { success: false, error: result.error || "Kunde inte hämta Giftv3-åtkomst" };
  }

  const companies = Array.isArray(result.companies) ? result.companies : [];
  const companyIds = Array.isArray(result.companyIds)
    ? result.companyIds.map((value) => String(value)).filter(Boolean)
    : [];
  const companyNames = companies
    .map((company) => parseScalar(company?.companyName || company?.companyId))
    .filter(Boolean);
  const primaryCompanyId = companyIds[0] || "";
  const primaryOperatorId = companyNames[0] || primaryCompanyId;

  return {
    success: true,
    companies,
    companyIds,
    companyNames,
    primaryCompanyId,
    primaryOperatorId,
  };
}

function getAllowedRequestedCompanyId(access, requestedCompanyId) {
  const requested = parseScalar(requestedCompanyId);
  if (!requested) {
    return access.primaryCompanyId || "";
  }
  if (!access.companyIds.includes(requested)) {
    return null;
  }
  return requested;
}

function getStringByKeys(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  const entries = Object.entries(obj);
  for (const [key, value] of entries) {
    if (!keys.has(key.toLowerCase())) continue;
    const parsed = parseScalar(value);
    if (parsed) return parsed;
  }
  return "";
}

function filterCompaniesPayload(payload, allowedCompanyIds) {
  const allowed = new Set((allowedCompanyIds || []).map((value) => String(value).toLowerCase()));
  if (allowed.size === 0) return payload;

  const sanitizeCompany = (item) => {
    if (!item || typeof item !== "object") return item;
    const next = {};
    for (const key of EXPOSED_COMPANY_FIELDS) {
      if (item[key] !== undefined) {
        next[key] = item[key];
      }
    }
    if (next.id === undefined) {
      const companyId = getStringByKeys(item, COMPANY_ID_KEYS);
      if (companyId) {
        next.id = companyId;
      }
    }
    if (next.companyId === undefined && next.id !== undefined) {
      next.companyId = next.id;
    }
    if (next.companyName === undefined) {
      next.companyName = parseScalar(item.companyName);
    }
    if (next.bannerHtml === undefined) {
      next.bannerHtml = typeof item.bannerHtml === "string" ? item.bannerHtml : "";
    }
    if (next.companyFooterHtml === undefined) {
      next.companyFooterHtml = typeof item.companyFooterHtml === "string" ? item.companyFooterHtml : "";
    }
    return next;
  };

  const filterList = (items) =>
    items.filter((item) => {
      const id = getStringByKeys(item, COMPANY_ID_KEYS).toLowerCase();
      return id && allowed.has(id);
    }).map((item) => sanitizeCompany(item));

  if (Array.isArray(payload)) {
    return filterList(payload);
  }

  if (payload && Array.isArray(payload.data)) {
    return { ...payload, data: filterList(payload.data) };
  }

  if (payload && Array.isArray(payload.companies)) {
    return { ...payload, companies: filterList(payload.companies) };
  }

  return payload;
}

function containsRelevantTemplateKey(node) {
  if (!node || typeof node !== "object") return false;

  if (Array.isArray(node)) {
    return node.some((item) => containsRelevantTemplateKey(item));
  }

  return Object.entries(node).some(([key, value]) => {
    const normalized = key.toLowerCase();
    if (COMPANY_ID_KEYS.has(normalized) || OPERATOR_ID_KEYS.has(normalized)) {
      return true;
    }
    return containsRelevantTemplateKey(value);
  });
}

function valueMatchesAllowed(value, allowedValues) {
  if (Array.isArray(value)) {
    return value.some((item) => valueMatchesAllowed(item, allowedValues));
  }

  if (value && typeof value === "object") {
    return Object.values(value).some((item) => valueMatchesAllowed(item, allowedValues));
  }

  const parsed = parseScalar(value).toLowerCase();
  return parsed ? allowedValues.has(parsed) : false;
}

function templateMatchesAccess(node, allowedCompanyIds, allowedOperatorIds) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return true;

  let hasCompanyKey = false;
  let hasOperatorKey = false;
  let companyMatch = false;
  let operatorMatch = false;

  for (const [key, value] of Object.entries(node)) {
    const normalized = key.toLowerCase();
    if (COMPANY_ID_KEYS.has(normalized)) {
      hasCompanyKey = true;
      if (valueMatchesAllowed(value, allowedCompanyIds)) {
        companyMatch = true;
      }
      continue;
    }
    if (OPERATOR_ID_KEYS.has(normalized)) {
      hasOperatorKey = true;
      if (valueMatchesAllowed(value, allowedOperatorIds)) {
        operatorMatch = true;
      }
      continue;
    }
  }

  if (hasCompanyKey) return companyMatch;
  if (hasOperatorKey) return operatorMatch;
  return true;
}

function filterTemplatesPayload(payload, companyIds, operatorIds) {
  const allowedCompanyIds = new Set((companyIds || []).map((value) => String(value).toLowerCase()));
  const allowedOperatorIds = new Set((operatorIds || []).map((value) => String(value).toLowerCase()));

  const walk = (node) => {
    if (Array.isArray(node)) {
      if (node.some((item) => containsRelevantTemplateKey(item))) {
        return node
          .filter((item) => templateMatchesAccess(item, allowedCompanyIds, allowedOperatorIds))
          .map((item) => walk(item));
      }
      return node.map((item) => walk(item));
    }

    if (!node || typeof node !== "object") {
      return node;
    }

    const next = {};
    for (const [key, value] of Object.entries(node)) {
      next[key] = walk(value);
    }
    return next;
  };

  return walk(payload);
}

export async function getGiftcardMakerAuthStatus(session) {
  const access = await resolveGiftcardMakerAccess(session);
  if (!access.success) {
    return { authenticated: false, role: "operator", operatorId: "", operatorIds: "", companyId: "", companyIds: "" };
  }

  return {
    authenticated: true,
    role: "operator",
    operatorId: access.primaryOperatorId,
    operatorIds: access.companyNames.join(","),
    companyId: access.primaryCompanyId,
    companyIds: access.companyIds.join(","),
    companies: access.companies,
  };
}

export async function getGiftcardMakerCompanies(session) {
  const access = await resolveGiftcardMakerAccess(session);
  if (!access.success) {
    return { success: false, status: 400, error: access.error };
  }

  const { companiesUrl } = getGiftcardMakerUrls();
  const { response, text } = await fetchUpstreamText(companiesUrl);

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: text || "Kunde inte hämta företag",
      contentType: getResponseContentType(response),
    };
  }

  let payload;
  try {
    payload = text ? JSON.parse(text) : [];
  } catch {
    payload = [];
  }

  return {
    success: true,
    payload: filterCompaniesPayload(payload, access.companyIds),
  };
}

export async function updateGiftcardMakerCompany(session, companyId, payload) {
  const access = await resolveGiftcardMakerAccess(session);
  if (!access.success) {
    return { success: false, status: 400, error: access.error };
  }

  const requestedCompanyId = getAllowedRequestedCompanyId(access, companyId);
  if (!requestedCompanyId) {
    return { success: false, status: 403, error: "Otillåtet företag" };
  }

  const { companiesUrl } = getGiftcardMakerUrls();
  const upstreamUrl = `${companiesUrl.replace(/\/$/, "")}/${encodeURIComponent(requestedCompanyId)}`;
  const { response, text } = await fetchUpstreamText(upstreamUrl, {
    method: "PATCH",
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload || {}),
  });

  if (!response.ok) {
    return {
      success: false,
      status: response.status,
      error: text || "Kunde inte uppdatera företag",
      contentType: getResponseContentType(response),
    };
  }

  let nextPayload = {};
  try {
    nextPayload = text ? JSON.parse(text) : {};
  } catch {
    nextPayload = {};
  }

  return { success: true, payload: nextPayload };
}

export async function getGiftcardTemplates(session, requestedCompanyId) {
  const access = await resolveGiftcardMakerAccess(session);
  if (!access.success) {
    return { success: false, status: 400, error: access.error };
  }

  const companyId = getAllowedRequestedCompanyId(access, requestedCompanyId);
  if (requestedCompanyId && !companyId) {
    return { success: false, status: 403, error: "Otillåtet företag" };
  }

  const { templatesUrl } = getGiftcardMakerUrls();
  let upstreamUrl = templatesUrl;

  if (companyId && !urlHasAnyQueryParameter(upstreamUrl, ["companyId", "companyid"])) {
    upstreamUrl = appendQueryParameter(upstreamUrl, "companyId", companyId);
  }

  let result = await fetchUpstreamText(upstreamUrl);

  if (
    result.response.status === 400 &&
    companyId &&
    !urlHasAnyQueryParameter(templatesUrl, ["companyId", "companyid"])
  ) {
    upstreamUrl = appendQueryParameter(templatesUrl, "companyid", companyId);
    result = await fetchUpstreamText(upstreamUrl);
  }

  if (!result.response.ok) {
    return {
      success: false,
      status: result.response.status,
      error: result.text || "Kunde inte hämta mallar",
      contentType: getResponseContentType(result.response),
    };
  }

  let payload;
  try {
    payload = result.text ? JSON.parse(result.text) : [];
  } catch {
    payload = [];
  }

  return {
    success: true,
    payload: filterTemplatesPayload(payload, access.companyIds, access.companyNames),
  };
}

export async function getGiftcardData(session, requestedCompanyId) {
  const access = await resolveGiftcardMakerAccess(session);
  if (!access.success) {
    return { success: false, status: 400, error: access.error };
  }

  const companyId = getAllowedRequestedCompanyId(access, requestedCompanyId);
  if (requestedCompanyId && !companyId) {
    return { success: false, status: 403, error: "Otillåtet företag" };
  }

  const { dataUrl } = getGiftcardMakerUrls();
  let upstreamUrl = dataUrl;

  if (companyId && !urlHasAnyQueryParameter(upstreamUrl, ["companyId", "companyid"])) {
    upstreamUrl = appendQueryParameter(upstreamUrl, "companyId", companyId);
  }

  let result = await fetchUpstreamText(upstreamUrl);

  if (
    result.response.status === 400 &&
    companyId &&
    !urlHasAnyQueryParameter(dataUrl, ["companyId", "companyid"])
  ) {
    upstreamUrl = appendQueryParameter(dataUrl, "companyid", companyId);
    result = await fetchUpstreamText(upstreamUrl);
  }

  if (result.response.status === 404) {
    return { success: true, payload: DEFAULT_GIFTCARD_DATA };
  }

  if (!result.response.ok) {
    return {
      success: false,
      status: result.response.status,
      error: result.text || "Kunde inte hämta presentkortsdata",
      contentType: getResponseContentType(result.response),
    };
  }

  let payload;
  try {
    payload = result.text ? JSON.parse(result.text) : DEFAULT_GIFTCARD_DATA;
  } catch {
    payload = DEFAULT_GIFTCARD_DATA;
  }

  return { success: true, payload };
}

// ── Template CRUD via direct DB ───────────────────────────────────────────────

async function getTemplateSchemaColumns() {
  try {
    const rows = await query(
      `SELECT column_name, is_nullable, data_type FROM GiftcardV3.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'gift_card_templates'`
    );
    return (rows || []).map((r) => ({
      name: String(r.column_name),
      isNullable: String(r.is_nullable).toUpperCase() === 'YES',
      dataType: String(r.data_type).toLowerCase(),
    }));
  } catch {
    return [];
  }
}

function findTemplateCol(columns, candidates) {
  const map = new Map(columns.map((c) => [c.name.toLowerCase(), c]));
  for (const candidate of candidates) {
    const found = map.get(candidate.toLowerCase());
    if (found) return found.name;
  }
  return null;
}

function findTemplateColPattern(columns, pattern) {
  const col = columns.find((c) => pattern.test(c.name));
  return col ? col.name : null;
}

function isTemplateColNullable(columns, colName) {
  const col = columns.find((c) => c.name === colName);
  return col ? col.isNullable : true;
}

function templateColSqlType(columns, colName) {
  const col = columns.find((c) => c.name === colName);
  const dt = col?.dataType || '';
  if (dt === 'int' || dt === 'bigint' || dt === 'smallint' || dt === 'tinyint') return sql.Int;
  return sql.NVarChar;
}

export async function createSettingsTemplate(companyId, { templateName, htmlContent, cssContent, operatorId }) {
  if (!companyId) return { success: false, status: 400, error: "companyId krävs" };

  const columns = await getTemplateSchemaColumns();
  const companyCol = findTemplateCol(columns, ["companyId", "companyid"]);
  const nameCol = findTemplateCol(columns, ["templateName", "name"]);
  const htmlCol = findTemplateCol(columns, ["htmlContent", "htmlcontent"]);
  const cssCol = findTemplateCol(columns, ["cssContent", "csscontent"]);
  const operatorCol = findTemplateCol(columns, ["operatorId", "operatorid", "operatorID"]);
  const terminalCol = findTemplateCol(columns, ["terminalId", "terminalid", "terminal_id"]);
  const idCol = findTemplateCol(columns, ["templateId", "id"]);
  const createdCol = findTemplateCol(columns, ["createdAtUtc", "createdAt"]);
  const updatedCol = findTemplateCol(columns, ["updatedAtUtc", "updatedAt"]);

  if (!companyCol) return { success: false, status: 500, error: "Kunde inte läsa mallschemat" };

  const insertCols = [companyCol];
  const insertVals = ["@companyId"];
  const params = [{ name: "companyId", type: sql.NVarChar, value: String(companyId) }];

  if (nameCol) {
    insertCols.push(nameCol); insertVals.push("@templateName");
    params.push({ name: "templateName", type: sql.NVarChar, value: String(templateName || "") });
  }
  if (htmlCol) {
    insertCols.push(htmlCol); insertVals.push("@htmlContent");
    params.push({ name: "htmlContent", type: sql.NVarChar(sql.MAX), value: String(htmlContent || "") });
  }
  if (cssCol) {
    insertCols.push(cssCol); insertVals.push("@cssContent");
    params.push({ name: "cssContent", type: sql.NVarChar(sql.MAX), value: String(cssContent || "") });
  }
  if (operatorCol && operatorId != null) {
    insertCols.push(operatorCol); insertVals.push("@operatorId");
    params.push({ name: "operatorId", type: sql.NVarChar, value: String(operatorId) });
  }

  // Handle terminalId: if NOT NULL, look up an existing value for this company
  if (terminalCol) {
    const terminalNullable = isTemplateColNullable(columns, terminalCol);
    if (!terminalNullable) {
      // Try to find an existing terminalId used by this company's templates
      let terminalIdValue = null;
      try {
        const existing = await query(
          `SELECT TOP 1 [${terminalCol}] FROM GiftcardV3.dbo.gift_card_templates WHERE [${companyCol}] = @cid AND [${terminalCol}] IS NOT NULL`,
          [{ name: "cid", type: sql.NVarChar, value: String(companyId) }]
        );
        terminalIdValue = existing?.[0]?.[terminalCol] ?? null;
      } catch { /* fall through */ }

      if (terminalIdValue == null) {
        return { success: false, status: 422, error: "Kan inte skapa mall: terminalId krävs men hittades inte för detta företag. Skapa en mall via det vanliga systemet först." };
      }

      const tType = templateColSqlType(columns, terminalCol);
      insertCols.push(terminalCol); insertVals.push("@terminalId");
      params.push({ name: "terminalId", type: tType, value: tType === sql.Int ? Number(terminalIdValue) : String(terminalIdValue) });
    }
    // If nullable, omit it (SQL will use NULL/default)
  }

  const now = new Date().toISOString();
  if (createdCol) {
    insertCols.push(createdCol); insertVals.push("@createdAt");
    params.push({ name: "createdAt", type: sql.NVarChar, value: now });
  }
  if (updatedCol) {
    insertCols.push(updatedCol); insertVals.push("@updatedAt");
    params.push({ name: "updatedAt", type: sql.NVarChar, value: now });
  }

  const colList = insertCols.map((c) => `[${c}]`).join(", ");
  const valList = insertVals.join(", ");
  const outputClause = idCol ? `OUTPUT INSERTED.[${idCol}]` : "";

  try {
    const rows = await query(
      `INSERT INTO GiftcardV3.dbo.gift_card_templates (${colList}) ${outputClause} VALUES (${valList})`,
      params
    );
    const newId = idCol ? (rows?.[0]?.[idCol] ?? null) : null;
    return { success: true, templateId: newId };
  } catch (error) {
    return { success: false, status: 500, error: String(error?.message || error) };
  }
}

export async function getSettingsTemplatesDirect(companyId) {
  if (!companyId) return { success: false, status: 400, error: "companyId krävs" };

  const columns = await getTemplateSchemaColumns();
  const companyCol = findTemplateCol(columns, ["companyId", "companyid"]);
  if (!companyCol) return { success: false, status: 500, error: "Kunde inte läsa mallschemat" };

  const idCol      = findTemplateCol(columns, ["templateId", "id"]);
  const nameCol    = findTemplateCol(columns, ["templateName", "name"]);
  const htmlCol    = findTemplateCol(columns, ["htmlContent", "htmlcontent"]);
  const cssCol     = findTemplateCol(columns, ["cssContent", "csscontent"]);
  const operatorCol = findTemplateCol(columns, ["operatorId", "operatorid", "operatorID"]);
  const activeCol  = findTemplateCol(columns, ["isActive", "isactive", "active", "templateActive", "is_active"])
                  || findTemplateColPattern(columns, /vis[ia]b/i);
  const createdCol = findTemplateCol(columns, ["createdAtUtc", "createdAt"]);
  const updatedCol = findTemplateCol(columns, ["updatedAtUtc", "updatedAt"]);

  try {
    const orderBy = idCol ? ` ORDER BY [${idCol}]` : "";
    const rows = await query(
      `SELECT * FROM GiftcardV3.dbo.gift_card_templates WHERE [${companyCol}] = @companyId${orderBy}`,
      [{ name: "companyId", type: sql.NVarChar, value: String(companyId) }]
    );
    const templates = (rows || []).map((row) => ({
      templateId:   idCol       ? row[idCol]       : undefined,
      templateName: nameCol     ? row[nameCol]     : "",
      htmlContent:  htmlCol     ? row[htmlCol]     : "",
      cssContent:   cssCol      ? row[cssCol]      : "",
      companyId:    row[companyCol],
      operatorId:   operatorCol ? row[operatorCol] : undefined,
      isActive:     activeCol   ? row[activeCol]   : undefined,
      createdAtUtc: createdCol  ? row[createdCol]  : undefined,
      updatedAtUtc: updatedCol  ? row[updatedCol]  : undefined,
    }));
    return { success: true, templates };
  } catch (error) {
    return { success: false, status: 500, error: String(error?.message || error) };
  }
}

export async function updateSettingsTemplate(companyId, templateId, { templateName, htmlContent, cssContent, isActive }) {
  if (!companyId || !templateId) return { success: false, status: 400, error: "companyId och templateId krävs" };

  const columns = await getTemplateSchemaColumns();
  const companyCol = findTemplateCol(columns, ["companyId", "companyid"]);
  const idCol = findTemplateCol(columns, ["templateId", "id"]);
  const nameCol = findTemplateCol(columns, ["templateName", "name"]);
  const htmlCol = findTemplateCol(columns, ["htmlContent", "htmlcontent"]);
  const cssCol = findTemplateCol(columns, ["cssContent", "csscontent"]);
  const activeCol = findTemplateCol(columns, ["isActive", "isactive", "active", "templateActive", "is_active"])
                || findTemplateColPattern(columns, /vis[ia]b/i);
  const updatedCol = findTemplateCol(columns, ["updatedAtUtc", "updatedAt"]);

  if (!idCol || !companyCol) return { success: false, status: 500, error: "Kunde inte läsa mallschemat" };

  const setClauses = [];
  const params = [
    { name: "templateId", type: sql.Int, value: Number(templateId) },
    { name: "companyId", type: sql.NVarChar, value: String(companyId) },
  ];

  if (nameCol && templateName !== undefined) {
    setClauses.push(`[${nameCol}] = @templateName`);
    params.push({ name: "templateName", type: sql.NVarChar, value: String(templateName || "") });
  }
  if (htmlCol && htmlContent !== undefined) {
    setClauses.push(`[${htmlCol}] = @htmlContent`);
    params.push({ name: "htmlContent", type: sql.NVarChar(sql.MAX), value: String(htmlContent || "") });
  }
  if (cssCol && cssContent !== undefined) {
    setClauses.push(`[${cssCol}] = @cssContent`);
    params.push({ name: "cssContent", type: sql.NVarChar(sql.MAX), value: String(cssContent || "") });
  }
  if (activeCol && isActive !== undefined) {
    setClauses.push(`[${activeCol}] = @isActive`);
    params.push({ name: "isActive", type: sql.Int, value: isActive ? 1 : 0 });
  }
  if (updatedCol) {
    setClauses.push(`[${updatedCol}] = @updatedAt`);
    params.push({ name: "updatedAt", type: sql.NVarChar, value: new Date().toISOString() });
  }

  if (setClauses.length === 0) return { success: true };

  try {
    await query(
      `UPDATE GiftcardV3.dbo.gift_card_templates
       SET ${setClauses.join(", ")}
       WHERE [${idCol}] = @templateId AND [${companyCol}] = @companyId`,
      params
    );
    return { success: true };
  } catch (error) {
    return { success: false, status: 500, error: String(error?.message || error) };
  }
}

export async function deleteSettingsTemplate(companyId, templateId) {
  if (!companyId || !templateId) return { success: false, status: 400, error: "companyId och templateId krävs" };

  const columns = await getTemplateSchemaColumns();
  const companyCol = findTemplateCol(columns, ["companyId", "companyid"]);
  const idCol = findTemplateCol(columns, ["templateId", "id"]);

  if (!idCol || !companyCol) return { success: false, status: 500, error: "Kunde inte läsa mallschemat" };

  try {
    await query(
      `DELETE FROM GiftcardV3.dbo.gift_card_templates
       WHERE [${idCol}] = @templateId AND [${companyCol}] = @companyId`,
      [
        { name: "templateId", type: sql.Int, value: Number(templateId) },
        { name: "companyId", type: sql.NVarChar, value: String(companyId) },
      ]
    );
    return { success: true };
  } catch (error) {
    return { success: false, status: 500, error: String(error?.message || error) };
  }
}
