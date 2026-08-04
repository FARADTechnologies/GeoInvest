import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DEFAULT_VIEW } from "@/lib/view-routes";

/**
 * Root page = the default dashboard screen. Every other screen has its own
 * path (see src/app/[view]/page.tsx and lib/view-routes.ts).
 *
 * Wrapped in <AuthGate>, so unauthenticated users are redirected to /login
 * before any dashboard query runs. Providers (ThemeProvider + QueryClient)
 * live in src/app/layout.tsx so /login and any other route also has them.
 */
export default function Home() {
  return (
    <AuthGate>
      <DashboardShell initialView={DEFAULT_VIEW} />
    </AuthGate>
  );
}
