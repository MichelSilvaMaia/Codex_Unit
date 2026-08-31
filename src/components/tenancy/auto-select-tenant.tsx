"use client";

import { useEffect, useRef } from "react";
import { selectTenantAction } from "@/app/select-tenant/actions";

export function AutoSelectTenant({ tenantId }: { tenantId: string }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => form.current?.requestSubmit(), []);
  return <form action={selectTenantAction} ref={form}><input name="tenantId" type="hidden" value={tenantId} /><p className="text-muted-foreground">Abrindo sua empresa…</p></form>;
}
