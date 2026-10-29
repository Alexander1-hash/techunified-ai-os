import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const packageJson = JSON.parse(read("../package.json"));
const packageLock = JSON.parse(read("../package-lock.json"));

test("patched direct dependency versions match the lockfile", () => {
  for (const [name, expected] of [
    ["next", "16.4.2"],
    ["sharp", "0.35.5"],
    ["source-map-js", "1.2.2"],
  ]) {
    assert.equal(packageJson.dependencies[name], expected, `${name} must remain pinned`);
    assert.equal(packageLock.packages[`node_modules/${name}`]?.version, expected, `${name} lockfile must match`);
  }
});

test("forecast retrieval remains organization-scoped and bounded", () => {
  const source = read("../app/api/business/forecast/route.ts");
  assert.match(source, /\.eq\(['"]organization_id['"],\s*organizationId\)/);
  assert.match(source, /MAX_KPI_RECORDS\s*=\s*800/);
  assert.match(source, /MAX_RELATIONSHIPS\s*=\s*800/);
  assert.match(source, /\.limit\(MAX_KPI_RECORDS\s*\+\s*1\)/);
  assert.match(source, /kpiWindowTruncated/);
});

test("decision evaluation discloses bounded evidence windows", () => {
  const source = read("../app/api/business/decision-evaluation/route.ts");
  assert.match(source, /\.eq\(['"]organization_id['"],\s*organizationId\)/);
  assert.match(source, /MAX_ACTION_RUNS\s*=\s*100/);
  assert.match(source, /MAX_OUTCOMES\s*=\s*500/);
  assert.match(source, /resultsArePartial|partialResultsWarning/);
});

test("Company Brain imports retain file and row caps plus organization context", () => {
  const source = read("../app/api/brain/data-sources/route.ts");
  assert.match(source, /MAX_BYTES\s*=\s*10\s*\*\s*1024\s*\*\s*1024/);
  assert.match(source, /MAX_ROWS\s*=\s*5000/);
  assert.match(source, /getCurrentProfile/);
  assert.match(source, /organization_id:\s*profile\.organization_id/);
  const analysis = read("../app/api/business/analysis/route.ts");
  assert.match(analysis, /MAX_SOURCE_RECORDS\s*=\s*5000/);
  assert.match(analysis, /MAX_KPI_MAPPINGS\s*=\s*50/);
});

test("mobile navigation exposes dialog state, focus containment, and a skip link", () => {
  const source = read("../components/app-shell.tsx");
  assert.match(source, /aria-expanded=\{mobile\}/);
  assert.match(source, /aria-controls="mobile-navigation"/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /className="fixed inset-0 z-\[90\] bg-black\/50 lg:hidden"/);
  assert.match(source, /Skip to main content/);
  assert.match(source, /aria-current=\{active \? "page" : undefined\}/);
});
