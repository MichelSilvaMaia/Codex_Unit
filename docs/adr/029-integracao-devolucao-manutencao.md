# ADR-029 — Integração entre devolução e manutenção

## Decisão

A conclusão de devolução e a criação de ordem para disposições `MAINTENANCE` ocorrem na mesma transação serializável. Falha na ordem causa rollback da devolução, da custódia e do status do recurso.

Reservas futuras impactadas são consultadas e exibidas, mas nunca canceladas automaticamente. Manutenção atual não integra a constraint temporal de reservas; manutenção agendada permanece fora do escopo.
