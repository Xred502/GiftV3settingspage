import sql from "mssql";

const config = {
  user: "sa",
  password: "JHDCXS7HAkIcb0hkQOUH",
  server: "192.168.3.4",
  database: "oncard",
  port: 1433,
  options: { encrypt: true, trustServerCertificate: true },
};

const KEEP_ACTIVE = ["presentkort", "grattis", "tack"];

async function main() {
  const pool = await sql.connect(config);

  // Discover actual column names in felix_dev.dbo.Presentkort
  const schema = await pool.request().query(
    `SELECT column_name FROM felix_dev.INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'Presentkort'`
  );
  const cols = schema.recordset.map((r) => r.column_name);
  console.log("Kolumner i Presentkort:", cols.join(", "), "\n");

  const find = (candidates) => cols.find((c) => candidates.includes(c.toLowerCase())) ?? null;
  const findPattern = (re) => cols.find((c) => re.test(c)) ?? null;

  const nameCol   = find(["templatename", "name", "namn", "titel", "title"]);
  const activeCol = find(["isactive", "active", "isvisible", "isvisable"]) ?? findPattern(/vis[ia]b/i) ?? findPattern(/aktiv/i);
  const idCol     = find(["id", "templateid", "presentkortid"]);
  const companyCol = find(["companyid", "company_id", "foretag", "foretagid", "kundid"]) ?? findPattern(/company/i) ?? findPattern(/foretag/i);

  if (!nameCol || !activeCol || !idCol) {
    console.error("Kunde inte hitta nödvändiga kolumner.", { idCol, nameCol, activeCol, companyCol });
    process.exit(1);
  }
  console.log(`Använder kolumner: id=${idCol}, company=${companyCol ?? "(saknas)"}, name=${nameCol}, active=${activeCol}\n`);

  // Fetch all rows and filter on showtic if companyCol exists
  let query = `SELECT * FROM felix_dev.dbo.Presentkort`;
  const allRows = await pool.request().query(query);

  // Try to narrow down to showtic rows
  let rows = allRows.recordset;
  if (companyCol) {
    const showticRows = rows.filter((r) => String(r[companyCol] ?? "").toLowerCase().includes("showtic"));
    if (showticRows.length > 0) {
      rows = showticRows;
      console.log(`Filtrerat på showtic via kolumn "${companyCol}" — ${rows.length} rad(er) matchade.\n`);
    } else {
      // Show unique values to help identify showtic
      const unique = [...new Set(rows.map((r) => r[companyCol]))];
      console.log(`Inga rader matchade "showtic" i kolumn "${companyCol}". Unika värden:`, unique);
      process.exit(1);
    }
  } else {
    console.log(`Ingen company-kolumn hittades — visar alla ${rows.length} rader.\n`);
  }

  console.log(`Mallar (${rows.length} st):`);
  for (const t of rows) {
    const name = t[nameCol] ?? "";
    const active = t[activeCol];
    const keep = KEEP_ACTIVE.some((k) => name.toLowerCase().includes(k));
    const action = keep ? "BEHÅLLER aktiv" : "→ sätts inaktiv";
    console.log(`  [${t[idCol]}] "${name}" (active=${active}) — ${action}`);
  }

  const toDeactivate = rows.filter(
    (t) => !KEEP_ACTIVE.some((k) => (t[nameCol] ?? "").toLowerCase().includes(k))
  );

  if (toDeactivate.length === 0) {
    console.log("\nInget att uppdatera.");
    await pool.close();
    return;
  }

  console.log(`\nSätter ${toDeactivate.length} mall(ar) till inaktiv...`);

  for (const t of toDeactivate) {
    await pool
      .request()
      .input("id", sql.Int, t[idCol])
      .query(`UPDATE felix_dev.dbo.Presentkort SET [${activeCol}] = 0 WHERE [${idCol}] = @id`);
    console.log(`  ✓ [${t[idCol]}] "${t[nameCol]}" satt till inaktiv`);
  }

  console.log("\nKlart!");
  await pool.close();
}

main().catch((err) => {
  console.error("Fel:", err.message);
  process.exit(1);
});
