'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { MessagePart } from '@/lib/trading-copilot/types';
import { CopilotWidgetRenderer } from '@/components/trading-copilot/CopilotWidgets';

export function CopilotMessageParts({ parts }: { parts: MessagePart[] }) {
  return (
    <div className="space-y-3">
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <div
              key={i}
              className="prose prose-invert prose-sm max-w-none text-text-primary [&_a]:text-accent-primary"
            >
              <ReactMarkdown>{part.content}</ReactMarkdown>
            </div>
          );
        }
        if (part.type === 'widget') {
          return (
            <CopilotWidgetRenderer
              key={part.toolCallId || i}
              widgetType={part.widgetType}
              data={part.data}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
