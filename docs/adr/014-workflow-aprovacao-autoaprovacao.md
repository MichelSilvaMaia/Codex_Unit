# ADR 014 — Workflow de aprovação e autoaprovação

## Decisão

`PENDING` foi renomeado para `PENDING_APPROVAL`, pois já representava a mesma etapa. O fluxo é `DRAFT → PENDING_APPROVAL → APPROVED → CONFIRMED`, com rejeição em `PENDING_APPROVAL → REJECTED`, reabertura explícita `REJECTED → DRAFT` e cancelamento dos estados ativos. Campos críticos só podem ser editados em `DRAFT`.

Usuários com `reservations.approve` podem aprovar reservas próprias. `createdBy`, `submittedBy`, `approvedBy`, timestamps, histórico e `ReservationApproval` tornam essa autoaprovação auditável. A decisão concorrente usa atualização condicionada ao estado dentro de transação `SERIALIZABLE`; somente uma decisão vence.
