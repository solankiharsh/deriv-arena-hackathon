'use client';

import React from 'react';
import type { WidgetType } from '@/lib/trading-copilot/types';

import {
  WidgetBarChart,
  type CopilotBarChartData,
} from '@/components/trading-copilot/widgets/WidgetBarChart';
import {
  WidgetLineChart,
  type CopilotLineChartData,
} from '@/components/trading-copilot/widgets/WidgetLineChart';
import {
  WidgetPieChart,
  type CopilotPieChartData,
} from '@/components/trading-copilot/widgets/WidgetPieChart';
import {
  WidgetMetricCard,
  type CopilotMetricCardData,
} from '@/components/trading-copilot/widgets/WidgetMetricCard';
import {
  WidgetDataTable,
  type CopilotDataTableData,
} from '@/components/trading-copilot/widgets/WidgetDataTable';
import {
  WidgetFlowDiagram,
  type CopilotFlowDiagramData,
} from '@/components/trading-copilot/widgets/WidgetFlowDiagram';
import {
  WidgetTradingChart,
  type CopilotTradingChartData,
} from '@/components/trading-copilot/widgets/WidgetTradingChart';
import {
  WidgetSignalCard,
  type CopilotSignalCardData,
} from '@/components/trading-copilot/widgets/WidgetSignalCard';
import {
  WidgetPortfolio,
  type CopilotPortfolioData,
} from '@/components/trading-copilot/widgets/WidgetPortfolio';
import {
  WidgetLeaderboard,
  type CopilotLeaderboardData,
} from '@/components/trading-copilot/widgets/WidgetLeaderboard';
import {
  WidgetTradeTicket,
  type CopilotTradeTicketData,
} from '@/components/trading-copilot/widgets/WidgetTradeTicket';

export function CopilotWidgetRenderer({
  widgetType,
  data,
}: {
  widgetType: WidgetType;
  data: Record<string, unknown>;
}) {
  switch (widgetType) {
    case 'bar_chart':
      return <WidgetBarChart data={data as unknown as CopilotBarChartData} />;
    case 'line_chart':
      return <WidgetLineChart data={data as unknown as CopilotLineChartData} />;
    case 'pie_chart':
      return <WidgetPieChart data={data as unknown as CopilotPieChartData} />;
    case 'metric_card':
      return <WidgetMetricCard data={data as unknown as CopilotMetricCardData} />;
    case 'data_table':
      return <WidgetDataTable data={data as unknown as CopilotDataTableData} />;
    case 'flow_diagram':
      return <WidgetFlowDiagram data={data as unknown as CopilotFlowDiagramData} />;
    case 'trading_chart':
      return <WidgetTradingChart data={data as unknown as CopilotTradingChartData} />;
    case 'signal_card':
      return <WidgetSignalCard data={data as unknown as CopilotSignalCardData} />;
    case 'portfolio':
      return <WidgetPortfolio data={data as unknown as CopilotPortfolioData} />;
    case 'leaderboard':
      return <WidgetLeaderboard data={data as unknown as CopilotLeaderboardData} />;
    case 'trade_ticket':
      return <WidgetTradeTicket data={data as unknown as CopilotTradeTicketData} />;
    default:
      return (
        <pre className="text-xs bg-bg-secondary border border-border rounded-lg p-3 overflow-x-auto my-2">
          {JSON.stringify({ widgetType, data }, null, 2)}
        </pre>
      );
  }
}
