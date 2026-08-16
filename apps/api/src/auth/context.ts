import { auth } from "@mandys/auth";
import { tenantRoles, type TenantContext, type TenantRole } from "@mandys/contracts";
import type { FastifyRequest } from "fastify";
import { fromNodeHeaders } from "better-auth/node";

export class AuthenticationRequiredError extends Error {
  readonly statusCode = 401;

  constructor() {
    super("Authentication required");
    this.name = "AuthenticationRequiredError";
  }
}

export class ActiveOrganizationRequiredError extends Error {
  readonly statusCode = 409;

  constructor() {
    super("Select an active organization before using this endpoint");
    this.name = "ActiveOrganizationRequiredError";
  }
}

export class ForbiddenError extends Error {
  readonly statusCode = 403;

  constructor(message = "Insufficient permissions") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function parseTenantRole(value: string): TenantRole {
  const roles = value.split(",").map((role) => role.trim());
  const role = tenantRoles.find((candidate) => roles.includes(candidate));

  if (!role) {
    throw new ForbiddenError("The active organization role is not recognized by Mandy's");
  }

  return role;
}

export async function getTenantContext(request: FastifyRequest): Promise<TenantContext> {
  const headers = fromNodeHeaders(request.headers);
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new AuthenticationRequiredError();
  }

  const sessionData = session.session as typeof session.session & {
    activeOrganizationId?: string | null;
  };
  const organizationId = sessionData.activeOrganizationId;

  if (!organizationId) {
    throw new ActiveOrganizationRequiredError();
  }

  const activeMember = await auth.api.getActiveMemberRole({ headers });

  return {
    organizationId,
    userId: session.user.id,
    role: parseTenantRole(activeMember.role),
  };
}

export function assertRole(context: TenantContext, allowedRoles: readonly TenantRole[]): void {
  if (!allowedRoles.includes(context.role)) {
    throw new ForbiddenError();
  }
}
