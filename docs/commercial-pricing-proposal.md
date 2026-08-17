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

India should be treated as a separate purchasing-power market rather than converted mechanically from EUR/USD. This band is intentionally marked candidate until direct local competitor validation is complete.

| Plan | Monthly | Annual | Included staff | Extra active staff/month |
|---|---:|---:|---:|---:|
| Start | ₹999 | ₹9,990 | 5 | ₹99 |
| Grow | ₹1,799 | ₹17,990 | 15 | ₹99 |
| Operate | ₹2,999 | ₹29,990 | 30 | ₹99 |
| Intelligence | ₹4,499 | ₹44,990 | 30 | ₹99 |
| Multi | ₹6,999 | ₹69,990 | 50/location | ₹99 |

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
- Toast US: restaurant POS starts at $69/month; one current restaurant/payroll bundle advertises $9 per employee/month for payroll.
- Consumer Brazil: R$59.90/month Essencial, R$179.90 Profissional, R$269.90 Alta Performance.
- Saipos Brazil: restaurant plans advertised from about R$240.79/month and explicitly without per-user charges.
- Petpooja India: public 2026 guidance places app/cloud POS software broadly around ₹1,000–₹3,000/month, with larger configurations costing more.

## Labour-cost sanity check

The extra-seat prices are deliberately small relative to restaurant labour costs:

- Portugal 2026 minimum monthly wage: €920. An extra Mandy's staff seat at €3.90 is about 0.42% of that monthly wage.
- Spain 2026 SMI: €1,221/month (17,094 €/year). €3.90 is about 0.32% of the stated monthly SMI.
- Brazil 2026 minimum wage: R$1,621/month. R$9.90 is about 0.61%.
- US 2025 BLS median restaurant wages are roughly $16.94/hour for waiters and $17.93/hour for restaurant cooks. $4.90/month is materially below payroll-style software pricing and should not discourage adding real team accounts.
- India restaurant staffing guidance shows wide wage dispersion by role and city; ₹99/month is intentionally kept small relative to common service/kitchen monthly wages.

## Rules for additional countries

Do not convert prices only by FX. Assign each country to a purchasing-power/competitive band using:

1. local restaurant software prices;
2. hospitality labour costs;
3. typical restaurant ticket/revenue levels;
4. local taxes and payment-provider costs;
5. support/localization cost.

Initial language-to-market mapping:
- `pt-PT`: Portugal and other EUR Portuguese-language operators where appropriate.
- `pt-BR`: Brazil, priced in BRL.
- `es`: Spain first; Latin-American markets get a dedicated local band rather than Spain EUR pricing.
- `en`: US first; UK, Canada, Australia, Ireland and India require their own currency/purchasing-power bands.

## Commercial guardrails before publishing

- Keep `saas_plans.is_public = false` and prices null in production until owner approval.
- Do not activate Stripe checkout before pricing, tax handling, refund/cancellation rules and webhook idempotency are approved.
- Do not silently downgrade or disable a restaurant when a trial expires until billing lifecycle and grace-period UX exist.
- Do not charge for invited-but-never-active users; extra-seat counting should use active organization members.
- Keep public restaurant guests/customers completely outside staff-seat billing.

## Sources used for this draft

Public/official pages checked on 2026-08-17: Last.app pricing, Square Restaurants pricing, Toast restaurant POS pricing, Consumer Brazil pricing, Saipos restaurant pricing, Portugal DGERT 2026 minimum wage, Spain BOE Real Decreto 126/2026, Brazil Decreto 12.797/2025, US Bureau of Labor Statistics Accommodation and Food Services wage data, and Petpooja/Restroworks 2026 India restaurant technology and labour guidance.
