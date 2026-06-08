import { config } from "./config.js";

export async function proxyMps2(req, res) {
  try {
    const targetPath = req.originalUrl.replace(/^\/api\/mps2/, "");
    const targetUrl = `${config.mps2BaseUrl}${targetPath}`;

    const headers = new Headers();
    const contentType = req.headers["content-type"] || "application/json";
    headers.set("Content-Type", contentType);

    const init = {
      method: req.method,
      headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (contentType.includes("application/json")) {
        init.body = JSON.stringify(req.body ?? {});
      } else if (typeof req.body === "string") {
        init.body = req.body;
      }
    }

    const response = await fetch(targetUrl, init);
    const responseText = await response.text();

    // Capture account mapping for successful balance-changing transactions
    try {
      const sessionData = req.session?.bizdesk;
      if (sessionData && /\/Transaction\/(Deposit|Withdraw)/i.test(targetPath)) {
        const identifier = req.body?.Identifier ?? req.body?.identifier;
        const requestedAccountId = req.body?.AccountId ?? req.body?.accountId ?? null;
        if (identifier) {
          const parsed = JSON.parse(responseText);
          const accountId = parsed?.Data?.account?.id ?? parsed?.Data?.accountId ?? parsed?.Data?.accountid;
          if (parsed?.Success && accountId != null) {
            if (requestedAccountId != null && String(requestedAccountId) !== String(accountId)) {
              return;
            }
            const normalized = String(identifier).replace(/\D+/g, "");
            if (!sessionData.cardAccountOverrides) sessionData.cardAccountOverrides = {};
            sessionData.cardAccountOverrides[String(identifier)] = String(accountId);
            if (normalized) {
              sessionData.cardAccountOverrides[normalized] = String(accountId);
            }
          }
        }
      }
    } catch {
      // Ignore mapping errors; never block proxy response
    }

    res.status(response.status);
    res.set("Content-Type", response.headers.get("content-type") || "application/json");
    res.send(responseText);
  } catch (error) {
    console.error("MPS2 proxy error:", error);
    res.status(502).json({ error: "MPS2 proxy error", details: String(error) });
  }
}
