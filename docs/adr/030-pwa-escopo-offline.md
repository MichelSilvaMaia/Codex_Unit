# ADR-030 — PWA e escopo offline

## Decisão

O service worker armazena apenas shell público e assets estáticos versionados. Não armazena páginas autenticadas, respostas de `/api/*`, credenciais nem mutações. Uma navegação sem rede recebe um fallback estático que informa a limitação; dados de domínio continuam sob autoridade do PostgreSQL.

Nesta entrega parcial, somente diagnóstico e intervenção de manutenção podem ser preparados localmente. Retirada, devolução, assinatura, OTP e evidências permanecem online até existirem fluxos de sincronização seguros para cada um.

Service worker exige HTTPS em produção; `localhost` é exceção de desenvolvimento. Instalação em Chrome/Edge/Android e iOS ainda requer homologação visual em dispositivos reais.
