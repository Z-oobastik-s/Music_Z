declare const __BUILD_ID__: string;

import { assetUrl } from "./tracks";

/** Polls version.json so a new deploy reloads the page without manual cache clear. */
export function startAutoUpdate(): void {
  const current = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "";
  if (!current) return;

  const check = async () => {
    try {
      const res = await fetch(assetUrl("version.json"), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as { buildId?: string };
      if (data.buildId && data.buildId !== current) {
        location.reload();
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
