# ADR 020 — Aceite vinculado à tentativa de retirada

## Decisão

Cada `PickupAcceptance` pertence a exatamente uma `ReservationPickup`. Assinatura e OTP produzem o mesmo fato de domínio, mas seus artefatos são armazenados separadamente. Uma tentativa recusada permanece histórica e seu aceite nunca satisfaz uma tentativa posterior.

Somente um aceite `VERIFIED` é permitido por retirada. A garantia definitiva é um índice único parcial no PostgreSQL; verificações da aplicação existem apenas para mensagens e autorização.

## Consequências

- a conclusão da retirada exige aceite verificado da própria tentativa ainda `IN_PROGRESS`;
- a assinatura é privada, possui checksum e metadados, e não é armazenada como URL pública;
- corrida entre assinatura e OTP tem somente um vencedor no banco.
