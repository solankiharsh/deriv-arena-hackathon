"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useTradeStore } from "@/lib/stores/trade-store";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useAntiYouStore } from "@/lib/stores/anti-you-store";
import { calculateBES } from "@/lib/engines/behavioral-scorer";
import { GlassCard } from "@/components/shared/GlassCard";

export function BESTrendChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const { resolvedPhantoms } = usePhantomStore();
  const { antiYouSessionPnl } = useAntiYouStore();
  const trendData = useMemo(() => {
    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    return Array.from({ length: 12 }, (_, index) => {
      const weekOffset = 11 - index;
      const end = now - weekOffset * weekMs;
      const start = end - weekMs;
      const weekTrades = tradeHistory.filter(
        (trade) => trade.timestamp >= start && trade.timestamp < end && (trade.status === "won" || trade.status === "lost")
      );
      const weekPhantoms = resolvedPhantoms.filter(
        (phantom) => phantom.capturedAt >= start && phantom.capturedAt < end
      );
      const weekPnl = weekTrades.reduce((sum, trade) => sum + (trade.pnl ?? 0), 0);
      const revengeTradeCount = weekTrades.filter((trade) => trade.wasRevengeFlag).length;
      const postLossTradeCount = weekTrades.some((trade) => trade.status === "lost") ? weekTrades.length : 0;
      const score = Math.round(
        calculateBES({
          trades: weekTrades,
          phantoms: weekPhantoms,
          revengeTradeCount,
          postLossTradeCount,
          yourPnl: weekPnl,
          antiYouPnl: antiYouSessionPnl,
        }).overallScore
      );
      return { week: index + 1, score };
    });
  }, [tradeHistory, resolvedPhantoms, antiYouSessionPnl]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const w = containerRef.current.clientWidth;
    const h = 160;
    const m = { top: 20, right: 20, bottom: 30, left: 40 };

    const svg = d3.select(svgRef.current).attr("width", w).attr("height", h);
    svg.selectAll("*").remove();

    const x = d3.scaleBand()
      .domain(trendData.map((d) => `W${d.week}`))
      .range([m.left, w - m.right])
      .padding(0.3);

    const y = d3.scaleLinear().domain([0, 100]).range([h - m.bottom, m.top]);

    const g = svg.append("g");

    // Grid lines
    g.selectAll(".grid")
      .data([25, 50, 75])
      .join("line")
      .attr("x1", m.left).attr("x2", w - m.right)
      .attr("y1", (d) => y(d)).attr("y2", (d) => y(d))
      .attr("stroke", "rgba(255,255,255,0.05)")
      .attr("stroke-dasharray", "4,4");

    // Threshold line at 75
    g.append("line")
      .attr("x1", m.left).attr("x2", w - m.right)
      .attr("y1", y(75)).attr("y2", y(75))
      .attr("stroke", "#FBBF24")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "6,3")
      .attr("opacity", 0.5);

    g.append("text")
      .attr("x", w - m.right + 2).attr("y", y(75) + 4)
      .attr("fill", "#FBBF24").attr("font-size", "8px").text("75");

    // Bars
    g.selectAll(".bar")
      .data(trendData)
      .join("rect")
      .attr("class", "bar")
      .attr("x", (d) => x(`W${d.week}`) ?? 0)
      .attr("y", (d) => y(d.score))
      .attr("width", x.bandwidth())
      .attr("height", (d) => h - m.bottom - y(d.score))
      .attr("rx", 3)
      .attr("fill", (d) =>
        d.score >= 75 ? "#22C55E" : d.score >= 50 ? "#8B5CF6" : "#EF4444"
      )
      .attr("opacity", 0.8);

    // Trend line
    const line = d3.line<(typeof trendData)[0]>()
      .x((d) => (x(`W${d.week}`) ?? 0) + x.bandwidth() / 2)
      .y((d) => y(d.score))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(trendData)
      .attr("fill", "none")
      .attr("stroke", "#00D4AA")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,2")
      .attr("opacity", 0.6)
      .attr("d", line);

    // X axis
    g.append("g")
      .attr("transform", `translate(0,${h - m.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d, i) => i % 2 === 0 ? d : ""))
      .call((a) => {
        a.select(".domain").remove();
        a.selectAll("line").remove();
        a.selectAll("text").attr("fill", "#64748B").attr("font-size", "8px");
      });

    // Y axis
    g.append("g")
      .attr("transform", `translate(${m.left},0)`)
      .call(d3.axisLeft(y).ticks(4))
      .call((a) => {
        a.select(".domain").remove();
        a.selectAll("line").remove();
        a.selectAll("text").attr("fill", "#64748B").attr("font-size", "8px");
      });
  }, [trendData]);

  // Calculate improvement
  const firstScore = trendData[0]?.score ?? 50;
  const lastScore = trendData[trendData.length - 1]?.score ?? firstScore;
  const improvement = ((lastScore - firstScore) / firstScore) * 100;

  return (
    <GlassCard className="p-5" hoverable>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
          12-Week BES Trend
        </h3>
        <div
          className={`px-3 py-1 rounded-full text-[10px] font-bold border ${
            improvement >= 0
              ? "text-[var(--color-success)] border-[var(--color-success)]/20 bg-[var(--color-success-dim)]"
              : "text-[var(--color-danger)] border-[var(--color-danger)]/20 bg-[var(--color-danger-dim)]"
          }`}
        >
          {improvement >= 0 ? "+" : ""}{improvement.toFixed(0)}% improvement
        </div>
      </div>
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="w-full" />
      </div>
    </GlassCard>
  );
}
