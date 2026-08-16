# Development workflow

1. Branch from `main`.
2. Keep changes inside a clear product boundary.
3. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` before merge.
4. Never weaken tenant filters, RLS or cache rules to make a feature easier to implement.
5. Add a domain event for business changes that future automation, analytics or AI may need.
6. Keep public storefront presentation separate from domain logic so themes remain replaceable.
7. Add translations for all four V0.1 locales when introducing user-facing product copy.
8. Do not add paid template code or assets to the repository unless redistribution rights have been reviewed for this product model.
