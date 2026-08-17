import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const [runtimeAuthSource, packageAuthSource, teamSource] = await Promise.all([
  readFile(path.join(root, "supabase/functions/mandys-auth/index.ts"), "utf8"),
  readFile(path.join(root, "packages/auth/src/permissions.ts"), "utf8"),
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
    restaurant: [], menu: ["read"], reservation: ["read", "create", "update", "cancel"],
    customer: ["read", "create", "update"], event: ["read", "create", "update"], order: ["read", "create", "update"],
    stock: [], analytics: ["read"], settings: [],
  },
  kitchen: {
    restaurant: [], menu: ["read", "update"], reservation: ["read"], customer: [], event: [],
    order: ["read", "update"], stock: ["read", "update", "adjust"], analytics: [], settings: [],
  },
  staff: {
    restaurant: [], menu: ["read"], reservation: ["read"], customer: [], event: [],
    order: ["read", "update"], stock: ["read"], analytics: [], settings: [],
  },
  marketing: {
    restaurant: [], menu: ["read", "update", "publish"], reservation: [], customer: [],
    event: ["read", "create", "update"], order: [], stock: [], analytics: ["read"], settings: [],
  },
  accounting: {
    restaurant: [], menu: ["read"], reservation: [], customer: [], event: [],
    order: [], stock: ["read"], analytics: ["read"], settings: [],
  },
};

function objectBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing role declaration: ${marker}`);
  const open = source.indexOf("{", start + marker.length);
  if (open < 0) throw new Error(`Missing object body after ${marker}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
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

function validateAuthSource(source, label, exported) {
  const fullMarker = exported ? "const operationalFull =" : "const operationalFull =";
  assertMatrix(`${label}.operationalFull`, parsePermissions(objectBlock(source, fullMarker)), expected.operationalFull);
  for (const role of ["reception", "kitchen", "staff", "marketing", "accounting"]) {
    const marker = exported ? `export const ${role} = ac.newRole(` : `const ${role} = ac.newRole(`;
    assertMatrix(`${label}.${role}`, parsePermissions(objectBlock(source, marker)), expected[role]);
  }

  const ownerMarker = exported ? "export const owner = ac.newRole(" : "const owner = ac.newRole(";
  const managerMarker = exported ? "export const manager = ac.newRole(" : "const manager = ac.newRole(";
  const ownerBlock = objectBlock(source, ownerMarker);
  const managerBlock = objectBlock(source, managerMarker);
  if (!ownerBlock.includes("...ownerAc.statements") || !ownerBlock.includes("...operationalFull")) {
    throw new Error(`${label}.owner must combine ownerAc.statements with operationalFull`);
  }
  if (!managerBlock.includes("...adminAc.statements") || !managerBlock.includes("...operationalFull")) {
    throw new Error(`${label}.manager must combine adminAc.statements with operationalFull`);
  }
}

validateAuthSource(runtimeAuthSource, "runtime", false);
validateAuthSource(packageAuthSource, "package", true);

const registration = runtimeAuthSource.match(/roles:\s*\{([^}]+)\}/s)?.[1] ?? "";
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

console.log("Validated Mandy's runtime/package Better Auth role matrix and Team UI roles.");