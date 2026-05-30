import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

/**
 * Root page = dashboard. Wrapped in <AuthGate>, so unauthenticated users
 * are redirected to /login before any dashboard query runs.
 *
 * Providers (ThemeProvider + QueryClient) live in src/app/layout.tsx so
 * that /login and any other route also has access to them.
 */
export default function Home() {
  return (
    <AuthGate>
      <DashboardShell />
    </AuthGate>
  );
}
