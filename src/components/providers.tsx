"use client";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { PageTitleSync } from "./page-title-sync";
import { DEFAULT_SITE_TITLE } from "@/lib/site-brand";

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  return (
    <SessionProvider>
      <QueryClientProvider client={qc}>{children}<PageTitleSync defaultTitle={DEFAULT_SITE_TITLE} /></QueryClientProvider>
    </SessionProvider>
  );
}
