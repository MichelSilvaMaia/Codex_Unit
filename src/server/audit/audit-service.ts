import type { AuditScope, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId: string;
  scope?: AuditScope;
  tenantId?: string;
  actorUserId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function recordAuditEvent(event: AuditEvent) {
  await prisma.auditLog.create({
    data: {
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      scope: event.scope ?? (event.tenantId ? "TENANT" : "PLATFORM"),
      tenantId: event.tenantId,
      actorUserId: event.actorUserId,
      metadata: event.metadata,
    },
  });
}
