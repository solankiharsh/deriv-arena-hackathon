"use client";

import type { AntiYouState } from "@/lib/stores/anti-you-store";

type PersonalityType = NonNullable<AntiYouState["yourPersonality"]>;

interface PersonalityTableProps {
  yourPersonality: PersonalityType | null;
  antiYouPersonality: PersonalityType | null;
}

const DEMO_YOU = {
  tradesPerDay: 14.2,
  peakHours: "Pre-market / Close",
  afterLossBehavior: "Increased Size",
  avgHoldDuration: 252,
  favoriteAssets: [],
  escalatesAfterLoss: true,
  exitsEarly: true,
};

const DEMO_ANTI = {
  tradesPerDay: 2.1,
  peakHours: "London Mid-day",
  afterLossBehavior: "Immediate Shutdown",
  avgHoldDuration: 9900,
  favoriteAssets: [],
  escalatesAfterLoss: false,
  exitsEarly: false,
};

export function PersonalityTable({ yourPersonality, antiYouPersonality }: PersonalityTableProps) {
  const you = yourPersonality ?? DEMO_YOU;
  const anti = antiYouPersonality ?? DEMO_ANTI;

  const rows = [
    {
      trait: "Trades per Day",
      you: `${you.tradesPerDay.toFixed(1)}`,
      youLabel: you.tradesPerDay > 10 ? "Over-trading" : "Selective",
      anti: `${anti.tradesPerDay.toFixed(1)}`,
      antiLabel: anti.tradesPerDay < 5 ? "Selective" : "Active",
      youBetter: you.tradesPerDay < anti.tradesPerDay,
    },
    {
      trait: "Peak Hours",
      you: you.peakHours,
      youLabel: "",
      anti: anti.peakHours,
      antiLabel: "",
      youBetter: false,
    },
    {
      trait: "After a Loss",
      you: you.afterLossBehavior,
      youLabel: you.escalatesAfterLoss ? "Dangerous" : "Disciplined",
      anti: anti.afterLossBehavior,
      antiLabel: anti.escalatesAfterLoss ? "Dangerous" : "Disciplined",
      youBetter: !you.escalatesAfterLoss,
    },
    {
      trait: "Avg Hold Duration",
      you: formatDuration(you.avgHoldDuration),
      youLabel: you.exitsEarly ? "Fear-driven exit" : "Patient",
      anti: formatDuration(anti.avgHoldDuration),
      antiLabel: !anti.exitsEarly ? "Target-bound" : "Impulsive",
      youBetter: !you.exitsEarly,
    },
  ];

  return (
    <div className="glass rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[var(--color-text-primary)] uppercase tracking-wide mb-4">
        Personality Comparison
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide py-2 pr-4 w-32">
                Trait
              </th>
              <th className="text-center text-[10px] font-bold text-[var(--color-real)] uppercase tracking-wide py-2 px-4">
                YOU
              </th>
              <th className="text-center text-[10px] font-bold text-[var(--color-anti-you)] uppercase tracking-wide py-2 pl-4">
                ANTI-YOU
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((row) => (
              <tr key={row.trait} className="hover:bg-white/2 transition-colors">
                <td className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide py-3 pr-4">
                  {row.trait}
                </td>
                <td className="text-center py-3 px-4">
                  <div className="text-sm font-bold text-[var(--color-text-primary)]">
                    {row.you}
                  </div>
                  {row.youLabel && (
                    <div
                      className={`text-[9px] mt-0.5 font-semibold ${
                        row.youBetter ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      }`}
                    >
                      {row.youLabel}
                    </div>
                  )}
                </td>
                <td className="text-center py-3 pl-4">
                  <div className="text-sm font-bold text-[var(--color-text-primary)]">
                    {row.anti}
                  </div>
                  {row.antiLabel && (
                    <div
                      className={`text-[9px] mt-0.5 font-semibold ${
                        !row.youBetter ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
                      }`}
                    >
                      {row.antiLabel}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
