# Mandy’s — Backlog mestre de 170 tarefas

> Fonte de verdade do desenvolvimento autônomo do Mandy’s.
> Atualizado em 2026-08-19. Uma tarefa só recebe `[x]` quando está completamente implementada e certificada pelos testes aplicáveis (incluindo E2E/live quando necessário).

## Legenda

- `[x]` — completamente concluída e certificada
- `[ ]` — pendente, em implementação ou ainda não totalmente certificada

## Progresso atual

**10 / 170 concluídas (5,9%)**

As tarefas **1–10** estão completamente concluídas. A certificação final do sprint 6–10 terminou com **CI = success** e **Performance 6–10 live QA = success**. As tarefas 11–170 permanecem abertas até validação completa.

## 1–10 — Performance inicial

- [x] **1.** Baseline de performance e instrumentação
- [x] **2.** Eliminar waterfall do Dashboard / bootstrap único
- [x] **3.** Cache do Storefront
- [x] **4.** Eliminar leituras duplicadas do Storefront
- [x] **5.** Cache cliente do Backoffice com dedupe/invalidação
- [x] **6.** Prefetch de navegação
- [x] **7.** Optimistic UI com rollback
- [x] **8.** Reduzir/reutilizar chamadas de sessão e contexto
- [x] **9.** Otimizar gateways operacionais / Netlify Edge
- [x] **10.** Analisar queries SQL críticas com EXPLAIN/índices baseados em evidência

## 11–20 — Performance e UX base

- [ ] **11.** Reduzir payloads e adicionar paginação
- [ ] **12.** Reduzir cold starts
- [ ] **13.** Skeleton/loading states
- [ ] **14.** Transições de navegação
- [ ] **15.** Empty states
- [ ] **16.** Erros e retry UX
- [ ] **17.** Sistema consistente de toasts
- [ ] **18.** Backoffice mobile completo
- [ ] **19.** Experiência tablet
- [ ] **20.** Acessibilidade

## 21–30 — Conta, onboarding e configurações

- [ ] **21.** Consistência geral da UI
- [ ] **22.** Perfil do utilizador
- [ ] **23.** Alteração de password
- [ ] **24.** Recuperação/reset de password
- [ ] **25.** Verificação de email
- [ ] **26.** Sessões/dispositivos
- [ ] **27.** Checklist de onboarding
- [ ] **28.** Onboarding retomável
- [ ] **29.** Validações completas do onboarding
- [ ] **30.** UX de horários especiais/feriados

## 31–40 — Operação e conformidade

- [ ] **31.** Áreas e mesas completas
- [ ] **32.** UX completa de equipa
- [ ] **33.** Audit log utilizável no Backoffice
- [ ] **34.** Central de notificações
- [ ] **35.** UX de proteção/exportação/exclusão de dados
- [ ] **36.** Limpeza do estado/demo
- [ ] **37.** Performance visual do Storefront
- [ ] **38.** Otimização de imagens
- [ ] **39.** SEO completo
- [ ] **40.** Páginas e estrutura legal

## 41–50 — Storefront e Menu

- [ ] **41.** Contactos e redes sociais
- [ ] **42.** QR Code do restaurante/menu
- [ ] **43.** Preview do Storefront
- [ ] **44.** Drafts de menu
- [ ] **45.** Personalização do tema
- [ ] **46.** Preview de temas
- [ ] **47.** Drag-and-drop do menu
- [ ] **48.** Duplicar categorias/itens
- [ ] **49.** Disponibilidade de itens por horário
- [ ] **50.** Variantes de produtos

## 51–60 — Menu e Reservas avançadas

- [ ] **51.** Modifiers/extras
- [ ] **52.** Sold-out/indisponibilidade rápida
- [ ] **53.** Importação/exportação CSV
- [ ] **54.** Calendário de reservas
- [ ] **55.** Floor plan visual
- [ ] **56.** Walk-ins
- [ ] **57.** Duração configurável de reservas
- [ ] **58.** Mover reserva de mesa
- [ ] **59.** Juntar mesas
- [ ] **60.** UX para conflitos de reserva

## 61–70 — Reservas, CRM e Eventos

- [ ] **61.** Confirmação/cancelamento público de reserva
- [ ] **62.** Converter waitlist em reserva
- [ ] **63.** Prioridade da waitlist
- [ ] **64.** Tags de clientes
- [ ] **65.** Preferências, alergias e observações
- [ ] **66.** Timeline completa do cliente
- [ ] **67.** Merge de clientes duplicados
- [ ] **68.** Segmentação CRM
- [ ] **69.** Ferramentas GDPR do CRM
- [ ] **70.** UX completa de Events

## 71–80 — Eventos e Takeaway

- [ ] **71.** Formulário público de eventos
- [ ] **72.** Notas e tarefas de eventos
- [ ] **73.** Ligação Events ↔ CRM
- [ ] **74.** Propostas de evento
- [ ] **75.** Geração de PDF
- [ ] **76.** Polish do carrinho
- [ ] **77.** Modifiers no pedido
- [ ] **78.** Horários específicos de takeaway
- [ ] **79.** Capacidade máxima por slot
- [ ] **80.** Tracking do pedido pelo cliente

## 81–90 — Kitchen e Stock

- [ ] **81.** Kitchen workflow completo
- [ ] **82.** Cancelamento de pedidos
- [ ] **83.** Recibo/comprovativo
- [ ] **84.** UX completa do inventário
- [ ] **85.** CRUD de fornecedores
- [ ] **86.** UX de receitas/fichas técnicas
- [ ] **87.** Stock teórico
- [ ] **88.** Contagens físicas
- [ ] **89.** Desperdícios/quebras
- [ ] **90.** Alertas de stock

## 91–100 — Custos e Insights

- [ ] **91.** Histórico de custos
- [ ] **92.** Food cost
- [ ] **93.** Margem por produto
- [ ] **94.** Performance do módulo Insights
- [ ] **95.** Insights de reservas
- [ ] **96.** Menu engineering
- [ ] **97.** Insights de CRM
- [ ] **98.** Insights de pedidos
- [ ] **99.** Insights de stock
- [ ] **100.** Comparações entre períodos

## 101–110 — Billing, Trials e Email

- [ ] **101.** Página de planos
- [ ] **102.** Ciclo completo de trial
- [ ] **103.** Entitlements em runtime
- [ ] **104.** Preços regionais
- [ ] **105.** Testes Stripe em test mode
- [ ] **106.** Idempotência de webhooks
- [ ] **107.** Teste do portal de billing
- [ ] **108.** Emails nos quatro idiomas
- [ ] **109.** UI de outbox/emails
- [ ] **110.** Retry/backoff do email worker

## 111–120 — Media, PWA e Segurança

- [ ] **111.** UX de uploads
- [ ] **112.** Validação segura de media
- [ ] **113.** Crop/redimensionamento
- [ ] **114.** Experiência de instalação PWA
- [ ] **115.** Cache de assets
- [ ] **116.** Comportamento offline
- [ ] **117.** Prompt de atualização da PWA
- [ ] **118.** Regression suite de RLS
- [ ] **119.** E2E completo dos roles
- [ ] **120.** Rate limiting

## 121–130 — Hardening, Observabilidade e Admin

- [ ] **121.** CSP
- [ ] **122.** Hardening de cookies/sessão
- [ ] **123.** Dependências + secret scanning
- [ ] **124.** Remover funções temporárias/teste
- [ ] **125.** Health dashboard
- [ ] **126.** Logs de latência
- [ ] **127.** IDs rastreáveis de erros
- [ ] **128.** Alertas operacionais
- [ ] **129.** Lista de tenants no Mandy's Admin
- [ ] **130.** Estado/status dos tenants

## 131–140 — Admin, Domínios e Loyalty

- [ ] **131.** Gerir entitlements pelo Admin
- [ ] **132.** Health/usage por tenant
- [ ] **133.** Impersonation segura
- [ ] **134.** Audit do Super Admin
- [ ] **135.** Modelo de custom domains
- [ ] **136.** Backend de DNS/domínios
- [ ] **137.** UI de domínio personalizado
- [ ] **138.** Redirects/canonical domain
- [ ] **139.** Modelo de Loyalty
- [ ] **140.** Sistema de pontos

## 141–150 — Loyalty, IA e Multi-location

- [ ] **141.** Rewards/recompensas
- [ ] **142.** Backoffice de Loyalty
- [ ] **143.** Autenticação/autorização para AI
- [ ] **144.** Camada AI independente de fornecedor
- [ ] **145.** Tradução com AI
- [ ] **146.** Resumo diário inteligente
- [ ] **147.** Q&A sobre reservas
- [ ] **148.** Análise AI de menu/margens
- [ ] **149.** Modelo multi-location
- [ ] **150.** Seletor de localização

## 151–160 — Multi-location e E2E

- [ ] **151.** Permissões por localização
- [ ] **152.** Overrides por localização
- [ ] **153.** Dashboard consolidado
- [ ] **154.** E2E Owner
- [ ] **155.** E2E Manager
- [ ] **156.** E2E Reception
- [ ] **157.** E2E Kitchen/Staff
- [ ] **158.** E2E Marketing/Accounting
- [ ] **159.** E2E completo em pt-PT, pt-BR, en e es
- [ ] **160.** E2E responsivo mobile/tablet/desktop

## 161–170 — Certificação final e Release

- [ ] **161.** Thresholds automáticos de performance
- [ ] **162.** Testes de concorrência de reservas
- [ ] **163.** Concorrência de pedidos
- [ ] **164.** Limpeza automática dos dados criados por E2E
- [ ] **165.** Seed/demo oficial
- [ ] **166.** Documentação para piloto
- [ ] **167.** Release checklist
- [ ] **168.** Procedimento e teste de rollback
- [ ] **169.** Validação de backup/restore
- [ ] **170.** Release final com zero erros críticos nos logs

## Regra para atualizar este ficheiro

1. Nunca marcar uma tarefa como concluída apenas porque o código foi escrito ou compilou.
2. Exigir os testes adequados à tarefa: lint/typecheck/unit/build/security e E2E focado; para alterações de runtime/UX, exigir também E2E/live em produção quando aplicável.
3. Não enfraquecer RLS, isolamento por `organization_id`, roles, entitlements ou comportamento fail-closed para obter testes verdes.
4. Tarefas que dependem de decisão/credencial/ativação do utilizador podem ficar bloqueadas, mas não impedem avançar nas tarefas independentes.
5. Atualizar o checkbox somente depois da certificação completa.
