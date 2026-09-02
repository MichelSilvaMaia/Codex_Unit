# ADR 024 — Devolução integral e atômica

Uma retirada concluída pode possuir várias tentativas de devolução, mas apenas uma ativa e apenas uma concluída. A conclusão reconcilia todos os itens na mesma transação `SERIALIZABLE`: devolução, reserva, recursos, histórico, custódia e auditoria avançam juntos ou sofrem rollback. Recurso não apresentado mantém a tentativa em andamento e continua `IN_USE`.

Devolução danificada nunca é recusada fisicamente. Ela recupera custódia e direciona o recurso para estado operacional seguro.
