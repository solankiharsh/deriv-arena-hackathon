"use client";

import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { useTradeStore } from "@/lib/stores/trade-store";
import { GlassCard } from "@/components/shared/GlassCard";

export function LeakCausality() {
  const svgRef = useRef<SVGSVGElement>(null);
  const tradeHistory = useTradeStore((s) => s.tradeHistory);
  const leakData = useMemo(() => {
    const resolvedTrades = tradeHistory.filter((trade) => trade.status === "won" || trade.status === "lost");
    const fearOfGiveback = resolvedTrades.filter((trade) => !trade.heldToExpiry && trade.status === "won").length;
    const fomoEntry = resolvedTrades.filter((trade) => trade.wasRevengeFlag).length;
    const impatience = resolvedTrades.filter((trade) => !trade.heldToExpiry).length;
    const total = Math.max(1, fearOfGiveback + fomoEntry + impatience);
    return [
      { label: "Fear of Giveback", value: Math.round((fearOfGiveback / total) * 100), color: "#8B5CF6" },
      { label: "FOMO / Early Entry", value: Math.round((fomoEntry / total) * 100), color: "#EF4444" },
      { label: "Lack of Patience", value: Math.round((impatience / total) * 100), color: "#F97316" },
    ];
  }, [tradeHistory]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const w = 180, h = 180;
    const radius = 70;

    const pie = d3.pie<(typeof leakData)[0]>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<(typeof leakData)[0]>>()
      .innerRadius(45)
      .outerRadius(radius);

    const arcHover = d3.arc<d3.PieArcDatum<(typeof leakData)[0]>>()
      .innerRadius(45)
      .outerRadius(radius + 6);

    const g = svg.append("g").attr("transform", `translate(${w / 2},${h / 2})`);

    const slices = g.selectAll(".slice")
      .data(pie(leakData))
      .join("path")
      .attr("class", "slice")
      .attr("d", arc)
      .attr("fill", (d) => d.data.color)
      .attr("opacity", 0.85)
      .attr("stroke", "var(--color-bg-secondary)")
      .attr("stroke-width", 2)
      .style("cursor", "pointer")
      .style("filter", (d) => `drop-shadow(0 0 6px ${d.data.color}40)`)
      .attr("aria-label", (d) => `${d.data.label} ${d.data.value}%`)
      .on("mouseenter", function (event, d) {
        d3.select(this).transition().duration(200).attr("d", arcHover(d) as string).attr("opacity", 1);
      })
      .on("mouseleave", function (event, d) {
        d3.select(this).transition().duration(200).attr("d", arc(d) as string).attr("opacity", 0.85);
      });

    // Center text
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "-5px")
      .attr("fill", "#F1F5F9")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .text("LEAK");

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "10px")
      .attr("fill", "#64748B")
      .attr("font-size", "9px")
      .text("CAUSALITY");
  }, [leakData]);

  return (
    <GlassCard className="p-5" hoverable>
      <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
        Leak Causality
      </h3>

      <div className="flex items-center gap-4">
        <svg ref={svgRef} width={180} height={180} className="flex-shrink-0" />

        <div className="space-y-3">
          {leakData.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: item.color }}
                  />
                  <span className="text-[var(--color-text-secondary)] font-medium">
                    {item.label}
                  </span>
                </div>
                <span className="font-bold" style={{ color: item.color }}>
                  {item.value}%
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/6 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${item.value}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  );
}
