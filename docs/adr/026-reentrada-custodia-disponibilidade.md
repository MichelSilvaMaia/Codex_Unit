# ADR 026 — Reentrada de custódia e disponibilidade

`RETURNED` encerra custódia física; não existe `FINALIZED` nesta fase. A conclusão acrescenta `RETURNED_TO_TENANT` sem sobrescrever a saída anterior. O intervalo planejado `startAt/endAt` permanece histórico e o instante real fica em `ReservationReturn.completedAt`.

`RETURNED` não integra a predicate GiST bloqueante. Assim, retorno antecipado pode liberar disponibilidade temporal sem falsificar o contrato. A condição física continua separada: apenas recursos `AVAILABLE` podem ser selecionados para nova reserva.
