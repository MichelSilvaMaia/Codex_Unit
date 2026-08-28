# ADR-002 — Estratégia multi-tenant

## Contexto

Usuários podem participar de múltiplas empresas e nenhum dado pode atravessar a fronteira entre tenants.

## Decisão

Manter identidade global em `User`, empresa em `Tenant` e vínculo em `TenantMembership`. O tenant ativo é resolvido no servidor pela combinação usuário autenticado + slug solicitado + membership ativa.

## Alternativas consideradas

- Banco por tenant: isolamento forte, mas custo operacional prematuro.
- `tenantId` fornecido pelo cliente: inseguro sem validação de membership.
- Usuário duplicado por empresa: impede identidade multiempresa limpa.

## Consequências

Toda entidade tenant-aware deverá conter `tenantId` e toda consulta deverá receber um `TenantContext` confiável. Testes negativos de acesso cruzado são obrigatórios.
