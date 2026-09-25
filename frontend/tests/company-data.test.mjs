import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const loadDependency = createRequire(import.meta.url);
const testDirectory = path.dirname(fileURLToPath(import.meta.url));

function load(relative, imports = {}, globals = {}) {
  const source = fs.readFileSync(path.join(testDirectory, '../src', relative), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020,
  } });
  const loadedModule = { exports: {} };
  vm.runInNewContext(outputText, { module: loadedModule, exports: loadedModule.exports,
    require: (name) => imports[name] ?? loadDependency(name),
    process: { env: {} }, Date, URL, AbortSignal, setTimeout, clearTimeout, ...globals });
  return loadedModule.exports;
}
const flush = () => new Promise(setImmediate);

test('preload concurrency, deduplication and manual-open reuse', async () => {
  const requests = [];
  const api = load('lib/api.ts', {}, { window: {}, fetch: (url) => new Promise((resolve) => {
    requests.push({ url, resolve });
  }) });
  api.preloadFinancials(['MSFT', 'NVDA', 'MSFT', 'AAPL']);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((r) => r.url.endsWith('?track=false')));
  const opened = api.getFinancials('MSFT');
  assert.equal(requests.length, 2);
  requests[0].resolve({ ok: true, json: async () => ({ symbol: 'MSFT' }) });
  assert.equal((await opened).symbol, 'MSFT');
  await flush();
  assert.equal(requests.length, 3);
  assert.equal((await api.getFinancials('MSFT')).symbol, 'MSFT');
  assert.equal(requests.length, 3);
  requests[1].resolve({ ok: true, json: async () => ({ symbol: 'NVDA' }) });
  requests[2].resolve({ ok: true, json: async () => ({ symbol: 'AAPL' }) });
  await flush();
});

test('failed preload frees capacity and permits later retry', async () => {
  let calls = 0;
  const api = load('lib/api.ts', {}, { window: {}, fetch: async () => {
    calls += 1;
    return { ok: false, status: 503 };
  } });
  api.preloadFinancials(['MSFT']);
  await flush();
  api.preloadFinancials(['MSFT']);
  await flush();
  assert.equal(calls, 2);
});

test('unsupported speculative listings do not fan out', async () => {
  const urls = [];
  const api = load('lib/api.ts', {}, { window: {}, fetch: async (url) => {
    urls.push(url); return { ok: true, json: async () => ({ symbol: 'TSLA' }) };
  } });
  api.preloadFinancials(['TSLA', 'TSLA.TO', 'TSLA.L'], true);
  await flush();
  assert.equal(urls.length, 1);
});

test('logo missing/broken fallback and recovery preserve dimensions', () => {
  let value;
  let state;
  const { CompanyLogo } = load('components/research/company-logo.tsx', {
    react: {
      useSyncExternalStore: (_subscribe, get) => get(),
      useEffect: () => {},
      useState: () => [state, (next) => { state = next; }],
    },
    '@/lib/company-metadata': { readMetadata: () => value, subscribeMetadata: () => {}, serverMetadata: () => {} },
    'next/image': { default: 'img', __esModule: true },
  });
  const missing = CompanyLogo({ symbol: 'MSFT' });
  assert.equal(missing.props.children, 'M');
  value = { logoUrl: 'https://example.com/msft.png' };
  const loaded = CompanyLogo({ symbol: 'MSFT' });
  assert.equal(loaded.props.children.props.src, value.logoUrl);
  loaded.props.children.props.onError();
  const broken = CompanyLogo({ symbol: 'MSFT' });
  assert.equal(broken.props.children, 'M');
  assert.equal(broken.props.style.width, missing.props.style.width);
  assert.equal(broken.props.style.height, missing.props.style.height);
  value = { logoUrl: 'https://example.com/new.png' };
  assert.equal(CompanyLogo({ symbol: 'MSFT' }).props.children.props.src, value.logoUrl);
});
