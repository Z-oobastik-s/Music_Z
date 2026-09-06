declare const __BUILD_ID__: string;

import { assetUrl } from "./tracks";

/**
 * Polls version.json. Calls onAvailable when a newer build is deployed
 * (caller shows a banner — avoid hard reload mid-track).
 */
export function startAutoUpdate(onAvailable?: () => void): void {
  const current = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "";
  if (!current) return;

  let notified = false;

  const check = async () => {
    try {
      const res = await fetch(assetUrl("version.json"), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      if (data.buildId && data.buildId !== current && !notified) {
        notified = true;
        if (onAvailable) onAvailable();
        else location.reload();
      }
    } catch {
      /* offline / first local run without version.json */
    }
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void check();
  });
  window.addEventListener("focus", () => void check());
  setInterval(() => void check(), 45_000);
  void check();
}
