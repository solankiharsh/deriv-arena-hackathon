'use strict';

export const widgetFunctionTools = [
  {
    type: 'function' as const,
    function: {
      name: 'show_bar_chart',
      description:
        'Display a bar chart for categorical comparisons (countries, products, groups).',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          xLabel: { type: 'string' },
          yLabel: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
              },
              required: ['name', 'value'],
            },
          },
        },
        required: ['data'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_line_chart',
      description: 'Display a line chart for trends over time.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          xLabel: { type: 'string' },
          yLabel: { type: 'string' },
          data: { type: 'array', items: { type: 'object' } },
          keys: { type: 'array', items: { type: 'string' } },
        },
        required: ['data', 'keys'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_pie_chart',
      description: 'Display a pie chart for proportions or composition.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                value: { type: 'number' },
              },
              required: ['name', 'value'],
            },
          },
        },
        required: ['data'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_metric_card',
      description: 'Display a single headline metric or KPI.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          value: { type: 'string', description: 'Primary value as a string (numbers may be stringified).' },
          change: { type: 'string' },
          changeType: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
          description: { type: 'string' },
        },
        required: ['label', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_data_table',
      description: 'Display a structured multi-column table.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          columns: { type: 'array', items: { type: 'string' } },
          rows: { type: 'array', items: { type: 'object' } },
        },
        required: ['columns', 'rows'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'show_flow_diagram',
      description: 'Display a flow diagram with nodes and directed edges.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
                group: { type: 'string' },
                color: { type: 'string' },
              },
              required: ['id', 'label'],
            },
          },
          edges: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                from: { type: 'string' },
                to: { type: 'string' },
                label: { type: 'string' },
              },
              required: ['from', 'to'],
            },
          },
          groups: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                label: { type: 'string' },
              },
              required: ['id', 'label'],
            },
          },
          direction: { type: 'string', enum: ['LR', 'TB'] },
        },
        required: ['nodes', 'edges'],
      },
    },
  },
] as const;
