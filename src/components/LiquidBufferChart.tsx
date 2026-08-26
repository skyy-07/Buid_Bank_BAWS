import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Sparkles, TrendingUp, ShieldCheck, Flame, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { BufferHistoryPoint } from '../types';

interface LiquidBufferChartProps {
  history?: BufferHistoryPoint[];
  currentBuffer: number;
  currencySymbol?: string;
  onSweepMore?: () => void;
}

export const LiquidBufferChart: React.FC<LiquidBufferChartProps> = React.memo(({
  history,
  currentBuffer,
  currencySymbol = '₹',
  onSweepMore,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 340, height: 210 });
  const [hoveredPoint, setHoveredPoint] = useState<BufferHistoryPoint | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'sweeps' | 'growth'>('all');

  // Fallback dataset if none provided
  const data: BufferHistoryPoint[] = useMemo(() => {
    if (history && history.length > 0) return history;
    return [
      { month: 'Mar 2026', shortMonth: 'Mar', baseBuffer: 4200, microSavingsSweep: 0, totalBuffer: 4200, sweepThisMonth: 0, essentialDaysCovered: 3, milestoneTarget: 15000, notes: 'Baseline emergency cash' },
      { month: 'Apr 2026', shortMonth: 'Apr', baseBuffer: 5400, microSavingsSweep: 420, totalBuffer: 5820, sweepThisMonth: 420, essentialDaysCovered: 4, milestoneTarget: 15000, notes: 'First auto-sweep initiated' },
      { month: 'May 2026', shortMonth: 'May', baseBuffer: 7200, microSavingsSweep: 1450, totalBuffer: 8650, sweepThisMonth: 1030, essentialDaysCovered: 6, milestoneTarget: 15000, notes: 'Harvest wholesale surge sweep' },
      { month: 'Jun 2026', shortMonth: 'Jun', baseBuffer: 8100, microSavingsSweep: 2320, totalBuffer: 10420, sweepThisMonth: 870, essentialDaysCovered: 8, milestoneTarget: 15000, notes: 'Crossed ₹10k safety buffer' },
      { month: 'Jul 2026', shortMonth: 'Jul', baseBuffer: 8450, microSavingsSweep: 3150, totalBuffer: 11600, sweepThisMonth: 830, essentialDaysCovered: 9, milestoneTarget: 15000, notes: 'Monsoon dip absorbed' },
      { month: 'Aug 2026', shortMonth: 'Aug', baseBuffer: 8580, microSavingsSweep: 3820, totalBuffer: currentBuffer || 12400, sweepThisMonth: 670, essentialDaysCovered: 9, milestoneTarget: 15000, notes: 'Current liquid reserve' },
    ];
  }, [history, currentBuffer]);

  // Safe responsive container width tracking with threshold guard
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entryWidth = entries[0].contentRect.width;
      if (entryWidth > 40) {
        setDimensions((prev) => {
          if (Math.abs(prev.width - entryWidth) < 3) return prev;
          return {
            width: entryWidth,
            height: Math.max(190, Math.min(230, entryWidth * 0.58)),
          };
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const initialPoint = data[0];
  const latestPoint = data[data.length - 1];
  const activePoint = hoveredPoint || latestPoint;

  const totalGrowthPercent = useMemo(() => {
    return initialPoint && latestPoint
      ? Math.round(((latestPoint.totalBuffer - initialPoint.totalBuffer) / (initialPoint.totalBuffer || 1)) * 100)
      : 195;
  }, [initialPoint, latestPoint]);

  const sweepSharePercent = useMemo(() => {
    return latestPoint
      ? Math.round((latestPoint.microSavingsSweep / (latestPoint.totalBuffer || 1)) * 100)
      : 31;
  }, [latestPoint]);

  // Pure mathematical scales computation (no DOM mutation)
  const chartMath = useMemo(() => {
    const { width, height } = dimensions;
    const margin = { top: 22, right: 18, bottom: 28, left: 40 };
    const innerWidth = Math.max(10, width - margin.left - margin.right);
    const innerHeight = Math.max(10, height - margin.top - margin.bottom);

    const xScale = d3
      .scalePoint<string>()
      .domain(data.map((d) => d.shortMonth))
      .range([margin.left, width - margin.right])
      .padding(0.15);

    const maxVal = d3.max(data, (d) => Math.max(d.totalBuffer, d.milestoneTarget || 15000)) || 16000;
    const yScale = d3
      .scaleLinear()
      .domain([0, maxVal * 1.08])
      .nice()
      .range([height - margin.bottom, margin.top]);

    const totalAreaGenerator = d3
      .area<BufferHistoryPoint>()
      .x((d) => xScale(d.shortMonth) || 0)
      .y0(yScale(0))
      .y1((d) => yScale(d.totalBuffer))
      .curve(d3.curveMonotoneX);

    const sweepAreaGenerator = d3
      .area<BufferHistoryPoint>()
      .x((d) => xScale(d.shortMonth) || 0)
      .y0(yScale(0))
      .y1((d) => yScale(d.microSavingsSweep))
      .curve(d3.curveMonotoneX);

    const totalLineGenerator = d3
      .line<BufferHistoryPoint>()
      .x((d) => xScale(d.shortMonth) || 0)
      .y((d) => yScale(d.totalBuffer))
      .curve(d3.curveMonotoneX);

    const sweepLineGenerator = d3
      .line<BufferHistoryPoint>()
      .x((d) => xScale(d.shortMonth) || 0)
      .y((d) => yScale(d.microSavingsSweep))
      .curve(d3.curveMonotoneX);

    const yTicks = yScale.ticks(4);
    const totalAreaD = totalAreaGenerator(data) || '';
    const sweepAreaD = sweepAreaGenerator(data) || '';
    const totalLineD = totalLineGenerator(data) || '';
    const sweepLineD = sweepLineGenerator(data) || '';

    const targetVal = latestPoint?.milestoneTarget || 15000;
    const targetY = yScale(targetVal);

    return {
      margin,
      innerWidth,
      innerHeight,
      xScale,
      yScale,
      yTicks,
      totalAreaD,
      sweepAreaD,
      totalLineD,
      sweepLineD,
      targetY,
    };
  }, [dimensions, data, latestPoint]);

  return (
    <div
      id="liquid-buffer-chart-card"
      className="bg-white rounded-3xl p-5 border border-[#e8e2d5] shadow-xs space-y-4 transition-all"
    >
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono tracking-widest uppercase font-semibold text-[#6e7f74]">
              6-Month Reserve Growth
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#eef7f2] text-[#123524] text-[10px] font-mono font-bold rounded-full border border-[#cbe4d4]">
              <TrendingUp className="w-3 h-3 text-[#123524]" />
              +{totalGrowthPercent}%
            </span>
          </div>
          <h3 className="font-display text-xl sm:text-2xl font-bold text-[#123524] mt-0.5">
            Liquid Buffer Trajectory
          </h3>
        </div>

        {/* View Mode Pills */}
        <div className="flex items-center gap-1 bg-[#f5f2eb] p-1 rounded-xl self-start sm:self-auto border border-[#e8e2d6]">
          <button
            onClick={() => setActiveView('all')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
              activeView === 'all'
                ? 'bg-white text-[#123524] font-semibold shadow-xs'
                : 'text-[#6e7f74] hover:text-[#123524]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveView('sweeps')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all flex items-center gap-1 ${
              activeView === 'sweeps'
                ? 'bg-[#d97706] text-white font-semibold shadow-xs'
                : 'text-[#92400e] hover:text-[#78350f]'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Sweeps
          </button>
          <button
            onClick={() => setActiveView('growth')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all ${
              activeView === 'growth'
                ? 'bg-[#123524] text-white font-semibold shadow-xs'
                : 'text-[#6e7f74] hover:text-[#123524]'
            }`}
          >
            Total
          </button>
        </div>
      </div>

      {/* Interactive Legend & Context Badges */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] pt-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#123524] inline-block shadow-xs" />
            <span className="font-medium text-[#123524]">Total Buffer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#d97706] inline-block shadow-xs" />
            <span className="font-semibold text-[#b45309]">Micro-Savings Sweeps</span>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[#6e7f74]">
          {activePoint.month}
        </div>
      </div>

      {/* Declarative React SVG Chart Stage */}
      <div ref={containerRef} className="w-full relative select-none">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible w-full block"
        >
          <defs>
            <linearGradient id="totalBufferGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#123524" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#123524" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="sweepBufferGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d97706" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
            <filter id="nodeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid Lines */}
          {chartMath.yTicks.map((tickVal) => (
            <line
              key={`grid-${tickVal}`}
              x1={chartMath.margin.left}
              x2={dimensions.width - chartMath.margin.right}
              y1={chartMath.yScale(tickVal)}
              y2={chartMath.yScale(tickVal)}
              stroke="#ede8dc"
              strokeDasharray="3,3"
              strokeWidth="1"
            />
          ))}

          {/* Y Axis Labels */}
          {chartMath.yTicks.map((tickVal) => (
            <text
              key={`ytick-${tickVal}`}
              x={chartMath.margin.left - 6}
              y={chartMath.yScale(tickVal) + 3.5}
              textAnchor="end"
              fontSize="10px"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fill="#8c9c91"
            >
              {tickVal === 0 ? '₹0' : `₹${tickVal / 1000}k`}
            </text>
          ))}

          {/* X Axis Labels */}
          {data.map((d) => (
            <text
              key={`xtick-${d.shortMonth}`}
              x={chartMath.xScale(d.shortMonth) || 0}
              y={dimensions.height - 8}
              textAnchor="middle"
              fontSize="11px"
              fontFamily="ui-monospace, SFMono-Regular, monospace"
              fontWeight={d.shortMonth === latestPoint.shortMonth ? '700' : '500'}
              fill={d.shortMonth === latestPoint.shortMonth ? '#123524' : '#6b7d72'}
            >
              {d.shortMonth}
            </text>
          ))}

          {/* Target Milestone Reference Line */}
          {chartMath.targetY >= chartMath.margin.top &&
            chartMath.targetY <= dimensions.height - chartMath.margin.bottom && (
              <g>
                <line
                  x1={chartMath.margin.left}
                  x2={dimensions.width - chartMath.margin.right}
                  y1={chartMath.targetY}
                  y2={chartMath.targetY}
                  stroke="#a7c4b2"
                  strokeDasharray="4,4"
                  strokeWidth="1.2"
                  opacity="0.8"
                />
                <text
                  x={dimensions.width - chartMath.margin.right - 2}
                  y={chartMath.targetY - 4}
                  textAnchor="end"
                  fontSize="9px"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="600"
                  fill="#5a826b"
                >
                  Target Cushion (₹15k)
                </text>
              </g>
            )}

          {/* Total Buffer Area and Stroke */}
          {(activeView === 'all' || activeView === 'growth') && (
            <g>
              <path d={chartMath.totalAreaD} fill="url(#totalBufferGrad)" />
              <path
                d={chartMath.totalLineD}
                fill="none"
                stroke="#123524"
                strokeWidth="2.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Micro Savings Sweeps Area and Stroke */}
          {(activeView === 'all' || activeView === 'sweeps') && (
            <g>
              <path d={chartMath.sweepAreaD} fill="url(#sweepBufferGrad)" />
              <path
                d={chartMath.sweepLineD}
                fill="none"
                stroke="#d97706"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Highlight vertical guide line on hover */}
          {hoveredPoint && (
            <line
              x1={chartMath.xScale(hoveredPoint.shortMonth) || 0}
              x2={chartMath.xScale(hoveredPoint.shortMonth) || 0}
              y1={chartMath.margin.top}
              y2={dimensions.height - chartMath.margin.bottom}
              stroke="#123524"
              strokeDasharray="2,2"
              strokeWidth="1.2"
              opacity="0.45"
            />
          )}

          {/* Node Circles */}
          {data.map((d) => {
            const cx = chartMath.xScale(d.shortMonth) || 0;
            const cyTotal = chartMath.yScale(d.totalBuffer);
            const cySweep = chartMath.yScale(d.microSavingsSweep);
            const isHovered = hoveredPoint?.shortMonth === d.shortMonth;

            return (
              <g key={`nodes-${d.shortMonth}`}>
                {(activeView === 'all' || activeView === 'sweeps') && (
                  <circle
                    cx={cx}
                    cy={cySweep}
                    r={isHovered ? 5.5 : 3.5}
                    fill="#d97706"
                    stroke="#ffffff"
                    strokeWidth="1.8"
                    filter={isHovered ? 'url(#nodeGlow)' : undefined}
                  />
                )}
                {(activeView === 'all' || activeView === 'growth') && (
                  <circle
                    cx={cx}
                    cy={cyTotal}
                    r={isHovered ? 6 : 4}
                    fill="#123524"
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter={isHovered ? 'url(#nodeGlow)' : undefined}
                  />
                )}
              </g>
            );
          })}

          {/* Interactive touch/mouse hover column overlay */}
          {data.map((d) => {
            const cx = chartMath.xScale(d.shortMonth) || 0;
            const colWidth = chartMath.innerWidth / data.length;
            return (
              <rect
                key={`hit-${d.shortMonth}`}
                x={cx - colWidth / 2}
                y={chartMath.margin.top}
                width={colWidth}
                height={chartMath.innerHeight}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(d)}
                onTouchStart={() => setHoveredPoint(d)}
              />
            );
          })}
        </svg>
      </div>

      {/* Active Month Inspector Card */}
      {activePoint && (
        <div className="bg-[#fcfaf4] border border-[#e8e2d5] rounded-2xl p-3.5 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#6e7f74]">
                  {activePoint.month} Breakdown
                </span>
                {activePoint.shortMonth === latestPoint.shortMonth && (
                  <span className="px-1.5 py-0.2 bg-[#123524]/10 text-[#123524] text-[10px] font-semibold rounded">
                    Current
                  </span>
                )}
              </div>
              <p className="text-[12px] text-[#4b5b50] mt-0.5">
                {activePoint.notes}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-mono text-[#6e7f74] block">Essential Cover</span>
              <span className="text-[13px] font-bold text-[#123524]">
                ~{activePoint.essentialDaysCovered} days
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-[#ede8dc]">
            <div>
              <span className="text-[11px] font-medium text-[#6e7f74] block">
                Total Liquid Reserve
              </span>
              <span className="font-display text-xl font-bold text-[#123524]">
                {currencySymbol}{activePoint.totalBuffer.toLocaleString('en-IN')}
              </span>
            </div>

            <div className="border-l border-[#ede8dc] pl-3">
              <div className="flex items-center gap-1">
                <span className="text-[11px] font-semibold text-[#b45309] block">
                  Swept Contribution
                </span>
                <span className="px-1.5 py-0.2 bg-[#fef3c7] text-[#92400e] text-[9px] font-mono font-bold rounded">
                  {Math.round((activePoint.microSavingsSweep / (activePoint.totalBuffer || 1)) * 100)}%
                </span>
              </div>
              <span className="font-display text-xl font-bold text-[#d97706]">
                {currencySymbol}{activePoint.microSavingsSweep.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Behavioral Incentive Callout */}
      <div className="bg-[#fef9ee] border border-[#f5e4bd] rounded-2xl p-3.5 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#d97706]/15 text-[#d97706] flex items-center justify-center shrink-0 mt-0.5">
            <Flame className="w-4.5 h-4.5 stroke-[2.2]" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="text-[13px] font-bold text-[#78350f] leading-tight">
                6-Month Micro-Savings Streak
              </h4>
              <span className="text-[10px] font-mono font-bold text-[#b45309] bg-[#fde68a]/50 px-2 py-0.5 rounded-full">
                {sweepSharePercent}% of buffer
              </span>
            </div>
            <p className="text-[12px] text-[#92400e] mt-1 leading-snug">
              Auto-sweeps of 2.5% on positive harvest and merchant days contributed{' '}
              <strong className="text-[#78350f]">
                {currencySymbol}{latestPoint.microSavingsSweep.toLocaleString('en-IN')}
              </strong>{' '}
              to your liquid cushion without touching everyday household cash.
            </p>
          </div>
        </div>

        {/* Milestone Progress Bar */}
        <div className="pt-1">
          <div className="flex justify-between text-[11px] font-medium text-[#78350f] mb-1">
            <span>Progress to ₹15,000 Safety Milestone</span>
            <span className="font-mono font-bold">
              {Math.min(100, Math.round((latestPoint.totalBuffer / (latestPoint.milestoneTarget || 15000)) * 100))}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#f2dfb8] rounded-full overflow-hidden flex">
            <div
              style={{
                width: `${Math.min(100, (latestPoint.baseBuffer / (latestPoint.milestoneTarget || 15000)) * 100)}%`,
              }}
              className="bg-[#123524] h-full transition-all duration-500"
              title="Base Buffer"
            />
            <div
              style={{
                width: `${Math.min(
                  100,
                  (latestPoint.microSavingsSweep / (latestPoint.milestoneTarget || 15000)) * 100
                )}%`,
              }}
              className="bg-[#d97706] h-full transition-all duration-500"
              title="Micro-Savings Sweep Contribution"
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[#a16207] mt-1">
            <span>₹0</span>
            <span className="text-[#123524] font-semibold">Current: {currencySymbol}{latestPoint.totalBuffer.toLocaleString('en-IN')}</span>
            <span>Target: ₹15,000</span>
          </div>
        </div>

        {onSweepMore && (
          <button
            onClick={onSweepMore}
            className="w-full mt-1 py-2 px-3 bg-[#d97706] hover:bg-[#b45309] text-white text-[12px] font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs active:scale-98"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Add ₹430 Micro-Sweep to Compound Buffer</span>
            <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
          </button>
        )}
      </div>
    </div>
  );
});
