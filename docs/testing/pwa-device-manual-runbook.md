# Runbook manual — homologação PWA em dispositivo

Preencha em cada teste: **Resultado: PASSOU / FALHOU** e **Observação/evidência:** screenshot, horário, dispositivo e comportamento observado. Use dados de homologação, nunca produção.

## A. Instalação

### A1 — Instalar e abrir standalone
Pré-condição: Chrome/Edge conectado a `http://localhost:3000` ou URL HTTPS.
1. Abra a aplicação e faça login. 2. Use “Instalar aplicativo”. 3. Feche o navegador. 4. Abra pelo atalho instalado.
Esperado: janela standalone abre no dashboard; Manifest e ícones corretos.
Resultado: ____  Observação/evidência: ____

## B. Offline básico

### B1 — Close/reopen e modo avião
Pré-condição: PWA instalada e `/sync` aberto ao menos uma vez.
1. Ative modo avião. 2. Feche completamente a PWA. 3. Reabra pelo atalho. 4. Acesse `/sync`.
Esperado: shell abre, indica “Sem conexão” e não perde pendências.
Resultado: ____  Observação/evidência: ____

### B2 — IndexedDB e cache
1. Em DevTools > Application, abra IndexedDB. 2. Confirme `codex-unit-offline` v4. 3. Confira Cache Storage.
Esperado: stores de operações/anexos/pickups/returns; nenhum POST, senha, OTP, assinatura ou evidência no Cache Storage.
Resultado: ____  Observação/evidência: ____

## C. Maintenance

### C1 — Diagnóstico, intervenção e foto offline
1. Online, abra uma ordem. 2. Fique offline. 3. Salve diagnóstico, intervenção e foto. 4. Feche/reabra. 5. Reconecte e sincronize.
Esperado: Blob/preview persistem; checksum e MIME coerentes; servidor confirma uma vez; cleanup somente após ACK.
Resultado: ____  Observação/evidência: ____

## D. Pickup

### D1 — Retirada offline completa
1. Online, abra Pickup válida. 2. Confirme snapshot, versão e termos. 3. Offline, preencha destinatário e inspeção, fotografe, assine e conclua localmente. 4. Feche/reabra.
Esperado: “aguardando sincronização”; assinatura e foto persistem; OTP indisponível; Resource ainda não muda no servidor.
Resultado: ____  Observação/evidência: ____

### D2 — Reconnect e FULL ACK
1. Reconecte. 2. Abra `/sync`. 3. Sincronize. 4. Confira PostgreSQL/administrativo.
Esperado: inspeção → evidence → assinatura → Acceptance → complete → FULL ACK; uma custódia; Resource IN_USE; cleanup local.
Resultado: ____  Observação/evidência: ____

## E. Return

### E1 — GOOD
1. Carregue Return online. 2. Offline, marque PRESENT/GOOD e conclua. 3. Confirme que Resource segue IN_USE. 4. Reconecte e sincronize.
Esperado: Return COMPLETED, Reservation RETURNED, Resource AVAILABLE, uma RETURNED_TO_TENANT e cleanup.
Resultado: ____  Observação/evidência: ____

### E2 — DAMAGED
1. Use outra Return. 2. Offline, marque PRESENT/DAMAGED, descreva e fotografe. 3. Conclua localmente. 4. Reconecte.
Esperado: antes do sync, nenhuma ordem; depois, Resource MAINTENANCE, uma custódia, uma MaintenanceOrder, evidence e FULL ACK.
Resultado: ____  Observação/evidência: ____

### E3 — NOT_PRESENT
1. Offline, marque NOT_PRESENT. 2. Tente concluir.
Esperado: conclusão bloqueada; nenhum efeito server-side.
Resultado: ____  Observação/evidência: ____

## F. Interrupção de rede

### F1 — Queda durante upload e resposta perdida
1. Inicie upload. 2. Corte a rede durante o envio. 3. Reconecte e sincronize novamente.
Esperado: Blob permanece; retry não duplica evidence, Acceptance, custódia, Return ou MaintenanceOrder.
Resultado: ____  Observação/evidência: ____

## G. Autenticação

### G1 — Sessão expirada
1. Crie pendência. 2. Encerre a sessão em outra aba. 3. Sincronize. 4. Entre novamente e retome.
Esperado: AUTH_REQUIRED sem cleanup; retomada após login.
Resultado: ____  Observação/evidência: ____

## H. Conflitos

### H1 — Snapshot antigo e duas abas
1. Capture snapshot. 2. Altere o registro em outra sessão. 3. Sincronize o antigo. 4. Dispare sync simultâneo em duas abas.
Esperado: CONFLICT sem overwrite; Web Lock permite um executor local.
Resultado: ____  Observação/evidência: ____

## I. Segurança

### I1 — Outro usuário e outro tenant
1. Com pendência do usuário A/Tenant A, faça logout. 2. Entre como B. 3. Troque de tenant. 4. Retorne ao contexto autorizado original.
Esperado: B/Tenant B não veem nem sincronizam A; pendência reaparece somente no owner correto; local/session/cache sem senha, OTP ou segredo provider.
Resultado: ____  Observação/evidência: ____

## J. Atualização PWA

### J1 — Update com pendência
1. Mantenha Blobs e operações pendentes. 2. Publique/ative nova versão do SW. 3. Atualize e reabra.
Esperado: sem loop; IndexedDB v4 e pendências preservados; `/sync` funcional.
Resultado: ____  Observação/evidência: ____

## K. Cleanup

### K1 — Gate do FULL ACK
1. Interrompa cada fluxo antes do ACK e confira IndexedDB. 2. Finalize com ACK e confira novamente.
Esperado: nada é removido antes do FULL ACK; snapshot, draft, operações e Blobs temporários são removidos depois dele.
Resultado: ____  Observação/evidência: ____
