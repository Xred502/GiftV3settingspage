import { exec, spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const VITE_URL     = "http://localhost:8080";
const SETTINGS_URL = "http://localhost:8080/settings.html";
const API_HEALTH   = "http://localhost:3011/api/health";

function log(msg) {
  process.stdout.write(`[launcher] ${msg}\n`);
}

async function isReady(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(url, label, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isReady(url)) return true;
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write(".");
  }
  process.stdout.write("\n");
  return false;
}

function shell(cmd) {
  return new Promise((resolve) => {
    log(`> ${cmd}`);
    exec(cmd, { cwd: __dirname }, (err, _out, stderr) => {
      if (err)    log(`FEL: ${err.message}`);
      if (stderr) log(`stderr: ${stderr.trim()}`);
      resolve(!err);
    });
  });
}

function openBrowser(url) {
  // rundll32 är mer tillförlitlig än 'start' för URL:er i alla Windows-versioner
  exec(`rundll32 url.dll,FileProtocolHandler "${url}"`, { cwd: __dirname });
}

// Startar en Node.js-process i ett nytt minimerat cmd-fönster.
// Använder spawn med detached+stdio:ignore för att undvika att cmd.exe/c
// hänger sig p.g.a. ärvda pipe-handtag från föräldraprocessen.
async function startService(scriptPath, title) {
  log(`> start "${title}" /min ${process.execPath} ${scriptPath}`);
  const child = spawn(
    "cmd.exe",
    ["/c", "start", title, "/min", "/D", __dirname, process.execPath, scriptPath],
    { cwd: __dirname, detached: true, stdio: "ignore" }
  );
  child.unref();
  // Ge processen lite tid att starta innan vi kontrollerar
  await new Promise((r) => setTimeout(r, 1500));
}

(async () => {
  const viteScript   = path.join(__dirname, "node_modules", "vite", "bin", "vite.js");
  const serverScript = path.join(__dirname, "server", "index.js");

  if (!existsSync(viteScript)) {
    log("FEL: node_modules saknas!");
    log("Öppna ett terminalfönster i projektmappen och kör: npm install");
    process.exit(1);
  }

  // Om Vite redan svarar — öppna bara webbläsaren.
  if (await isReady(VITE_URL)) {
    log("Tjänsterna körs redan.");
    log(`Öppnar ${SETTINGS_URL}`);
    openBrowser(SETTINGS_URL);
    await new Promise((r) => setTimeout(r, 500));
    process.exit(0);
  }

  // Starta API och Frontend i egna minimerade fönster.
  log("Startar API-server...");
  await startService(serverScript, "GiftCard API");

  log("Startar Frontend (Vite)...");
  await startService(viteScript, "GiftCard Frontend");

  // Vänta på att Vite ska svara (max 60s).
  log("Väntar pa Frontend");
  const viteOk = await waitFor(VITE_URL, "Frontend");
  process.stdout.write("\n");

  if (!viteOk) {
    log("TIMEOUT: Frontend startade inte inom 60 sekunder.");
    log("Titta pa de minimerade fonstren i aktivitetsfaltet for felmeddelanden.");
    process.exit(1);
  }

  // Vänta på att API ska svara.
  log("Vantar pa API-server");
  const apiOk = await waitFor(API_HEALTH, "API", 60_000);
  process.stdout.write("\n");
  if (!apiOk) {
    log("TIMEOUT: API-servern startade inte inom 60 sekunder.");
    log("Titta pa de minimerade fonstren i aktivitetsfaltet for felmeddelanden.");
    process.exit(1);
  }

  log(`Oppnar ${SETTINGS_URL}`);
  openBrowser(SETTINGS_URL);

  await new Promise((r) => setTimeout(r, 800));
  log("Klart! Det har fonstret stanger nu.");
  process.exit(0);
})();
