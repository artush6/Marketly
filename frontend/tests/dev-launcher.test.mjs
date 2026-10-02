import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../scripts/dev.mjs", import.meta.url), "utf8")
  .replace(/^import .*;\n/gm, "")
  .replaceAll("import.meta.url", '"file:///repo/frontend/scripts/dev.mjs"');

async function launch({ ready = false, check = { status: 0 }, backendExit = false } = {}) {
  const children = [];
  const errors = [];
  const exits = [];
  const process = new EventEmitter();
  process.env = {};
  process.execPath = "/node";
  process.exit = (code) => exits.push(code);
  const context = vm.createContext({
    process,
    console: { log() {}, error: (...args) => errors.push(args.join(" ")) },
    dirname: () => "/repo/frontend/scripts",
    resolve: (...parts) => parts.join("/"),
    fileURLToPath: (url) => url,
    existsSync: () => true,
    lstatSync: () => ({}),
    spawnSync: () => check,
    spawn: () => {
      const child = new EventEmitter();
      child.exitCode = null;
      child.kill = () => { child.killed = true; };
      children.push(child);
      if (backendExit && children.length === 1) queueMicrotask(() => {
        child.exitCode = 1;
        child.emit("exit", 1, null);
      });
      return child;
    },
    fetch: async () => ({ ok: ready || children.length > 0 }),
    AbortSignal,
    setTimeout: (callback) => { callback(); return { unref() {} }; },
  });
  await vm.runInContext(`(async () => { ${source} })()`, context);
  return { children, errors, exits, process };
}

test("missing dependencies fail cleanly before either child starts", async () => {
  const result = await launch({ check: { status: 1, stderr: "No module named 'rich'" } });
  assert.equal(result.children.length, 0);
  assert.deepEqual(result.exits, [1]);
  assert.match(result.errors.join("\n"), /requirements.txt/);
  assert.doesNotMatch(result.errors.join("\n"), /TypeError/);
});

test("missing Python executable reports repair instructions", async () => {
  const result = await launch({ check: { error: new Error("spawn ENOENT") } });
  assert.deepEqual(result.exits, [1]);
  assert.match(result.errors.join("\n"), /ENOENT/);
});

test("backend failure during startup never starts the frontend", async () => {
  const result = await launch({ backendExit: true });
  assert.equal(result.children.length, 1);
  assert.deepEqual(result.exits, [1]);
});

test("backend failure after startup stops the frontend", async () => {
  const result = await launch();
  assert.equal(result.children.length, 2);
  result.children[0].exitCode = 1;
  result.children[0].emit("exit", 1, null);
  assert.equal(result.children[1].killed, true);
  assert.deepEqual(result.exits, [1]);
});

test("reused backend remains external and frontend shutdown is safe", async () => {
  const result = await launch({ ready: true });
  assert.equal(result.children.length, 1);
  result.process.emit("SIGTERM");
  assert.equal(result.children[0].killed, true);
  assert.deepEqual(result.exits, [0]);
});
