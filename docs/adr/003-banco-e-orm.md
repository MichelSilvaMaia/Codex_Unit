# ADR-003 — Banco e ORM

## Contexto

Reservas exigirão transações, integridade referencial, índices e controle de concorrência.

## Decisão

Usar PostgreSQL 17 e Prisma 6.19.3 com migrations SQL versionadas e UUIDs públicos.

## Alternativas consideradas

- Banco documental: pior aderência aos relacionamentos e invariantes transacionais.
- IDs incrementais: facilitam enumeração e expõem volume.
- Sincronização destrutiva de schema: inadequada para produção.

## Consequências

Mudanças estruturais exigem migration revisável. Constraints e índices complementam as validações da aplicação.
