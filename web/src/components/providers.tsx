"use client";

import { useState, type ReactNode } from "react";
import { WagmiProvider, type State } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConfig } from "@/lib/wagmi";

export function Providers({ children, initialState }: { children: ReactNode; initialState?: State }) {
  const [config] = useState(getConfig);
  const [client] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config} initialState={initialState}>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
