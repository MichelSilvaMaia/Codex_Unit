# ADR 008 — Contexto de tenant ativo

## Status

Aceita.

## Decisão

O tenant ativo é representado por cookie assinado, `HttpOnly`, `SameSite=Lax` e seguro em produção. A seleção aceita somente uma membership ativa do usuário e um tenant ativo. Todas as leituras posteriores revalidam usuário, membership e tenant no servidor.

## Consequências

IDs enviados pelo cliente não constituem autorização. Acesso cruzado deve responder como recurso inexistente, reduzindo enumeração de tenants.
