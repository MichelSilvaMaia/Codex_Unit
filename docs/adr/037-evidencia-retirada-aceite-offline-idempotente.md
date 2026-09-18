# ADR-037 — Evidência de Pickup e aceite offline idempotente

Status: IMPLEMENTADO NO ESCOPO DA FASE 10.3.2; conclusão offline da retirada continua pendente.

## Captura e transporte

O IndexedDB permanece na versão 3. A operação `PICKUP_ATTACHMENTS` reutiliza `OfflineOperation`, `OfflineAttachment`, SyncEngine, Web Locks, autenticação, retry e a rota de upload da Fase 10.2. Fotos usam `purpose=PICKUP_EVIDENCE` e viram `OperationalEvidence`. A assinatura usa `purpose=PICKUP_SIGNATURE` e nunca vira evidência operacional. O canvas desenhado é salvo como Blob PNG com SHA-256, dimensões, identidade tenant/usuário/Pickup, versão esperada, hash e versão dos termos, e horário local informativo. Falha do IndexedDB não é apresentada como sucesso.

## Política de versão e termos

A preparação da operação exige Pickup `IN_PROGRESS` e `version=expectedVersion`. Para uma nova evidência, a versão é revalidada antes e durante o registro transacional; evidência ligada a inspeção antiga conflita. Um retry de attachment já confirmado recebe ACK idempotente mesmo que a versão tenha avançado depois, pois não cria novo efeito. A assinatura exige versão atual e reconstituição exata de `termsVersion`/`termsHash` a partir do domínio no momento do aceite. Mudança de destinatário, recursos, condições ou versão gera `CONFLICT`, sem mesclagem. O snapshot original não é substituído enquanto houver rascunho ou anexos locais. A UI bloqueia assinatura se o rascunho local difere do snapshot; inspeção/destinatário do rascunho ainda não são enviados nesta entrega.

## Idempotência e concorrência

`OfflineAttachmentReceipt` passa a ter `purpose`, tipo textual e referência opcional de PickupItem, mantendo a chave única `(tenantId, attachmentId)`. Mesmo ID/checksum/propriedades recebe o mesmo ACK; divergência conflita. `OfflineSignatureReceipt` possui chaves únicas tenant-aware para `attachmentId` e `clientOperationId`, com claim recuperável. A transação que cria `PickupAcceptance VERIFIED` também cria `AcceptanceSignature`, audita e confirma o receipt; não há aceite final sem assinatura. O fluxo online de assinatura e o offline usam a mesma rotina de criação. A constraint PostgreSQL de um único aceite verificado por Pickup continua a autoridade para a corrida online/offline. Retry exato retorna o aceite persistido; operação diferente recebe conflito.

## Estados, falhas e limpeza

O uploader envia evidências antes da assinatura, mas **não sincroniza a inspeção do rascunho e não executa `PICKUP_COMPLETE`**. A central `/sync` distingue foto local/confirmada, assinatura local/confirmada e aceite pendente/verificado. Um 401 põe a operação em `AUTH_REQUIRED`; 403 em `FAILED_PERMANENT`; conflito mantém os Blobs. Web Lock impede envios simultâneos entre abas do mesmo usuário/tenant. Upload interrompido recupera o claim/estado e o retry usa os receipts. Evidência local pode ser removida antes da submissão; assinatura e anexos confirmados são mantidos até o futuro FULL ACK da retirada. Nem Resource `IN_USE` nem `RELEASED_TO_RECIPIENT` são criados nesta etapa. OTP continua exclusivamente online.

O armazenamento externo e PostgreSQL não compartilham transação distribuída. A compensação de objeto órfão segue best-effort, conforme ADR-034; reconciliação externa não faz parte desta fase. `capturedAtDevice` não é autoridade de horário de custódia.
