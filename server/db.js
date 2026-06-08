import sql from "mssql";
import { config } from "./config.js";

let pool;

export async function getPool() {
  if (pool) return pool;
  if (!config.db.host || !config.db.name || !config.db.user) {
    throw new Error("Database configuration is missing");
  }
  pool = await sql.connect({
    user: config.db.user,
    password: config.db.password,
    server: config.db.host,
    database: config.db.name,
    port: config.db.port,
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustCert,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  });
  return pool;
}

export async function query(queryText, params = []) {
  const poolConn = await getPool();
  const request = poolConn.request();
  for (const param of params) {
    if (!param || !param.name) continue;
    request.input(param.name, param.type || sql.VarChar, param.value);
  }
  const result = await request.query(queryText);
  return result.recordset || [];
}

export { sql };
