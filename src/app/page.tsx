import { AppShell } from "@/components/AppShell";
import { omdbKey } from "@/lib/omdb";
import { hasTmdb } from "@/lib/tmdb";

// Rendered per request so the key checks reflect the running environment
// rather than whatever was set when the build ran.
export const dynamic = "force-dynamic";

export default function Home() {
  // Read on the server so keys are never shipped to the browser — only
  // whether each one is configured.
  return <AppShell hasOmdb={Boolean(omdbKey())} hasTmdb={hasTmdb()} />;
}
