export async function checkConnectivity(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.onLine) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch("/api/health", { cache: "no-store", credentials: "same-origin", signal: controller.signal });
    return response.ok;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
