# Matriz de homologação PWA e operação offline

Data: 2026-09-22. Build base: `9493efabf366347fa8e08358e7fed9537c747140`.

Ambiente automatizado real: Windows, Microsoft Edge Chromium headless, `http://127.0.0.1:3000`, Next.js em modo development. O controlador visual do Codex falhou com `failed to write kernel assets`; o fallback usou o protocolo de depuração do Edge e capturas reais. Nenhum resultado de dispositivo físico foi inferido.

| Cenário | Desktop | Tablet | Mobile | Resultado | Evidência/observação |
|---|---|---|---|---|---|
| Login e dashboard | PASSOU 1366×768 | — | — | PASSOU | Tela real renderizada, sessão seed e tenant ativos |
| Manifest | PASSOU | — | — | PASSOU | `standalone`, escopo `/`, start `/dashboard`, ícones 192/512 |
| Service Worker | PASSOU | — | — | PASSOU | `activated`, página controlada por `/sw.js` |
| Cache Storage | PASSOU | — | — | PASSOU | Apenas `codex-unit-shell-v1`; SW ignora mutations e `/api` |
| IndexedDB real | PASSOU | — | — | PASSOU | `codex-unit-offline`, versão 4 |
| Quota | PASSOU | — | — | PASSOU | quota 10.742.273.450 bytes; uso 4.855.210 bytes |
| Indicador offline | PASSOU | PASSOU | — | PASSOU | DevTools offline alterou estado para “Sem conexão” |
| `/sync` | — | PASSOU 768×1024 | — | PASSOU | Sem overflow do documento; estado e ação legíveis |
| Fila de devoluções | — | — | PASSOU 390×844 | PASSOU | Filtros legíveis e sem overflow do documento |
| Navegação responsiva | PASSOU | PARCIAL | PARCIAL | PARCIAL | Barra superior usa rolagem horizontal; módulos finais não aparecem inicialmente |
| Instalação standalone | NÃO EXECUTADO | NÃO EXECUTADO | NÃO EXECUTADO | PENDENTE | Edge headless não instala aplicação |
| Close/reopen PWA instalada | NÃO EXECUTADO | NÃO EXECUTADO | NÃO EXECUTADO | PENDENTE | Requer instalação interativa |
| Modo avião físico | — | — | NÃO EXECUTADO | PENDENTE | Requer dispositivo físico |
| Touch, câmera e orientação | — | NÃO EXECUTADO | NÃO EXECUTADO | PENDENTE | Requer dispositivo físico |
| Maintenance offline completo | NÃO EXECUTADO MANUALMENTE | — | — | PENDENTE | Cobertura automatizada preservada; executar runbook |
| Pickup offline completo/assinatura | NÃO EXECUTADO MANUALMENTE | — | — | PENDENTE | Cobertura automatizada preservada; executar runbook |
| Return GOOD/DAMAGED | NÃO EXECUTADO MANUALMENTE | — | — | PENDENTE | Cobertura PostgreSQL preservada; executar runbook |
| 401, 403 e conflito reais | NÃO EXECUTADO MANUALMENTE | — | — | PENDENTE | Cobertura automatizada existente |
| Dois dispositivos | — | — | NÃO EXECUTADO | PENDENTE | Somente concorrência PostgreSQL automatizada |
| iOS/Android | — | — | NÃO EXECUTADO | PENDENTE | Nenhum dispositivo conectado |

## Bugs encontrados

### PWA-105-001 — controlador de navegador indisponível

- Severidade: LOW, externo à aplicação.
- Observado: `failed to write kernel assets` após inicialização e após reset.
- Contorno de QA: Edge real via protocolo de depuração.
- Correção da aplicação: nenhuma.

### PWA-105-002 — navegação horizontal em viewports estreitos

- Severidade: MEDIUM.
- Cenário: 768×1024 e 390×844.
- Esperado: acesso claro a todos os módulos.
- Observado: módulos finais exigem rolagem horizontal na barra superior.
- Estado: aberto; não bloqueia armazenamento, sincronização ou isolamento.

## Resultado

A infraestrutura PWA foi comprovada em Edge real, mas os gates de instalação, close/reopen da aplicação instalada, modo avião físico, touch, câmera e fluxos operacionais completos em dispositivo permanecem pendentes. Portanto Fase 10.5 e Fase 10 continuam PARCIAIS.

## Android físico — Fase 10.5.1

Sessão preparada em 2026-09-24 sobre o commit-base `926a3eb84ba3cd5cfb04e07f93ced1194c25c6f7`.

Ambiente detectado: nenhum dispositivo Android conectado; `adb`, `cloudflared` e `ngrok` não estão instalados. A aplicação permanece disponível apenas em `localhost`, que não é acessível pelo smartphone. Não foi criado túnel público nem instalado certificado inseguro.

| Cenário Android físico | Resultado | Evidência/observação |
|---|---|---|
| URL HTTPS controlada | NÃO EXECUTADO | Exposição segura ainda não autorizada/configurada |
| Instalação PWA | NÃO EXECUTADO | Requer smartphone e URL HTTPS |
| Standalone e reinício | NÃO EXECUTADO | Requer PWA instalada |
| Service Worker / IndexedDB v4 | NÃO EXECUTADO | Edge desktop não substitui Android |
| Modo avião e offline reopen | NÃO EXECUTADO | Gate físico obrigatório |
| Touch, assinatura e orientação | NÃO EXECUTADO | Nenhum aparelho conectado |
| Câmera e Blob real | NÃO EXECUTADO | Nenhum aparelho conectado |
| Maintenance offline | NÃO EXECUTADO | Aguardando dados e aparelho de homologação |
| Pickup offline / FULL ACK / cleanup | NÃO EXECUTADO | Aguardando dados e aparelho de homologação |
| Return GOOD | NÃO EXECUTADO | Aguardando dados e aparelho de homologação |
| Return DAMAGED / MaintenanceOrder | NÃO EXECUTADO | Aguardando dados e aparelho de homologação |
| Interrupção de rede / 401 | NÃO EXECUTADO | Aguardando aparelho e sessão controlada |
| Isolamento user/tenant | NÃO EXECUTADO | Aguardando contas/tenant de homologação |
| PWA-105-002 no aparelho | NÃO EXECUTADO | Severidade permanece MEDIUM até teste físico |

Status: **FASE 10.5.1 PARCIAL — dispositivo Android e origem HTTPS pendentes.** Nenhum gate físico foi aprovado por inferência.
