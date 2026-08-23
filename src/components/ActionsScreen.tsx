import React, { useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import {
  Shield,
  Building,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  Check,
  ChevronRight,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { BorrowerProfile, ActionItem } from '../types';

interface ActionsScreenProps {
  profile: BorrowerProfile;
  onExecuteAction: (action: ActionItem) => void;
  onQuickComplete?: (actionId: string, actionType: ActionItem['actionType'], amount: number) => void;
  onSelectActionForDetails: (action: ActionItem) => void;
}

interface SwipeableActionCardProps {
  action: ActionItem;
  profile: BorrowerProfile;
  onExecute: (action: ActionItem) => void;
  onQuickComplete: (actionId: string, actionType: ActionItem['actionType'], amount: number) => void;
  onSelectForDetails: (action: ActionItem) => void;
}

const getActionIcon = (type: ActionItem['actionType']) => {
  switch (type) {
    case 'PROTECT_BUFFER':
      return { icon: Shield, bg: 'bg-[#faebd7]', color: 'text-[#c05e2b]', trackColor: '#123524' };
    case 'REPAY_FLEXIBLE':
      return { icon: Building, bg: 'bg-[#e2f0e8]', color: 'text-[#1b4332]', trackColor: '#1b4332' };
    case 'SWEEP_RESERVE':
      return { icon: TrendingUp, bg: 'bg-[#eaf4ed]', color: 'text-[#2d6a4f]', trackColor: '#2d6a4f' };
    case 'ACTIVATE_SHIELD':
      return { icon: AlertTriangle, bg: 'bg-[#fef3c7]', color: 'text-[#b45309]', trackColor: '#92400e' };
  }
};

const SwipeableActionCard: React.FC<SwipeableActionCardProps> = ({
  action,
  profile,
  onExecute,
  onQuickComplete,
  onSelectForDetails,
}) => {
  const [isThresholdMet, setIsThresholdMet] = useState(false);
  const [isSwiping, setIsSwiping] = useState(false);
  const isDone = action.status === 'COMPLETED';

  const x = useMotionValue(0);

  // Background visual transformations mapped to horizontal swipe distance
  const backgroundOpacity = useTransform(x, [0, 40, 110], [0.2, 0.7, 1]);
  const checkScale = useTransform(x, [0, 40, 95], [0.5, 0.85, 1.15]);
  const textTranslateX = useTransform(x, [0, 100], [0, 15]);

  const SWIPE_THRESHOLD = 95;
  const iconConfig = getActionIcon(action.actionType);
  const Icon = iconConfig.icon;

  const handleDrag = (_: any, info: any) => {
    if (isDone) return;
    setIsSwiping(true);
    if (info.offset.x >= SWIPE_THRESHOLD && !isThresholdMet) {
      setIsThresholdMet(true);
    } else if (info.offset.x < SWIPE_THRESHOLD && isThresholdMet) {
      setIsThresholdMet(false);
    }
  };

  const handleDragEnd = (_: any, info: any) => {
    setTimeout(() => setIsSwiping(false), 80);
    if (isDone) return;

    if (info.offset.x >= SWIPE_THRESHOLD) {
      // Confetti feedback
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.65 },
        colors: ['#123524', '#80a98f', '#d97706', '#10b981', '#ffffff'],
      });

      onQuickComplete(action.id, action.actionType, action.amount);
      setIsThresholdMet(false);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If the user just dragged, don't open modal
    if (isSwiping) return;
    onSelectForDetails(action);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.25 }}
      className="relative overflow-hidden rounded-3xl select-none"
    >
      {/* Background Swipe Reveal Track */}
      {!isDone && (
        <motion.div
          style={{ opacity: backgroundOpacity }}
          className={`absolute inset-0 rounded-3xl flex items-center justify-between px-6 transition-colors duration-200 ${
            isThresholdMet
              ? 'bg-gradient-to-r from-[#123524] via-[#1a4a33] to-[#10b981]'
              : 'bg-gradient-to-r from-[#1b4332] via-[#23583d] to-[#123524]'
          } text-white`}
        >
          <motion.div
            style={{ scale: checkScale, x: textTranslateX }}
            className="flex items-center gap-3"
          >
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isThresholdMet ? 'bg-white text-[#123524] shadow-md scale-110' : 'bg-white/20 text-white'} transition-all`}>
              <Check className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <p className="font-display font-bold text-[15px] leading-tight text-white">
                {isThresholdMet ? 'Release to complete!' : 'Swipe right to complete'}
              </p>
              <p className="text-[11px] text-[#b6dbc5] font-mono mt-0.5">
                {action.impactText}
              </p>
            </div>
          </motion.div>

          <span className="text-[11px] font-mono font-semibold tracking-wider uppercase text-white/70">
            {isThresholdMet ? 'Ready ✓' : 'Keep sliding →'}
          </span>
        </motion.div>
      )}

      {/* Draggable Foreground Card */}
      <motion.div
        drag={isDone ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 160 }}
        dragElastic={{ left: 0.05, right: 0.45 }}
        dragSnapToOrigin={true}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        style={{ x: isDone ? 0 : x }}
        whileTap={isDone ? {} : { cursor: 'grabbing' }}
        className={`relative z-10 bg-white rounded-3xl p-5 border shadow-xs transition-shadow cursor-grab active:cursor-grabbing group ${
          isDone
            ? 'border-[#d6ebd9] bg-[#fcfdfc] opacity-90'
            : isThresholdMet
            ? 'border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
            : 'border-[#e8e2d5] hover:border-[#123524]/40 hover:shadow-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Left Icon */}
          <div
            className={`w-10 h-10 rounded-2xl ${iconConfig.bg} ${iconConfig.color} flex items-center justify-center shrink-0 mt-0.5 shadow-xs`}
          >
            <Icon className="w-5 h-5" />
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-mono tracking-wider text-[#7e8f83] uppercase">
                <span className="font-bold">{action.badgeType}</span>
                <span>·</span>
                <span>{action.stepNumber}</span>
              </div>

              {!isDone && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-[#8a998f] bg-[#f4efe4] px-2 py-0.5 rounded-md">
                  <span>Swipe right</span>
                  <ChevronRight className="w-2.5 h-2.5" />
                </span>
              )}
            </div>

            <h3 className="font-display text-2xl font-bold text-[#123524] mt-0.5 tracking-tight">
              {action.title}
            </h3>

            <p className="text-[13px] text-[#4a5c50] mt-1 leading-relaxed">
              {action.description}
            </p>
          </div>

          {/* Top Right Action Indicator */}
          <div className="text-[#123524] opacity-70 group-hover:opacity-100 transition-all shrink-0">
            {isDone ? (
              <div className="w-8 h-8 rounded-full bg-[#e8f5ec] text-[#1b4332] flex items-center justify-center">
                <CheckCircle2 className="w-4.5 h-4.5" />
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute(action);
                }}
                className="w-8 h-8 rounded-full bg-[#f4efe4] hover:bg-[#123524] hover:text-white flex items-center justify-center text-[#123524] transition-all"
                title="Execute action"
                aria-label={`Open details for ${action.title}`}
              >
                <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}
          </div>
        </div>

        {/* Footer with Impact Text & Interactive Swipe Hint Bar */}
        <div className="pt-3.5 mt-3 border-t border-[#f0ece4] flex items-center justify-between text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#123524]">
              {action.impactText}
            </span>
            {!isDone && (
              <span className="px-1.5 py-0.5 bg-[#eef7f2] text-[#123524] text-[10px] font-mono font-semibold rounded-md border border-[#d6ebd9]">
                ₹{action.amount.toLocaleString('en-IN')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isDone ? (
              <div className="flex items-center gap-1 text-[11px] font-mono font-medium text-[#7e8f83] group-hover:text-[#123524] transition-colors">
                <span className="hidden sm:inline">Tap for details ·</span>
                <span className="uppercase font-bold tracking-wider">WHY?</span>
              </div>
            ) : (
              <span className="text-[11px] font-mono text-emerald-700 font-bold flex items-center gap-1">
                <Check className="w-3 h-3" /> Completed
              </span>
            )}
          </div>
        </div>

        {/* Mobile Tactile Swipe Helper Bar (shown on uncompleted cards) */}
        {!isDone && (
          <div className="mt-2.5 pt-2 border-t border-dashed border-[#ede8dc] flex items-center justify-between text-[10px] font-mono text-[#8a998f]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Drag right to quick-complete</span>
            </span>
            <span className="text-[#123524] font-semibold hover:underline">
              Slide card →
            </span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export const ActionsScreen: React.FC<ActionsScreenProps> = ({
  profile,
  onExecuteAction,
  onQuickComplete = (id, type, amt) => onExecuteAction(profile.actions.find((a) => a.id === id) || profile.actions[0]),
  onSelectActionForDetails,
}) => {
  const [activeFilter, setActiveFilter] = useState<'todo' | 'completed' | 'history'>('todo');

  const todoActions = profile.actions.filter((a) => a.status === 'TODO');
  const completedActions = profile.actions.filter((a) => a.status === 'COMPLETED');

  const displayedActions =
    activeFilter === 'todo'
      ? todoActions
      : activeFilter === 'completed'
      ? completedActions
      : profile.actions;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
            Action Centre
          </span>
          <span className="px-2.5 py-0.5 bg-[#eef7f2] text-[#123524] text-[10px] font-mono font-bold rounded-full border border-[#cbe4d4] flex items-center gap-1">
            <Zap className="w-3 h-3 text-emerald-600" />
            <span>Swipe-To-Complete Active</span>
          </span>
        </div>

        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#123524] tracking-tight leading-[1.15]">
          Your money, next.
        </h2>

        <p className="text-[14px] text-[#4a5c50] leading-relaxed">
          Small, timely steps that keep your financial resilience from slipping. Swipe right to execute directly.
        </p>
      </div>

      {/* Filter Tabs matching Screenshot 5 */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => setActiveFilter('todo')}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
            activeFilter === 'todo'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'bg-white border border-[#e2dacb] text-[#4a5c50] hover:bg-[#faf8f2]'
          }`}
        >
          To do · {todoActions.length}
        </button>

        <button
          onClick={() => setActiveFilter('completed')}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
            activeFilter === 'completed'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'bg-white border border-[#e2dacb] text-[#4a5c50] hover:bg-[#faf8f2]'
          }`}
        >
          Completed {completedActions.length > 0 && `· ${completedActions.length}`}
        </button>

        <button
          onClick={() => setActiveFilter('history')}
          className={`px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all ${
            activeFilter === 'history'
              ? 'bg-[#123524] text-white shadow-xs'
              : 'bg-white border border-[#e2dacb] text-[#4a5c50] hover:bg-[#faf8f2]'
          }`}
        >
          History · {profile.actions.length}
        </button>
      </div>

      {/* Action Cards List with Swipe-to-Complete */}
      <div className="space-y-3 pt-1">
        <AnimatePresence mode="popLayout">
          {displayedActions.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-8 text-center border border-[#e8e2d5] space-y-3"
            >
              <div className="w-12 h-12 rounded-full bg-[#e8f5ec] text-[#1b4332] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-display text-xl font-bold text-[#123524]">
                All caught up!
              </h3>
              <p className="text-[13px] text-[#6e7f74] max-w-sm mx-auto">
                Your liquid buffer and dynamic repayments are in optimal balance for this period.
              </p>
            </motion.div>
          ) : (
            displayedActions.map((act) => (
              <SwipeableActionCard
                key={act.id}
                action={act}
                profile={profile}
                onExecute={onExecuteAction}
                onQuickComplete={onQuickComplete}
                onSelectForDetails={onSelectActionForDetails}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Automated Shock Shield Banner for Zero-Default Guarantee */}
      <div className="bg-[#123524] text-white rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#80a98f]">
            Zero-Default Policy
          </span>
          <span className="px-2.5 py-0.5 bg-[#80a98f]/20 text-[#c2e2ce] text-[10px] font-mono font-bold rounded-full">
            Active Protection
          </span>
        </div>

        <h4 className="font-display text-xl font-bold text-white">
          Automated Shock Shielding
        </h4>

        <p className="text-[13px] text-[#d6e5dc] leading-relaxed">
          If an exogenous disaster, crop failure, or medical emergency hits, BAWS instantly pauses regular repayments without reporting any delinquency to credit bureaus.
        </p>

        <div className="pt-2 flex items-center justify-between text-[12px] text-[#9fc4ad]">
          <span>Current status: <strong>{profile.loanFacility.shockShieldStatus}</strong></span>
          <span>Grace months available: <strong>2</strong></span>
        </div>
      </div>
    </div>
  );
};

