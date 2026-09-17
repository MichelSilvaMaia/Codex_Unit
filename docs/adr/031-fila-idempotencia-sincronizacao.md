# ADR-031 — Fila local, idempotência e sincronização

## Decisão

IndexedDB possui stores versionadas para operações, anexos e metadados. O payload operacional não usa `localStorage`. Cada operação recebe UUID de cliente e device UUID pseudônimo. O servidor registra `ClientOperation` com unicidade `(tenantId, clientOperationId)` no mesmo commit da mutação. Reenvio idêntico consulta o recibo; reuso com payload, usuário ou dispositivo diferentes é conflito.

A fila usa Web Locks para impedir sincronização simultânea entre abas. Onde Web Locks não existir, ela não envia automaticamente — opção conservadora até haver fallback de lock testado. Erros transitórios recebem backoff; 401 pausa; 409 permanece como conflito; 400/403/404 permanecem rejeitados. Limpeza local só ocorre após ACK e resolução das dependências.
