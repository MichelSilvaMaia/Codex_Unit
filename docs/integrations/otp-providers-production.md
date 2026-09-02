# Runbook — OTP em produção

## Estado antes da homologação

O código pode ser implantado sem credenciais usando `OTP_PROVIDER_MODE=development` somente fora de produção. Para homologar, use ambiente isolado, destinatários autorizados e `OTP_PROVIDER_MODE=production`.

## Zenvia WhatsApp

1. Crie ou selecione a conta Zenvia e habilite WhatsApp Business.
2. Registre o sender e configure `ZENVIA_WHATSAPP_FROM`.
3. Crie um template de categoria `AUTHENTICATION`, locale `pt_BR`, com os campos `token` e `minutes`.
4. Aguarde a aprovação da Meta/Zenvia e configure seu ID em `ZENVIA_WHATSAPP_OTP_TEMPLATE_ID`.
5. Gere um token Standard (`ZENVIA_API_TOKEN`) ou assinado (token e `ZENVIA_API_SECRET`).
6. Cadastre `/api/webhooks/zenvia` como webhook v2 de `MESSAGE_STATUS` para WhatsApp e SMS.
7. Adicione no cadastro do webhook o header `X-Webhook-Token` com o mesmo valor de `ZENVIA_WEBHOOK_TOKEN`.

O sistema usa `POST https://api.zenvia.com/v2/channels/whatsapp/messages`, template aprovado, telefone brasileiro normalizado sem `+`, `externalId` igual ao ID interno da tentativa e timeout configurável.

## Zenvia SMS

1. Habilite SMS e confirme o sender/alias autorizado.
2. Configure `ZENVIA_SMS_FROM` e as mesmas credenciais Zenvia.
3. Confirme que o webhook de `MESSAGE_STATUS` cobre SMS.

O endpoint é `POST https://api.zenvia.com/v2/channels/sms/messages`. O texto não contém dados da reserva.

## Resend

1. Crie a conta e adicione um subdomínio dedicado, como `notify.seudominio.com`.
2. Publique SPF e DKIM informados pelo Resend; recomenda-se também DMARC.
3. Aguarde a verificação do domínio, crie a API key e configure `RESEND_API_KEY`, `RESEND_FROM_EMAIL` e `RESEND_FROM_NAME`.
4. Cadastre `/api/webhooks/resend` para `email.sent`, `email.delivered`, `email.failed`, `email.bounced` e `email.delivery_delayed`.
5. Copie o signing secret para `RESEND_WEBHOOK_SECRET`.

O envio usa `POST https://api.resend.com/emails`, HTML e texto simples. A chave `otp/{challengeId}/{deliveryAttemptId}` é enviada em `Idempotency-Key` e não contém o OTP.

## Teste de homologação

Para cada canal: crie uma reserva, aprove e confirme; inicie a retirada, conclua a conferência e solicite OTP. Confirme no painel do provider o ID retornado, aguarde o webhook alterar `OtpDeliveryAttempt` de `ACCEPTED` para `DELIVERED` e então valide o código. Repita com falha controlada para comprovar o fallback sequencial.

Não execute sandbox com telefone ou e-mail de terceiros. HTTP 200/aceite da API não comprova entrega: a homologação exige o webhook correspondente.

## Diagnóstico

- `INVALID_DESTINATION`: valide o telefone no formato brasileiro com DDD ou o e-mail.
- `HTTP_401/403`: rotacione credencial e confira escopo.
- template rejeitado: confirme ID, sender, locale e aprovação.
- `TIMEOUT`, `HTTP_429` ou `HTTP_5xx`: o próximo canal elegível é tentado.
- webhook 401: confira o header Zenvia ou o signing secret Svix; nunca desabilite a validação.

Na rotação, atualize o secret no cofre de implantação e no painel do provider, teste o novo valor e revogue o anterior. Nunca versione credenciais.
