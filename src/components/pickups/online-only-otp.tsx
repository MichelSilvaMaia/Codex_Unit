"use client";

import { useEffect, useState, type ReactNode } from "react";
import { checkConnectivity } from "@/lib/offline/connectivity";

export function OnlineOnlyAction({ children, offlineMessage }: { children: ReactNode; offlineMessage: string }) {
  const [online, setOnline] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = () => { void checkConnectivity().then(value => { if (active) setOnline(value); }); };
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    const timer = window.setInterval(refresh, 10_000);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("online", refresh); window.removeEventListener("offline", refresh); };
  }, []);
  return online ? <>{children}</> : <p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">{offlineMessage}</p>;
}
