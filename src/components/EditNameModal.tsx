import React, { useState, useEffect } from 'react';
import { X, Check, User, Sparkles, ShieldCheck, Tag } from 'lucide-react';
import { BorrowerProfile } from '../types';

interface EditNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: BorrowerProfile;
  onSaveName: (updated: { displayName: string; fullName: string; sectorLabel?: string }) => void;
}

export const EditNameModal: React.FC<EditNameModalProps> = React.memo(({
  isOpen,
  onClose,
  profile,
  onSaveName,
}) => {
  const [displayName, setDisplayName] = useState(profile.displayName || '');
  const [fullName, setFullName] = useState(profile.fullName || '');
  const [sectorLabel, setSectorLabel] = useState(profile.sectorLabel || '');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDisplayName(profile.displayName || '');
      setFullName(profile.fullName || '');
      setSectorLabel(profile.sectorLabel || '');
      setIsSaved(false);
    }
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDisplay = displayName.trim() || fullName.trim().split(' ')[0] || 'User';
    const cleanFull = fullName.trim() || cleanDisplay;
    const cleanSector = sectorLabel.trim() || profile.sectorLabel;

    onSaveName({
      displayName: cleanDisplay,
      fullName: cleanFull,
      sectorLabel: cleanSector,
    });

    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 450);
  };

  return (
    <div
      id="edit-name-modal-backdrop"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs touch-manipulation animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="edit-name-modal-sheet"
        className="bg-[#fdfbf7] w-full max-w-md rounded-t-3xl sm:rounded-3xl border-t sm:border border-[#e8e2d5] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]"
      >
        {/* Drag handle for mobile */}
        <div className="w-10 h-1.25 bg-[#d6cbba] rounded-full mx-auto my-2.5 sm:hidden shrink-0" />

        {/* Modal Header */}
        <div className="px-5 pt-3 pb-3 flex items-center justify-between border-b border-[#e8e2d5] bg-white/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#123524] text-[#98d4ad] flex items-center justify-center shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#123524]">
                Set Your Name
              </h2>
              <p className="text-[11px] text-[#6e7f74] font-mono">
                Personalize greetings & credit risk passport
              </p>
            </div>
          </div>
          <button
            id="close-edit-name-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#f0ece4] hover:bg-[#e4ded4] flex items-center justify-center text-[#123524] transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Live Preview Card */}
          <div className="p-3.5 rounded-2xl bg-[#f0f7f2] border border-[#cfe6d6] space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-[#1e543b] uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-[#15803d]" />
              <span>Live Header & Passport Preview</span>
            </div>
            <p className="font-display text-xl font-bold text-[#123524]">
              Good morning, {displayName.trim() || 'Your Name'}.
            </p>
            <div className="flex items-center gap-1 text-[12px] text-[#4a6353]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#15803d]" />
              <span>Risk Passport: <strong>{fullName.trim() || 'Your Full Name'}</strong></span>
            </div>
          </div>

          {/* Display Name Input */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-mono uppercase font-bold text-[#123524]">
              Display Name / First Name *
            </label>
            <input
              id="input-display-name"
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Nilavra, Alex, Priya..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6cbba] text-[#123524] text-[14px] font-medium placeholder:text-[#9ea8a0] focus:outline-hidden focus:ring-2 focus:ring-[#123524] focus:border-transparent transition-all"
              autoFocus
            />
            <p className="text-[11px] text-[#6e7f74]">
              This is the greeting name displayed at the top of the home screen.
            </p>
          </div>

          {/* Full Legal Name Input */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-mono uppercase font-bold text-[#123524]">
              Full Legal / Business Name
            </label>
            <input
              id="input-full-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Nilavra Sen, Alex Rivera..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6cbba] text-[#123524] text-[14px] font-medium placeholder:text-[#9ea8a0] focus:outline-hidden focus:ring-2 focus:ring-[#123524] focus:border-transparent transition-all"
            />
            <p className="text-[11px] text-[#6e7f74]">
              Used on the downloadable PDF Risk Report & Underwriting Passport.
            </p>
          </div>

          {/* Sector / Vocation */}
          <div className="space-y-1.5">
            <label className="block text-[12px] font-mono uppercase font-bold text-[#123524]">
              Sector & Cadence Label (Optional)
            </label>
            <input
              id="input-sector-label"
              type="text"
              value={sectorLabel}
              onChange={(e) => setSectorLabel(e.target.value)}
              placeholder="e.g. Smallholder Agriculture, Gig Economy, Freelancer..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#d6cbba] text-[#123524] text-[14px] font-medium placeholder:text-[#9ea8a0] focus:outline-hidden focus:ring-2 focus:ring-[#123524] focus:border-transparent transition-all"
            />
          </div>

          {/* Quick preset chips */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-mono font-bold text-[#6e7f74] uppercase">
              Quick Suggestions:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { disp: 'Nilavra', full: 'Nilavra Sen', sec: 'Digital Technology & Freelancing' },
                { disp: 'Alex', full: 'Alex Rivera', sec: 'Independent Services & Retail' },
                { disp: 'Ravi', full: 'Ravi Verma', sec: 'Smallholder Agriculture & Trade' },
                { disp: 'Priya', full: 'Priya Patel', sec: 'Gig Economy Quick-Commerce Fleet' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.disp}
                  onClick={() => {
                    setDisplayName(item.disp);
                    setFullName(item.full);
                    setSectorLabel(item.sec);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#faf8f2] border border-[#e5ded0] text-[11px] font-medium text-[#123524] hover:bg-[#ede8dc] active:scale-95 transition-all"
                >
                  {item.disp}
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-3">
            <button
              id="save-name-submit-btn"
              type="submit"
              disabled={!displayName.trim() && !fullName.trim()}
              className="w-full py-3 px-4 rounded-xl bg-[#123524] hover:bg-[#1a4a33] text-white font-semibold text-[14px] flex items-center justify-center gap-2 shadow-md transition-all active:scale-98 disabled:opacity-50"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-[#98d4ad]" />
                  <span>Name Updated!</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-[#98d4ad]" />
                  <span>Save & Apply Name</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
});
