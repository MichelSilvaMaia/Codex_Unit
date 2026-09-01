# ADR 017 — Tentativas de retirada e cadeia de custódia

Uma reserva possui `1:N ReservationPickup`: uma tentativa recusada não impede nova tentativa, mas um índice parcial garante no máximo uma `COMPLETED`. A retirada é integral e atômica; `PickupItem` prepara evolução futura sem permitir custódia parcial. A conclusão atualiza reserva, itens, recursos, histórico, auditoria e um evento de custódia por recurso na mesma transação `SERIALIZABLE`.
