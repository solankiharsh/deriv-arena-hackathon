"use client";

import type { ReactNode } from 'react';
import WalletProvider from './WalletProvider';

export default function AppProviders({ children }: { children: ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
