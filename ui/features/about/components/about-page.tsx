import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { open } from "@tauri-apps/plugin-shell";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";

export function AboutPage() {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const openExternal = (url: string) => {
    open(url).catch(() => {});
  };

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
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
