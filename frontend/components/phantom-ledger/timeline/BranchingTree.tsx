"use client";

import { useEffect, useRef, useMemo } from "react";
import * as d3 from "d3";
import { useTradeStore } from "@/lib/stores/trade-store";
import { usePhantomStore } from "@/lib/stores/phantom-store";
import { useAntiYouStore } from "@/lib/stores/anti-you-store";

interface TreeNode {
  id: string;
  label: string;
  time: number;
  pnl: number;
  type: "real" | "phantom" | "anti-you" | "tilt";
  children: TreeNode[];
}

export function BranchingTree() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { tradeHistory, sessionPnl } = useTradeStore();
  const { activePhantoms, resolvedPhantoms } = usePhantomStore();
  const { shadowPositions } = useAntiYouStore();

  const treeData = useMemo(() => {
    const root: TreeNode = {
      id: "session-start",
      label: "Session Start",
      time: Date.now() - 3600000,
      pnl: 0,
      type: "real",
      children: [],
    };

    const trades = tradeHistory.slice(-15);
    const phantoms = [...activePhantoms, ...resolvedPhantoms].slice(-10);
    const shadows = shadowPositions.slice(-8);

    let parentNode = root;

    if (trades.length === 0 && phantoms.length === 0) {
      root.children = [
        {
          id: "demo-trade-1",
          label: "EUR/USD RISE",
          time: Date.now() - 3000000,
          pnl: 18.5,
          type: "real",
          children: [
            {
              id: "demo-phantom-1",
              label: "Phantom: USD/JPY FALL",
              time: Date.now() - 2800000,
              pnl: 24.0,
              type: "phantom",
              children: [],
            },
            {
              id: "demo-trade-2",
              label: "AUD/USD FALL",
              time: Date.now() - 2700000,
              pnl: -12.0,
              type: "real",
              children: [
                {
                  id: "demo-ay-1",
                  label: "Anti-You: AUD/USD RISE",
                  time: Date.now() - 2700000,
                  pnl: 12.0,
                  type: "anti-you",
                  children: [],
                },
                {
                  id: "demo-tilt-1",
                  label: "Tilt: ON TILT",
                  time: Date.now() - 2500000,
                  pnl: -12.0,
                  type: "tilt",
                  children: [
                    {
                      id: "demo-phantom-2",
                      label: "Phantom: EUR/USD RISE",
                      time: Date.now() - 2400000,
                      pnl: 31.0,
                      type: "phantom",
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
      return root;
    }

    for (const trade of trades) {
      const tradeNode: TreeNode = {
        id: `trade-${trade.id}`,
        label: `${trade.assetDisplayName ?? trade.asset} ${trade.direction}`,
        time: trade.timestamp ?? Date.now(),
        pnl: trade.pnl ?? 0,
        type: "real",
        children: [],
      };

      const matchingPhantoms = phantoms.filter(
        (p) => Math.abs((p.capturedAt ?? 0) - (trade.timestamp ?? 0)) < 120000
      );
      for (const phantom of matchingPhantoms) {
        tradeNode.children.push({
          id: `phantom-${phantom.id}`,
          label: `Phantom: ${phantom.assetDisplayName ?? phantom.asset}`,
          time: phantom.capturedAt ?? Date.now(),
          pnl: phantom.finalPnl ?? 0,
          type: "phantom",
          children: [],
        });
      }

      const matchingShadows = shadows.filter(
        (s) => Math.abs(s.startTime - (trade.timestamp ?? 0)) < 60000
      );
      for (const shadow of matchingShadows) {
        tradeNode.children.push({
          id: `ay-${shadow.id}`,
          label: `Anti-You: ${shadow.asset} ${shadow.direction}`,
          time: shadow.startTime,
          pnl: shadow.currentPnl,
          type: "anti-you",
          children: [],
        });
      }

      if ((trade.pnl ?? 0) < -15) {
        tradeNode.children.push({
          id: `tilt-${trade.id}`,
          label: "Tilt Event",
          time: (trade.timestamp ?? Date.now()) + 30000,
          pnl: trade.pnl ?? 0,
          type: "tilt",
          children: [],
        });
      }

      parentNode.children.push(tradeNode);
      parentNode = tradeNode;
    }

    return root;
  }, [tradeHistory, activePhantoms, resolvedPhantoms, shadowPositions]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("*").remove();

    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom);

    const root = d3.hierarchy(treeData);
    const treeLayout = d3.tree<TreeNode>()
      .size([height - 80, width - 200])
      .separation(() => 1.5);

    treeLayout(root);

    const getColor = (type: TreeNode["type"]) => {
      switch (type) {
        case "real": return "#00D4AA";
        case "phantom": return "#A78BFA";
        case "anti-you": return "#F97316";
        case "tilt": return "#EF4444";
      }
    };

    const getDash = (type: TreeNode["type"]) =>
      type === "phantom" || type === "anti-you" ? "6,4" : "none";

    g.selectAll(".link")
      .data(root.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", (d) => getColor(d.target.data.type))
      .attr("stroke-width", (d) => d.target.data.type === "real" ? 2.5 : 1.5)
      .attr("stroke-dasharray", (d) => getDash(d.target.data.type))
      .attr("stroke-opacity", 0.7)
      .attr("d", d3.linkHorizontal<d3.HierarchyLink<TreeNode>, d3.HierarchyPointNode<TreeNode>>()
        .x((d) => (d.y ?? 0) + 100)
        .y((d) => d.x ?? 0)
      );

    const node = g.selectAll(".node")
      .data(root.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${(d.y ?? 0) + 100},${d.x ?? 0})`)
      .style("cursor", "pointer");

    node.append("circle")
      .attr("r", (d) => d.data.type === "tilt" ? 7 : 6)
      .attr("fill", (d) => getColor(d.data.type))
      .attr("stroke", "#1a1a24")
      .attr("stroke-width", 2)
      .style("filter", (d) => `drop-shadow(0 0 6px ${getColor(d.data.type)})`);

    node.filter((d) => d.data.type === "tilt")
      .append("path")
      .attr("d", "M0,-9 L9,0 L0,9 L-9,0 Z")
      .attr("fill", "#EF4444")
      .attr("opacity", 0.4);

    node.append("text")
      .attr("dy", -14)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => getColor(d.data.type))
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .text((d) => d.data.label.slice(0, 22));

    node.filter((d) => d.data.pnl !== 0)
      .append("text")
      .attr("dy", 22)
      .attr("text-anchor", "middle")
      .attr("fill", (d) => d.data.pnl >= 0 ? "#22C55E" : "#EF4444")
      .attr("font-size", "8px")
      .attr("font-family", "var(--font-geist-mono)")
      .text((d) => `${d.data.pnl >= 0 ? "+" : ""}$${d.data.pnl.toFixed(1)}`);

    node.on("mouseenter", function () {
      d3.select(this).select("circle").transition().duration(150).attr("r", 9);
    }).on("mouseleave", function (_event, d) {
      d3.select(this).select("circle").transition().duration(150)
        .attr("r", d.data.type === "tilt" ? 7 : 6);
    });

    svg.call(zoom.transform, d3.zoomIdentity.translate(20, height / 3));
  }, [treeData]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      <div className="absolute bottom-3 right-3 flex gap-2">
        <button
          onClick={() => {
            if (!svgRef.current) return;
            const svg = d3.select(svgRef.current);
            const height = containerRef.current?.clientHeight ?? 400;
            svg.transition().duration(500).call(
              d3.zoom<SVGSVGElement, unknown>().transform as never,
              d3.zoomIdentity.translate(20, height / 3)
            );
          }}
          className="px-2 py-1 rounded-lg glass text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
