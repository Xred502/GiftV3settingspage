import express from "express";
import dotenv from "dotenv";
import { spawn, spawnSync } from "child_process";
import { copyFileSync, existsSync, mkdirSync, symlinkSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const gitCommand = resolveExecutable(
  process.platform === "win32"
    ? ["C:\\Program Files\\Git\\cmd\\git.exe", "C:\\Program Files\\Git\\bin\\git.exe"]
    : [],
  process.platform === "win32" ? "git.exe" : "git"
);

dotenv.config({ path: path.join(rootDir, ".env.server.local") });
dotenv.config({ path: path.join(rootDir, ".env.local") });
dotenv.config({ path: path.join(rootDir, ".env") });

const launcherPort = parseInt(process.env.LAUNCHER_PORT || "3035", 10);
const npmCommand = resolveExecutable(
  process.platform === "win32"
    ? ["C:\\Program Files\\nodejs\\npm.cmd"]
    : [],
  process.platform === "win32" ? "npm.cmd" : "npm"
);
const npmCliScript = path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
const npmRunner = existsSync(npmCliScript)
  ? { command: process.execPath, prefixArgs: [npmCliScript] }
  : { command: npmCommand, prefixArgs: [] };
const nodeRunner = process.execPath;
const dotnetCommand = resolveExecutable(
  process.platform === "win32"
    ? ["C:\\Program Files\\dotnet\\dotnet.exe"]
    : [],
  "dotnet"
);
const launcherMainRef = process.env.LAUNCHER_MAIN_REF || "origin/main";
const launcherUseLatestMain = (process.env.LAUNCHER_USE_LATEST_MAIN || "true").toLowerCase() !== "false";
const launcherManagedWorktreePath = process.env.LAUNCHER_MAIN_WORKTREE_PATH
  ? resolveAppPath(process.env.LAUNCHER_MAIN_WORKTREE_PATH)
  : path.resolve(rootDir, "..", `${path.basename(rootDir)}-launcher-main`);
const launcherAppOverridePath = process.env.LAUNCHER_APP_PATH
  ? resolveAppPath(process.env.LAUNCHER_APP_PATH)
  : "";
const giftcardMakerDefaultPaths = [
  process.env.GIFTCARD_MAKER_PATH,
  "C:\\Users\\Linus\u00d6nnerby\\Downloads\\Giftv3_GiftcardMaker",
  "C:\\Temp - Allt under min användare\\Misc\\AI\\GiftCard\\Giftv3_GiftcardMaker",
].filter(Boolean);

const giftcardMakerPath =
  giftcardMakerDefaultPaths.find((candidatePath) => existsSync(candidatePath)) ||
  giftcardMakerDefaultPaths[0] ||
  "";
const launcherOverlayFiles = [
  "server/index.js",
  "server/giftcardMaker.js",
  "src/App.tsx",
  "src/components/layout/MainLayout.tsx",
  "src/contexts/BackofficeThemeContext.tsx",
  "src/index.css",
  "src/lib/giftcard-maker.ts",
  "src/pages/Login.tsx",
  "src/pages/GiftcardMaker.tsx",
  "src/services/giftcardMakerService.ts",
  "src/services/websiteSettingsService.ts",
  "src/settings-app/main.tsx",
  "src/settings-app/App.tsx",
  "src/settings-app/components/Layout.tsx",
  "src/settings-app/components/CodeEditor.tsx",
  "src/settings-app/components/CompanyCombobox.tsx",
  "src/settings-app/components/HtmlPreview.tsx",
  "src/settings-app/components/DraftBanner.tsx",
  "src/settings-app/components/ImageUpload.tsx",
  "src/settings-app/components/ChangeHistoryPanel.tsx",
  "src/settings-app/hooks/useLocalDraft.ts",
  "src/settings-app/hooks/useChangeHistory.ts",
  "src/settings-app/pages/Login.tsx",
  "src/settings-app/pages/WebsiteSettings.tsx",
  "settings.html",
  "vite.config.ts",
];

let cachedAppContext = null;
let apiProcess = null;
let frontendProcess = null;

const services = {
  frontend: {
    label: "Frontend",
    healthUrl: "http://localhost:8080",
    port: 8080,
    startupTimeoutMs: 20_000,
    usesAppContext: true,
    start: (appContext) => spawnManagedNodeScript("node_modules/vite/bin/vite.js", appContext?.appDir || rootDir, "frontend"),
    canStart: true,
    canStop: true,
  },
  api: {
    label: "API",
    healthUrl: "http://localhost:3011/api/health",
    port: 3011,
    startupTimeoutMs: 20_000,
    usesAppContext: true,
    start: (appContext) => spawnManagedNodeScript("server/index.js", appContext?.appDir || rootDir, "api"),
    canStart: true,
    canStop: true,
  },
  giftcard: {
    label: "Giftv3",
    healthUrl: "http://localhost:1025/api/auth/status",
    port: 1025,
    startupTimeoutMs: 120_000,
    start: () => {
      if (!giftcardMakerPath || !existsSync(giftcardMakerPath)) {
        throw new Error("Giftv3_GiftcardMaker hittades inte.");
      }
      return spawnDetached(dotnetCommand, ["run", "--project", "TempWebServer.csproj"], giftcardMakerPath);
    },
    canStart: true,
    canStop: true,
  },
  database: {
    label: "Databas",
    healthUrl: "http://localhost:3001/api/db/health",
    canStart: false,
    canStop: false,
  },
};

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.get("/api/status", async (_req, res) => {
  const appContextState = await getAppContextState();
  const statusEntries = await Promise.all(
    Object.entries(services).map(async ([key, service]) => {
      const status = await getServiceStatus(key, service);
      return [key, status];
    })
  );

  res.json({
    ok: true,
    launcherPort,
    rootDir,
    appDir: appContextState.appContext.appDir,
    appSource: appContextState.appContext.source,
    appRevision: appContextState.appContext.revision,
    appContextError: appContextState.error,
    giftcardMakerPath,
    services: Object.fromEntries(statusEntries),
  });
});

app.post("/api/start/:service", async (req, res) => {
  const { service: serviceName } = req.params;

  if (serviceName === "all") {
    let appContext = null;
    try {
      appContext = await getLaunchAppContext({ refresh: true });
    } catch (error) {
      return res.status(500).json({ ok: false, error: String(error?.message || error) });
    }

    const results = {};
    for (const name of ["frontend", "api", "giftcard"]) {
      results[name] = await ensureStarted(name, appContext);
    }
    return res.json({ ok: true, results });
  }

  if (!services[serviceName]) {
    return res.status(404).json({ ok: false, error: "Okänd tjänst." });
  }

  const result = await ensureStarted(serviceName);
  return res.status(result.ok ? 200 : 500).json(result);
});

app.post("/api/stop/:service", async (req, res) => {
  const { service: serviceName } = req.params;

  if (!services[serviceName]) {
    return res.status(404).json({ ok: false, error: "Okänd tjänst." });
  }

  const result = await ensureStopped(serviceName);
  return res.status(result.ok ? 200 : 500).json(result);
});

app.post("/api/restart/:service", async (req, res) => {
  const { service: serviceName } = req.params;

  if (!services[serviceName]) {
    return res.status(404).json({ ok: false, error: "Okänd tjänst." });
  }

  const stopResult = await ensureStopped(serviceName, { allowAlreadyStopped: true });
  if (!stopResult.ok) {
    return res.status(500).json(stopResult);
  }

  const startResult = await ensureStarted(serviceName);
  return res.status(startResult.ok ? 200 : 500).json(startResult);
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(launcherPort, () => {
  console.log(`Launcher running on http://localhost:${launcherPort}`);
});

async function ensureStarted(serviceName, sharedAppContext = null) {
  const service = services[serviceName];
  if (!service?.canStart) {
    return { ok: false, error: "Den här tjänsten kan inte startas automatiskt." };
  }

  let appContext = sharedAppContext;
  if (service.usesAppContext && !appContext) {
    try {
      appContext = await getLaunchAppContext({ refresh: true });
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  }

  const before = await getServiceStatus(serviceName, service);
  if (before.healthy) {
    return { ok: true, started: false, message: `${service.label} kör redan.` };
  }

  try {
    service.start(appContext);
  } catch (error) {
    return { ok: false, error: String(error?.message || error) };
  }

  const startupTimeoutMs = Number.isFinite(service.startupTimeoutMs)
    ? service.startupTimeoutMs
    : 20_000;
  const becameHealthy = await waitForHealthy(serviceName, service, startupTimeoutMs);
  if (!becameHealthy) {
    return { ok: false, error: `${service.label} startade inte i tid.` };
  }

  return { ok: true, started: true, message: `${service.label} är igång.` };
}

async function getServiceStatus(serviceName, service) {
  const reachable = await isHealthy(service.healthUrl);
  let detail = reachable ? "OK" : "Svarar inte";

  if (serviceName === "giftcard" && !giftcardMakerPath) {
    detail = "Ingen Giftv3-sökväg är konfigurerad.";
  } else if (serviceName === "giftcard" && giftcardMakerPath && !existsSync(giftcardMakerPath)) {
    detail = "Giftv3-mappen hittades inte.";
  } else if (serviceName === "database" && !reachable) {
    detail = "Databasen svarar inte via API:t. Kontrollera VPN, DB-uppgifter och att API:t kör.";
  }

  return {
    label: service.label,
    healthy: reachable,
    canStart: !!service.canStart,
    canStop: !!service.canStop,
    detail,
    healthUrl: service.healthUrl,
  };
}

async function isHealthy(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealthy(serviceName, service, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await getServiceStatus(serviceName, service);
    if (status.healthy) {
      return true;
    }
    await delay(1000);
  }
  return false;
}

async function waitForUnhealthy(serviceName, service, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await getServiceStatus(serviceName, service);
    if (!status.healthy) {
      return true;
    }
    await delay(700);
  }
  return false;
}

async function ensureStopped(serviceName, options = {}) {
  const service = services[serviceName];
  if (!service?.canStop) {
    return { ok: false, error: "Den här tjänsten kan inte stoppas från launchern." };
  }

  const before = await getServiceStatus(serviceName, service);
  const wasHealthy = before.healthy;

  await stopTrackedProcess(serviceName);
  if (service.port) {
    killProcessesOnPort(service.port);
  }

  const becameUnhealthy = await waitForUnhealthy(serviceName, service, 8_000);
  if (!becameUnhealthy) {
    const after = await getServiceStatus(serviceName, service);
    if (after.healthy) {
      return { ok: false, error: `${service.label} kunde inte stoppas.` };
    }
  }

  if (!wasHealthy && options.allowAlreadyStopped) {
    return { ok: true, stopped: false, message: `${service.label} var redan stoppad.` };
  }

  return { ok: true, stopped: true, message: `${service.label} är stoppad.` };
}

function spawnDetached(command, args, cwd) {
  if (process.platform === "win32") {
    spawnDetachedOnWindows(command, args, cwd);
    return;
  }

  const nodeBinDir = path.dirname(process.execPath);
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") || "Path";
  const pathSeparator = process.platform === "win32" ? ";" : ":";
  const inheritedPath = process.env[pathKey] || "";
  const mergedPath = inheritedPath
    ? `${nodeBinDir}${pathSeparator}${inheritedPath}`
    : nodeBinDir;
  const sanitizedEnvEntries = Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "PATH");
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    shell: false,
    windowsHide: true,
    env: Object.fromEntries([
      ...sanitizedEnvEntries,
      [pathKey, mergedPath],
    ]),
  });
  child.unref();
}

async function stopTrackedProcess(serviceName) {
  const tracked = serviceName === "api" ? apiProcess : serviceName === "frontend" ? frontendProcess : null;
  if (!tracked) {
    return false;
  }

  try {
    tracked.kill("SIGTERM");
  } catch {
    // Ignore kill errors and fall back to port-based termination.
  }

  await waitForProcessExit(tracked, 2000);
  if (serviceName === "api" && apiProcess === tracked) {
    apiProcess = null;
  } else if (serviceName === "frontend" && frontendProcess === tracked) {
    frontendProcess = null;
  }
  return true;
}

function waitForProcessExit(child, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    child.once("exit", done);
    setTimeout(done, timeoutMs);
  });
}

function killProcessesOnPort(port) {
  if (!Number.isInteger(port) || port <= 0) {
    return;
  }

  if (process.platform === "win32") {
    const script = [
      "$pids = @()",
      "try {",
      "  $connections = Get-NetTCPConnection -LocalPort " + port + " -State Listen -ErrorAction SilentlyContinue",
      "  if ($connections) {",
      "    $pids += ($connections | Select-Object -ExpandProperty OwningProcess -Unique)",
      "  }",
      "} catch {}",
      "if (-not $pids -or $pids.Count -eq 0) {",
      "  $matches = netstat -ano | Select-String ':" + port + "\\s+.*LISTENING\\s+\\d+$'",
      "  foreach ($line in $matches) {",
      "    $m = [regex]::Match($line.ToString(), 'LISTENING\\s+(\\d+)$')",
      "    if ($m.Success) { $pids += [int]$m.Groups[1].Value }",
      "  }",
      "}",
      "$pids = $pids | Sort-Object -Unique",
      "if (-not $pids -or $pids.Count -eq 0) { exit 0 }",
      "foreach ($targetPid in $pids) {",
      "  if ($targetPid -and $targetPid -ne $PID) {",
      "    Stop-Process -Id $targetPid -Force -ErrorAction SilentlyContinue",
      "  }",
      "}",
    ].join("; ");

    spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  const lookup = spawnSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" });
  if (lookup.status !== 0 || !lookup.stdout) {
    return;
  }

  const pids = lookup.stdout
    .split(/\s+/)
    .map((value) => parseInt(value, 10))
    .filter((value) => Number.isInteger(value) && value > 0 && value !== process.pid);

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // Ignore failures; process may already be gone.
    }
  }
}

function spawnManagedNodeScript(scriptPath, cwd, serviceName) {
  const env = buildSpawnEnv();
  const child = spawn(nodeRunner, [scriptPath], {
    cwd,
    stdio: "ignore",
    windowsHide: true,
    env,
  });

  if (serviceName === "api") {
    apiProcess = child;
  } else if (serviceName === "frontend") {
    frontendProcess = child;
  }

  child.on("exit", () => {
    if (serviceName === "api" && apiProcess === child) {
      apiProcess = null;
    } else if (serviceName === "frontend" && frontendProcess === child) {
      frontendProcess = null;
    }
  });

  return child;
}

function spawnDetachedOnWindows(command, args, cwd) {
  const env = buildSpawnEnv();
  const pathKey = Object.keys(env).find((key) => key.toUpperCase() === "PATH") || "Path";
  const mergedPath = env[pathKey] || path.dirname(process.execPath);
  const encodedCommand = encodePowerShellCommand(buildStartProcessScript(command, args, cwd, mergedPath));

  const child = spawn("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-WindowStyle",
    "Hidden",
    "-EncodedCommand",
    encodedCommand,
  ], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env,
  });
  child.unref();
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getAppContextState() {
  try {
    const appContext = await getLaunchAppContext();
    return { appContext, error: "" };
  } catch (error) {
    return { appContext: getFallbackAppContext(), error: String(error?.message || error) };
  }
}

async function getLaunchAppContext({ refresh = false } = {}) {
  if (!refresh && cachedAppContext) {
    return cachedAppContext;
  }

  let appContext = getFallbackAppContext();

  if (launcherAppOverridePath) {
    appContext = {
      appDir: launcherAppOverridePath,
      source: "konfigurerad sökväg",
      revision: getGitRevision(launcherAppOverridePath) || "okänd",
    };
  } else if (launcherUseLatestMain) {
    appContext = prepareLatestMainWorktree();
  }

  ensureAppRuntimeFiles(appContext.appDir);
  cachedAppContext = appContext;
  return cachedAppContext;
}

function getFallbackAppContext() {
  return {
    appDir: rootDir,
    source: "arbetskatalogen",
    revision: getGitRevision(rootDir) || "okänd",
  };
}

function prepareLatestMainWorktree() {
  runGit(["fetch", "origin", "main"], rootDir);
  const revision = runGit(["rev-parse", launcherMainRef], rootDir);
  const worktreeGitPath = path.join(launcherManagedWorktreePath, ".git");

  if (!existsSync(launcherManagedWorktreePath)) {
    runGit(["worktree", "add", "--detach", launcherManagedWorktreePath, revision], rootDir);
  } else if (!existsSync(worktreeGitPath)) {
    throw new Error(`Launcher-mappen finns redan men är inte ett git-worktree: ${launcherManagedWorktreePath}`);
  } else {
    runGit(["reset", "--hard", revision], launcherManagedWorktreePath);
  }

  return {
    appDir: launcherManagedWorktreePath,
    source: `senaste ${launcherMainRef}`,
    revision,
  };
}

function ensureAppRuntimeFiles(appDir) {
  copyRuntimeFile(".env", appDir);
  copyRuntimeFile(".env.server.local", appDir);
  ensureNodeModulesLink(appDir);
  syncLauncherOverlayFiles(appDir);
}

function copyRuntimeFile(fileName, appDir) {
  const sourcePath = path.join(rootDir, fileName);
  const targetPath = path.join(appDir, fileName);
  if (!existsSync(sourcePath) || sourcePath === targetPath) {
    return;
  }
  copyFileSync(sourcePath, targetPath);
}

function ensureNodeModulesLink(appDir) {
  const sourceNodeModules = path.join(rootDir, "node_modules");
  const targetNodeModules = path.join(appDir, "node_modules");

  if (appDir === rootDir || !existsSync(sourceNodeModules) || existsSync(targetNodeModules)) {
    return;
  }

  symlinkSync(sourceNodeModules, targetNodeModules, "junction");
}

function syncLauncherOverlayFiles(appDir) {
  if (appDir === rootDir) {
    return;
  }

  for (const relativePath of launcherOverlayFiles) {
    const sourcePath = path.join(rootDir, relativePath);
    const targetPath = path.join(appDir, relativePath);
    if (!existsSync(sourcePath)) {
      continue;
    }

    mkdirSync(path.dirname(targetPath), { recursive: true });
    copyFileSync(sourcePath, targetPath);
  }
}

function getGitRevision(cwd) {
  try {
    return runGit(["rev-parse", "--short", "HEAD"], cwd);
  } catch {
    return "";
  }
}

function runGit(args, cwd) {
  const result = spawnSync(gitCommand, args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || `git ${args.join(" ")} misslyckades`).trim());
  }

  return (result.stdout || "").trim();
}

function resolveAppPath(candidatePath) {
  return path.isAbsolute(candidatePath)
    ? candidatePath
    : path.resolve(rootDir, candidatePath);
}

function resolveExecutable(preferredPaths, fallbackCommand) {
  const existingPath = preferredPaths.find((candidatePath) => existsSync(candidatePath));
  return existingPath || fallbackCommand;
}

function buildSpawnEnv() {
  const nodeBinDir = path.dirname(process.execPath);
  const pathKey = Object.keys(process.env).find((key) => key.toUpperCase() === "PATH") || "Path";
  const pathSeparator = process.platform === "win32" ? ";" : ":";
  const inheritedPath = process.env[pathKey] || "";
  const mergedPath = inheritedPath
    ? `${nodeBinDir}${pathSeparator}${inheritedPath}`
    : nodeBinDir;
  const sanitizedEnvEntries = Object.entries(process.env).filter(([key]) => key.toUpperCase() !== "PATH");

  return Object.fromEntries([
    ...sanitizedEnvEntries,
    [pathKey, mergedPath],
  ]);
}

function buildStartProcessScript(command, args, cwd, mergedPath) {
  const escapedCommand = escapeForPowerShellSingleQuoted(command);
  const escapedArgs = args.map((arg) => `'${escapeForPowerShellSingleQuoted(arg)}'`).join(", ");
  const escapedCwd = escapeForPowerShellSingleQuoted(cwd);
  const escapedPath = escapeForPowerShellSingleQuoted(mergedPath);

  return [
    `$env:Path = '${escapedPath}'`,
    `$argumentList = @(${escapedArgs})`,
    `Start-Process -FilePath '${escapedCommand}' -ArgumentList $argumentList -WorkingDirectory '${escapedCwd}' -WindowStyle Hidden`,
  ].join("; ");
}

function encodePowerShellCommand(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

function escapeForPowerShellSingleQuoted(value) {
  return String(value).replace(/'/g, "''");
}
