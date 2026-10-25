"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

// The theme is only known in the browser; render the switch after hydration.
const useMounted = () =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

export function ThemeToggle() {
  const t = useTranslations("common");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground">
      {mounted && resolvedTheme === "dark" ? (
        <Moon className="size-4" aria-hidden />
      ) : (
        <Sun className="size-4" aria-hidden />
      )}
      <span className="flex-1">{t("darkMode")}</span>
      <Switch
        checked={mounted && resolvedTheme === "dark"}
        onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
        disabled={!mounted}
        aria-label={t("darkMode")}
      />
    </label>
  );
}
