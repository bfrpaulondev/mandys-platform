# Mandy's commercial pricing proposal

Status: internal draft — do not publish or charge customers yet.

Research snapshot: 2026-08-17.

## Pricing principle

Mandy's should primarily charge per restaurant/location, not per employee. Restaurant headcount changes seasonally and charging every staff member from seat one creates friction. Each plan therefore includes a generous staff allowance, with a small price only for additional active staff accounts.

Annual billing should equal 10 monthly payments (roughly two months free). Taxes/VAT are added where applicable. Payments, fiscal integrations, hardware and third-party messaging can be priced separately when those providers are connected.

## Proposed launch pricing

### Portugal and Spain — EUR, per location

| Plan | Monthly | Annual | Included staff | Extra active staff/month |
|---|---:|---:|---:|---:|
| Start | €39 | €390 | 5 | €3.90 |
| Grow | €69 | €690 | 15 | €3.90 |
| Operate | €109 | €1,090 | 30 | €3.90 |
| Intelligence | €149 | €1,490 | 30 | €3.90 |
| Multi | €199 | €1,990 | 50/location | €3.90 |

### United States — USD, per location

| Plan | Monthly | Annual | Included staff | Extra active staff/month |
|---|---:|---:|---:|---:|
| Start | $49 | $490 | 5 | $4.90 |
| Grow | $89 | $890 | 15 | $4.90 |
| Operate | $149 | $1,490 | 30 | $4.90 |
| Intelligence | $199 | $1,990 | 30 | $4.90 |
| Multi | $299 | $2,990 | 50/location | $4.90 |

### Brazil — BRL, per location

| Plan | Monthly | Annual | Included staff | Extra active staff/month |
|---|---:|---:|---:|---:|
| Start | R$79 | R$790 | 5 | R$9.90 |
| Grow | R$149 | R$1,490 | 15 | R$9.90 |
| Operate | R$249 | R$2,490 | 30 | R$9.90 |
| Intelligence | R$349 | R$3,490 | 30 | R$9.90 |
| Multi | R$499 | R$4,990 | 50/location | R$9.90 |

### India — INR candidate band, per location

India is priced as a separate purchasing-power market rather than converted mechanically from EUR/USD. The band was revised downward after checking current Indian restaurant platforms: several complete or near-complete offers sit between roughly ₹399 and ₹1,999/month, while enterprise vendors generally quote individually.

| Plan | Monthly | Annual | Included staff | Extra active staff/month |
|---|---:|---:|---:|---:|
| Start | ₹499 | ₹4,990 | 5 | ₹49 |
| Grow | ₹899 | ₹8,990 | 15 | ₹49 |
| Operate | ₹1,499 | ₹14,990 | 30 | ₹49 |
| Intelligence | ₹2,199 | ₹21,990 | 30 | ₹49 |
| Multi | ₹3,499 | ₹34,990 | 50/location | ₹49 |

## Plan packaging

### Start
- Core
- Menu
- Reservations
- 5 staff accounts included
- Public restaurant page and direct booking

### Grow
Everything in Start, plus:
- CRM
- Events
- 15 staff accounts included

### Operate
Everything in Grow, plus:
- Orders
- Stock
- Insights / Analytics
- 30 staff accounts included

### Intelligence
Everything in Operate, plus:
- Mandy's AI when released
- 30 staff accounts included
- higher AI usage allowance to be defined from provider cost

### Multi
Everything in Intelligence, plus:
- Multi-location management when released
- consolidated group operations
- 50 staff accounts included per location
- final multi-location discount curve to be defined before launch

## Market anchors

Observed public restaurant-software pricing on 2026-08-17:

- Last.app: €50/month Starter, €95 Growth, €175 Unlimited per location; annual prices lower.
- Square Restaurants US: $49/month Plus and $149/month Premium per location; additional restaurant apps/devices can carry separate monthly fees.
- Toast US: restaurant POS starts at $69/month; one restaurant/payroll bundle advertises $9 per employee/month for payroll.
- Consumer Brazil: R$59.90/month Essencial, R$179.90 Profissional, R$269.90 Alta Performance.
- Saipos Brazil: restaurant plans advertised from about R$240.79/month, with no per-user charge.
- India current public examples: Billzova ₹399/month; CurryIQ ₹499 Starter and ₹999 Growth; RestoPOS ₹499–₹1,999; DineMate ₹799/₹1,999. Petpooja and Restroworks also compete in the segment but use regional/demo-led or requirements-based pricing.
- Ireland Square Restaurants Plus: €69 + VAT/month per location.
- Japan Square Restaurants Plus: ¥13,000/month.

## Labour-cost sanity check

The extra-seat prices are deliberately small relative to restaurant labour costs and remain secondary to location pricing. The employee add-on is operational-access pricing, not payroll processing.

## Rules for additional countries

Do not convert prices only by FX. Assign each country to a purchasing-power/competitive band using:

1. local restaurant software prices;
2. hospitality labour costs;
3. typical restaurant ticket/revenue levels;
4. local taxes and payment-provider costs;
5. support/localization cost.

Initial language-to-market mapping:
- `pt-PT`: Portugal; other EUR Portuguese-language operators require market review.
- `pt-BR`: Brazil, priced in BRL.
- `es`: Spain first; Latin-American markets get dedicated local bands rather than Spain EUR pricing.
- `en`: US first; UK, Canada, Australia, Ireland, India and other English-language markets use dedicated currency/purchasing-power bands.

## Commercial guardrails before publishing

- Every regional row remains `is_public = false` until explicit owner approval.
- Customer-facing billing keeps prices unpublished until checkout/tax/refund rules and payment-provider integration are ready.
- Do not silently downgrade or disable a restaurant when a trial expires until billing lifecycle and grace-period UX exist.
- Do not charge for invited-but-never-active users; extra-seat counting should use active organization members.
- Keep public restaurant guests/customers completely outside staff-seat billing.
- CI validates the regional matrix and fails if a draft row becomes public accidentally.

## Sources used for this draft

Public/official/current pages checked on 2026-08-17 include Last.app, Square Restaurants, Toast, Consumer Brazil, Saipos, CurryIQ, RestoPOS, DineMate, Billzova, Petpooja and Restroworks pricing/product pages, plus market wage sources used for sanity checking. This remains a commercial proposal, not a public price list.
