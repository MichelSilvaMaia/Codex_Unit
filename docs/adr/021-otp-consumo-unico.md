# ADR 021 — OTP com consumo único

## Decisão

O OTP tem seis dígitos gerados por CSPRNG, validade curta, limite de tentativas e cooldown de reenvio. O código nunca é persistido: somente HMAC-SHA-256 com segredo da aplicação e identificador do desafio. Destinos são mascarados e armazenados também como hash.

A validação usa comparação constante, transação `SERIALIZABLE` e atualização condicional de estado. Replay, expiração, bloqueio e validações concorrentes falham de modo controlado. Um novo desafio invalida desafios pendentes anteriores da mesma retirada.

## Consequências

O segredo `OTP_HMAC_SECRET` deve ter pelo menos 32 caracteres e ser rotacionado por procedimento operacional; sua troca invalida desafios ainda pendentes.
