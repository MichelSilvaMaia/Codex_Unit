# ADR 016 — Consistência entre estados e disponibilidade

## Decisão

A fonte central da aplicação e a predicate PostgreSQL usam os mesmos estados bloqueantes: `PENDING_APPROVAL`, `APPROVED` e `CONFIRMED`. `DRAFT`, `REJECTED` e `CANCELLED` não bloqueiam.

A migration incremental renomeia o valor antigo e, em transação posterior, recria `ReservationItem_no_blocking_overlap`. A separação é obrigatória no PostgreSQL porque um novo valor de enum não pode ser usado com segurança antes do commit que o introduziu. Testes integrados comprovam bloqueio em pendência/aprovação e liberação após rejeição.
