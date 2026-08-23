import React, { useState, useEffect } from 'react';
import { Bell, Sparkles, Building2, ShieldCheck, User, LogIn, Wifi, WifiOff } from 'lucide-react';
import { BorrowerProfile, OAuthUser } from '../types';

interface HeaderProps {
  profile: BorrowerProfile;
  currentUser?: OAuthUser | null;
  onOpenNotifications: () => void;
  onOpenBankModal?: () => void;
  onOpenAuthModal?: () => void;
  unreadCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  profile,
  currentUser,
  onOpenNotifications,
  onOpenBankModal,
  onOpenAuthModal,
  unreadCount,
}) => {
  const bankCount = profile.connectedBankAccounts?.length || 2;
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

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
    <header className="px-5 pt-4 pb-2">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-[#123524] flex items-center justify-center text-[#e8f5ec] shadow-sm">
            <Sparkles className="w-5 h-5 text-[#98d4ad]" />
          </div>
          <span className="font-display text-2xl font-bold tracking-tight text-[#123524]">
            baws
          </span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Offline / Online indicator */}
          {!isOnline && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-mono font-bold text-amber-800"
              title="You are currently offline. Using cached profile data."
            >
              <WifiOff className="w-3 h-3 text-amber-700" />
              <span>Offline</span>
            </div>
          )}

          {/* Live Bank Feed Pill */}
          <button
            onClick={onOpenBankModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 border border-[#e5ded0] text-[11px] font-medium text-[#123524] hover:bg-white transition-all shadow-xs active:scale-95"
            title="Real-Time Bank Stream Status"
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <Building2 className="w-3.5 h-3.5 text-[#123524]" />
            <span className="hidden sm:inline font-mono font-semibold">{bankCount} Banks</span>
            <span className="sm:hidden font-mono font-semibold">Live</span>
          </button>


          {/* User Profile / OAuth Login Pill */}
          <button
            onClick={onOpenAuthModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 border border-[#e5ded0] text-[11px] font-medium text-[#123524] hover:bg-white transition-all shadow-xs active:scale-95"
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

          <button
            onClick={onOpenNotifications}
            className="relative w-10 h-10 rounded-full bg-white/90 border border-[#e5ded0] flex items-center justify-center text-[#123524] hover:bg-white transition-all shadow-xs active:scale-95"
            aria-label="Notifications"
          >
            <Bell className="w-4.5 h-4.5" />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-[#d97706] rounded-full ring-2 ring-white" />
            )}
          </button>
        </div>
      </div>

      {/* Date & Personalized Greeting */}
      <div className="mt-5">
        <p className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
          {profile.greetingDate}
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#123524] tracking-tight mt-1 leading-[1.15]">
          Good morning,<br />
          {profile.displayName}.
        </h1>
      </div>
    </header>
  );
};
