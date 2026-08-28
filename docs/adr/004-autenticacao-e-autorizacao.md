# ADR-004 — Autenticação e autorização

## Contexto

A fundação deve suportar múltiplos métodos de login e RBAC futuro sem implementar credenciais inseguras nesta fase.

## Decisão

Usar Auth.js/NextAuth 4 com sessão JWT e página de login própria. Nenhum provider será ativado até a fase de autenticação definir senha, recuperação e MFA. Autorização será baseada em capacidades e vinculada à membership.

## Alternativas consideradas

- Autenticação própria completa agora: amplia o escopo e o risco.
- Role única no usuário: não representa permissões diferentes por tenant.

## Consequências

Rotas e helpers existem, mas login real ainda não está funcional. A matriz Role → Permission será adicionada sem alterar a identidade global ou o vínculo multiempresa.
