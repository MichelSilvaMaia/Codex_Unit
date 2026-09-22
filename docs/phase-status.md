# Estado de validação das fases

## Fase 2 — VALIDADA EM POSTGRESQL

A cadeia real foi executada em PostgreSQL 17.11:

- migrations aplicadas;
- seed executado;
- hash de senha validado;
- membership e tenant ativos consultados;
- permissões carregadas do RBAC;
- isolamento cross-tenant comprovado contra o banco.

OAuth externo continua dependendo das credenciais dos respectivos provedores, sem afetar a validação da identidade local.

## Fase 3 — VALIDADA EM POSTGRESQL

A migration incremental e o seed operacional foram executados. O teste integrado confirmou isolamento real de Customer entre tenants.

## Fase 4 — VALIDADA EM POSTGRESQL

Reservas usam proteção PostgreSQL por exclusion constraint. O teste concorrente real comprovou que, entre duas transações simultâneas conflitantes, apenas uma vence e a outra recebe conflito controlado.

## Fase 5 — VALIDADA EM POSTGRESQL

O workflow de aprovação, autoaprovação explícita do gerente, reprovação motivada e urgência auditável foram implementados. A predicate GiST foi migrada para `PENDING_APPROVAL`, `APPROVED` e `CONFIRMED`. Testes reais comprovam exclusão temporal e decisão concorrente `approve × reject` com apenas um vencedor.

## Fase 6 — VALIDADA EM POSTGRESQL

Retiradas usam tentativas `1:N`, checklist integral, recusa sem cancelamento comercial, custódia por recurso e apenas uma conclusão por reserva. Migration, constraint parcial, transação atômica e dupla conclusão concorrente foram comprovadas em PostgreSQL real.

## Fase 7 — VALIDADA EM POSTGRESQL

Aceite por assinatura desenhada ou OTP multicanal foi vinculado à tentativa específica de retirada. O código OTP é armazenado somente como HMAC, possui expiração, limite e consumo único. Testes concorrentes reais comprovaram: replay rejeitado; apenas um vencedor ao validar o mesmo OTP; apenas um aceite final na corrida assinatura × OTP; e impossibilidade de reaproveitar aceite de retirada recusada.

## Fase 7.1 — PARCIAL: CÓDIGO CONCLUÍDO, HOMOLOGAÇÃO EXTERNA PENDENTE

Adapters Zenvia v2 para WhatsApp com template aprovado e SMS, adapter Resend com idempotência, fallback sequencial, timeouts e webhooks autenticados foram implementados. Migration e mocks estão validados, mas nenhum envio real foi executado sem credenciais externas. A pendência não bloqueia a Fase 8.

## Fase 8 — VALIDADA EM POSTGRESQL

Devolução integral, inspeção por recurso, evidência de irregularidade, reentrada de custódia e disposition operacional foram implementadas. Constraints parciais e transação serializável impedem dupla devolução; testes reais comprovam concorrência, rollback, avaria aceita, recurso ausente e preservação do período planejado. O seed visual agora usa `VEICULO/VEH-001`.
# FASE 9 — CONCLUÍDA — VALIDADA EM POSTGRESQL

- Ordens de manutenção, diagnóstico, atividades, evidências e histórico tenant-safe.
- Uma ordem ativa por recurso garantida por índice parcial PostgreSQL.
- Devolução irregular e ordem de manutenção atômicas.
- Conclusão técnica separada da liberação operacional explícita.
- Central de manutenção responsiva e modernização do shell visual compartilhado.

FASE 7.1 permanece **PARCIAL — homologação externa Zenvia/Resend pendente**.

## Fase 10 — PARCIAL: infraestrutura PWA e sincronização inicial de manutenção

Manifesto, service worker de shell público, IndexedDB versionado, fila com Web Locks, indicador de conectividade, central `/sync`, recibo idempotente PostgreSQL e conflito por versão foram implementados. Apenas diagnóstico/intervenção de manutenção podem ser guardados no dispositivo. Retirada, devolução, assinatura, evidências e OTP não possuem fluxo offline aprovado nesta entrega. A inspeção visual automática em desktop/tablet/mobile e homologação de instalação também estão pendentes. Fase 7.1 continua PARCIAL independentemente desta fase.

### Fase 10.1 — entrega incremental de recuperação da fila

Sob o mutex entre abas, operações interrompidas em `SYNCING` retornam a `FAILED_RETRYABLE` antes do envio. Resposta 401 mantém a intenção local em `AUTH_REQUIRED`, sem backoff nem descarte; uma nova sincronização após login pode retomá-la. A central mostra tentativas, último erro e quantidade de anexos locais pendentes. Os 101 testes anteriores continuam como baseline; há testes adicionais para recuperação/401 e exclusão entre abas.

**Ainda PARCIAL:** não foi implementado nem homologado o fluxo offline completo de Pickup/Return, assinatura, upload de evidências, quota/persistência, snapshots privados, instalação PWA, visual QA ou modo avião. Nenhuma conclusão de custódia deve ser inferida de uma captura local. A Fase 7.1 permanece PARCIAL pela homologação externa.

### Fase 10.2 — PARCIAL: motor de evidências offline de manutenção

Captura Blob/SHA-256 com ownership tenant/user, upgrade IndexedDB v1→v2, estados de upload, retry/401/403/409, recibo idempotente PostgreSQL e ACK explícito antes do cleanup foram adicionados para `MaintenanceEvidence`. Falha de uma entre N fotos preserva a operação e não repete o domínio. Testes de IndexedDB compatível e PostgreSQL exercitam persistência, isolamento, upgrade, quota, concorrência e replay. Consulte [ADR-034](adr/034-ciclo-anexos-offline-idempotencia.md).

**Fase 10.2 permanece PARCIAL:** os testes usam IndexedDB compatível (`fake-indexeddb`), não Chrome/Edge real; o controlador do navegador não conseguiu acessar a aplicação local, portanto QA visual e fechar/reabrir PWA no dispositivo não foram executados. A compensação de storage externo indisponível ainda precisa de reconciliação operacional. **Fase 10 geral continua PARCIAL:** Pickup/Return/assinatura e homologação PWA/visual/dispositivo real ainda não foram realizados; Fase 7.1 continua PARCIAL pela homologação externa.

### Fase 10.3 — PARCIAL: snapshot e rascunho de retirada

O IndexedDB v3 preserva snapshots mínimos de Pickup por tenant/usuário e rascunhos locais de destinatário/inspeção. A página autenticada informa frescor, exibe termos previamente carregados e deixa claro que o rascunho não confirma saída. Ações online de inspeção, assinatura, OTP e conclusão não são apresentadas sem conectividade. A migração v2→v3 mantém operações e Blobs da manutenção. Consulte [ADR-035](adr/035-retirada-offline-snapshot-rascunho.md).

**Ainda não há conclusão offline de Pickup:** a Fase 10.3.1 iniciou o versionamento otimista server-side (`ReservationPickup.version`, snapshot `expectedVersion` e comparação atômica em inspeção/conclusão), validado no PostgreSQL real. Faltam upload de evidências de retirada, assinatura idempotente com validação de termos, sincronização da cadeia e cleanup após FULL ACK. Consulte [ADR-036](adr/036-pickup-offline-fechamento-transacional.md). Fases 10, 10.2 e 10.3 continuam PARCIAIS; Fase 7.1 permanece PARCIAL pela homologação externa.

### Fase 10.3.2 — Evidência e aceite offline; conclusão ainda desabilitada

O motor OfflineAttachment agora transporta `PICKUP_EVIDENCE` até `OperationalEvidence` com receipt PostgreSQL e `PICKUP_SIGNATURE` até `PickupAcceptance` + `AcceptanceSignature` com receipt próprio, validação de termos/versão, checksum e constraint de aceite único. A central `/sync` mostra os subestados e mantém os Blobs para a próxima etapa. **Não há `PICKUP_COMPLETE` offline, alteração de Resource ou evento de custódia nesta entrega.** O texto anterior registra o estado histórico da 10.3.1; os itens de evidência e aceite ali pendentes foram abordados nesta 10.3.2. Consulte [ADR-037](adr/037-evidencia-retirada-aceite-offline-idempotente.md). Fase 10.3 e Fase 10 geral permanecem PARCIAIS; Fase 7.1 permanece PARCIAL pela homologação externa.

### Fase 10.3.3 — Conclusão offline funcional; homologação PWA pendente

`PICKUP_COMPLETE` persiste uma intenção local com dependências. A sincronização envia inspeção, evidências e assinatura/aceite antes da conclusão; o servidor revalida os receipts, a reserva, o checklist, o aceite, os recursos e a versão do Pickup. O mesmo `completePickup()` do fluxo online faz a transição e grava o receipt idempotente com FULL ACK na transação PostgreSQL. Retry após resposta perdida recupera o ACK sem duplicar custódia. O IndexedDB remove rascunho, operações e Blobs de foto/assinatura somente após FULL ACK, em uma transação. Consulte [ADR-038](adr/038-offline-pickup-completion-custody-full-ack.md).

**Fase 10.3 permanece PARCIAL:** implementação funcional concluída, porém testes em navegador/PWA e dispositivo real ainda pendentes. **Fase 10 geral permanece PARCIAL.** Fase 7.1 continua PARCIAL pela homologação externa Zenvia/Resend. Return e OTP offline não foram implementados.

### Fase 10.4 — Devolução offline funcional; homologação PWA pendente

Snapshots e rascunhos de Return, inspeção integral, presença, condições e evidências são persistidos no IndexedDB. A sincronização usa versionamento otimista, receipts e o mesmo `completeReturn()` do fluxo online. Somente a transação PostgreSQL conclui Return/Reservation, reentra custódia, aplica disposition e cria MaintenanceOrder. FULL ACK governa a limpeza local e retry após resposta perdida não duplica custódia ou manutenção. Consulte [ADR-039](adr/039-offline-return-custody-maintenance.md).

**Fase 10.4 permanece PARCIAL:** implementação funcional concluída, homologação Chrome/Edge/PWA/dispositivo real pendente. Fase 10 geral permanece PARCIAL e Fase 7.1 segue PARCIAL pela homologação externa.
