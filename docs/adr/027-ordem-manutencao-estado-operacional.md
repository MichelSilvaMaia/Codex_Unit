# ADR-027 — Ordem de manutenção e estado operacional

## Decisão

`Resource.operationalStatus` permanece um snapshot. O histórico vive em `MaintenanceOrder`, diagnósticos, atividades e transições. Existe no máximo uma ordem ativa por recurso e tenant, garantida por índice único parcial no PostgreSQL.

Ordens são abertas automaticamente, na transação da devolução, quando a inspeção resulta em `MAINTENANCE`. `UNAVAILABLE` continua um bloqueio operacional amplo e exige análise manual antes de virar ordem.
