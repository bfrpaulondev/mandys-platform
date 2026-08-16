import type { ModuleKey } from "@mandys/contracts";

export interface TenantEntitlement {
  module: ModuleKey;
  status: "enabled" | "disabled" | "trial";
  expiresAt?: Date;
}

export class ModuleNotEnabledError extends Error {
  constructor(public readonly module: ModuleKey) {
    super(`Mandy's module '${module}' is not enabled for this tenant`);
    this.name = "ModuleNotEnabledError";
  }
}

export function hasModule(
  entitlements: readonly TenantEntitlement[],
  module: ModuleKey,
  now = new Date(),
): boolean {
  const entitlement = entitlements.find((item) => item.module === module);
  if (!entitlement || entitlement.status === "disabled") return false;
  if (entitlement.expiresAt && entitlement.expiresAt <= now) return false;
  return true;
}

export function assertModuleEnabled(
  entitlements: readonly TenantEntitlement[],
  module: ModuleKey,
  now = new Date(),
): void {
  if (!hasModule(entitlements, module, now)) {
    throw new ModuleNotEnabledError(module);
  }
}
