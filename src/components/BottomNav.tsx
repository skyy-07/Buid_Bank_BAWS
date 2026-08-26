import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Home, TrendingUp, Mail, MoreHorizontal } from 'lucide-react';

export type TabType = 'home' | 'cashflow' | 'actions' | 'more';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingActionsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = React.memo(({
  activeTab,
  onChangeTab,
  pendingActionsCount,
}) => {
  const tabs = useMemo(() => [
    {
      id: 'home' as TabType,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'cashflow' as TabType,
      label: 'Cash flow',
      icon: TrendingUp,
    },
    {
      id: 'actions' as TabType,
      label: 'Actions',
      icon: Mail,
      badge: pendingActionsCount > 0 ? pendingActionsCount : undefined,
    },
    {
      id: 'more' as TabType,
      label: 'More',
      icon: MoreHorizontal,
    },
  ], [pendingActionsCount]);

  return (
    <nav
      id="mobile-bottom-nav"
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#faf8f2]/95 backdrop-blur-md border-t border-[#e8e1d5] px-3 sm:px-6 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-40 select-none shadow-[0_-4px_16px_rgba(0,0,0,0.03)]"
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className="flex flex-col items-center justify-center py-1 px-2.5 min-w-[64px] min-h-[48px] relative transition-transform duration-100 active:scale-95 group focus:outline-hidden touch-manipulation"
              aria-label={tab.label}
            >
              <div className="relative w-12 h-7.5 flex items-center justify-center">
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                    className="absolute inset-0 bg-[#d8e7dc] rounded-full shadow-2xs"
                  />
                )}
                <Icon
                  className={`w-5 h-5 relative z-10 transition-colors ${
                    isActive ? 'text-[#123524] stroke-[2.2]' : 'text-[#69796e] stroke-[1.8] group-hover:text-[#123524]'
                  }`}
                />
                {tab.badge && (
                  <span className="absolute -top-1 -right-1 z-20 w-4 h-4 bg-[#c05e2b] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#faf8f2]">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[11px] mt-0.5 tracking-tight font-medium transition-colors ${
                  isActive
                    ? 'text-[#123524] font-semibold'
                    : 'text-[#69796e] group-hover:text-[#123524]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
