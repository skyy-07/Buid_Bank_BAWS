import React from 'react';
import { X, Bell, ShieldAlert, Sparkles, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { BorrowerProfile } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BorrowerProfile;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = React.memo(({
  isOpen,
  onClose,
  profile,
}) => {
  if (!isOpen) return null;

  const notifications = [
    {
      id: 'notif-1',
      title: 'Adaptive Lookback Adjusted to 8 Weeks',
      time: '6d ago',
      desc: 'BAWS isolated uneven monsoon cashflow signals without lowering your baseline credit rating.',
      type: 'info',
    },
    {
      id: 'notif-2',
      title: 'Micro-Savings Liquid Sweep Successful',
      time: '1d ago',
      desc: '₹430 automatically transferred to your liquid buffer following Mandi settlement.',
      type: 'success',
    },
    {
      id: 'notif-3',
      title: 'Downside Tail Risk Alert (VaR ↑ 12%)',
      time: 'Just now',
      desc: 'Action recommended: Ring-fence ₹6,000 for the next 14 days to preserve 71% resilience.',
      type: 'warning',
    },
  ];

  return (
    <div
      id="notifications-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-xs touch-manipulation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="notifications-modal-sheet"
        className="w-full max-w-md bg-[#faf8f2] rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#e8e2d5] shadow-2xl p-5 sm:p-6 space-y-4 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain animate-in slide-in-from-bottom duration-200 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        {/* Mobile Drag Handle */}
        <div className="w-10 h-1.25 bg-[#d6cbba] rounded-full mx-auto mb-1 sm:hidden shrink-0" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#123524]">
            <Bell className="w-5 h-5 text-[#1b4332]" />
            <h3 className="font-display text-xl sm:text-2xl font-bold">
              Activity & Alerts
            </h3>
          </div>
          <button
            id="notifications-modal-close-btn"
            onClick={onClose}
            className="w-9 h-9 min-w-[36px] min-h-[36px] rounded-full bg-white border border-[#e2dacb] flex items-center justify-center text-[#6e7f74] hover:text-[#123524] active:bg-[#ede8dc] transition-all"
            aria-label="Close notifications modal"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="space-y-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-3.5 sm:p-4 bg-white rounded-2xl border border-[#e8e2d5] space-y-1 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[13px] text-[#123524] leading-snug">
                  {n.title}
                </span>
                <span className="text-[10px] font-mono text-[#8a9b8f] shrink-0">
                  {n.time}
                </span>
              </div>
              <p className="text-[12px] text-[#4a5c50] leading-snug">
                {n.desc}
              </p>
            </div>
          ))}
        </div>

        <button
          id="notifications-modal-dismiss-btn"
          onClick={onClose}
          className="w-full min-h-[48px] py-3 bg-[#123524] text-white font-semibold rounded-2xl hover:bg-[#1b4332] active:bg-[#0c2419] transition-all"
        >
          Close
        </button>
      </div>
    </div>
  );
});
