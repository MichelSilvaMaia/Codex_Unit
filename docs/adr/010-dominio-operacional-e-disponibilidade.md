# ADR 010 — Domínio operacional e disponibilidade temporal

## Status

Aceita.

## Decisão

Unidades, clientes, contatos, endereços, contratos, categorias e recursos pertencem diretamente a um tenant. Relações críticas repetem `tenantId` e usam chaves estrangeiras compostas, impedindo no banco a associação de registros de tenants diferentes. Contratos podem se limitar explicitamente a unidades por `ContractUnit`; ausência de vínculos significa aplicabilidade geral dentro do tenant.

`Resource` representa nesta fase um ativo individualizado. Seu status administrativo é separado do estado operacional (`AVAILABLE`, `MAINTENANCE`, `UNAVAILABLE`, `RETIRED`). Não existe `RESERVED`, porque reserva e disponibilidade dependem de intervalo.

## Consequências

A Fase 4 deverá modelar `Reservation` e `ReservationItem`, definir semântica de intervalos e timezone e impedir dupla reserva com garantia transacional no PostgreSQL. Quantidades agregadas, atributos customizáveis e estoque não são antecipados nesta fase.
