"use client";

import { useEffect, useId, useRef, useMemo } from "react";
import * as d3 from "d3";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useAntiYouStore } from "@/lib/stores/anti-you-store";
import { calculateBES } from "@/lib/engines/behavioral-scorer";
import { GlassCard } from "@/components/shared/GlassCard";

export function BESGauge() {
  const svgRef = useRef<SVGSVGElement>(null);
  const gradientId = useId().replace(/:/g, "");
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const sessionPnl = useTradeStore((s) => s.sessionPnl);
  const { activePhantoms, resolvedPhantoms } = usePhantomStore();
  const { antiYouSessionPnl } = useAntiYouStore();

  const besData = useMemo(() => {
    const resolvedTrades = tradeHistory.filter(
      (t) => t.status === "won" || t.status === "lost"
    );

    // Compute revenge/post-loss counts from ordered trade history
    const sorted = [...resolvedTrades].sort((a, b) => a.timestamp - b.timestamp);
    let revengeTradeCount = 0;
    let postLossTradeCount = 0;
    let hadALoss = false;
    for (const trade of sorted) {
      if (hadALoss) postLossTradeCount++;
      if (trade.wasRevengeFlag) revengeTradeCount++;
      if (trade.status === "lost") hadALoss = true;
    }

    const components = calculateBES({
      trades: resolvedTrades,
      phantoms: [...activePhantoms, ...resolvedPhantoms],
      revengeTradeCount,
      postLossTradeCount,
      yourPnl: sessionPnl,
      antiYouPnl: antiYouSessionPnl,
    });

    return {
      score: Math.round(components.overallScore),
      phantomEff: Math.round(components.phantomEfficiency),
      exitIntel: Math.round(components.exitIntelligence),
      tiltResist: Math.round(components.tiltResistance),
      antiYouDiff: Math.round(components.antiYouDifferential),
    };
  }, [tradeHistory, activePhantoms, resolvedPhantoms, sessionPnl, antiYouSessionPnl]);

  const besScore = besData.score;

  useEffect(() => {

    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 160;
    const height = 100;
    const cx = width / 2;
    const cy = height * 0.85;
    const r = 70;
    const innerR = 50;

    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;

    const arc = d3.arc<unknown, unknown>()
      .innerRadius(innerR)
      .outerRadius(r)
      .startAngle(startAngle);

    svg.append("path")
      .datum({ endAngle })
      .attr("d", arc({ endAngle } as never) as string)
      .attr("fill", "rgba(255,255,255,0.06)")
      .attr("transform", `translate(${cx}, ${cy})`);

    const valueAngle = startAngle + (endAngle - startAngle) * (besScore / 100);
    const gradient = svg.append("defs").append("linearGradient")
      .attr("id", `bes-gradient-${gradientId}`)
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "100%").attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", "#8B5CF6");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "#00D4AA");

    svg.append("path")
      .datum({ endAngle: valueAngle })
      .attr("d", arc({ endAngle: valueAngle } as never) as string)
      .attr("fill", `url(#bes-gradient-${gradientId})`)
      .attr("transform", `translate(${cx}, ${cy})`)
      .style("filter", "drop-shadow(0 0 8px rgba(139,92,246,0.5))");

    svg.append("text")
      .attr("x", cx)
      .attr("y", cy - 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#F1F5F9")
      .attr("font-size", "22px")
      .attr("font-weight", "bold")
      .attr("font-family", "var(--font-geist-mono)")
      .text(besScore);

    svg.append("text")
      .attr("x", cx)
      .attr("y", cy + 8)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748B")
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("letter-spacing", "2px")
      .text("BES SCORE");

    const thresholdAngle = startAngle + (endAngle - startAngle) * 0.75;
    const markerOuter = [
      cx + r * Math.cos(thresholdAngle - Math.PI / 2),
      cy + r * Math.sin(thresholdAngle - Math.PI / 2),
    ];
    const markerInner = [
      cx + (innerR - 4) * Math.cos(thresholdAngle - Math.PI / 2),
      cy + (innerR - 4) * Math.sin(thresholdAngle - Math.PI / 2),
    ];
    svg.append("line")
      .attr("x1", markerInner[0])
      .attr("y1", markerInner[1])
      .attr("x2", markerOuter[0])
      .attr("y2", markerOuter[1])
      .attr("stroke", "#FBBF24")
      .attr("stroke-width", "2")
      .attr("stroke-dasharray", "3,2");
  }, [besScore, gradientId]);

  const subMetrics = [
    { label: "Phantom Eff.", value: `${besData.phantomEff}%`, color: "var(--color-phantom)" },
    { label: "Exit Intel", value: `${besData.exitIntel}%`, color: "var(--color-real)" },
    { label: "Tilt Resist.", value: `${besData.tiltResist}%`, color: "var(--color-success)" },
    { label: "Anti-You Δ", value: `${besData.antiYouDiff}%`, color: "var(--color-warning)" },
  ];

  return (
    <GlassCard className="p-5 h-full flex flex-col" hoverable>
      <h2 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-1">
        BES Score
      </h2>
      <p className="text-[10px] text-[var(--color-text-muted)] mb-4">
        Behavioral Edge Score — composite discipline metric
      </p>

      <div className="flex-1 flex items-center justify-center">
        <svg ref={svgRef} width={160} height={100} className="overflow-visible" />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
        {subMetrics.map((m) => (
          <div key={m.label} className="text-center">
            <div className="text-[10px] text-[var(--color-text-muted)] truncate">{m.label}</div>
            <div className="text-sm font-bold" style={{ color: m.color }}>
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
