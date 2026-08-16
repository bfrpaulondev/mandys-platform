import {
  createMenuCategorySchema,
  createMenuItemSchema,
  createMenuSchema,
  menuIdParamsSchema,
  updateMenuSchema,
} from "@mandys/contracts";
import {
  createMenu,
  createMenuCategory,
  createMenuItem,
  listMenuTree,
  MenuModuleDisabledError,
  MenuNotFoundError,
  MenuReferenceError,
  updateMenu,
} from "@mandys/database";
import type { FastifyInstance, FastifyReply } from "fastify";

import { assertRole, getTenantContext } from "../auth/context";

function replyForMenuError(error: unknown, reply: FastifyReply) {
  if (error instanceof MenuModuleDisabledError) {
    return reply.status(403).send({ error: error.name, message: error.message });
  }

  if (error instanceof MenuNotFoundError) {
    return reply.status(404).send({ error: error.name, message: error.message });
  }

  if (error instanceof MenuReferenceError) {
    return reply.status(422).send({ error: error.name, message: error.message });
  }

  throw error;
}

export async function registerMenuRoutes(app: FastifyInstance): Promise<void> {
  app.get("/v1/menu", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager", "reception", "kitchen", "staff"]);

    try {
      const data = await listMenuTree({
        organizationId: context.organizationId,
        userId: context.userId,
      });
      return { data };
    } catch (error) {
      return replyForMenuError(error, reply);
    }
  });

  app.post("/v1/menu", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager"]);

    const parsed = createMenuSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Menu data is invalid",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const data = await createMenu(
        { organizationId: context.organizationId, userId: context.userId },
        parsed.data,
      );
      return reply.status(201).send({ data });
    } catch (error) {
      return replyForMenuError(error, reply);
    }
  });

  app.patch("/v1/menu/:menuId", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager"]);

    const params = menuIdParamsSchema.safeParse(request.params);
    const body = updateMenuSchema.safeParse(request.body);
    if (!params.success || !body.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Menu update is invalid",
        issues: {
          params: params.success ? undefined : params.error.flatten(),
          body: body.success ? undefined : body.error.flatten(),
        },
      });
    }

    try {
      const data = await updateMenu(
        { organizationId: context.organizationId, userId: context.userId },
        params.data.menuId,
        body.data,
      );
      return { data };
    } catch (error) {
      return replyForMenuError(error, reply);
    }
  });

  app.post("/v1/menu/categories", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager"]);

    const parsed = createMenuCategorySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Menu category data is invalid",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const data = await createMenuCategory(
        { organizationId: context.organizationId, userId: context.userId },
        parsed.data,
      );
      return reply.status(201).send({ data });
    } catch (error) {
      return replyForMenuError(error, reply);
    }
  });

  app.post("/v1/menu/items", async (request, reply) => {
    const context = await getTenantContext(request);
    assertRole(context, ["owner", "manager"]);

    const parsed = createMenuItemSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: "INVALID_REQUEST",
        message: "Menu item data is invalid",
        issues: parsed.error.flatten(),
      });
    }

    try {
      const data = await createMenuItem(
        { organizationId: context.organizationId, userId: context.userId },
        parsed.data,
      );
      return reply.status(201).send({ data });
    } catch (error) {
      return replyForMenuError(error, reply);
    }
  });
}
