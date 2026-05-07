import { convertFileSrc } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";
import { api } from "@/lib/tauri-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * Avatar image with a two-letter initials fallback. If no `initialPath` is
 * provided, fetches and caches the avatar via `ensureAvatar`.
 */
export function AvatarImageBlock({
  steamId64,
  initialPath,
  fallback,
  className,
}: {
  steamId64: string;
  initialPath?: string | null;
  fallback: string;
  className?: string;
}) {
  // Drive the local-file src off props so a refetch that flips
  // `initialPath` from null to a real path actually swaps the image.
  // `useState`'s initialiser only runs on first mount, so we'd otherwise
  // be stuck on the first render's value forever.
  const localSrc = initialPath ? convertFileSrc(initialPath) : null;
  const [fetched, setFetched] = useState<string | null>(null);
  const src = localSrc ?? fetched;
  useEffect(() => {
    if (src) return;
    let alive = true;
    api.ensureAvatar(steamId64)
      .then((path) => alive && setFetched(convertFileSrc(path)))
      .catch(() => {});
    return () => { alive = false; };
  }, [steamId64, src]);
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt={fallback} />}
      <AvatarFallback>{fallback.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
