import { spawn, spawnSync } from "node:child_process";
import { existsSync, lstatSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backendRoot = resolve(frontendRoot, "../backend");
const venvPython = resolve(backendRoot, ".venv/bin/python");
const legacyPython = resolve(backendRoot, "venv/bin/python");
const nextBin = resolve(frontendRoot, "node_modules/next/dist/bin/next");
const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:8000";
let backend;
let frontend;
let stopping = false;

async function backendIsReady() {
  try {
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/healthz`, {
      signal: AbortSignal.timeout(800),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await backendIsReady()) return;
    if (stopping) throw new Error("Backend startup stopped");
    if (backend?.exitCode != null)
      throw new Error(`Backend exited with code ${backend.exitCode}`);
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Backend did not become ready at ${backendUrl}`);
}

function stop(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  if (frontend && frontend.exitCode == null) frontend.kill("SIGTERM");
  if (backend && backend.exitCode == null) backend.kill("SIGTERM");
  setTimeout(() => process.exit(exitCode), 250).unref();
}

for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => stop(0));

try {
  if (!(await backendIsReady())) {
    // lstat also detects a broken interpreter symlink after a Python upgrade.
    const python = process.env.MARKETLY_PYTHON ||
      [venvPython, legacyPython].find((path) => lstatSync(path, { throwIfNoEntry: false })) ||
      "python3";
    const check = spawnSync(python, ["-c", "import rich, uvicorn, fastapi, pandas, finnhub, eventregistry, dotenv, openai, httpx, fredapi, redis"], {
      cwd: backendRoot,
      encoding: "utf8",
    });
    if (check.error || check.status !== 0) {
      throw new Error(`Backend Python environment is unavailable or incomplete (${python}).\n` +
        `${check.error?.message || check.stderr.trim()}\n` +
        "From the repository root, create/repair backend/.venv with Python 3.11+ and run:\n" +
        "  backend/.venv/bin/python -m pip install -r backend/requirements.txt\n" +
        "Set MARKETLY_PYTHON to use a different interpreter.");
    }
    console.log(`[marketly] Starting backend at ${backendUrl}`);
    backend = spawn(python, ["run.py"], {
      cwd: backendRoot,
      env: process.env,
      stdio: "inherit",
    });
    backend.on("error", (error) => {
      console.error("[marketly] Backend failed to start", error);
      stop(1);
    });
    backend.on("exit", (code, signal) => {
      if (!stopping) {
        console.error(`[marketly] Backend exited (${signal || code})`);
        stop(code || 1);
      }
    });
    await waitForBackend();
  } else {
    console.log(`[marketly] Using backend already running at ${backendUrl}`);
  }

  if (stopping) throw new Error("Startup stopped");
  if (!existsSync(nextBin)) throw new Error("Next.js is missing. Run npm install in frontend first.");
  console.log("[marketly] Backend ready; starting Next.js");
  frontend = spawn(process.execPath, [nextBin, "dev"], {
    cwd: frontendRoot,
    env: process.env,
    stdio: "inherit",
  });
  frontend.on("error", (error) => {
    console.error("[marketly] Frontend failed to start", error);
    stop(1);
  });
  frontend.on("exit", (code) => stop(code ?? 0));
} catch (error) {
  console.error(`[marketly] ${error instanceof Error ? error.message : error}`);
  stop(1);
}
