import { notFound } from "next/navigation";

import { AuthGate } from "@/components/auth/auth-gate";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { ALL_SLUGS, viewForSlug } from "@/lib/view-routes";

/**
 * One dashboard screen per URL — /ads, /market, /portfolio and so on.
 *
 * Static routes (/login, /terms, /privacy) take precedence over this dynamic
 * segment in the App Router, so they keep working. Anything that isn't a known
 * screen 404s rather than silently rendering the default view.
 */
export function generateStaticParams() {
  return ALL_SLUGS.map((view) => ({ view }));
}

export default async function DashboardViewPage({
  params
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  const initialView = viewForSlug(view);
  if (!initialView) notFound();

  return (
    <AuthGate>
      <DashboardShell initialView={initialView} />
    </AuthGate>
  );
}
