'use strict';

export type WidgetType =
  | 'bar_chart'
  | 'line_chart'
  | 'pie_chart'
  | 'metric_card'
  | 'data_table'
  | 'flow_diagram'
  | 'trading_chart'
  | 'trade_ticket'
  | 'portfolio'
  | 'signal_card'
  | 'leaderboard';

export type TextPart = { type: 'text'; content: string };

export type WidgetPart = {
  type: 'widget';
  toolCallId: string;
  widgetType: WidgetType;
  data: Record<string, unknown>;
};

export type MessagePart = TextPart | WidgetPart;

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}
