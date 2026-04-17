'use strict';

import Dexie, { type EntityTable } from 'dexie';

export interface CopilotConversationRow {
  id: string;
  userId: string;
  title: string;
  updatedAt: number;
}

export interface CopilotMessageRow {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant';
  partsJson: string;
  createdAt: number;
}

class TradingCopilotDexie extends Dexie {
  conversations!: EntityTable<CopilotConversationRow, 'id'>;
  messages!: EntityTable<CopilotMessageRow, 'id'>;

  constructor() {
    super('DerivArenaTradingCopilot');
    this.version(1).stores({
      conversations: 'id, userId, updatedAt',
      messages: 'id, conversationId, userId, createdAt',
    });
  }
}

let dbInstance: TradingCopilotDexie | null = null;

export function getCopilotDB(): TradingCopilotDexie {
  if (!dbInstance) {
    dbInstance = new TradingCopilotDexie();
  }
  return dbInstance;
}
