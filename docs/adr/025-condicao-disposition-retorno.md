# ADR 025 — Condição e disposition de retorno

O servidor deriva a disposition: `GOOD → AVAILABLE`; `DAMAGED`, `MISSING_COMPONENTS` e `DIRTY → MAINTENANCE`; `UNUSABLE → UNAVAILABLE`; `OTHER → MAINTENANCE|UNAVAILABLE` informado pelo operador. Irregularidades exigem observação e evidência. O frontend nunca escolhe `AVAILABLE` como autoridade.

Evidências de retorno usam entidade própria e storage privado, evitando relações ambíguas com evidências da retirada.
