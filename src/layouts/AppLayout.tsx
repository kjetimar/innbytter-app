import React, { useState } from 'react';
import TopBar from '@/components/TopBar';
import HamburgerMenu from '@/components/HamburgerMenu';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <TopBar onMenu={() => setMenuOpen(true)} />
      <HamburgerMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="px-3 pb-24">{children}</main>
    </div>
  );
}
