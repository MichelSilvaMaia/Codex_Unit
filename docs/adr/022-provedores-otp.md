# ADR 022 — Provedores OTP desacoplados

## Decisão

O domínio depende somente de `OtpDeliveryProvider`. A prioridade de entrega é WhatsApp, SMS e e-mail, com fallback apenas para falhas explicitamente recuperáveis. Cada tentativa registra canal, provedor, resultado e identificador externo sem registrar o código.

O provedor de desenvolvimento é bloqueado em produção. Meta WhatsApp Cloud API, Twilio, Zenvia ou outro fornecedor poderão ser adaptados sem alterar o workflow de retirada.
