# ADR 015 — Reservas urgentes

## Decisão

Urgência é representada por `isUrgent` e `urgentReason`, sem enum de prioridade adicional. A justificativa é obrigatória na aplicação e por `CHECK` no PostgreSQL. Marcar ou remover urgência exige `reservations.mark_urgent` e gera auditoria. Ao remover, a justificativa permanece como evidência histórica.

Urgência altera destaque e ordenação, nunca disponibilidade, integridade, RBAC ou isolamento de tenant.
