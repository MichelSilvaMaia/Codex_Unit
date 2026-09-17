"use client";
import { useState, type FormEvent } from "react";
import { offlineStore, type OfflineOperation } from "@/lib/offline/offline-store";

export function OfflineMaintenanceForm({ tenantId, userId, orderId, expectedVersion, canDiagnose, canPerform }: { tenantId: string; userId: string; orderId: string; expectedVersion: number; canDiagnose: boolean; canPerform: boolean }) {
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), description = String(data.get("description") ?? "").trim(), type = String(data.get("type") ?? "DIAGNOSIS");
    if (description.length < 3) { setMessage("Descreva a ocorrência com pelo menos 3 caracteres."); return; }
    try {
      const deviceId = await offlineStore.deviceId(), now = new Date().toISOString();
      const operations = await offlineStore.getPendingOperations(tenantId, userId);
      const previous = operations.filter(row => row.aggregateId === orderId && row.status !== "SYNCED").at(-1);
      if (previous) { setMessage("Sincronize a operação anterior deste registro antes de registrar outra."); return; }
      const operationId = crypto.randomUUID();
      const operation: OfflineOperation = { id: operationId, clientOperationId: operationId, tenantId, userId, deviceId, operationType: type === "DIAGNOSIS" ? "MAINTENANCE_ADD_DIAGNOSIS" : "MAINTENANCE_ADD_ACTIVITY", aggregateType: "MaintenanceOrder", aggregateId: orderId, expectedVersion, payload: type === "DIAGNOSIS" ? { description } : { description, type: type as "INSPECTION" | "REPAIR" | "CLEANING" | "TEST" | "ADJUSTMENT" | "OTHER" }, dependsOnOperationIds: [], status: "PENDING", attemptCount: 0, createdAt: now, updatedAt: now, schemaVersion: 1 };
      await offlineStore.saveOperation(operation);
      form.reset(); setMessage("Registrado neste dispositivo. Ainda não foi confirmado pelo servidor; abra Sincronização para acompanhar.");
    } catch { setMessage("Não foi possível salvar neste dispositivo. Verifique o armazenamento antes de sair da página."); }
  }
  return <form onSubmit={save} className="surface-card"><h2>Registro temporário sem conexão</h2><p className="mt-2 text-sm text-muted-foreground">Diagnóstico ou intervenção fica pendente no dispositivo. Não altera o servidor até receber confirmação da sincronização.</p><div className="mt-4 grid gap-3 sm:grid-cols-[12rem_1fr_auto]"><select name="type" className="h-10 rounded-lg border px-3 text-sm">{canDiagnose && <option value="DIAGNOSIS">Diagnóstico</option>}{canPerform && <><option value="INSPECTION">Inspeção</option><option value="REPAIR">Reparo</option><option value="CLEANING">Limpeza</option><option value="TEST">Teste</option><option value="ADJUSTMENT">Ajuste</option><option value="OTHER">Outro</option></>}</select><input name="description" className="h-10 rounded-lg border px-3 text-sm" placeholder="O que foi observado ou feito" required/><button className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Guardar no dispositivo</button></div>{message && <p role="status" className="mt-3 text-sm">{message}</p>}</form>;
}
