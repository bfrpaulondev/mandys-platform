import { createAccessControl } from "better-auth/plugins/access";
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access";

export const mandysStatements = {
  ...defaultStatements,
  restaurant: ["read", "update"],
  menu: ["read", "create", "update", "delete", "publish"],
  reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update", "delete", "export"],
  event: ["read", "create", "update", "delete"],
  order: ["read", "create", "update", "refund"],
  stock: ["read", "create", "update", "adjust"],
  analytics: ["read"],
  settings: ["read", "update"],
} as const;

export const ac = createAccessControl(mandysStatements);

const operationalFull = {
  restaurant: ["read", "update"],
  menu: ["read", "create", "update", "delete", "publish"],
  reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update", "delete", "export"],
  event: ["read", "create", "update", "delete"],
  order: ["read", "create", "update", "refund"],
  stock: ["read", "create", "update", "adjust"],
  analytics: ["read"],
  settings: ["read", "update"],
} as const;

export const owner = ac.newRole({
  ...ownerAc.statements,
  ...operationalFull,
});

export const manager = ac.newRole({
  ...adminAc.statements,
  ...operationalFull,
});

export const reception = ac.newRole({
  ...memberAc.statements,
  restaurant: [],
  menu: ["read"],
  reservation: ["read", "create", "update", "cancel"],
  customer: ["read", "create", "update"],
  event: ["read", "create", "update"],
  order: ["read", "create", "update"],
  stock: [],
  analytics: ["read"],
  settings: [],
});

export const kitchen = ac.newRole({
  ...memberAc.statements,
  restaurant: [],
  menu: ["read", "update"],
  reservation: ["read"],
  customer: [],
  event: [],
  order: ["read", "update"],
  stock: ["read", "update", "adjust"],
  analytics: [],
  settings: [],
});

export const staff = ac.newRole({
  ...memberAc.statements,
  restaurant: [],
  menu: ["read"],
  reservation: ["read"],
  customer: [],
  event: [],
  order: ["read", "update"],
  stock: ["read"],
  analytics: [],
  settings: [],
});

export const marketing = ac.newRole({
  ...memberAc.statements,
  restaurant: [],
  menu: ["read", "update", "publish"],
  reservation: [],
  customer: [],
  event: ["read", "create", "update"],
  order: [],
  stock: [],
  analytics: ["read"],
  settings: [],
});

export const accounting = ac.newRole({
  ...memberAc.statements,
  restaurant: [],
  menu: ["read"],
  reservation: [],
  customer: [],
  event: [],
  order: [],
  stock: ["read"],
  analytics: ["read"],
  settings: [],
});

export const mandysRoles = {
  owner,
  manager,
  reception,
  kitchen,
  staff,
  marketing,
  accounting,
};

export type MandysRole = keyof typeof mandysRoles;