# ADR-034 — Ciclo de anexos offline e upload idempotente

## Decisão

Evidência operacional de manutenção é o primeiro consumidor. A intenção de manutenção sincroniza pela rota existente e cria `ClientOperation`; cada foto é um Blob independente no IndexedDB v2, associado a essa intenção. Não há endpoint genérico de tabela, nem assinatura/OTP/Pickup/Return offline nesta fase.

| Estado | Significado | Próximo passo |
| --- | --- | --- |
| LOCAL | Blob capturado neste dispositivo | PENDING_UPLOAD |
| PENDING_UPLOAD | Intenção confirmada, aguardando envio | UPLOADING |
| UPLOADING | Request em curso sob Web Lock | SERVER_CONFIRMED ou falha |
| FAILED_RETRYABLE | Rede, timeout, 429, 5xx, interrupção | UPLOADING após backoff |
| AUTH_REQUIRED | Sessão expirada; Blob preservado | UPLOADING após novo login |
| FAILED_PERMANENT | 403/validação definitiva | revisão/descarte confirmado |
| CONFLICT | 409/checksum/propriedade divergente | revisão/descarte confirmado |
| SERVER_CONFIRMED | ACK com id, checksum e evidenceId | cleanup atômico quando TODOS confirmados |

O campo `domainConfirmed` na operação distingue a mutação de domínio aceita da confirmação completa dos anexos. Uma falha de upload nunca reenvia a mutação. `deleteSynced` valida todos os anexos no mesmo transaction IndexedDB que apaga JSON e Blobs. Um crash em `UPLOADING` é recuperado sob o mesmo Web Lock da fila. Operações locais legadas e AUTH_REQUIRED sobrevivem ao upgrade v1→v2; anexos legados sem status são lidos como LOCAL sem apagar o Blob.

## Servidor

`OfflineAttachmentReceipt` é único por `(tenantId, attachmentId)`. A rota de manutenção exige sessão, tenant, usuário, RBAC, recibo da intenção, ordem correspondente, tipo explícito, tamanho, magic bytes e SHA-256 recalculado. Mesmo ID com metadados/conteúdo diferente gera conflito. Um claim é gravado antes de chamar `StorageProvider`; após gravação, `MaintenanceEvidence`, auditoria e ACK do receipt são confirmados na mesma transação. Não há transação PostgreSQL aberta durante I/O do storage. O storage key é derivado exclusivamente de UUIDs validados; o cliente não escolhe caminho. Falha entre storage e banco tenta apagar o objeto e deixa claim recuperável; claim interrompido pode ser retomado após lease de 120 s. A confirmação do receipt dá ACK duplicado sem criar segunda evidência. Um upload por vez no cliente.

## Limitações e riscos

O storage local existente não é distribuído: produção multi-instância requer StorageProvider compartilhado. A compensação `delete` é best-effort; se storage estiver indisponível no rollback, um objeto órfão pode exigir reconciliação operacional. Sem concessão de `navigator.storage.persist`, o navegador pode liberar dados sob pressão; quota é estimativa, e falhas efetivas de IndexedDB são exibidas como não salvas. O Blob não é criptografado adicionalmente em repouso pelo aplicativo; isolamento é por origem/perfil de navegador e escopo tenant/user nas APIs locais, não proteção contra acesso físico ao mesmo perfil. Instalação PWA e QA visual em dispositivo real seguem pendentes na Fase 10.5.
