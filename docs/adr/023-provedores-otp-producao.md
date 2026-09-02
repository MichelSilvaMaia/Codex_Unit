# ADR 023 — Provedores de produção para OTP

## Decisão

WhatsApp e SMS usam adapters separados sobre um `ZenviaClient` comum e a API Zenvia v2. WhatsApp sempre envia o template de autenticação aprovado; SMS envia somente código, validade e aviso. E-mail usa a API HTTP do Resend com HTML, texto simples e `Idempotency-Key` obrigatório. Não foi adicionada dependência de SDK porque `fetch`, `AbortSignal.timeout` e a verificação HMAC/Svix necessária já são suportados pelo runtime.

O domínio continua dependendo exclusivamente de `OtpDeliveryProvider`. O envio ocorre fora de transação longa: o desafio e a tentativa são persistidos antes da chamada, e o resultado aceito pela API é `ACCEPTED`, não `DELIVERED`. Webhooks atualizam o estado posterior de forma autenticada, idempotente e resistente a eventos atrasados.

## Segurança e operação

- Zenvia usa `X-API-Token`; `X-API-Signature` é gerada quando uma credencial assinada também fornece secret.
- O webhook Zenvia usa o header customizado oficial configurável `X-Webhook-Token`.
- O webhook Resend valida `svix-id`, `svix-timestamp` e `svix-signature` sobre o corpo bruto.
- URLs dos providers são constantes, timeouts são explícitos e logs/auditoria não recebem OTP nem destinos completos.
- Desenvolvimento nunca seleciona provider real por acidente, e produção nunca cai silenciosamente no provider de desenvolvimento.

Falhas externas permanecem isoladas do fluxo de reserva, custódia e da futura Fase 8.
