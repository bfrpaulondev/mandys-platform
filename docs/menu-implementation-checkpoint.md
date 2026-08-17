# Mandy's Menu checkpoint

The Menu slice is now test-ready.

## Shipped

- tenant-safe menu runtime with entitlement checks, RLS defense in depth and audit logging;
- multilingual menu/category/item persistence for `pt-PT`, `pt-BR`, `en` and `es`;
- create/edit/delete/reorder flows for menus, categories and items;
- publication controls;
- allergen persistence and Backoffice UI;
- menu-item availability/featured state and media URL support;
- signed-media upload integration surface with HTTPS URL fallback;
- role-aware access: all operational roles can read; owner/manager create/delete; kitchen/marketing update; owner/manager/marketing publish;
- deployed Supabase runtime and same-origin Backoffice gateway;
- real-tenant browser/API coverage through the authenticated release suite.

Cloudinary production credentials/preset remain deliberately unconfigured during internal QA. The media runtime fails closed instead of permitting unsigned uploads, so this does not block testing the Menu workflows with HTTPS media URLs.