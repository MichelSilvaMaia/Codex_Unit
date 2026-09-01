# Estado de validação das fases

## Fase 2 — VALIDADA EM POSTGRESQL

A cadeia real foi executada em PostgreSQL 17.11:

- migrations aplicadas;
- seed executado;
- hash de senha validado;
- membership e tenant ativos consultados;
- permissões carregadas do RBAC;
- isolamento cross-tenant comprovado contra o banco.

OAuth externo continua dependendo das credenciais dos respectivos provedores, sem afetar a validação da identidade local.

## Fase 3 — VALIDADA EM POSTGRESQL

A migration incremental e o seed operacional foram executados. O teste integrado confirmou isolamento real de Customer entre tenants.

## Fase 4 — VALIDADA EM POSTGRESQL

Reservas usam proteção PostgreSQL por exclusion constraint. O teste concorrente real comprovou que, entre duas transações simultâneas conflitantes, apenas uma vence e a outra recebe conflito controlado.

## Fase 5 — VALIDADA EM POSTGRESQL

O workflow de aprovação, autoaprovação explícita do gerente, reprovação motivada e urgência auditável foram implementados. A predicate GiST foi migrada para `PENDING_APPROVAL`, `APPROVED` e `CONFIRMED`. Testes reais comprovam exclusão temporal e decisão concorrente `approve × reject` com apenas um vencedor.
