import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Providers } from "@/components/providers";

export default function Home() {
  return (
    <Providers>
      <DashboardShell />
    </Providers>
  );
}
