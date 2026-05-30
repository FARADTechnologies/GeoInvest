"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { isAuthed } from "@/lib/auth";

/**
 * Client-side auth gate.
 *
 * Wrap any protected tree (e.g. the dashboard) with <AuthGate>. On mount it
 * reads the token from localStorage; if missing, it pushes the user to
 * `/login` and renders nothing. This is intentionally client-side — the
 * mock backend has no session cookie, so middleware can't see the token.
 *
 * When you wire a real backend with httpOnly cookies, replace this with
 * Next.js middleware that reads the cookie.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isAuthed()) {
      // Preserve where the user wanted to go.
      const redirect = pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${redirect}`);
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) return null;
  return <>{children}</>;
}
