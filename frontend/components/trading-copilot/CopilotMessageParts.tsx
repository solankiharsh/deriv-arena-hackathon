'use client';

import React from 'react';
import NextImage from 'next/image';
import ReactMarkdown, { type Components } from 'react-markdown';
import type { MessagePart } from '@/lib/trading-copilot/types';
import { CopilotWidgetRenderer } from '@/components/trading-copilot/CopilotWidgets';

// The LLM sometimes emits markdown like `![](  )` or `![alt]()`. ReactMarkdown
// forwards that to a raw <img> with src="", which Next / the browser warn about.
// We filter those out and route valid external images through next/image with
// an explicit size so layout stays stable.
function SafeMarkdownImage({
  src,
  alt,
  title,
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const url = typeof src === 'string' ? src.trim() : '';
  if (!url) return null;
  if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) return null;
  return (
    <span className="relative block my-2 h-60 w-full overflow-hidden rounded-lg border border-border">
      <NextImage
        src={url}
        alt={alt || ''}
        title={title}
        fill
        className="object-contain"
        sizes="(max-width: 768px) 100vw, 640px"
        unoptimized
      />
    </span>
  );
}

const MARKDOWN_COMPONENTS: Components = {
  img: SafeMarkdownImage,
};

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
              <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                {part.content}
              </ReactMarkdown>
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
