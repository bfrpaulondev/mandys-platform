import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const roleNames = ["owner", "manager", "reception", "kitchen", "staff", "marketing", "accounting"];

const files = Object.fromEntries(await Promise.all([
  "menu", "reservations", "events", "orders", "stock", "insights", "operations", "crm", "audit",
].map(async (name) => [name, await readFile(path.join(root, `supabase/functions/mandys-${name}/index.ts`), "utf8")])));

function functionBlock(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing authorization helper ${name}`);
  const open = source.indexOf("{", start + marker.length);
  if (open < 0) throw new Error(`Missing body for authorization helper ${name}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unclosed authorization helper ${name}`);
}

function rolesIn(source, helper) {
  const block = functionBlock(source, helper);
  return roleNames.filter((role) => new RegExp(`["']${role}["']`).test(block));
}

function assertRoles(file, helper, expected) {
  const actual = rolesIn(files[file], helper).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${file}.${helper} role drift. Expected ${wanted.join(",")}; got ${actual.join(",")}`);
  }
}

assertRoles("menu", "canRead", roleNames);
assertRoles("menu", "canCreateDelete", ["owner", "manager"]);
assertRoles("menu", "canUpdate", ["owner", "manager", "kitchen", "marketing"]);
assertRoles("menu", "canPublish", ["owner", "manager", "marketing"]);

assertRoles("reservations", "canRead", ["owner", "manager", "reception", "kitchen", "staff"]);
assertRoles("reservations", "canOperate", ["owner", "manager", "reception"]);
assertRoles("reservations", "canConfigure", ["owner", "manager"]);

assertRoles("events", "canManage", ["owner", "manager", "reception", "marketing"]);

assertRoles("orders", "canRead", ["owner", "manager", "reception", "kitchen", "staff"]);
assertRoles("orders", "canUpdate", ["owner", "manager", "reception", "kitchen", "staff"]);

assertRoles("stock", "canRead", ["owner", "manager", "kitchen", "staff", "accounting"]);
assertRoles("stock", "canCreate", ["owner", "manager"]);
assertRoles("stock", "canUpdate", ["owner", "manager", "kitchen"]);
assertRoles("stock", "canAdjust", ["owner", "manager", "kitchen"]);

assertRoles("insights", "canRead", ["owner", "manager", "reception", "accounting", "marketing"]);
assertRoles("operations", "canConfigure", ["owner", "manager"]);
assertRoles("crm", "canRead", ["owner", "manager", "reception"]);
assertRoles("audit", "canRead", ["owner", "manager"]);

const crmWrite = functionBlock(files.crm, "canWrite");
if (!/return\s+canRead\(ctx\)/.test(crmWrite)) {
  throw new Error("crm.canWrite must stay aligned with crm.canRead");
}

const stockSource = files.stock;
for (const [operation, helper] of [
  ["createIngredient", "canCreate"],
  ["createSupplier", "canCreate"],
  ["createMovement", "canAdjust"],
  ["saveRecipe", "canUpdate"],
]) {
  const block = functionBlock(stockSource, operation);
  if (!block.includes(`${helper}(ctx)`)) throw new Error(`stock.${operation} must enforce ${helper}`);
}

const menuSource = files.menu;
for (const [operation, helper] of [
  ["createMenu", "canCreateDelete"],
  ["createCategory", "canCreateDelete"],
  ["deleteCategory", "canCreateDelete"],
  ["createItem", "canCreateDelete"],
  ["deleteItem", "canCreateDelete"],
  ["patchCategory", "canUpdate"],
  ["patchItem", "canUpdate"],
]) {
  const block = functionBlock(menuSource, operation);
  if (!block.includes(`${helper}(ctx)`)) throw new Error(`menu.${operation} must enforce ${helper}`);
}
const patchMenu = functionBlock(menuSource, "patchMenu");
if (!patchMenu.includes("canUpdate(ctx)") || !patchMenu.includes("canPublish(ctx)")) {
  throw new Error("menu.patchMenu must separately enforce update and publish permissions");
}

console.log("Validated Mandy's runtime role enforcement and least-privilege action boundaries.");