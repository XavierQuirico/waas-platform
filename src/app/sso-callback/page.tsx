"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SSOCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#08090A" }}>
      <AuthenticateWithRedirectCallback />
    </div>
  );
}
