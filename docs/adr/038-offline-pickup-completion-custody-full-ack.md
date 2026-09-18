# ADR-038 — Offline Pickup Completion, Custody and Full ACK

Status: implementado funcionalmente na Fase 10.3.3; homologação em navegador/PWA real pendente.

## Intenção local e ordem

O operador salva destinatário e inspeção antes de anexos e assinatura. O IndexedDB v3 persiste `PICKUP_COMPLETE` com `clientOperationId`, `deviceId`, `pickupId`, `expectedVersion` e dependências explícitas. A intenção local nunca afirma `COMPLETED`: significa apenas “concluída neste dispositivo, aguardando sincronização”. O motor envia inspeção, evidências, assinatura/aceite e só então conclusão. Web Lock evita dois processadores locais, mas não substitui a concorrência PostgreSQL.

## Autoridade e atomicidade

O servidor deriva identidade, tenant, permissões, recursos e horários oficiais da sessão e do banco. Ele verifica o receipt da inspeção, recibos de evidências e assinatura, aceite verificado, checklist, reserva, estado dos recursos e `ReservationPickup.version`. A conclusão offline chama o mesmo `completePickup()` do fluxo online. Uma transação serializável faz compare-and-set da versão, altera Pickup/Reservation/Resource, cria eventos `RELEASED_TO_RECIPIENT`, audita e grava o receipt de conclusão. Índice parcial único impede duplicar a liberação de um mesmo recurso pela mesma tentativa.

## Idempotência, FULL ACK e limpeza

O receipt `ClientOperation` guarda hash da intenção, versão e retrato do FULL ACK na mesma transação. Um retry da mesma operação — inclusive após commit com resposta perdida — retorna esse resultado; outra operação não herda a idempotência. FULL ACK explicita Pickup `COMPLETED`, Resource(s) `IN_USE`, IDs de custódia, aceite, referência e horário server-side. Apenas após persistir esse ACK no IndexedDB, uma transação local única remove snapshot, operações relacionadas, Blobs de evidências e assinatura. Falha, 401, 403 e 409 preservam a cadeia; queda após ACK retoma a limpeza sem reenviar o domínio. `capturedAtDevice` é metadado informativo, não horário de custódia.

OTP e Return continuam online. A reconciliação de objetos externos órfãos permanece débito da 10.2. A homologação em Chrome/Edge/PWA real é separada dos testes de PostgreSQL e IndexedDB compatível.
