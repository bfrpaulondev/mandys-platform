import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const [authSource, teamSource] = await Promise.all([
  readFile(path.join(root, "supabase/functions/mandys-auth/index.ts"), "utf8"),
  readFile(path.join(root, "apps/backoffice/src/app/[locale]/team/team-board.tsx"), "utf8"),
]);

const resources = ["restaurant", "menu", "reservation", "customer", "event", "order", "stock", "analytics", "settings"];
const expected = {
  operationalFull: {
    restaurant: ["read", "update"], menu: ["read", "create", "update", "delete", "publish"],
    reservation: ["read", "create", "update", "cancel"], customer: ["read", "create", "update", "delete", "export"],
    event: ["read", "create", "update", "delete"], order: ["read", "create", "update", "refund"],
    stock: ["read", "create", "update", "adjust"], analytics: ["read"], settings: ["read", "update"],
  },
  reception: {
    restaurant: ["read"], menu: ["read"], reservation: ["read", "create", "update", "cancel"],
    customer: ["read", "create", "update"], event: ["read", "create", "update"], order: ["read", "create", "update"],
    stock: ["read"], analytics: ["read"], settings: ["read"],
  },
  kitchen: {
    restaurant: ["read"], menu: ["read", "update"], reservation: ["read"], customer: [], event: ["read"],
    order: ["read", "update"], stock: ["read", "update", "adjust"], analytics: [], settings: ["read"],
  },
  staff: {
    restaurant: ["read"], menu: ["read"], reservation: ["read"], customer: [], event: ["read"],
    order: ["read", "update"], stock: ["read"], analytics: [], settings: ["read"],
  },
  marketing: {
    restaurant: ["read"], menu: ["read", "update", "publish"], reservation: [], customer: [],
    event: ["read", "create", "update"], order: [], stock: [], analytics: ["read"], settings: ["read"],
  },
  accounting: {
    restaurant: ["read"], menu: ["read"], reservation: ["read"], customer: [], event: ["read"],
    order: ["read"], stock: ["read"], analytics: ["read"], settings: ["read"],
  },
};

function objectBlock(marker) {
  const start = authSource.indexOf(marker);
  if (start < 0) throw new Error(`Missing role declaration: ${marker}`);
  const open = authSource.indexOf("{", start + marker.length);
  if (open < 0) throw new Error(`Missing object body after ${marker}`);
  let depth = 0;
  for (let index = open; index < authSource.length; index += 1) {
    const char = authSource[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return authSource.slice(open + 1, index);
    }
  }
  throw new Error(`Unclosed object body after ${marker}`);
}

function parsePermissions(block) {
  const result = {};
  for (const resource of resources) {
    const match = block.match(new RegExp(`\\b${resource}\\s*:\\s*\\[([^\\]]*)\\]`));
    if (!match) continue;
    result[resource] = [...match[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
  }
  return result;
}

function normalized(value) {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, actions]) => [key, [...actions].sort()]),
  );
}

function assertMatrix(label, actual, wanted) {
  const left = JSON.stringify(normalized(actual));
  const right = JSON.stringify(normalized(wanted));
  if (left !== right) throw new Error(`${label} permission matrix drifted. Expected ${right}; got ${left}`);
}

assertMatrix("operationalFull", parsePermissions(objectBlock("const operationalFull =")), expected.operationalFull);
for (const role of ["reception", "kitchen", "staff", "marketing", "accounting"]) {
  assertMatrix(role, parsePermissions(objectBlock(`const ${role} = ac.newRole(`)), expected[role]);
}

const ownerBlock = objectBlock("const owner = ac.newRole(");
const managerBlock = objectBlock("const manager = ac.newRole(");
if (!ownerBlock.includes("...ownerAc.statements") || !ownerBlock.includes("...operationalFull")) {
  throw new Error("owner must combine ownerAc.statements with operationalFull");
}
if (!managerBlock.includes("...adminAc.statements") || !managerBlock.includes("...operationalFull")) {
  throw new Error("manager must combine adminAc.statements with operationalFull");
}

const registration = authSource.match(/roles:\s*\{([^}]+)\}/s)?.[1] ?? "";
for (const role of ["owner", "manager", "reception", "kitchen", "staff", "marketing", "accounting"]) {
  if (!new RegExp(`\\b${role}\\b`).test(registration)) throw new Error(`Better Auth registration is missing ${role}`);
}

const uiMatch = teamSource.match(/const\s+assignableRoles\s*=\s*\[([^\]]+)\]\s*as\s+const\s*;/s);
if (!uiMatch) throw new Error("assignableRoles must remain a literal array declared as const");
const uiRoles = [...uiMatch[1].matchAll(/["']([^"']+)["']/g)].map((item) => item[1]);
const expectedUiRoles = ["manager", "reception", "kitchen", "staff", "marketing", "accounting"];
if (JSON.stringify(uiRoles) !== JSON.stringify(expectedUiRoles)) {
  throw new Error(`Team UI roles drifted. Expected ${expectedUiRoles.join(", ")}; got ${uiRoles.join(", ")}`);
}

console.log("Validated Mandy's Better Auth operational role matrix and Team UI roles.");
