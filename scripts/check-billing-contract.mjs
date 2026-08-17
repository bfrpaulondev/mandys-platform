import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const source = await readFile(
  path.resolve(process.cwd(), "supabase/functions/mandys-billing/index.ts"),
  "utf8",
);
const failures = [];

if (!/select\s+module_key,status,activated_at,expires_at/i.test(source)) {
  failures.push("billing entitlements query must read activated_at from module_entitlements");
}
if (/\benabled_at\b/i.test(source)) {
  failures.push("billing references non-existent module_entitlements.enabled_at");
}
if (!/enabledAt:\s*row\.activated_at/i.test(source)) {
  failures.push("billing API must preserve enabledAt while mapping from activated_at");
}
if (/Promise\.all\s*\(\s*\[[\s\S]{0,400}tx</i.test(source)) {
  failures.push("billing must not parallelize tenant reads on one transaction context");
}
if (!/set_config\('app\.organization_id'/i.test(source)) {
  failures.push("billing must set tenant context before tenant-owned reads");
}

if (failures.length > 0) {
  console.error("Billing contract validation failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("Validated Mandy's billing schema/API contract.");
}
