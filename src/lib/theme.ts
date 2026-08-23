const KEY = "music_z_theme";

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;
  return "dark";
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem(KEY, theme);
  document.querySelectorAll<HTMLButtonElement>("[data-theme-pick]").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.themePick === theme);
  });
}

export function setTheme(theme: Theme): Theme {
  applyTheme(theme);
  return theme;
}

export function toggleTheme(): Theme {
  return setTheme(getTheme() === "dark" ? "light" : "dark");
}
