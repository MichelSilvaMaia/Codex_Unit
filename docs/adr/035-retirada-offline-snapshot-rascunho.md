# ADR-035 — Snapshot e rascunho local da retirada (entrega inicial da 10.3)

## Contexto

`ReservationPickup` ainda não possui versão otimista e o recibo de evidências da 10.2 autoriza somente `MaintenanceEvidence`. Assinatura online cria `PickupAcceptance` e `AcceptanceSignature` em uma única operação, mas não possui chave de idempotência para replay de Blob offline. Ativar `PICKUP_COMPLETE` neste estado permitiria uma cadeia parcialmente confirmada sem recuperação segura.

## Decisão nesta entrega

O IndexedDB v3 adiciona `offlinePickupSnapshots`, com chave composta `(tenantId, userId, pickupId)`. A página autenticada guarda apenas o contexto mínimo: reserva, destinatário, itens, identificação dos recursos, data de atualização do servidor, termos com versão/hash/texto e permissões conhecidas. Um rascunho separado registra destinatário, inspeção e observações. Se já há rascunho, um novo carregamento **não** troca silenciosamente sua data-base nem os termos. O rascunho nunca altera `Pickup`, `Resource` ou custódia no servidor.

O formulário online de inspeção, aceite, OTP e conclusão fica indisponível quando o health check indica ausência de conexão. OTP nunca é gerado ou enfileirado localmente. Não se oferece assinatura offline até existir processamento idempotente, validação de termos e ACK server-side. O texto de termos guardado é somente referência para revisão; se destinatário ou condições mudarem, deve ser regenerado antes de assinar.

## Cadeia necessária para fechar a 10.3

1. Versão otimista da retirada e revalidação de reserva, recursos e permissões.
2. Upload de `OperationalEvidence` pelo motor 10.2 com recibo específico.
3. Assinatura Blob com idempotência, termos versionados e corrida segura contra OTP/assinatura online.
4. `completePickup()` existente somente após evidências e aceite confirmados; ACK final e cleanup.
5. Abertura segura de snapshot após fechar/reabrir o PWA sem expor dados entre contas, mais QA em navegador/dispositivo real.

Até isso existir, o rascunho local não representa aceite, retirada concluída nem custódia. `completedAt` oficial e eventos de custódia continuarão usando o relógio do servidor.
