import React from 'react';
import { FootballIcon, HomeIcon, GearIcon, ListIcon } from './Icons';
import { Link } from 'react-router-dom';

type Props = { open: boolean; onClose: () => void };

export default function HamburgerMenu({ open, onClose }: Props) {
  return (
    <>
      {/* Bakgrunn */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      {/* Skuff */}
      <aside
        className={`fixed left-0 top-0 z-50 h-full w-[82%] max-w-[360px] bg-slate-900 border-r border-slate-800 transition-transform ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-slate-800">
          <FootballIcon size={26} />
          <span className="text-slate-100 font-semibold">Innbytter</span>
        </div>

        <nav className="py-2">
          <Link to="/" onClick={onClose} className="flex items-center gap-3 px-4 h-12 text-slate-200 hover:bg-slate-800">
            <HomeIcon /><span>Hjem</span>
          </Link>
          <Link to="/plan/current" onClick={onClose} className="flex items-center gap-3 px-4 h-12 text-slate-200 hover:bg-slate-800">
            <ListIcon /><span>Plan</span>
          </Link>
          <Link to="/settings" onClick={onClose} className="flex items-center gap-3 px-4 h-12 text-slate-200 hover:bg-slate-800">
            <GearIcon /><span>Innstillinger</span>
          </Link>

          <div className="mt-4 px-4 text-xs text-slate-500">© Innbytter</div>
        </nav>
      </aside>
    </>
  );
}
