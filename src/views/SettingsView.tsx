import { useSettingsStore, Theme } from "../lib/settingsStore";
import { Monitor, Moon, Sun } from "lucide-react";
import { clsx } from "clsx";

export function SettingsView() {
  const theme = useSettingsStore((s) => s.theme);
  const setTheme = useSettingsStore((s) => s.setTheme);

  const themeOptions: { value: Theme; label: string; icon: any; describe: string }[] = [
    { value: "system", label: "System", icon: Monitor, describe: "Follows your operating system's appearance" },
    { value: "light", label: "Light", icon: Sun, describe: "Always use the light theme" },
    { value: "dark", label: "Dark", icon: Moon, describe: "Always use the dark theme" },
  ];

  return (
    <div className="h-full overflow-y-auto p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-2xl font-semibold text-[color:var(--text-0)]">Settings</h1>

        <section className="obs-panel border border-[color:var(--border)] p-6">
          <h2 className="mb-4 text-lg font-medium text-[color:var(--text-0)]">Appearance</h2>
          
          <div className="flex flex-col gap-3">
            {themeOptions.map((option) => {
              const isActive = theme === option.value;
              return (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={clsx(
                    "flex flex-col items-start rounded-md border p-4 text-left transition-colors",
                    isActive
                      ? "border-[color:var(--accent)] bg-[color:var(--accent-muted)]"
                      : "border-[color:var(--border)] bg-[color:var(--bg-0)] hover:border-[color:var(--border-active)]"
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <div className="flex items-center gap-3">
                      <option.icon
                        className={clsx(
                          "h-5 w-5",
                          isActive ? "text-[color:var(--accent)]" : "text-[color:var(--text-1)]"
                        )}
                      />
                      <span
                        className={clsx(
                          "font-medium",
                          isActive ? "text-[color:var(--text-0)]" : "text-[color:var(--text-1)]"
                        )}
                      >
                        {option.label}
                      </span>
                    </div>
                    {isActive && (
                      <div className="h-2 w-2 rounded-full bg-[color:var(--accent)]" />
                    )}
                  </div>
                  <p className="mt-2 text-sm text-[color:var(--text-2)]">{option.describe}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
