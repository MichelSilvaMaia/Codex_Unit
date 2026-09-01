# ADR 011 — Intervalos temporais e timezone

## Status

Aceita.

## Decisão

Reservas usam intervalos semiabertos `[startAt, endAt)`: início inclusivo e término exclusivo. Instantes são persistidos como `TIMESTAMPTZ` em UTC. Cada tenant possui um timezone IANA, inicialmente `America/Sao_Paulo`, usado para converter entradas locais antes da persistência e para apresentação.

## Consequências

Duas reservas podem se tocar no limite. Alterar o timezone do tenant muda somente a representação, nunca os instantes persistidos. Horários locais inválidos em transições de horário oficial são rejeitados.
