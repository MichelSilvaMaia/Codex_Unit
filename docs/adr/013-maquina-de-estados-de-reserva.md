# ADR 013 — Máquina de estados inicial de reserva

## Status

Aceita.

## Decisão

Estados iniciais: `DRAFT`, `PENDING`, `CONFIRMED` e `CANCELLED`. Transições permitidas:

- `DRAFT → PENDING | CANCELLED`;
- `PENDING → CONFIRMED | CANCELLED`;
- `CONFIRMED → CANCELLED`.

`DRAFT` e `CANCELLED` não bloqueiam disponibilidade. Toda transição atualiza itens, cria `ReservationStatusHistory` e registra auditoria na mesma transação.

## Consequências

Não há atualização arbitrária de status nem reativação de cancelamento. A Fase 5 poderá ampliar a tabela de transições com aprovação e urgência sem substituir o mecanismo.
