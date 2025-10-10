import React from 'react';

type Props = { size?: number; className?: string };

export const FootballIcon: React.FC<Props> = ({ size = 28, className }) => (
  <svg
    width={size} height={size} viewBox="0 0 64 64"
    className={className} fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
  >
    {/* Blyantaktige, litt ujevne linjer for “håndtegnet” følelse */}
    <circle cx="32" cy="32" r="29" />
    <path d="M32 13l9 6 3 10-7 8h-10l-7-8 3-10 9-6z" />
    <path d="M23 29l9 6 9-6M32 13l0 9M23 29l-7 8M41 29l7 8M32 35l0 10" />
  </svg>
);

export const MenuIcon: React.FC<Props> = ({ size = 26, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <path d="M3 6h18M3 12h18M3 18h18" />
  </svg>
);

export const HomeIcon: React.FC<Props> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" />
  </svg>
);

export const GearIcon: React.FC<Props> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.07a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06A2 2 0 1 1 4.2 16.9l.06-.06A1.65 1.65 0 0 0 4.6 15 1.65 1.65 0 0 0 3.09 14H3a2 2 0 0 1 0-4h.07A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.26 7.18l-.06-.06A2 2 0 1 1 7 4.29l.06.06A1.65 1.65 0 0 0 8.82 4.6 1.65 1.65 0 0 0 10.33 3.09V3a2 2 0 0 1 4 0v.07c0 .67.39 1.27 1 1.51.5.22 1.09.13 1.51-.33l.06-.06A2 2 0 1 1 19.71 7l-.06.06c-.46.42-.55 1.01-.33 1.51.24.61.84 1 1.51 1H21a2 2 0 0 1 0 4h-.07c-.67 0-1.27.39-1.51 1z"/>
  </svg>
);

export const ListIcon: React.FC<Props> = ({ size = 20, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>
  </svg>
);
