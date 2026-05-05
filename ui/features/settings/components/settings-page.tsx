import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getVersion } from "@tauri-apps/api/app";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Section } from "@/components/layout/section";
import { useSettings, useUpdateSettings } from "../api/queries";
import { api } from "@/lib/tauri-client";
import { useTheme } from "@/app/providers/theme-provider";

export function SettingsPage() {
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const [steamPath, setSteamPath] = useState("");
  const [retention, setRetention] = useState(20);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setSteamPath(settings.steam_path_override ?? "");
      setRetention(settings.backup_retention_per_pair);
    }
  }, [settings]);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  const save = () => {
    if (!settings) return;
    update.mutate({
      ...settings,
      steam_path_override: steamPath ? steamPath : null,
      backup_retention_per_pair: retention,
    }, {
      onSuccess: () => toast.success("Settings saved"),
      onError: (e: { message: string }) => toast.error(e.message),
    });
  };

  const pickPath = async () => {
    try {
      const picked = await api.pickSteamPath();
      if (picked) setSteamPath(picked);
    } catch (e: unknown) {
      toast.error((e as { message: string }).message);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6">
          <Section title="Steam install path" description="Override the auto-detected folder">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                value={steamPath}
                placeholder="(auto-detect)"
                onChange={(e) => setSteamPath(e.target.value)}
                className="flex-1 min-w-0"
              />
              <Button variant="outline" onClick={pickPath} className="sm:w-auto">
                Browse...
              </Button>
            </div>
          </Section>

          <Section
            title="Backup retention"
            description="Auto-delete old auto-backups when more than this number exist per (account, game). Manual backups are never auto-deleted."
          >
            <div className="flex items-center gap-2">
              <Label htmlFor="retention" className="text-sm">Keep last</Label>
              <Input
                id="retention"
                type="number"
                min={1}
                value={retention}
                onChange={(e) => setRetention(Number(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">most recent</span>
            </div>
          </Section>

          <Section title="Appearance" description="Theme">
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <div className="flex justify-end border-t pt-4 mt-2">
            <Button onClick={save} disabled={update.isPending}>Save</Button>
          </div>
        </div>
      </div>

      {version && (
        <div className="border-t py-2.5">
          <p className="text-xs text-muted-foreground text-center">
            Carry v{version}
          </p>
        </div>
      )}
    </div>
  );
}
