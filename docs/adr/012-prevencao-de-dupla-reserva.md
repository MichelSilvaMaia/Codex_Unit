# ADR 012 — Prevenção de dupla reserva

## Status

Aceita.

## Decisão

`ReservationItem` replica o período principal da reserva para permitir uma exclusion constraint PostgreSQL GiST sobre tenant, recurso e `tstzrange(startAt, endAt, '[)')`. A constraint parcial considera somente itens `PENDING` ou `CONFIRMED`. Operações críticas também usam transações `SERIALIZABLE` e uma consulta prévia apenas para feedback amigável.

## Alternativas

Um simples `SELECT` antes do `INSERT` foi rejeitado por possuir race condition. Locks explícitos por recurso seriam corretos, mas ampliariam a lógica de ordenação e risco de deadlock. A exclusion constraint expressa diretamente a invariável no banco.

## Consequências

A migration usa `btree_gist` e SQL que o Prisma Schema não representa. Violações são convertidas em `CONFLICT`. Cancelar uma reserva altera os itens para `CANCELLED`, removendo-os imediatamente do predicado da constraint.
