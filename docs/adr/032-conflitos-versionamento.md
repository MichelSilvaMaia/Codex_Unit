# ADR-032 — Conflito e versionamento

## Decisão

`MaintenanceOrder.version` aumenta por trigger em atualizações da ordem e inserções de diagnóstico, atividade ou evidência. A sincronização compara `expectedVersion` usando `UPDATE ... WHERE version = expectedVersion` dentro de transação serializável. Não existe last-write-wins nem merge automático. A UI mostra conflito e orienta revisar o registro no servidor.

Versões de Pickup/Return e suas operações offline ainda não foram implantadas; por isso essas mutações não podem ser enfileiradas nesta entrega.
