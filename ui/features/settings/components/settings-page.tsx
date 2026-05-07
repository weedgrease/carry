import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const update = useUpdateSettings();
  const { theme, setTheme } = useTheme();
  const [steamPath, setSteamPath] = useState("");
  // `retention` holds the user-visible "keep last N" number, even when the
  // pruning toggle is off — so unchecking the toggle restores their last
  // preferred number. The wire format treats 0 as "never auto-delete".
  const [retention, setRetention] = useState(20);
  const [keepAllBackups, setKeepAllBackups] = useState(false);
  const [hideUntitled, setHideUntitled] = useState(true);

  useEffect(() => {
    if (settings) {
      setSteamPath(settings.steam_path_override ?? "");
      const stored = settings.backup_retention_per_pair;
      setKeepAllBackups(stored === 0);
      // Don't clobber the input back to 0 when "keep all" was chosen — keep
      // the existing user-visible value so they can toggle back without losing it.
      if (stored !== 0) setRetention(stored);
      setHideUntitled(settings.hide_untitled_apps);
    }
  }, [settings]);

  const save = () => {
    if (!settings) return;
    update.mutate({
      ...settings,
      steam_path_override: steamPath ? steamPath : null,
      backup_retention_per_pair: keepAllBackups ? 0 : retention,
      hide_untitled_apps: hideUntitled,
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
        <div className="mx-auto max-w-2xl px-5 py-5">
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

          <Section title="Backup retention">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="keep-all-backups"
                  checked={keepAllBackups}
                  onCheckedChange={(v) => setKeepAllBackups(v === true)}
                />
                <Label htmlFor="keep-all-backups" className="text-sm font-normal cursor-pointer">
                  Keep every auto-backup forever
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="retention" className="text-sm">Keep last</Label>
                <Input
                  id="retention"
                  type="number"
                  min={1}
                  value={retention}
                  disabled={keepAllBackups}
                  onChange={(e) => setRetention(Number(e.target.value) || 1)}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">per game, per account</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Manual backups are never auto-deleted.
              </p>
            </div>
          </Section>

          <Section title="Game list">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hide-untitled"
                  checked={hideUntitled}
                  onCheckedChange={(v) => setHideUntitled(v === true)}
                />
                <Label htmlFor="hide-untitled" className="text-sm font-normal cursor-pointer">
                  Hide untitled apps from the games list
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Untitled apps are usually Steam internals (Steam Client, Steam Input, etc.).
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  api.clearGamesCache()
                    .then(() => {
                      queryClient.removeQueries({ queryKey: ["games"] });
                      toast.success("Game cache cleared. Names + images will refetch on next visit.");
                    })
                    .catch((e: { message: string }) => toast.error(e.message));
                }}
              >
                Clear cached game names + images
              </Button>
            </div>
          </Section>

          <Section title="Appearance">
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
          </Section>
        </div>
      </div>

      <div className="border-t bg-background/95 backdrop-blur px-5 py-5 flex items-center justify-end gap-4">
        <Button onClick={save} disabled={update.isPending}>
          {update.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}
