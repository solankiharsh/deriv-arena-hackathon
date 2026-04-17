'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

export type CopilotFlowDiagramData = {
  title?: string;
  nodes: Array<{ id: string; label: string; group?: string; color?: string }>;
  edges: Array<{ from: string; to: string; label?: string }>;
  groups?: Array<{ id: string; label: string }>;
  direction?: 'LR' | 'TB';
};

const GROUP_COLORS = ['#00ff41', '#38bdf8', '#f472b6', '#fbbf24'];

type NodePosition = { x: number; y: number; w: number; h: number };

export function WidgetFlowDiagram({ data }: { data: CopilotFlowDiagramData }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());

  const direction = data.direction ?? 'LR';
  const isHorizontal = direction === 'LR';

  const groupIds = data.groups?.map((g) => g.id) ?? [];
  const groupLabels = new Map(data.groups?.map((g) => [g.id, g.label]) ?? []);

  const nodesByGroup = new Map<string, typeof data.nodes>();
  for (const node of data.nodes) {
    const gid = node.group ?? '__ungrouped__';
    if (!nodesByGroup.has(gid)) nodesByGroup.set(gid, []);
    nodesByGroup.get(gid)!.push(node);
    if (!groupIds.includes(gid) && gid !== '__ungrouped__') groupIds.push(gid);
  }
  if (nodesByGroup.has('__ungrouped__') && !groupIds.includes('__ungrouped__')) {
    groupIds.push('__ungrouped__');
  }

  const groupColorMap = new Map<string, string>();
  groupIds.forEach((gid, i) => {
    groupColorMap.set(gid, GROUP_COLORS[i % GROUP_COLORS.length]);
  });

  const measureNodes = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newPositions = new Map<string, NodePosition>();
    containerRef.current
      .querySelectorAll<HTMLElement>('[data-node-id]')
      .forEach((el) => {
        const id = el.getAttribute('data-node-id')!;
        const rect = el.getBoundingClientRect();
        newPositions.set(id, {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          w: rect.width,
          h: rect.height,
        });
      });
    setPositions(newPositions);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(measureNodes);
    return () => cancelAnimationFrame(raf);
  }, [measureNodes]);

  const edges = data.edges
    .map((edge) => {
      const from = positions.get(edge.from);
      const to = positions.get(edge.to);
      if (!from || !to) return null;
      let x1: number, y1: number, x2: number, y2: number;
      if (isHorizontal) {
        x1 = from.x + from.w / 2;
        y1 = from.y;
        x2 = to.x - to.w / 2;
        y2 = to.y;
      } else {
        x1 = from.x;
        y1 = from.y + from.h / 2;
        x2 = to.x;
        y2 = to.y - to.h / 2;
      }
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const path = isHorizontal
        ? `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      return { ...edge, path, x2, y2 };
    })
    .filter(Boolean);

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-card p-5">
      {data.title ? (
        <h4 className="mb-4 text-sm font-semibold text-text-primary">{data.title}</h4>
      ) : null}
      <div ref={containerRef} className="relative overflow-x-auto">
        {positions.size > 0 ? (
          <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 1 }}>
            <defs>
              <marker id="copilot-flow-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="none" stroke="#9ca3af" strokeWidth="1.5" />
              </marker>
            </defs>
            {edges.map((e, i) => (
              <g key={i}>
                <path
                  d={e!.path}
                  fill="none"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                  markerEnd="url(#copilot-flow-arrow)"
                  opacity={0.55}
                />
                {e!.label ? (
                  <text
                    x={(positions.get(data.edges[i].from)!.x + positions.get(data.edges[i].to)!.x) / 2}
                    y={
                      (positions.get(data.edges[i].from)!.y + positions.get(data.edges[i].to)!.y) / 2 - 8
                    }
                    textAnchor="middle"
                    fill="#9ca3af"
                    fontSize="11"
                  >
                    {e!.label}
                  </text>
                ) : null}
              </g>
            ))}
          </svg>
        ) : null}

        <div
          className={`relative flex gap-8 ${isHorizontal ? 'flex-row items-start' : 'flex-col items-center'}`}
          style={{ zIndex: 2 }}
        >
          {groupIds.map((gid) => {
            const nodes = nodesByGroup.get(gid) ?? [];
            const label = groupLabels.get(gid);
            const color = groupColorMap.get(gid) ?? GROUP_COLORS[0];
            return (
              <div
                key={gid}
                className={`flex min-w-[120px] flex-1 ${isHorizontal ? 'flex-col items-center gap-3' : 'flex-row items-center justify-center gap-3'}`}
              >
                {label ? (
                  <p className="mb-1 text-[11px] font-semibold text-text-muted">{label}</p>
                ) : null}
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    data-node-id={node.id}
                    className="rounded-lg px-4 py-2.5 text-center text-sm font-semibold text-black shadow-sm"
                    style={{ backgroundColor: node.color ?? color, minWidth: 100 }}
                  >
                    {node.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
