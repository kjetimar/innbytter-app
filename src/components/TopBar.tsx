import React from 'react';
import { FootballIcon, MenuIcon } from './Icons';

type Props = { title?: string; onMenu: () => void };

export default function TopBar({ title = 'Innbytter', onMenu }: Props) {
  return (
    <header className="sticky top-0 z-30 h-14 w-full bg-slate-900/80 backdrop-blur flex items-center justify-between px-3 border-b border-slate-800">
      <div className="flex items-center gap-2">
        <FootballIcon size={28} />
        <span className="text-slate-100 font-semibold tracking-wide">{title}</span>
      </div>
      <button
        aria-label="Meny"
        onClick={onMenu}
        className="p-2 rounded-xl hover:bg-slate-800 active:bg-slate-700 transition"
      >
        <MenuIcon />
      </button>
    </header>
  );
}
