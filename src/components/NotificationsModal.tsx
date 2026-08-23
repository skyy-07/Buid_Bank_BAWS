import React from 'react';
import { X, Bell, ShieldAlert, Sparkles, CheckCircle2, TrendingUp, AlertCircle } from 'lucide-react';
import { BorrowerProfile } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BorrowerProfile;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-[#faf8f2] rounded-3xl border border-[#e8e2d5] shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#123524]">
            <Bell className="w-5 h-5" />
            <h3 className="font-display text-2xl font-bold">
              Activity & Alerts
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white border border-[#e2dacb] flex items-center justify-center text-[#6e7f74] hover:text-[#123524]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 bg-white rounded-2xl border border-[#e8e2d5] space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[13px] text-[#123524]">
                  {n.title}
                </span>
                <span className="text-[10px] font-mono text-[#8a9b8f]">
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
          onClick={onClose}
          className="w-full py-3 bg-[#123524] text-white font-semibold rounded-2xl hover:bg-[#1b4332]"
        >
          Close
        </button>
      </div>
    </div>
  );
};
