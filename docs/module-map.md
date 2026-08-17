# Module map

| Module | Current state | Purpose |
|---|---:|---|
| Core | Shipped | Tenant, users, locations, settings, themes, permissions, notifications, audit and data protection |
| Menu | Shipped | Menus, categories, items, translations, allergens, media integration and publication |
| Reservations | Shipped | Areas, tables, availability, policies, exceptions, reservations and waitlist |
| Events | Shipped | Group and private-event enquiry pipeline |
| CRM | Shipped | Customer directory, contact details, consent and operational history |
| Orders | Shipped | Direct takeaway ordering, public tracking and kitchen status flow; customer online card payment remains optional later expansion |
| Stock | Shipped | Ingredients, recipes, suppliers, movements, average cost and low-stock monitoring |
| Analytics | Shipped | Operational and commercial Insights across current restaurant data |
| Billing foundation | Shipped, fail-closed | Plans, subscriptions, country pricing, checkout, Stripe webhook and customer portal foundations |
| Transactional email | Shipped, fail-closed | Tenant-scoped outbox, localized templates, idempotent worker and provider safety switches |
| Loyalty | Later | Repeat-customer programmes and offers |
| Multi-location | Later | Group-level permissions and consolidated operations |
| AI | Later | Provider-neutral assistant over authorized restaurant data |

A module entitlement controls commercial access. Themes use a separate entitlement model so presentation can be sold independently of business capabilities. SaaS pricing and external provider activation remain private/fail-closed until explicitly approved for commercial launch; this does not block internal QA.