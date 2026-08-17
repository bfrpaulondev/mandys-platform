import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const migrationFiles = [
  "packages/database/sql/0010_regional_plan_prices.sql",
  "packages/database/sql/0012_regional_plan_prices_wave2.sql",
];
const sources = await Promise.all(
  migrationFiles.map((file) => readFile(path.resolve(process.cwd(), file), "utf8")),
);
const source = sources.join("\n");

const plans = ["start", "grow", "operate", "intelligence", "multi"];
const markets = [
  "PT", "ES", "US", "BR", "IN", "GB", "CA", "AU", "MX",
  "IE", "JP", "SG", "NZ", "AE", "ZA", "PE",
];
const includedStaff = new Map([
  ["start", 5],
  ["grow", 15],
  ["operate", 30],
  ["intelligence", 30],
  ["multi", 50],
]);

const rowPattern =
  /\('([a-z-]+)','([A-Z]{2})','([A-Z]{3})',(\d+),(\d+),(\d+),(\d+),(true|false)\)/g;
const rows = [...source.matchAll(rowPattern)].map((match) => ({
  plan: match[1],
  country: match[2],
  currency: match[3],
  monthly: Number(match[4]),
  annual: Number(match[5]),
  included: Number(match[6]),
  extraStaff: Number(match[7]),
  isPublic: match[8] === "true",
}));

const failures = [];
const expectedCount = plans.length * markets.length;
if (rows.length !== expectedCount) {
  failures.push(`expected ${expectedCount} regional price rows, found ${rows.length}`);
}

const keys = new Set();
for (const row of rows) {
  const key = `${row.country}:${row.plan}`;
  if (keys.has(key)) failures.push(`duplicate regional price row ${key}`);
  keys.add(key);

  if (!plans.includes(row.plan)) failures.push(`unknown plan ${row.plan}`);
  if (!markets.includes(row.country)) failures.push(`unexpected market ${row.country}`);
  if (row.isPublic) failures.push(`${key} is public before commercial approval`);
  if (row.monthly <= 0 || row.extraStaff <= 0) failures.push(`${key} must use positive prices`);
  if (row.annual !== row.monthly * 10) {
    failures.push(`${key} annual price must equal ten monthly payments`);
  }
  if (row.included !== includedStaff.get(row.plan)) {
    failures.push(`${key} included staff does not match the plan allowance`);
  }
}

for (const country of markets) {
  for (const plan of plans) {
    if (!keys.has(`${country}:${plan}`)) failures.push(`missing ${country}:${plan}`);
  }
}

for (const [index, file] of migrationFiles.entries()) {
  if (!/on conflict[\s\S]*is_public=false/i.test(sources[index])) {
    failures.push(`${file} upsert must force draft regional prices back to is_public=false`);
  }
}

if (failures.length > 0) {
  console.error("Commercial pricing guardrails failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Validated ${rows.length} private regional prices across ${markets.length} markets and ${plans.length} plans.`,
  );
}
