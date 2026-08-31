# ADR 007 — RBAC por capacidades

## Status

Aceita.

## Decisão

Papéis agregam permissões explícitas e memberships recebem papéis. Os papéis iniciais são Tenant Admin, Manager, Supervisor e Operator. A autorização é feita por capacidade, é negada por padrão e sempre restringe o papel ao tenant da membership.

## Consequências

Novas ações precisam declarar uma permissão no catálogo, adicioná-la por migration/seed e verificá-la no servidor. Nomes de papéis não devem aparecer como regras de negócio espalhadas pela aplicação.
