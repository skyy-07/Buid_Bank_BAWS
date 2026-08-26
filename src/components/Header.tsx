import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, Building2, ShieldCheck, User, LogIn, Wifi, WifiOff, Pencil, Sun, Moon, Contrast } from 'lucide-react';
import { BorrowerProfile, OAuthUser } from '../types';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  profile: BorrowerProfile;
  currentUser?: OAuthUser | null;
  onOpenNotifications: () => void;
  onOpenBankModal?: () => void;
  onOpenAuthModal?: () => void;
  onOpenEditName?: () => void;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = React.memo(({
  profile,
  currentUser,
  onOpenNotifications,
  onOpenBankModal,
  onOpenAuthModal,
  onOpenEditName,
  unreadCount,
}) => {
  const { theme, setTheme } = useTheme();
  const bankCount = profile.connectedBankAccounts?.length || 2;
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('contrast');
    else setTheme('light');
  };

  useEffect(() => {
    const setOnline = () => setIsOnline(true);
    const setOffline = () => setIsOnline(false);

    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  return (
    <header id="app-header" className="px-4 sm:px-5 pt-3 sm:pt-4 pb-2 select-none">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#123524] flex items-center justify-center text-[#e8f5ec] shadow-xs shrink-0">
            <Sparkles className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-[#98d4ad]" />
          </div>
          <span className="font-display text-2xl sm:text-2xl font-bold tracking-tight text-[#123524]">
            baws
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Offline / Online indicator */}
          {!isOnline && (
            <div
              id="offline-pill"
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-mono font-bold text-amber-800"
              title="You are currently offline. Using cached profile data."
            >
              <WifiOff className="w-3 h-3 text-amber-700" />
              <span>Offline</span>
            </div>
          )}

          {/* Live Bank Feed Pill */}
          <button
            id="header-bank-btn"
            onClick={onOpenBankModal}
            className="flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-full bg-white/90 border border-[#e5ded0] text-[11px] font-medium text-[#123524] hover:bg-white active:bg-[#ede8dc] transition-all shadow-2xs active:scale-95 touch-manipulation"
            title="Real-Time Bank Stream Status"
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <Building2 className="w-3.5 h-3.5 text-[#123524]" />
            <span className="hidden xs:inline sm:inline font-mono font-semibold">{bankCount} Banks</span>
            <span className="xs:hidden sm:hidden font-mono font-semibold">Live</span>
          </button>

          {/* User Profile / OAuth Login Pill */}
          <button
            id="header-auth-btn"
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-full bg-white/90 border border-[#e5ded0] text-[11px] font-medium text-[#123524] hover:bg-white active:bg-[#ede8dc] transition-all shadow-2xs active:scale-95 touch-manipulation"
            title={currentUser ? `Logged in as ${currentUser.name} (${currentUser.role})` : 'Sign in with OAuth'}
          >
            {currentUser?.picture ? (
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="w-4 h-4 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-[#123524]" />
            )}
            <span className="hidden sm:inline font-mono font-semibold truncate max-w-[90px]">
              {currentUser ? currentUser.name.split(' ')[0] : 'Sign In'}
            </span>
          </button>

          {/* Theme Quick Switcher (Light / Dark / High Contrast) */}
          <button
            id="header-theme-cycle-btn"
            onClick={cycleTheme}
            className="w-10 h-10 min-w-[40px] rounded-full bg-white/90 border border-[#e5ded0] flex items-center justify-center text-[#123524] hover:bg-white active:bg-[#ede8dc] transition-all shadow-2xs active:scale-95 touch-manipulation"
            title={`Current theme: ${theme === 'dark' ? 'Dark Mode' : theme === 'contrast' ? 'High Contrast' : 'Light (Natural Paper)'}. Tap to switch.`}
            aria-label="Toggle Theme Mode"
          >
            {theme === 'dark' ? (
              <Moon className="w-4.5 h-4.5 text-[#4ade80]" />
            ) : theme === 'contrast' ? (
              <Contrast className="w-4.5 h-4.5 text-black" />
            ) : (
              <Sun className="w-4.5 h-4.5 text-[#123524]" />
            )}
          </button>

          <button
            id="header-notifications-btn"
            onClick={onOpenNotifications}
            className="relative w-10 h-10 min-w-[40px] rounded-full bg-white/90 border border-[#e5ded0] flex items-center justify-center text-[#123524] hover:bg-white active:bg-[#ede8dc] transition-all shadow-2xs active:scale-95 touch-manipulation"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#d97706] rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {/* Date & Personalized Greeting with Click-to-Edit Name */}
      <div className="mt-3.5 sm:mt-5">
        <p className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
          {profile.greetingDate}
        </p>
        <div className="flex items-baseline justify-between gap-2 mt-1">
          <button
            id="header-edit-name-btn"
            onClick={onOpenEditName}
            className="text-left group focus:outline-hidden touch-manipulation flex items-baseline gap-2 cursor-pointer"
            title="Click to change your display name"
          >
            <h1 className="font-display text-2xl xs:text-3xl sm:text-4xl font-bold text-[#123524] tracking-tight leading-[1.15]">
              Good morning,<br />
              <span className="group-hover:text-[#1e543b] transition-colors inline-flex items-center gap-1.5 border-b-2 border-dashed border-[#123524]/25 group-hover:border-[#123524]">
                {profile.displayName}.
                <Pencil className="w-4 h-4 sm:w-5 sm:h-5 text-[#6e7f74] group-hover:text-[#123524] transition-transform group-hover:scale-110 opacity-75 group-hover:opacity-100" />
              </span>
            </h1>
          </button>

          {onOpenEditName && (
            <button
              onClick={onOpenEditName}
              className="px-2.5 py-1 rounded-full bg-white/80 border border-[#e5ded0] text-[11px] font-mono font-medium text-[#4a5c50] hover:text-[#123524] hover:bg-white active:scale-95 transition-all shadow-2xs shrink-0 self-end mb-1"
            >
              Edit Name
            </button>
          )}
        </div>
      </div>
    </header>
  );
});
