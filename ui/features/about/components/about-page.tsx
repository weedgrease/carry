import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import { toast } from "sonner";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { settingsKey, useSettings } from "@/features/settings/api/queries";
import { showUpdateAvailableToast } from "@/features/settings/api/show-update-toast";
import { api, toErrorMessage } from "@/lib/tauri-client";

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "Never";
  const diffSec = Math.round((Date.now() - then) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

/** About page: app version, project links, and a manual update-check button. */
export function AboutPage() {
  const [version, setVersion] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const { data: settings } = useSettings();
  const qc = useQueryClient();

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const openExternal = (url: string) => {
    open(url).catch(() => {});
  };

  const checkForUpdates = async () => {
    setChecking(true);
    try {
      const info = await api.checkForUpdate();
      qc.invalidateQueries({ queryKey: settingsKey });
      if (info.available) {
        showUpdateAvailableToast(info);
      } else {
        toast.success("You're on the latest version.");
      }
    } catch (e) {
      toast.error(toErrorMessage(e, "Update check failed"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <Section title="carry">
          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <p className="text-2xl font-semibold tracking-tight">carry</p>
              {version && (
                <p className="text-sm text-muted-foreground">v{version}</p>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Transfer Steam game configuration files between accounts on the
              same machine, with automatic backups and signed auto-updates.
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Button
                variant="outline"
                size="sm"
                onClick={checkForUpdates}
                disabled={checking}
              >
                {checking ? "Checking…" : "Check for updates"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Last checked: {formatRelativeTime(settings?.last_update_check ?? null)}
              </p>
            </div>
          </div>
        </Section>

        <Section title="Maintainers">
          <p className="text-sm">Kevin, Noah, and Bart</p>
        </Section>

        <Section title="Source">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openExternal("https://github.com/weedgrease/carry")}
          >
            github.com/weedgrease/carry
          </Button>
        </Section>
      </div>
    </div>
  );
}
