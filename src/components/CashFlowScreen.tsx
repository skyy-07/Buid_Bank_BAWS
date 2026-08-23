import React, { useState } from 'react';
import {
  TrendingDown,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import { BorrowerProfile, SeasonTag } from '../types';

interface CashFlowScreenProps {
  profile: BorrowerProfile;
  onUpdateLookbackWindow?: (newK: number) => void;
}

export const CashFlowScreen: React.FC<CashFlowScreenProps> = ({
  profile,
  onUpdateLookbackWindow,
}) => {
  const [selectedMonth, setSelectedMonth] = useState('August');
  const [selectedSeasonFilter, setSelectedSeasonFilter] = useState<string>('ALL');
  const [activeK, setActiveK] = useState<number>(profile.bawsEngineState.optimalLookbackWindowK);

  const totalInflow = 24680;
  const totalOutflow = 18940;
  const netSurplus = totalInflow - totalOutflow;

  // Granular series points for the SVG line chart
  const linePoints = [
    { x: 10, y: 70, date: '1 Jul' },
    { x: 30, y: 55 },
    { x: 50, y: 40 },
    { x: 70, y: 60 },
    { x: 90, y: 45 },
    { x: 110, y: 75 },
    { x: 130, y: 50 },
    { x: 150, y: 35 }, // Vertical boundary line at x=150 (start of adaptive shaded window)
    { x: 170, y: 60 },
    { x: 190, y: 45 },
    { x: 210, y: 50 },
    { x: 230, y: 30 },
    { x: 250, y: 45 },
    { x: 270, y: 38, date: 'TODAY' },
  ];

  const svgPathD = linePoints.reduce(
    (acc, pt, idx) => (idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
    ''
  );

  const filteredRecords = profile.cashFlowRecords.filter((rec) => {
    if (selectedSeasonFilter === 'ALL') return true;
    return rec.seasonTag === selectedSeasonFilter;
  });

  const handleKChange = (newVal: number) => {
    setActiveK(newVal);
    if (onUpdateLookbackWindow) {
      onUpdateLookbackWindow(newVal);
    }
  };

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
            Cash Flow
          </span>
          <div className="relative">
            <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-[#e2dacb] rounded-full text-[13px] font-semibold text-[#123524] shadow-2xs hover:bg-[#faf8f2]">
              <span>{selectedMonth}</span>
              <span className="text-[10px] text-[#7e8f83]">▼</span>
            </button>
          </div>
        </div>

        <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#123524] tracking-tight leading-[1.15]">
          Your income rhythm
        </h2>

        <p className="text-[14px] text-[#4a5c50] leading-relaxed">
          Your recent work has been more uneven than usual. We are using the last{' '}
          <strong className="font-semibold text-[#123524]">{activeK} weeks</strong> to guide this plan.
        </p>
      </div>

      {/* 1. Adaptive Window Card (Dark Forest Green) */}
      <div className="bg-[#123524] text-white rounded-3xl p-5 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#80a98f]">
            Adaptive Window
          </span>
          <span className="px-3 py-1 bg-[#d9822b] text-[#331802] text-[10px] font-mono font-bold tracking-wider rounded-full uppercase">
            Changed {profile.bawsEngineState.lastChangedAgo}
          </span>
        </div>

        <div>
          <h3 className="font-display text-3xl font-bold text-white tracking-tight">
            {activeK} weeks of signal
          </h3>
        </div>

        {/* Custom SVG Line Chart with Shaded Lookback Window */}
        <div className="bg-[#0b2318] rounded-2xl p-4 border border-white/5 relative">
          <svg className="w-full h-36" viewBox="0 0 280 100" preserveAspectRatio="none">
            {/* Shaded Lookback Window Rectangle (x: 145 to 280) */}
            <rect
              x="145"
              y="10"
              width="135"
              height="80"
              fill="#18422e"
              opacity="0.8"
              rx="4"
            />

            {/* Vertical dividing line */}
            <line
              x1="145"
              y1="10"
              x2="145"
              y2="90"
              stroke="#2e6b4d"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />

            {/* Cash flow trajectory path */}
            <path
              d={svgPathD}
              fill="none"
              stroke="#e59846"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data points */}
            {linePoints.map((pt, idx) => (
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={idx === linePoints.length - 1 ? 4 : 2}
                fill={idx === linePoints.length - 1 ? '#ffffff' : '#e59846'}
                stroke="#0b2318"
                strokeWidth="1"
              />
            ))}
          </svg>

          {/* Chart Axis Labels */}
          <div className="flex justify-between text-[10px] font-mono font-medium text-[#80a98f] mt-2 px-1">
            <span>1 JULY</span>
            <span className="text-[#e59846] font-bold">TODAY</span>
          </div>

          <div className="flex items-center gap-2 mt-3 text-[11px] text-[#9fc4ad]">
            <span className="w-2 h-2 rounded-full bg-[#e59846]" />
            <span>The shaded period is what BAWS is using now.</span>
          </div>
        </div>

        {/* Window Selector Controller */}
        <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
          <span className="text-[12px] text-[#80a98f] font-medium">Test Lookback (k̂_t):</span>
          <div className="flex items-center gap-1.5">
            {[4, 6, 8, 12, 24].map((kVal) => (
              <button
                key={kVal}
                onClick={() => handleKChange(kVal)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold transition-all ${
                  activeK === kVal
                    ? 'bg-[#e59846] text-[#241203]'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {kVal}w
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Inflow / Outflow Stat Tiles (Side-by-Side) */}
      <div className="grid grid-cols-2 gap-3">
        {/* Money In */}
        <div className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-1">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74] block">
            Money In
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#123524]">
            ₹{totalInflow.toLocaleString('en-IN')}
          </div>
          <p className="text-[12px] text-[#6e7f74]">19 payments this month</p>
        </div>

        {/* Money Out */}
        <div className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-1">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74] block">
            Money Out
          </span>
          <div className="font-display text-2xl sm:text-3xl font-bold text-[#123524]">
            ₹{totalOutflow.toLocaleString('en-IN')}
          </div>
          <p className="text-[12px] text-[#6e7f74]">Essentials stayed steady</p>
        </div>
      </div>

      {/* 3. Regime Timeline Card (What changed?) */}
      <div className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
            Regime Timeline
          </span>
          <TrendingDown className="w-5 h-5 text-[#b45309]" />
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold text-[#123524]">
            What changed?
          </h3>
        </div>

        {/* 4-Phase Horizontal Status Indicator Bar */}
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <div className="h-2 rounded-full bg-[#80a98f]" />
            <div className="h-2 rounded-full bg-[#80a98f]" />
            <div className="h-2 rounded-full bg-[#d9822b]" />
            <div className="h-2 rounded-full bg-[#d9822b]" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-mono font-semibold tracking-wider text-[#6e7f74]">
            <span>STABLE</span>
            <span>STABLE</span>
            <span className="text-[#b45309]">WATCH</span>
            <span className="text-[#b45309]">NOW</span>
          </div>
        </div>

        <div className="pt-2 border-t border-[#f0ece4]">
          <p className="text-[13px] text-[#3d4f44] leading-relaxed">
            Income gaps are <strong>23% wider</strong> than your previous pattern. Your essential spending is consistent, so keeping a buffer matters more this week.
          </p>
        </div>
      </div>

      {/* 4. Detailed Cash Flow Ingestion Log with Season Tags */}
      <div className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-[#123524]">
            Cash Flow Stream
          </h3>
          <div className="flex items-center gap-1 text-[11px]">
            {['ALL', 'HARVEST', 'GROWTH', 'SOWING'].map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedSeasonFilter(tag)}
                className={`px-2 py-0.5 rounded-full font-mono text-[10px] transition-all ${
                  selectedSeasonFilter === tag
                    ? 'bg-[#123524] text-white'
                    : 'bg-[#f0ece4] text-[#4a5c50] hover:bg-[#e4ded4]'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-[#f0ece4] max-h-60 overflow-y-auto pr-1">
          {filteredRecords.slice().reverse().map((rec) => {
            const isSurplus = rec.netCashFlow >= 0;
            return (
              <div key={rec.periodIndex} className="py-2.5 flex items-center justify-between text-[13px]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#123524]">{rec.label || rec.periodDate}</span>
                    <span
                      className={`text-[9px] font-mono px-2 py-0.2 rounded-full font-bold uppercase ${
                        rec.seasonTag === 'HARVEST'
                          ? 'bg-[#dcfce7] text-[#15803d]'
                          : rec.seasonTag === 'SOWING'
                          ? 'bg-[#fee2e2] text-[#b91c1c]'
                          : 'bg-[#f1f5f9] text-[#475569]'
                      }`}
                    >
                      {rec.seasonTag}
                    </span>
                  </div>
                  {rec.description && (
                    <p className="text-[11px] text-[#6e7f74] mt-0.5">{rec.description}</p>
                  )}
                </div>

                <div className="text-right">
                  <span
                    className={`font-semibold font-mono ${
                      isSurplus ? 'text-[#15803d]' : 'text-[#b91c1c]'
                    }`}
                  >
                    {isSurplus ? '+' : ''}₹{rec.netCashFlow.toLocaleString('en-IN')}
                  </span>
                  <div className="text-[10px] font-mono text-[#8a9b8f]">
                    In: ₹{rec.grossInflow.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
