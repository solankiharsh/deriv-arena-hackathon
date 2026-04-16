"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useTradeStore } from "@/lib/stores/trade-store";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useAntiYouStore } from "@/lib/stores/anti-you-store";
import { calculateBES } from "@/lib/engines/behavioral-scorer";
import { GlassCard } from "@/components/shared/GlassCard";

export function BESScoreGauge() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const sessionPnl = useTradeStore((s) => s.sessionPnl);
  const { activePhantoms, resolvedPhantoms } = usePhantomStore();
  const { antiYouSessionPnl } = useAntiYouStore();

  const metrics = useMemo(() => {
    const resolvedTrades = tradeHistory.filter((t) => t.status === "won" || t.status === "lost");
    const sortedTrades = [...resolvedTrades].sort((a, b) => a.timestamp - b.timestamp);
    let hadLoss = false;
    let postLossTradeCount = 0;
    let revengeTradeCount = 0;
    for (const trade of sortedTrades) {
      if (hadLoss) postLossTradeCount++;
      if (trade.wasRevengeFlag) revengeTradeCount++;
      if (trade.status === "lost") hadLoss = true;
    }
    const bes = calculateBES({
      trades: resolvedTrades,
      phantoms: [...activePhantoms, ...resolvedPhantoms],
      revengeTradeCount,
      postLossTradeCount,
      yourPnl: sessionPnl,
      antiYouPnl: antiYouSessionPnl,
    });
    return {
      score: Math.round(bes.overallScore),
      components: [
        { label: "Phantom Efficiency", value: Math.round(bes.phantomEfficiency), color: "var(--color-phantom)" },
        { label: "Exit Intelligence", value: Math.round(bes.exitIntelligence), color: "var(--color-real)" },
        { label: "Tilt Resistance", value: Math.round(bes.tiltResistance), color: "var(--color-success)" },
        { label: "Anti-You Diff.", value: Math.round(bes.antiYouDifferential), color: "var(--color-anti-you)" },
      ],
    };
  }, [tradeHistory, activePhantoms, resolvedPhantoms, sessionPnl, antiYouSessionPnl]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const w = 180, h = 120;
    const cx = w / 2, cy = h * 0.85;
    const r = 80, innerR = 58;

    const startAngle = -Math.PI * 0.8;
    const endAngle = Math.PI * 0.8;

    const arc = d3.arc<unknown, unknown>()
      .innerRadius(innerR)
      .outerRadius(r)
      .startAngle(startAngle);

    // Background
    svg.append("path")
      .datum({ endAngle })
      .attr("d", arc({ endAngle } as never) as string)
      .attr("fill", "rgba(255,255,255,0.05)")
      .attr("transform", `translate(${cx},${cy})`);

    // Colored segments
    const segmentAngle = (endAngle - startAngle) / 4;
    const segColors = ["#EF4444", "#F97316", "#FBBF24", "#22C55E"];

    segColors.forEach((color, i) => {
      const sa = startAngle + i * segmentAngle;
      const ea = startAngle + (i + 1) * segmentAngle;
      const segArc = d3.arc<unknown, unknown>()
        .innerRadius(innerR)
        .outerRadius(r)
        .startAngle(sa)
        .endAngle(ea);
      svg.append("path")
        .attr("d", segArc({} as never) as string)
        .attr("fill", color)
        .attr("opacity", 0.3)
        .attr("transform", `translate(${cx},${cy})`);
    });

    // Value arc
    const valueAngle = startAngle + (endAngle - startAngle) * (metrics.score / 100);
    const defs = svg.append("defs");
    const grad = defs.append("linearGradient").attr("id", `bes-dash-grad-${gradientId}`)
      .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
    grad.append("stop").attr("offset", "0%").attr("stop-color", "#8B5CF6");
    grad.append("stop").attr("offset", "100%").attr("stop-color", "#00D4AA");

    svg.append("path")
      .datum({ endAngle: valueAngle })
      .attr("d", arc({ endAngle: valueAngle } as never) as string)
      .attr("fill", `url(#bes-dash-grad-${gradientId})`)
      .attr("transform", `translate(${cx},${cy})`)
      .style("filter", "drop-shadow(0 0 8px rgba(0,212,170,0.4))");

    // Score text
    svg.append("text")
      .attr("x", cx).attr("y", cy - 10)
      .attr("text-anchor", "middle")
      .attr("fill", "#F1F5F9")
      .attr("font-size", "28px")
      .attr("font-weight", "900")
      .attr("font-family", "var(--font-geist-mono)")
      .text(metrics.score);

    svg.append("text")
      .attr("x", cx).attr("y", cy + 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748B")
      .attr("font-size", "8px")
      .attr("font-weight", "bold")
      .attr("letter-spacing", "3px")
      .text("BES SCORE");
  }, [metrics.score, gradientId]);

  return (
    <GlassCard className="p-5 h-full" hoverable>
      <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-2">
        Behavioral Edge Score
      </h3>
      <div className="flex justify-center">
        <svg ref={svgRef} width={180} height={120} className="overflow-visible" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        {metrics.components.map((c) => (
          <div key={c.label} className="text-center p-2 rounded-lg bg-white/3">
            <div className="text-xs font-bold" style={{ color: c.color }}>
              {c.value}%
            </div>
            <div className="text-[8px] text-[var(--color-text-muted)] truncate">{c.label}</div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
