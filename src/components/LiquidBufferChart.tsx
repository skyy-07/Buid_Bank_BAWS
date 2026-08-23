import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Sparkles, TrendingUp, ShieldCheck, Flame, Info, CheckCircle2, ChevronRight } from 'lucide-react';
import { BufferHistoryPoint, BorrowerProfile } from '../types';

interface LiquidBufferChartProps {
  history?: BufferHistoryPoint[];
  currentBuffer: number;
  currencySymbol?: string;
  onSweepMore?: () => void;
}

export const LiquidBufferChart: React.FC<LiquidBufferChartProps> = ({
  history,
  currentBuffer,
  currencySymbol = '₹',
  onSweepMore,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 340, height: 210 });
  const [hoveredPoint, setHoveredPoint] = useState<BufferHistoryPoint | null>(null);
  const [activeView, setActiveView] = useState<'all' | 'sweeps' | 'growth'>('all');

  // Fallback data if none provided
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

  // Track responsive container width
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      if (width > 0) {
        setDimensions({
          width,
          height: Math.max(190, Math.min(230, width * 0.58)),
        });
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute key milestone and growth figures
  const initialPoint = data[0];
  const latestPoint = data[data.length - 1];
  const totalGrowthPercent = initialPoint && latestPoint
    ? Math.round(((latestPoint.totalBuffer - initialPoint.totalBuffer) / (initialPoint.totalBuffer || 1)) * 100)
    : 195;
  const sweepSharePercent = latestPoint
    ? Math.round((latestPoint.microSavingsSweep / (latestPoint.totalBuffer || 1)) * 100)
    : 31;

  // Render D3 chart
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 22, right: 18, bottom: 28, left: 38 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    // Scales
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

    // Definitions (Gradients & Filters)
    const defs = svg.append('defs');

    // Total Buffer Gradient (Forest Green)
    const bufferGradient = defs
      .append('linearGradient')
      .attr('id', 'totalBufferGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    bufferGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#123524')
      .attr('stop-opacity', 0.22);

    bufferGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#123524')
      .attr('stop-opacity', 0.01);

    // Micro-Savings Sweep Gradient (Warm Amber / Gold)
    const sweepGradient = defs
      .append('linearGradient')
      .attr('id', 'sweepGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    sweepGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#d97706')
      .attr('stop-opacity', 0.35);

    sweepGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#f59e0b')
      .attr('stop-opacity', 0.02);

    // Glow filter for interactive highlight
    const filter = defs.append('filter').attr('id', 'glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // 1. Grid Lines
    const yTicks = yScale.ticks(4);
    svg
      .append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', '#ede8dc')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1);

    // 2. Y-Axis Ticks (compact format e.g. 5k, 10k, 15k)
    svg
      .append('g')
      .attr('class', 'y-axis-labels')
      .selectAll('text')
      .data(yTicks)
      .enter()
      .append('text')
      .attr('x', margin.left - 6)
      .attr('y', (d) => yScale(d) + 3.5)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .attr('fill', '#8c9c91')
      .text((d) => (d === 0 ? '₹0' : `₹${d / 1000}k`));

    // 3. X-Axis Month Labels
    svg
      .append('g')
      .attr('class', 'x-axis-labels')
      .selectAll('text')
      .data(data)
      .enter()
      .append('text')
      .attr('x', (d) => xScale(d.shortMonth) || 0)
      .attr('y', height - 8)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .attr('font-weight', (d) => (d.shortMonth === latestPoint.shortMonth ? '700' : '500'))
      .attr('fill', (d) => (d.shortMonth === latestPoint.shortMonth ? '#123524' : '#6b7d72'))
      .text((d) => d.shortMonth);

    // 4. Milestone Target Reference Line (₹15,000 target)
    const targetVal = latestPoint?.milestoneTarget || 15000;
    const targetY = yScale(targetVal);
    if (targetY >= margin.top && targetY <= height - margin.bottom) {
      svg
        .append('line')
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', targetY)
        .attr('y2', targetY)
        .attr('stroke', '#a7c4b2')
        .attr('stroke-dasharray', '4,4')
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.8);

      svg
        .append('text')
        .attr('x', width - margin.right - 2)
        .attr('y', targetY - 4)
        .attr('text-anchor', 'end')
        .attr('font-size', '9px')
        .attr('font-family', 'ui-monospace, monospace')
        .attr('font-weight', '600')
        .attr('fill', '#5a826b')
        .text('Target Cushion (₹15k)');
    }

    // 5. Area Generators
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

    // 6. Line Generators
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

    // Render Total Buffer Area & Line
    if (activeView === 'all' || activeView === 'growth') {
      svg
        .append('path')
        .datum(data)
        .attr('fill', 'url(#totalBufferGradient)')
        .attr('d', totalAreaGenerator);

      svg
        .append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#123524')
        .attr('stroke-width', 2.8)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', totalLineGenerator);
    }

    // Render Micro-Savings Sweep Area & Line (Highlighting in vibrant Amber)
    if (activeView === 'all' || activeView === 'sweeps') {
      svg
        .append('path')
        .datum(data)
        .attr('fill', 'url(#sweepGradient)')
        .attr('d', sweepAreaGenerator);

      svg
        .append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#d97706')
        .attr('stroke-width', 2.4)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('d', sweepLineGenerator);
    }

    // 7. Interactive Hover Guide Overlay & Dots
    data.forEach((d) => {
      const cx = xScale(d.shortMonth) || 0;
      const cyTotal = yScale(d.totalBuffer);
      const cySweep = yScale(d.microSavingsSweep);

      // Micro-savings node circle (Amber)
      if (activeView === 'all' || activeView === 'sweeps') {
        svg
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cySweep)
          .attr('r', hoveredPoint?.shortMonth === d.shortMonth ? 5.5 : 3.5)
          .attr('fill', '#d97706')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.8)
          .attr('filter', hoveredPoint?.shortMonth === d.shortMonth ? 'url(#glow)' : null)
          .style('transition', 'all 0.15s ease');
      }

      // Total Buffer node circle (Forest Green)
      if (activeView === 'all' || activeView === 'growth') {
        svg
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cyTotal)
          .attr('r', hoveredPoint?.shortMonth === d.shortMonth ? 6 : 4)
          .attr('fill', '#123524')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2)
          .attr('filter', hoveredPoint?.shortMonth === d.shortMonth ? 'url(#glow)' : null)
          .style('transition', 'all 0.15s ease');
      }
    });

    // 8. Invisible interactive rects over each column for smooth touch/mouse hover
    data.forEach((d, i) => {
      const cx = xScale(d.shortMonth) || 0;
      const colWidth = innerWidth / data.length;

      svg
        .append('rect')
        .attr('x', cx - colWidth / 2)
        .attr('y', margin.top)
        .attr('width', colWidth)
        .attr('height', innerHeight)
        .attr('fill', 'transparent')
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHoveredPoint(d))
        .on('touchstart', () => setHoveredPoint(d));
    });

    // Highlight vertical guide if a point is hovered
    if (hoveredPoint) {
      const hx = xScale(hoveredPoint.shortMonth) || 0;
      svg
        .append('line')
        .attr('x1', hx)
        .attr('x2', hx)
        .attr('y1', margin.top)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#123524')
        .attr('stroke-dasharray', '2,2')
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.45);
    }
  }, [dimensions, data, hoveredPoint, activeView, latestPoint]);

  const activePoint = hoveredPoint || latestPoint;

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

      {/* D3 SVG Chart Stage */}
      <div ref={containerRef} className="w-full relative select-none">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible w-full"
        />
      </div>

      {/* Floating Active Month Inspector Card */}
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

      {/* Behavioral Incentive Callout: Micro-Savings Sweeps Gamification */}
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
            {/* Base buffer portion */}
            <div
              style={{
                width: `${Math.min(100, (latestPoint.baseBuffer / (latestPoint.milestoneTarget || 15000)) * 100)}%`,
              }}
              className="bg-[#123524] h-full transition-all duration-500"
              title="Base Buffer"
            />
            {/* Micro-savings sweep portion */}
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

        {/* Quick Micro-Sweep Action button if available */}
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
};
