import React from 'react';
import { Home, TrendingUp, Mail, MoreHorizontal } from 'lucide-react';

export type TabType = 'home' | 'cashflow' | 'actions' | 'more';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  pendingActionsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  pendingActionsCount,
}) => {
  const tabs = [
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
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#faf8f2]/95 backdrop-blur-md border-t border-[#e8e1d5] px-6 py-2 z-40">
      <div className="flex items-center justify-between">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onChangeTab(tab.id)}
              className="flex flex-col items-center justify-center py-1 px-3 relative transition-all group"
            >
              <div
                className={`w-10 h-8 rounded-full flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-[#d8e7dc] text-[#123524]'
                    : 'text-[#69796e] group-hover:text-[#123524]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {tab.badge && (
                  <span className="absolute top-0 right-3 w-4 h-4 bg-[#c05e2b] text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-[#faf8f2]">
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
};
