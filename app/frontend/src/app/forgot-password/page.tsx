"use client";

// /forgot-password — thin wrapper that mounts the auth flow already
// opened in "forgot" mode. Most of the time users reach the forgot
// state from inside /login itself, but a deep-linkable URL is nice.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  // Push the user to /login (which holds the full flow); we send a hash
  // so future code can open the right tab. For now this is just a
  // redirect — keeps the URL valid without duplicating the layout.
  useEffect(() => {
    router.replace("/login#forgot");
  }, [router]);
  return null;
}
