'use strict';

import type OpenAI from 'openai';
import type { FunctionParameters } from 'openai/resources/shared';
import { widgetFunctionTools } from '@/lib/trading-copilot/copilot-widget-tools';
import { tradingFunctionTools, TRADING_COPILOT_SYSTEM_PROMPT } from '@/lib/trading-copilot/copilot-trading-tools';

type FnTool = (typeof widgetFunctionTools)[number] | (typeof tradingFunctionTools)[number];

function toOpenAITool(t: FnTool): OpenAI.Chat.Completions.ChatCompletionTool {
  return {
    type: 'function',
    function: {
      name: t.function.name,
      description: t.function.description,
      parameters: t.function.parameters as FunctionParameters,
    },
  };
}

export const TRADING_COPILOT_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  ...widgetFunctionTools.map(toOpenAITool),
  ...tradingFunctionTools.map(toOpenAITool),
];

export { TRADING_COPILOT_SYSTEM_PROMPT };
