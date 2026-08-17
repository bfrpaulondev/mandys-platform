import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as ts from "typescript";

const root = process.cwd();
const authPath = path.join(root, "supabase/functions/mandys-auth/index.ts");
const teamPath = path.join(root, "apps/backoffice/src/app/[locale]/team/team-board.tsx");
const [authSource, teamSource] = await Promise.all([
  readFile(authPath, "utf8"),
  readFile(teamPath, "utf8"),
]);

const authFile = ts.createSourceFile(authPath, authSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const teamFile = ts.createSourceFile(teamPath, teamSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const full = {
  restaurant: ["read", "update"],
  menu: ["read", "create", "update", "delete", "publish"],
  reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update", "delete", "export"],
  event: ["read", "create", "update", "delete"],
  order: ["read", "create", "update", "refund"],
  stock: ["read", "create", "update", "adjust"],
  analytics: ["read"],
  settings: ["read", "update"],
};

const expected = {
  reception: {
    restaurant: ["read"], menu: ["read"], reservation: ["read", "create", "update", "cancel"],
    customer: ["read", "create", "update"], event: ["read", "create", "update"],
    order: ["read", "create", "update"], stock: ["read"], analytics: ["read"], settings: ["read"],
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

function variableInitializer(file, name) {
  let result = null;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name
    ) {
      result = node.initializer ?? null;
      return;
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  if (!result) throw new Error(`Missing variable ${name}`);
  return result;
}

function roleObject(file, name) {
  const initializer = variableInitializer(file, name);
  if (ts.isObjectLiteralExpression(initializer)) return initializer;
  if (ts.isCallExpression(initializer)) {
    const first = initializer.arguments[0];
    if (first && ts.isObjectLiteralExpression(first)) return first;
  }
  throw new Error(`Role ${name} is not defined by an object literal`);
}

function permissions(object) {
  const map = {};
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const key = ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)
      ? property.name.text
      : null;
    if (!key || !ts.isArrayLiteralExpression(property.initializer)) continue;
    map[key] = property.initializer.elements.map((element) => {
      if (!ts.isStringLiteral(element)) throw new Error(`${key} contains a non-string permission`);
      return element.text;
    });
  }
  return map;
}

function normalized(value) {
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, actions]) => [key, [...actions].sort()]),
  );
}

function assertEqual(label, actual, wanted) {
  const left = JSON.stringify(normalized(actual));
  const right = JSON.stringify(normalized(wanted));
  if (left !== right) {
    throw new Error(`${label} permissions changed.\nExpected: ${right}\nActual:   ${left}`);
  }
}

assertEqual("operationalFull", permissions(roleObject(authFile, "operationalFull")), full);
for (const [role, matrix] of Object.entries(expected)) {
  assertEqual(role, permissions(roleObject(authFile, role)), matrix);
}

for (const [role, baseSpread] of [["owner", "ownerAc.statements"], ["manager", "adminAc.statements"]]) {
  const object = roleObject(authFile, role);
  const spreads = object.properties
    .filter(ts.isSpreadAssignment)
    .map((property) => property.expression.getText(authFile));
  if (!spreads.includes(baseSpread) || !spreads.includes("operationalFull")) {
    throw new Error(`${role} must combine ${baseSpread} with operationalFull`);
  }
}

const rolesRegistration = authSource.match(/roles:\s*\{([^}]+)\}/s)?.[1] ?? "";
for (const role of ["owner", "manager", "reception", "kitchen", "staff", "marketing", "accounting"]) {
  if (!new RegExp(`\\b${role}\\b`).test(rolesRegistration)) {
    throw new Error(`Better Auth role registration is missing ${role}`);
  }
}

const assignable = variableInitializer(teamFile, "assignableRoles");
let assignableArray = assignable;
if (ts.isAsExpression(assignable) || ts.isSatisfiesExpression(assignable)) assignableArray = assignable.expression;
if (!ts.isArrayLiteralExpression(assignableArray)) {
  throw new Error("assignableRoles must remain a literal array");
}
const uiRoles = assignableArray.elements.map((element) => {
  if (!ts.isStringLiteral(element)) throw new Error("assignableRoles contains a non-string role");
  return element.text;
});
const expectedUiRoles = ["manager", "reception", "kitchen", "staff", "marketing", "accounting"];
if (JSON.stringify(uiRoles) !== JSON.stringify(expectedUiRoles)) {
  throw new Error(`Team UI roles changed. Expected ${expectedUiRoles.join(", ")}; got ${uiRoles.join(", ")}`);
}

console.log("Validated Mandy's Better Auth role matrix and Team UI role registration.");
