# ADR-039 — Offline Return, Custody Reentry and Maintenance Integration

Status: implementação funcional da Fase 10.4; homologação em navegador/PWA real pendente.

Uma devolução carregada online é guardada no IndexedDB v4 por tenant, usuário e `returnId`. Inspeção, presença, condição, observações e Blobs SHA-256 formam uma intenção local; não alteram a custódia nem o Resource. `RETURN_COMPLETE` depende explicitamente da operação `RETURN_ATTACHMENTS`.

Na sincronização, o servidor confirma a inspeção por compare-and-set de `ReservationReturn.version`, persiste evidências com receipt idempotente e revalida sessão, tenant, RBAC, Pickup, Reservation, Return, itens, presença e estado dos recursos. O cliente nunca é autoridade da disposition. `completeReturn()` continua sendo o ponto único para calcular e aplicar `AVAILABLE`, `MAINTENANCE` ou `UNAVAILABLE`.

A transação serializável confirma Return e Reservation, altera Resources, cria `RETURNED_TO_TENANT`, cria MaintenanceOrder quando a disposition é `MAINTENANCE`, audita e grava o receipt com FULL ACK. A falha de qualquer efeito reverte todos. Transporte at-least-once mais receipt transacional produz um único efeito lógico; resposta perdida recupera o mesmo ACK. Uma constraint parcial impede duas reentradas para o mesmo recurso/devolução.

O FULL ACK contém estados, referências de custódia e ordens de manutenção. Somente depois dele uma única transação IndexedDB remove snapshot, draft, operações e Blobs. 401, 403, conflito ou falha de rede preservam os dados. Horários locais são informativos; conclusão e custódia usam o relógio do servidor.
