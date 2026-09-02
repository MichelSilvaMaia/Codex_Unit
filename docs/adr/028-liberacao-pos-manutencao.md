# ADR-028 — Liberação após manutenção

## Decisão

`COMPLETED` significa serviço tecnicamente concluído e não altera o recurso. A operação separada `releaseMaintenanceOrder` exige permissão, compare-and-set transacional e estado `COMPLETED`; somente então marca a ordem `RELEASED` e o recurso `AVAILABLE`.

Uma ordem liberada não é reaberta. Recorrências geram nova ordem e preservam o histórico.
