import type {
  CreateMenuCategoryInput,
  CreateMenuInput,
  CreateMenuItemInput,
  UpdateMenuInput,
} from "@mandys/contracts";
import { and, asc, eq, inArray } from "drizzle-orm";

import {
  allergens,
  auditLogs,
  locations,
  menuCategories,
  menuCategoryTranslations,
  menuItemAllergens,
  menuItems,
  menuItemTranslations,
  menus,
  menuTranslations,
  moduleEntitlements,
} from "./schema";
import { withTenant, type TenantDatabaseContext, type TenantTransaction } from "./tenant";

export class MenuModuleDisabledError extends Error {
  constructor() {
    super("The menu module is not enabled for this restaurant");
    this.name = "MenuModuleDisabledError";
  }
}

export class MenuNotFoundError extends Error {
  constructor() {
    super("Menu not found");
    this.name = "MenuNotFoundError";
  }
}

export class MenuReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuReferenceError";
  }
}

async function assertMenuEnabled(tx: TenantTransaction, organizationId: string): Promise<void> {
  const [entitlement] = await tx
    .select({ status: moduleEntitlements.status })
    .from(moduleEntitlements)
    .where(
      and(
        eq(moduleEntitlements.organizationId, organizationId),
        eq(moduleEntitlements.moduleKey, "menu"),
      ),
    )
    .limit(1);

  if (!entitlement || entitlement.status === "disabled") {
    throw new MenuModuleDisabledError();
  }
}

async function assertLocation(
  tx: TenantTransaction,
  organizationId: string,
  locationId: string,
): Promise<void> {
  const [location] = await tx
    .select({ id: locations.id })
    .from(locations)
    .where(and(eq(locations.organizationId, organizationId), eq(locations.id, locationId)))
    .limit(1);

  if (!location) throw new MenuReferenceError("The selected location does not belong to this restaurant");
}

export async function listMenuTree(context: TenantDatabaseContext) {
  return withTenant(context, async (tx) => {
    await assertMenuEnabled(tx, context.organizationId);

    const tenantMenus = await tx
      .select()
      .from(menus)
      .where(eq(menus.organizationId, context.organizationId))
      .orderBy(asc(menus.createdAt));

    const [translations, categories, categoryTranslations, items, itemTranslations, itemAllergenRows, tenantAllergens] =
      await Promise.all([
        tx
          .select()
          .from(menuTranslations)
          .where(eq(menuTranslations.organizationId, context.organizationId))
          .orderBy(asc(menuTranslations.locale)),
        tx
          .select()
          .from(menuCategories)
          .where(eq(menuCategories.organizationId, context.organizationId))
          .orderBy(asc(menuCategories.sortOrder), asc(menuCategories.createdAt)),
        tx
          .select()
          .from(menuCategoryTranslations)
          .where(eq(menuCategoryTranslations.organizationId, context.organizationId))
          .orderBy(asc(menuCategoryTranslations.locale)),
        tx
          .select()
          .from(menuItems)
          .where(eq(menuItems.organizationId, context.organizationId))
          .orderBy(asc(menuItems.sortOrder), asc(menuItems.createdAt)),
        tx
          .select()
          .from(menuItemTranslations)
          .where(eq(menuItemTranslations.organizationId, context.organizationId))
          .orderBy(asc(menuItemTranslations.locale)),
        tx
          .select()
          .from(menuItemAllergens)
          .where(eq(menuItemAllergens.organizationId, context.organizationId)),
        tx
          .select()
          .from(allergens)
          .where(eq(allergens.organizationId, context.organizationId))
          .orderBy(asc(allergens.name)),
      ]);

    return {
      allergens: tenantAllergens,
      menus: tenantMenus.map((menu) => ({
        ...menu,
        translations: translations.filter((translation) => translation.menuId === menu.id),
        categories: categories
          .filter((category) => category.menuId === menu.id)
          .map((category) => ({
            ...category,
            translations: categoryTranslations.filter(
              (translation) => translation.categoryId === category.id,
            ),
            items: items
              .filter((item) => item.categoryId === category.id)
              .map((item) => ({
                ...item,
                translations: itemTranslations.filter(
                  (translation) => translation.menuItemId === item.id,
                ),
                allergenIds: itemAllergenRows
                  .filter((row) => row.menuItemId === item.id)
                  .map((row) => row.allergenId),
              })),
          })),
      })),
    };
  });
}

export async function createMenu(context: TenantDatabaseContext, input: CreateMenuInput) {
  return withTenant(context, async (tx) => {
    await assertMenuEnabled(tx, context.organizationId);
    if (input.locationId) await assertLocation(tx, context.organizationId, input.locationId);

    const [created] = await tx
      .insert(menus)
      .values({
        organizationId: context.organizationId,
        internalName: input.internalName,
        slug: input.slug,
        ...(input.locationId ? { locationId: input.locationId } : {}),
      })
      .returning();

    if (!created) throw new Error("Menu could not be created");

    await tx.insert(menuTranslations).values(
      input.translations.map((translation) => ({
        organizationId: context.organizationId,
        menuId: created.id,
        locale: translation.locale,
        name: translation.name,
        ...(translation.description ? { description: translation.description } : {}),
      })),
    );

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "menu.created",
      entityType: "menu",
      entityId: created.id,
      metadata: { slug: created.slug, locationId: created.locationId },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return created;
  });
}

export async function updateMenu(
  context: TenantDatabaseContext,
  menuId: string,
  input: UpdateMenuInput,
) {
  return withTenant(context, async (tx) => {
    await assertMenuEnabled(tx, context.organizationId);

    const [current] = await tx
      .select()
      .from(menus)
      .where(and(eq(menus.organizationId, context.organizationId), eq(menus.id, menuId)))
      .limit(1);

    if (!current) throw new MenuNotFoundError();

    const [updated] = await tx
      .update(menus)
      .set({
        ...(input.internalName !== undefined ? { internalName: input.internalName } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(menus.organizationId, context.organizationId), eq(menus.id, menuId)))
      .returning();

    if (!updated) throw new MenuNotFoundError();

    if (input.translations) {
      for (const translation of input.translations) {
        await tx
          .insert(menuTranslations)
          .values({
            organizationId: context.organizationId,
            menuId,
            locale: translation.locale,
            name: translation.name,
            description: translation.description ?? null,
          })
          .onConflictDoUpdate({
            target: [menuTranslations.menuId, menuTranslations.locale],
            set: {
              name: translation.name,
              description: translation.description ?? null,
              updatedAt: new Date(),
            },
          });
      }
    }

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "menu.updated",
      entityType: "menu",
      entityId: menuId,
      metadata: {
        changedFields: Object.keys(input).filter((key) => key !== "translations"),
        translations: input.translations?.map((translation) => translation.locale) ?? [],
      },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return updated;
  });
}

export async function createMenuCategory(
  context: TenantDatabaseContext,
  input: CreateMenuCategoryInput,
) {
  return withTenant(context, async (tx) => {
    await assertMenuEnabled(tx, context.organizationId);

    const [menu] = await tx
      .select({ id: menus.id })
      .from(menus)
      .where(and(eq(menus.organizationId, context.organizationId), eq(menus.id, input.menuId)))
      .limit(1);

    if (!menu) throw new MenuReferenceError("The selected menu does not belong to this restaurant");

    const [created] = await tx
      .insert(menuCategories)
      .values({
        organizationId: context.organizationId,
        menuId: input.menuId,
        sortOrder: input.sortOrder,
        isVisible: input.isVisible,
      })
      .returning();

    if (!created) throw new Error("Menu category could not be created");

    await tx.insert(menuCategoryTranslations).values(
      input.translations.map((translation) => ({
        organizationId: context.organizationId,
        categoryId: created.id,
        locale: translation.locale,
        name: translation.name,
        ...(translation.description ? { description: translation.description } : {}),
      })),
    );

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "menu.category_created",
      entityType: "menu_category",
      entityId: created.id,
      metadata: { menuId: input.menuId },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return created;
  });
}

export async function createMenuItem(
  context: TenantDatabaseContext,
  input: CreateMenuItemInput,
) {
  return withTenant(context, async (tx) => {
    await assertMenuEnabled(tx, context.organizationId);

    const [category] = await tx
      .select({ id: menuCategories.id })
      .from(menuCategories)
      .where(
        and(
          eq(menuCategories.organizationId, context.organizationId),
          eq(menuCategories.id, input.categoryId),
        ),
      )
      .limit(1);

    if (!category) {
      throw new MenuReferenceError("The selected category does not belong to this restaurant");
    }

    if (input.allergenIds.length > 0) {
      const tenantAllergens = await tx
        .select({ id: allergens.id })
        .from(allergens)
        .where(
          and(
            eq(allergens.organizationId, context.organizationId),
            inArray(allergens.id, input.allergenIds),
          ),
        );

      if (tenantAllergens.length !== new Set(input.allergenIds).size) {
        throw new MenuReferenceError("One or more allergens do not belong to this restaurant");
      }
    }

    const [created] = await tx
      .insert(menuItems)
      .values({
        organizationId: context.organizationId,
        categoryId: input.categoryId,
        priceCents: input.priceCents,
        isAvailable: input.isAvailable,
        isFeatured: input.isFeatured,
        sortOrder: input.sortOrder,
        ...(input.sku ? { sku: input.sku } : {}),
        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      })
      .returning();

    if (!created) throw new Error("Menu item could not be created");

    await tx.insert(menuItemTranslations).values(
      input.translations.map((translation) => ({
        organizationId: context.organizationId,
        menuItemId: created.id,
        locale: translation.locale,
        name: translation.name,
        ...(translation.description ? { description: translation.description } : {}),
      })),
    );

    if (input.allergenIds.length > 0) {
      await tx.insert(menuItemAllergens).values(
        [...new Set(input.allergenIds)].map((allergenId) => ({
          organizationId: context.organizationId,
          menuItemId: created.id,
          allergenId,
        })),
      );
    }

    await tx.insert(auditLogs).values({
      organizationId: context.organizationId,
      action: "menu.item_created",
      entityType: "menu_item",
      entityId: created.id,
      metadata: {
        categoryId: input.categoryId,
        priceCents: input.priceCents,
        allergenCount: input.allergenIds.length,
      },
      ...(context.userId ? { actorUserId: context.userId } : {}),
    });

    return created;
  });
}
