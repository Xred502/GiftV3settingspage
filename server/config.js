import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load local env files if present (local overrides first)
dotenv.config({ path: path.join(__dirname, "..", ".env.server.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const toBool = (val, fallback = false) => {
  if (!val) return fallback;
  return val.toLowerCase() === "true" || val === "1";
};

export const config = {
  port: parseInt(process.env.SERVER_PORT || process.env.PORT || "3011", 10),
  authBaseUrl: process.env.AUTH_BASE_URL || "https://dittkort.microdeb.se",
  mps2BaseUrl: process.env.MPS2_BASE_URL || "https://dittkort.microdeb.se/mps2/Api",
  sessionSecret: process.env.SESSION_SECRET || "dev-session-secret",
  corsOrigin: (() => {
    const origin = process.env.CORS_ORIGIN || "http://localhost:8080";
    if (origin.includes(",")) {
      return origin.split(",").map((item) => item.trim()).filter(Boolean);
    }
    return origin;
  })(),
  cookieSecure: toBool(process.env.COOKIE_SECURE, false),
  db: {
    host: process.env.DB_HOST || "",
    name: process.env.DB_NAME || "",
    user: process.env.DB_USER || "",
    password: process.env.DB_PASSWORD || "",
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 1433,
    trustCert: toBool(process.env.DB_TRUST_CERT, true),
    encrypt: toBool(process.env.DB_ENCRYPT, true),
  },
};
