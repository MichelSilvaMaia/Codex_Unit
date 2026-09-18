# ADR-036 — Fechamento transacional do Pickup offline

Status: EM IMPLEMENTAÇÃO (FASE 10.3.1 parcial).

## Versionamento otimista

`ReservationPickup.version` começa em 1 e é incrementado em inspeção, recusa e conclusão. O snapshot local guarda `expectedVersion`. Inspeção e conclusão aceitam esse token opcional e fazem comparação atômica antes de alterar itens ou custódia; uma versão antiga gera `CONFLICT`. A migration `20260918100000_pickup_optimistic_version` foi aplicada ao PostgreSQL local. O IndexedDB permanece na versão 3 e o rascunho existente não é substituído silenciosamente.

## Limite desta entrega incremental

Ainda não há sincronização de Pickup, evidência de Pickup offline, assinatura offline, receipt de assinatura, FULL ACK nem limpeza após confirmação. O botão de conclusão e a assinatura seguem online-only; OTP permanece online-only. A UI não deve chamar um rascunho salvo de retirada concluída, e nenhuma custódia é criada a partir do rascunho.

Para fechar a fase, a cadeia deverá usar os serviços existentes e exigir `inspection → evidence → signature/acceptance → completePickup → FULL ACK → cleanup`, com revalidação de termos, idempotência persistente, concorrência PostgreSQL e recuperação de falhas entre cada etapa.
