# Estado de validação das fases

## Fase 2 — VALIDADA EM POSTGRESQL

A cadeia real foi executada em PostgreSQL 17.11:

- migrations aplicadas;
- seed executado;
- hash de senha validado;
- membership e tenant ativos consultados;
- permissões carregadas do RBAC;
- isolamento cross-tenant comprovado contra o banco.

OAuth externo continua dependendo das credenciais dos respectivos provedores, sem afetar a validação da identidade local.

## Fase 3 — VALIDADA EM POSTGRESQL

A migration incremental e o seed operacional foram executados. O teste integrado confirmou isolamento real de Customer entre tenants.

## Fase 4 — VALIDADA EM POSTGRESQL

Reservas usam proteção PostgreSQL por exclusion constraint. O teste concorrente real comprovou que, entre duas transações simultâneas conflitantes, apenas uma vence e a outra recebe conflito controlado.

## Fase 5 — VALIDADA EM POSTGRESQL

O workflow de aprovação, autoaprovação explícita do gerente, reprovação motivada e urgência auditável foram implementados. A predicate GiST foi migrada para `PENDING_APPROVAL`, `APPROVED` e `CONFIRMED`. Testes reais comprovam exclusão temporal e decisão concorrente `approve × reject` com apenas um vencedor.

## Fase 6 — VALIDADA EM POSTGRESQL

Retiradas usam tentativas `1:N`, checklist integral, recusa sem cancelamento comercial, custódia por recurso e apenas uma conclusão por reserva. Migration, constraint parcial, transação atômica e dupla conclusão concorrente foram comprovadas em PostgreSQL real.

## Fase 7 — VALIDADA EM POSTGRESQL

Aceite por assinatura desenhada ou OTP multicanal foi vinculado à tentativa específica de retirada. O código OTP é armazenado somente como HMAC, possui expiração, limite e consumo único. Testes concorrentes reais comprovaram: replay rejeitado; apenas um vencedor ao validar o mesmo OTP; apenas um aceite final na corrida assinatura × OTP; e impossibilidade de reaproveitar aceite de retirada recusada.

## Fase 7.1 — PARCIAL: CÓDIGO CONCLUÍDO, HOMOLOGAÇÃO EXTERNA PENDENTE

Adapters Zenvia v2 para WhatsApp com template aprovado e SMS, adapter Resend com idempotência, fallback sequencial, timeouts e webhooks autenticados foram implementados. Migration e mocks estão validados, mas nenhum envio real foi executado sem credenciais externas. A pendência não bloqueia a Fase 8.

## Fase 8 — VALIDADA EM POSTGRESQL

Devolução integral, inspeção por recurso, evidência de irregularidade, reentrada de custódia e disposition operacional foram implementadas. Constraints parciais e transação serializável impedem dupla devolução; testes reais comprovam concorrência, rollback, avaria aceita, recurso ausente e preservação do período planejado. O seed visual agora usa `VEICULO/VEH-001`.
# FASE 9 — CONCLUÍDA — VALIDADA EM POSTGRESQL

- Ordens de manutenção, diagnóstico, atividades, evidências e histórico tenant-safe.
- Uma ordem ativa por recurso garantida por índice parcial PostgreSQL.
- Devolução irregular e ordem de manutenção atômicas.
- Conclusão técnica separada da liberação operacional explícita.
- Central de manutenção responsiva e modernização do shell visual compartilhado.

FASE 7.1 permanece **PARCIAL — homologação externa Zenvia/Resend pendente**.

## Fase 10 — PARCIAL: infraestrutura PWA e sincronização inicial de manutenção

Manifesto, service worker de shell público, IndexedDB versionado, fila com Web Locks, indicador de conectividade, central `/sync`, recibo idempotente PostgreSQL e conflito por versão foram implementados. Apenas diagnóstico/intervenção de manutenção podem ser guardados no dispositivo. Retirada, devolução, assinatura, evidências e OTP não possuem fluxo offline aprovado nesta entrega. A inspeção visual automática em desktop/tablet/mobile e homologação de instalação também estão pendentes. Fase 7.1 continua PARCIAL independentemente desta fase.

### Fase 10.1 — entrega incremental de recuperação da fila

Sob o mutex entre abas, operações interrompidas em `SYNCING` retornam a `FAILED_RETRYABLE` antes do envio. Resposta 401 mantém a intenção local em `AUTH_REQUIRED`, sem backoff nem descarte; uma nova sincronização após login pode retomá-la. A central mostra tentativas, último erro e quantidade de anexos locais pendentes. Os 101 testes anteriores continuam como baseline; há testes adicionais para recuperação/401 e exclusão entre abas.

**Ainda PARCIAL:** não foi implementado nem homologado o fluxo offline completo de Pickup/Return, assinatura, upload de evidências, quota/persistência, snapshots privados, instalação PWA, visual QA ou modo avião. Nenhuma conclusão de custódia deve ser inferida de uma captura local. A Fase 7.1 permanece PARCIAL pela homologação externa.
