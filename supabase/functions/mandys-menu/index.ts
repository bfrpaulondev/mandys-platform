import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import postgres from "npm:postgres@3.4.7";

const projectUrl = "https://dbfmjdissqsdhxhmqkqp.supabase.co";
const authSessionUrl = `${projectUrl}/functions/v1/mandys-auth/api/auth/get-session`;
const connectionString = Deno.env.get("SUPABASE_DB_URL");
if (!connectionString) throw new Error("SUPABASE_DB_URL is required");

const sql = postgres(connectionString, {
  prepare: false,
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
  connection: { application_name: "mandys-menu-edge", search_path: "mandys,public" },
});

type Context = { userId: string; organizationId: string; role: string };
type Result = { status?: number; body: unknown };
const locales = ["pt-PT", "pt-BR", "en", "es"] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
function fail(status: number, error: string, message: string): Result { return { status, body: { error, message } }; }
function isUuid(value: unknown): value is string { return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function text(value: unknown, min: number, max: number): string | null { if (typeof value !== "string") return null; const v = value.trim(); return v.length >= min && v.length <= max ? v : null; }
function slug(value: unknown): string | null { const v = text(value, 2, 80); return v && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? v : null; }
function httpsUrl(value: unknown): string | null { if (value === null || value === "" || value === undefined) return null; if (typeof value !== "string" || value.length > 2048) return null; try { const u = new URL(value); return u.protocol === "https:" ? u.toString() : null; } catch { return null; } }
function allowedOrigin(origin: string | null): boolean { if (!origin) return true; try { const u = new URL(origin); if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true; if (u.protocol !== "https:") return false; return u.hostname === "mandys.pt" || u.hostname.endsWith(".mandys.pt") || u.hostname.endsWith(".vercel.app") || u.hostname.endsWith(".netlify.app"); } catch { return false; } }

function translations(value: unknown): Array<{ locale: string; name: string; description: string | null }> | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return null;
  const seen = new Set<string>(); const out: Array<{ locale: string; name: string; description: string | null }> = [];
  for (const row of value) {
    const locale = typeof row?.locale === "string" && locales.includes(row.locale as typeof locales[number]) ? row.locale : null;
    const name = text(row?.name, 1, 160); const description = row?.description ? text(row.description, 1, 2000) : null;
    if (!locale || !name || seen.has(locale)) return null; seen.add(locale); out.push({ locale, name, description });
  }
  return out;
}

async function context(request: Request): Promise<Context | Result> {
  const cookie = request.headers.get("cookie");
  if (!cookie) return fail(401, "UNAUTHENTICATED", "Authentication is required");
  const response = await fetch(authSessionUrl, { headers: { cookie, accept: "application/json" }, cache: "no-store" });
  if (!response.ok) return fail(401, "UNAUTHENTICATED", "Session is invalid or expired");
  const body = await response.json().catch(() => null) as any;
  const userId = body?.user?.id; const organizationId = body?.session?.activeOrganizationId;
  if (typeof userId !== "string" || typeof organizationId !== "string") return fail(401, "TENANT_CONTEXT_REQUIRED", "Select an active restaurant organization");
  const members = await sql<{ role: string }[]>`select role from mandys.member where organization_id=${organizationId} and user_id=${userId} limit 1`;
  const role = members[0]?.role; if (!role) return fail(403, "FORBIDDEN", "Organization membership is required");
  return { userId, organizationId, role };
}
function canRead(ctx: Context) { return ["owner","manager","reception","kitchen","staff","marketing","accounting"].includes(ctx.role); }
function canCreateDelete(ctx: Context) { return ctx.role === "owner" || ctx.role === "manager"; }
function canUpdate(ctx: Context) { return ["owner","manager","kitchen","marketing"].includes(ctx.role); }
function canPublish(ctx: Context) { return ["owner","manager","marketing"].includes(ctx.role); }
async function audit(tx: any, ctx: Context, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) { await tx`insert into mandys.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, metadata) values (${ctx.organizationId},${ctx.userId},${action},${entityType},${entityId},${tx.json(metadata)})`; }
async function assertMenuEnabled(tx: any, ctx: Context) { const rows = await tx<any[]>`select status from mandys.module_entitlements where organization_id=${ctx.organizationId} and module_key='menu' limit 1`; if (!rows[0] || rows[0].status === "disabled") throw new Error("MENU_DISABLED"); }

async function tree(ctx: Context): Promise<Result> {
  if (!canRead(ctx)) return fail(403,"FORBIDDEN","Your role cannot access menus");
  return sql.begin(async tx => {
    await tx`select set_config('app.organization_id',${ctx.organizationId},true)`; await assertMenuEnabled(tx,ctx);
    const [menus, mt, cats, ct, items, it, allergens, links] = await Promise.all([
      tx<any[]>`select * from mandys.menus where organization_id=${ctx.organizationId} order by created_at`,
      tx<any[]>`select * from mandys.menu_translations where organization_id=${ctx.organizationId}`,
      tx<any[]>`select * from mandys.menu_categories where organization_id=${ctx.organizationId} order by sort_order, created_at`,
      tx<any[]>`select * from mandys.menu_category_translations where organization_id=${ctx.organizationId}`,
      tx<any[]>`select * from mandys.menu_items where organization_id=${ctx.organizationId} order by sort_order, created_at`,
      tx<any[]>`select * from mandys.menu_item_translations where organization_id=${ctx.organizationId}`,
      tx<any[]>`select id,code,name from mandys.allergens where organization_id=${ctx.organizationId} order by name`,
      tx<any[]>`select menu_item_id,allergen_id from mandys.menu_item_allergens where organization_id=${ctx.organizationId}`,
    ]);
    return { body: { data: { allergens, menus: menus.map(m => ({ id:m.id, internalName:m.internal_name, slug:m.slug, isPublished:m.is_published, translations:mt.filter(x=>x.menu_id===m.id).map(x=>({locale:x.locale,name:x.name,description:x.description})), categories:cats.filter(c=>c.menu_id===m.id).map(c=>({ id:c.id, sortOrder:c.sort_order, isVisible:c.is_visible, translations:ct.filter(x=>x.category_id===c.id).map(x=>({locale:x.locale,name:x.name,description:x.description})), items:items.filter(i=>i.category_id===c.id).map(i=>({ id:i.id, sku:i.sku, priceCents:i.price_cents, imageUrl:i.image_url, isAvailable:i.is_available, isFeatured:i.is_featured, sortOrder:i.sort_order, translations:it.filter(x=>x.menu_item_id===i.id).map(x=>({locale:x.locale,name:x.name,description:x.description})), allergenIds:links.filter(x=>x.menu_item_id===i.id).map(x=>x.allergen_id) })) })) })) } } };
  }).catch(e => String(e).includes("MENU_DISABLED") ? fail(403,"MENU_DISABLED","The menu module is not enabled") : Promise.reject(e));
}

async function createMenu(ctx: Context, b: any): Promise<Result> {
  if (!canCreateDelete(ctx)) return fail(403,"FORBIDDEN","Your role cannot create menus");
  const internalName=text(b?.internalName,2,160), s=slug(b?.slug), tr=translations(b?.translations); if(!internalName||!s||!tr) return fail(400,"INVALID_REQUEST","Menu data is invalid");
  return sql.begin(async tx=>{ await tx`select set_config('app.organization_id',${ctx.organizationId},true)`; await assertMenuEnabled(tx,ctx); try { const rows=await tx<any[]>`insert into mandys.menus (organization_id,internal_name,slug,is_published) values (${ctx.organizationId},${internalName},${s},false) returning id`; const id=rows[0].id; for(const t of tr) await tx`insert into mandys.menu_translations (organization_id,menu_id,locale,name,description) values (${ctx.organizationId},${id}::uuid,${t.locale}::mandys.locale_code,${t.name},${t.description})`; await audit(tx,ctx,"menu.created","menu",id,{slug:s}); return {status:201,body:{data:{id}}}; } catch(e){ if(String(e).includes("menus_org_slug_uidx")) return fail(409,"MENU_SLUG_EXISTS","A menu with this identifier already exists"); throw e; } });
}
async function patchMenu(ctx:Context,id:string,b:any):Promise<Result>{ if(!canUpdate(ctx))return fail(403,"FORBIDDEN","Your role cannot update menus"); if(b?.isPublished!==undefined&&!canPublish(ctx))return fail(403,"FORBIDDEN","Your role cannot publish menus"); if(!isUuid(id))return fail(400,"INVALID_ID","Invalid menu id"); return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;await assertMenuEnabled(tx,ctx);const cur=await tx<any[]>`select id from mandys.menus where organization_id=${ctx.organizationId} and id=${id}::uuid limit 1`;if(!cur[0])return fail(404,"NOT_FOUND","Menu not found"); const internal=b.internalName===undefined?undefined:text(b.internalName,2,160), s=b.slug===undefined?undefined:slug(b.slug), pub=typeof b.isPublished==="boolean"?b.isPublished:undefined, tr=b.translations===undefined?undefined:translations(b.translations); if((b.internalName!==undefined&&!internal)||(b.slug!==undefined&&!s)||(b.translations!==undefined&&!tr))return fail(400,"INVALID_REQUEST","Menu update is invalid"); await tx`update mandys.menus set internal_name=coalesce(${internal??null},internal_name), slug=coalesce(${s??null},slug), is_published=coalesce(${pub??null},is_published), updated_at=now() where organization_id=${ctx.organizationId} and id=${id}::uuid`; if(tr)for(const t of tr)await tx`insert into mandys.menu_translations (organization_id,menu_id,locale,name,description) values (${ctx.organizationId},${id}::uuid,${t.locale}::mandys.locale_code,${t.name},${t.description}) on conflict (menu_id,locale) do update set name=excluded.name,description=excluded.description,updated_at=now()`; await audit(tx,ctx,"menu.updated","menu",id,{published:pub});return{body:{data:{id}}};}); }
async function createCategory(ctx:Context,b:any):Promise<Result>{if(!canCreateDelete(ctx))return fail(403,"FORBIDDEN","Your role cannot create menu categories");const menuId=b?.menuId,tr=translations(b?.translations),sort=Number(b?.sortOrder??0),visible=b?.isVisible!==false;if(!isUuid(menuId)||!tr||!Number.isInteger(sort)||sort<0||sort>10000)return fail(400,"INVALID_REQUEST","Category data is invalid");return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;await assertMenuEnabled(tx,ctx);const menu=await tx<any[]>`select id from mandys.menus where organization_id=${ctx.organizationId} and id=${menuId}::uuid`;if(!menu[0])return fail(422,"INVALID_MENU","Menu does not belong to this restaurant");const r=await tx<any[]>`insert into mandys.menu_categories (organization_id,menu_id,sort_order,is_visible) values (${ctx.organizationId},${menuId}::uuid,${sort},${visible}) returning id`;const id=r[0].id;for(const t of tr)await tx`insert into mandys.menu_category_translations (organization_id,category_id,locale,name,description) values (${ctx.organizationId},${id}::uuid,${t.locale}::mandys.locale_code,${t.name},${t.description})`;await audit(tx,ctx,"menu.category_created","menu_category",id,{menuId});return{status:201,body:{data:{id}}};});}
async function patchCategory(ctx:Context,id:string,b:any):Promise<Result>{if(!canUpdate(ctx))return fail(403,"FORBIDDEN","Your role cannot update menu categories");if(!isUuid(id))return fail(400,"INVALID_ID","Invalid category id");const sort=b.sortOrder===undefined?undefined:Number(b.sortOrder),visible=typeof b.isVisible==="boolean"?b.isVisible:undefined,tr=b.translations===undefined?undefined:translations(b.translations);if((sort!==undefined&&(!Number.isInteger(sort)||sort<0||sort>10000))||(b.translations!==undefined&&!tr))return fail(400,"INVALID_REQUEST","Category update is invalid");return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;await assertMenuEnabled(tx,ctx);const cur=await tx<any[]>`select id from mandys.menu_categories where organization_id=${ctx.organizationId} and id=${id}::uuid`;if(!cur[0])return fail(404,"NOT_FOUND","Category not found");await tx`update mandys.menu_categories set sort_order=coalesce(${sort??null},sort_order),is_visible=coalesce(${visible??null},is_visible),updated_at=now() where organization_id=${ctx.organizationId} and id=${id}::uuid`;if(tr)for(const t of tr)await tx`insert into mandys.menu_category_translations (organization_id,category_id,locale,name,description) values (${ctx.organizationId},${id}::uuid,${t.locale}::mandys.locale_code,${t.name},${t.description}) on conflict (category_id,locale) do update set name=excluded.name,description=excluded.description,updated_at=now()`;await audit(tx,ctx,"menu.category_updated","menu_category",id,{});return{body:{data:{id}}};});}
async function deleteCategory(ctx:Context,id:string):Promise<Result>{if(!canCreateDelete(ctx))return fail(403,"FORBIDDEN","Your role cannot delete menu categories");if(!isUuid(id))return fail(400,"INVALID_ID","Invalid category id");return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;const cur=await tx<any[]>`select id from mandys.menu_categories where organization_id=${ctx.organizationId} and id=${id}::uuid`;if(!cur[0])return fail(404,"NOT_FOUND","Category not found");await tx`delete from mandys.menu_categories where organization_id=${ctx.organizationId} and id=${id}::uuid`;await audit(tx,ctx,"menu.category_deleted","menu_category",id,{});return{body:{data:{deleted:true}}};});}
async function createItem(ctx:Context,b:any):Promise<Result>{if(!canCreateDelete(ctx))return fail(403,"FORBIDDEN","Your role cannot create menu items");const categoryId=b?.categoryId,tr=translations(b?.translations),price=Number(b?.priceCents),sort=Number(b?.sortOrder??0),image=b?.imageUrl===undefined?null:httpsUrl(b.imageUrl),allergenIds=Array.isArray(b?.allergenIds)?[...new Set(b.allergenIds.filter(isUuid))]:[];if(!isUuid(categoryId)||!tr||!Number.isInteger(price)||price<0||price>100000000||!Number.isInteger(sort)||sort<0||sort>10000||(b?.imageUrl&&!image)||allergenIds.length!==(Array.isArray(b?.allergenIds)?new Set(b.allergenIds).size:0))return fail(400,"INVALID_REQUEST","Item data is invalid");return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;await assertMenuEnabled(tx,ctx);const cat=await tx<any[]>`select id from mandys.menu_categories where organization_id=${ctx.organizationId} and id=${categoryId}::uuid`;if(!cat[0])return fail(422,"INVALID_CATEGORY","Category does not belong to this restaurant");if(allergenIds.length){const a=await tx<any[]>`select id from mandys.allergens where organization_id=${ctx.organizationId} and id=any(${allergenIds}::uuid[])`;if(a.length!==allergenIds.length)return fail(422,"INVALID_ALLERGEN","One or more allergens are invalid");}const r=await tx<any[]>`insert into mandys.menu_items (organization_id,category_id,sku,price_cents,image_url,is_available,is_featured,sort_order) values (${ctx.organizationId},${categoryId}::uuid,${text(b?.sku,1,80)},${price},${image},${b?.isAvailable!==false},${b?.isFeatured===true},${sort}) returning id`;const id=r[0].id;for(const t of tr)await tx`insert into mandys.menu_item_translations (organization_id,menu_item_id,locale,name,description) values (${ctx.organizationId},${id}::uuid,${t.locale}::mandys.locale_code,${t.name},${t.description})`;for(const aid of allergenIds)await tx`insert into mandys.menu_item_allergens (organization_id,menu_item_id,allergen_id) values (${ctx.organizationId},${id}::uuid,${aid}::uuid)`;await audit(tx,ctx,"menu.item_created","menu_item",id,{categoryId,price});return{status:201,body:{data:{id}}};});}
async function patchItem(ctx:Context,id:string,b:any):Promise<Result>{if(!canUpdate(ctx))return fail(403,"FORBIDDEN","Your role cannot update menu items");if(!isUuid(id))return fail(400,"INVALID_ID","Invalid item id");const price=b.priceCents===undefined?undefined:Number(b.priceCents),sort=b.sortOrder===undefined?undefined:Number(b.sortOrder),image=b.imageUrl===undefined?undefined:httpsUrl(b.imageUrl),available=typeof b.isAvailable==="boolean"?b.isAvailable:undefined,featured=typeof b.isFeatured==="boolean"?b.isFeatured:undefined,tr=b.translations===undefined?undefined:translations(b.translations),allergenIds=b.allergenIds===undefined?undefined:(Array.isArray(b.allergenIds)?[...new Set(b.allergenIds.filter(isUuid))]:null);if((price!==undefined&&(!Number.isInteger(price)||price<0||price>100000000))||(sort!==undefined&&(!Number.isInteger(sort)||sort<0||sort>10000))||(b.imageUrl!==undefined&&b.imageUrl!==null&&b.imageUrl!==""&&!image)||(b.translations!==undefined&&!tr)||(b.allergenIds!==undefined&&(!allergenIds||allergenIds.length!==new Set(b.allergenIds).size)))return fail(400,"INVALID_REQUEST","Item update is invalid");return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;await assertMenuEnabled(tx,ctx);const cur=await tx<any[]>`select id from mandys.menu_items where organization_id=${ctx.organizationId} and id=${id}::uuid`;if(!cur[0])return fail(404,"NOT_FOUND","Item not found");if(allergenIds&&allergenIds.length){const a=await tx<any[]>`select id from mandys.allergens where organization_id=${ctx.organizationId} and id=any(${allergenIds}::uuid[])`;if(a.length!==allergenIds.length)return fail(422,"INVALID_ALLERGEN","One or more allergens are invalid");}await tx`update mandys.menu_items set price_cents=coalesce(${price??null},price_cents), image_url=case when ${b.imageUrl!==undefined} then ${image??null} else image_url end, is_available=coalesce(${available??null},is_available), is_featured=coalesce(${featured??null},is_featured), sort_order=coalesce(${sort??null},sort_order), updated_at=now() where organization_id=${ctx.organizationId} and id=${id}::uuid`;if(tr)for(const t of tr)await tx`insert into mandys.menu_item_translations (organization_id,menu_item_id,locale,name,description) values (${ctx.organizationId},${id}::uuid,${t.locale}::mandys.locale_code,${t.name},${t.description}) on conflict (menu_item_id,locale) do update set name=excluded.name,description=excluded.description,updated_at=now()`;if(allergenIds){await tx`delete from mandys.menu_item_allergens where organization_id=${ctx.organizationId} and menu_item_id=${id}::uuid`;for(const aid of allergenIds)await tx`insert into mandys.menu_item_allergens (organization_id,menu_item_id,allergen_id) values (${ctx.organizationId},${id}::uuid,${aid}::uuid)`;}await audit(tx,ctx,"menu.item_updated","menu_item",id,{price,available,featured});return{body:{data:{id}}};});}
async function deleteItem(ctx:Context,id:string):Promise<Result>{if(!canCreateDelete(ctx))return fail(403,"FORBIDDEN","Your role cannot delete menu items");if(!isUuid(id))return fail(400,"INVALID_ID","Invalid item id");return sql.begin(async tx=>{await tx`select set_config('app.organization_id',${ctx.organizationId},true)`;const cur=await tx<any[]>`select id from mandys.menu_items where organization_id=${ctx.organizationId} and id=${id}::uuid`;if(!cur[0])return fail(404,"NOT_FOUND","Item not found");await tx`delete from mandys.menu_items where organization_id=${ctx.organizationId} and id=${id}::uuid`;await audit(tx,ctx,"menu.item_deleted","menu_item",id,{});return{body:{data:{deleted:true}}};});}

Deno.serve(async request => {
  const url=new URL(request.url); if(request.method==="OPTIONS")return new Response(null,{status:204,headers:{allow:"GET,POST,PATCH,DELETE,OPTIONS"}}); if(request.method==="GET"&&url.pathname.endsWith("/health"))return json({ok:true,service:"mandys-menu"}); if(!allowedOrigin(request.headers.get("origin")))return json({error:"ORIGIN_NOT_ALLOWED",message:"Request origin is not allowed"},403);
  try { const ce=await context(request); if("body" in ce)return json(ce.body,ce.status??400); const ctx=ce; const marker=url.pathname.indexOf("/v1/"); if(marker<0)return json({error:"NOT_FOUND"},404); const path=url.pathname.slice(marker); const b=()=>request.json().catch(()=>null); let r:Result;
    if(request.method==="GET"&&path==="/v1/menu")r=await tree(ctx);
    else if(request.method==="POST"&&path==="/v1/menu")r=await createMenu(ctx,await b());
    else if(request.method==="PATCH"&&/^\/v1\/menu\/[0-9a-f-]+$/i.test(path))r=await patchMenu(ctx,path.split("/").pop()!,await b());
    else if(request.method==="POST"&&path==="/v1/menu/categories")r=await createCategory(ctx,await b());
    else if(/^\/v1\/menu\/categories\/[0-9a-f-]+$/i.test(path)&&request.method==="PATCH")r=await patchCategory(ctx,path.split("/").pop()!,await b());
    else if(/^\/v1\/menu\/categories\/[0-9a-f-]+$/i.test(path)&&request.method==="DELETE")r=await deleteCategory(ctx,path.split("/").pop()!);
    else if(request.method==="POST"&&path==="/v1/menu/items")r=await createItem(ctx,await b());
    else if(/^\/v1\/menu\/items\/[0-9a-f-]+$/i.test(path)&&request.method==="PATCH")r=await patchItem(ctx,path.split("/").pop()!,await b());
    else if(/^\/v1\/menu\/items\/[0-9a-f-]+$/i.test(path)&&request.method==="DELETE")r=await deleteItem(ctx,path.split("/").pop()!);
    else r=fail(404,"NOT_FOUND","Route not found"); return json(r.body,r.status??200);
  } catch(e){console.error("mandys-menu",e instanceof Error?e.message:String(e));return json({error:"INTERNAL_ERROR",message:"Menu operation could not be completed"},500);}
});