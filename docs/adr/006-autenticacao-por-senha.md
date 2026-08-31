# ADR 006 — Autenticação por senha

## Status

Aceita.

## Decisão

Credenciais locais ficam separadas de `User`. Senhas usam bcrypt com custo 12 e nunca são registradas em logs. O login retorna falha genérica, limita tentativas por e-mail e IP e exige usuário ativo. Tokens de recuperação são aleatórios, persistidos como SHA-256, expiram e só podem ser consumidos uma vez.

Google e Microsoft são provedores opcionais. Uma conta externa só entra se o e-mail já corresponder a um usuário ativo, evitando provisionamento e acesso implícitos.

## Consequências

O seed não contém senha padrão. Produção deve fornecer segredos, transporte HTTPS, um limitador distribuído e um canal de e-mail antes de liberar recuperação e convites ao público.
