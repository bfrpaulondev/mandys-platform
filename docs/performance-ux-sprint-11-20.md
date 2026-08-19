# Mandy’s — Sprint 11–20: Performance e UX base

Implementação preparada em 2026-08-19.

## Escopo

- **11 — Payloads/paginação:** CRM já paginado; pedidos e notificações passam a usar `limit=25&offset=...`, backend limita cada página a no máximo 50 registos e devolve `hasMore`. Prefetch operacional também usa páginas pequenas.
- **12 — Cold starts:** depois da sessão ficar pronta, o backoffice aquece em background os health endpoints de menu, reservas, CRM, pedidos, stock e notificações, sem bloquear render ou navegação.
- **13 — Skeleton/loading:** estados reutilizáveis em `@mandys/ui` e `loading.tsx` no segmento autenticado.
- **14 — Transições:** indicador não bloqueante de mudança de rota, com desativação efetiva para `prefers-reduced-motion`.
- **15 — Empty states:** componente reutilizável com título, descrição e ação opcional; aplicado às listas paginadas críticas.
- **16 — Error/retry:** `error.tsx`, estado reutilizável de erro e retry local nas listas.
- **17 — Toasts:** provider único com success/error/info e rollback comunicado por toast.
- **18 — Mobile:** navegação colapsável, alvos de toque de 44px, cards sem overflow e layout sem scroll horizontal involuntário.
- **19 — Tablet:** navegação própria abaixo de 1280px em grid responsivo e conteúdo fluido.
- **20 — Acessibilidade:** skip-link, `aria-current`, `aria-expanded`, `aria-pressed`, `aria-busy`, live regions, foco visível e reduced motion.

## Certificação exigida antes de fechar o backlog

As tarefas 11–20 permanecem `[ ]` até o commit passar o pipeline aplicável em `main`, incluindo quality/build, smoke/live readiness e browser E2E. O E2E do sprint verifica paginação, optimistic rollback, toasts, tablet/mobile, touch target, ausência de overflow horizontal e skip-link.
