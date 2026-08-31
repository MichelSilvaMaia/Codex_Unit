# ADR 009 — Segurança de sessão

## Status

Aceita.

## Decisão

Sessões JWT têm duração de oito horas e carregam apenas identidade mínima. O estado ativo do usuário é consultado novamente no servidor, e permissões são carregadas do banco para cada contexto autorizado. Logout invalida o cookie de sessão do navegador; eventos relevantes geram auditoria.

## Consequências

Desativar usuário, tenant ou membership interrompe o acesso sem esperar uma lista de permissões em cache expirar. O custo adicional de consulta é aceito nesta fase em favor de consistência e revogação imediata.
