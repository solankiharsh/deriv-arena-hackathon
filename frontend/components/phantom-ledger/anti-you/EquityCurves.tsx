"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useAntiYouStore } from "@/lib/stores/anti-you-store";

export function EquityCurves() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { yourEquityCurve, antiYouEquityCurve } = useAntiYouStore();

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 50 };

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("*").remove();

    // Demo data if no real data
    const yourData = yourEquityCurve.length > 1 ? yourEquityCurve : [
      { timestamp: Date.now() - 3600000, value: 0 },
      { timestamp: Date.now() - 2700000, value: 18.5 },
      { timestamp: Date.now() - 1800000, value: 6.5 },
      { timestamp: Date.now() - 900000, value: 28.5 },
      { timestamp: Date.now(), value: 24.0 },
    ];

    const antiYouData = antiYouEquityCurve.length > 1 ? antiYouEquityCurve : [
      { timestamp: Date.now() - 3600000, value: 0 },
      { timestamp: Date.now() - 2700000, value: -18.5 },
      { timestamp: Date.now() - 1800000, value: -4.5 },
      { timestamp: Date.now() - 900000, value: -22.0 },
      { timestamp: Date.now(), value: -18.0 },
    ];

    const allValues = [...yourData.map((d) => d.value), ...antiYouData.map((d) => d.value)];
    const allTimes = [...yourData.map((d) => d.timestamp), ...antiYouData.map((d) => d.timestamp)];

    const x = d3.scaleTime()
      .domain(d3.extent(allTimes) as [number, number])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([Math.min(...allValues) * 1.1, Math.max(...allValues) * 1.1])
      .range([height - margin.bottom, margin.top]);

    const g = svg.append("g");

    // Zero line
    g.append("line")
      .attr("x1", margin.left)
      .attr("x2", width - margin.right)
      .attr("y1", y(0))
      .attr("y2", y(0))
      .attr("stroke", "rgba(255,255,255,0.1)")
      .attr("stroke-dasharray", "4,4");

    // Area fill for your equity
    const areaYou = d3.area<typeof yourData[0]>()
      .x((d) => x(d.timestamp))
      .y0(y(0))
      .y1((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(yourData)
      .attr("fill", "rgba(0,212,170,0.08)")
      .attr("d", areaYou);

    // Your equity line
    const lineYou = d3.line<typeof yourData[0]>()
      .x((d) => x(d.timestamp))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(yourData)
      .attr("fill", "none")
      .attr("stroke", "var(--color-real)")
      .attr("stroke-width", 2.5)
      .attr("d", lineYou)
      .style("filter", "drop-shadow(0 0 4px rgba(0,212,170,0.5))");

    // Anti-You equity line
    const lineAntiYou = d3.line<typeof antiYouData[0]>()
      .x((d) => x(d.timestamp))
      .y((d) => y(d.value))
      .curve(d3.curveMonotoneX);

    g.append("path")
      .datum(antiYouData)
      .attr("fill", "none")
      .attr("stroke", "var(--color-anti-you)")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6,3")
      .attr("d", lineAntiYou)
      .style("filter", "drop-shadow(0 0 4px rgba(249,115,22,0.4))");

    // Y axis
    g.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(y)
          .ticks(5)
          .tickFormat((d) => `$${d}`)
      )
      .call((axis) => {
        axis.select(".domain").remove();
        axis.selectAll("line").attr("stroke", "rgba(255,255,255,0.1)");
        axis.selectAll("text")
          .attr("fill", "#64748B")
          .attr("font-size", "9px")
          .attr("font-family", "var(--font-geist-mono)");
      });

    // X axis (time)
    g.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(x)
          .ticks(4)
          .tickFormat((d) => d3.timeFormat("%H:%M")(d as Date))
      )
      .call((axis) => {
        axis.select(".domain").remove();
        axis.selectAll("line").remove();
        axis.selectAll("text")
          .attr("fill", "#64748B")
          .attr("font-size", "9px");
      });

    // Divergence shading
    // Find intersection points and shade areas where you're ahead/behind
  }, [yourEquityCurve, antiYouEquityCurve]);

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide">
          Equity Curves
        </h3>
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-[var(--color-real)]" />
            <span className="text-[var(--color-text-muted)]">You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-px border-t-2 border-dashed border-[var(--color-anti-you)]" />
            <span className="text-[var(--color-text-muted)]">Anti-You</span>
          </div>
        </div>
      </div>
      <div ref={containerRef} className="w-full">
        <svg ref={svgRef} className="w-full overflow-visible" />
      </div>
    </div>
  );
}
