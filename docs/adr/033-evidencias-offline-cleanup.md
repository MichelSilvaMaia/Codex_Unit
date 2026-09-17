# ADR-033 — Evidências offline e limpeza

## Decisão

O `OfflineStore` reserva uma store de Blob e uma transação para operação com metadados de anexo. Contudo, envio e ACK de evidências e assinatura ainda não estão implementados. Portanto a interface não oferece captura offline desses artefatos. Nenhuma foto ou assinatura pode ser classificada como sincronizada sem upload e confirmação do servidor.

Pendências com erro ou conflito são preservadas. Descarte exige ação explícita do usuário e registra marcador local. Não há criptografia caseira nem armazenamento de OTP ou credenciais.
