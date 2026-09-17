"use client";
import { useState, type FormEvent } from "react";
import { offlineStore, type OfflineAttachment, type OfflineOperation } from "@/lib/offline/offline-store";

const types = ["DAMAGE", "DIAGNOSIS", "REPAIR", "TEST_RESULT", "FINAL_CONDITION", "OTHER"] as const;
const maxSize = 8 * 1024 * 1024;
export function OfflineMaintenanceEvidence({ tenantId, userId, orderId, expectedVersion }: { tenantId: string; userId: string; orderId: string; expectedVersion: number }) {
  const [message, setMessage] = useState("");
  async function protect() { try { const granted = await offlineStore.requestPersistence(); setMessage(granted === undefined ? "Este navegador não oferece armazenamento persistente." : granted ? "Armazenamento persistente autorizado neste dispositivo." : "Persistência não concedida; as evidências locais permanecem, mas o navegador pode liberar espaço."); } catch { setMessage("Não foi possível consultar a persistência deste dispositivo."); } }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), file = data.get("evidence"), type = String(data.get("type"));
    if (!(file instanceof File) || !["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > maxSize || !types.includes(type as typeof types[number])) { setMessage("Selecione JPEG, PNG ou WebP de até 8 MB."); return; }
    try {
      const { usage, quota } = await offlineStore.storageEstimate();
      if (quota && usage !== undefined && (quota - usage < file.size * 1.5 || usage / quota > .95)) { setMessage("Armazenamento do dispositivo próximo do limite. Libere espaço antes de guardar a foto."); return; }
      const existing = (await offlineStore.getPendingOperations(tenantId, userId)).filter(o => o.aggregateId === orderId && !["CONFLICT", "FAILED_PERMANENT", "SYNCED"].includes(o.status));
      // Attach to the last pending domain mutation, or create an explicit evidence intent.
      let operation = existing.at(-1);
      if (operation?.status === "SYNCING") { setMessage("Sincronização em andamento; tente novamente depois."); return; }
      const now = new Date().toISOString(), deviceId = await offlineStore.deviceId();
      if (!operation) {
        const id = crypto.randomUUID();
        operation = { id, clientOperationId: id, tenantId, userId, deviceId, operationType: "MAINTENANCE_ADD_EVIDENCE", aggregateType: "MaintenanceOrder", aggregateId: orderId, expectedVersion, payload: { description: "Evidência de manutenção" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 } satisfies OfflineOperation;
      }
      const bytes = await file.arrayBuffer();
      const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), b => b.toString(16).padStart(2, "0")).join("");
      const attachment: OfflineAttachment = { id: crypto.randomUUID(), operationId: operation.id, tenantId, userId, aggregateType: "MaintenanceOrder", aggregateId: orderId, purpose: "MAINTENANCE_EVIDENCE", type: type as OfflineAttachment["type"], blob: file, mimeType: file.type, size: file.size, checksum, createdAt: now, updatedAt: now, status: "LOCAL", attemptCount: 0, schemaVersion: 2 };
      if (existing.length) await offlineStore.saveAttachment(attachment);
      else await offlineStore.saveOperation(operation, [attachment]);
      form.reset(); setMessage("Evidência salva neste dispositivo — aguardando sincronização e confirmação do servidor.");
    } catch { setMessage("Não foi possível salvar esta evidência no dispositivo. A foto não foi confirmada; verifique o armazenamento."); }
  }
  return <form onSubmit={save} className="surface-card"><h2>Evidência temporária no dispositivo</h2><p className="mt-2 text-sm text-muted-foreground">A foto só será definitiva após confirmação do servidor. Acesso limitado a esta conta e empresa.</p><div className="mt-4 flex flex-wrap gap-3"><select name="type" className="rounded-lg border px-3 py-2 text-sm">{types.map(t => <option key={t}>{t}</option>)}</select><input name="evidence" type="file" accept="image/jpeg,image/png,image/webp" required className="max-w-full text-sm"/><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Guardar evidência</button></div><button type="button" onClick={protect} className="mt-3 text-xs underline">Solicitar armazenamento persistente</button>{message&&<p role="status" className="mt-3 text-sm">{message}</p>}</form>;
}
