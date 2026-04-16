import { create } from 'zustand';

export interface MilesBalance {
  user_id: string;
  total_earned: string;
  current_balance: string;
  total_spent: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  created_at: string;
  updated_at: string;
}

export interface MilesStats extends MilesBalance {
  next_tier?: string;
  miles_to_next_tier: string;
  tier_benefits: string[];
  total_transactions: number;
}

export interface MilesTransaction {
  id: string;
  user_id: string;
  transaction_type: 'earn' | 'spend' | 'expire' | 'refund';
  amount: string;
  source_type: string;
  source_id?: string;
  description: string;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  category: 'ai_analysis' | 'premium_feature' | 'third_party_tool' | 'marketplace_item' | 'trading_benefit';
  name: string;
  description: string;
  base_cost: string;
  final_cost: string;
  discount: string;
  stock_quantity?: number;
  available: boolean;
  metadata?: Record<string, any>;
  image_url?: string;
  sort_order: number;
}

export interface Redemption {
  id: string;
  user_id: string;
  redemption_type: string;
  item_id: string;
  miles_cost: string;
  status: 'pending' | 'fulfilled' | 'failed' | 'refunded';
  fulfillment_data?: Record<string, any>;
  expires_at?: string;
  created_at: string;
  fulfilled_at?: string;
}

export interface EarningOpportunity {
  type: string;
  title: string;
  description: string;
  icon: string;
}

interface MilesStore {
  balance: MilesBalance | null;
  stats: MilesStats | null;
  transactions: MilesTransaction[];
  catalog: CatalogItem[];
  redemptions: Redemption[];
  earningOpportunities: EarningOpportunity[];
  selectedCategory: string | null;
  loading: boolean;
  error: string | null;

  fetchBalance: (userId: string) => Promise<void>;
  fetchStats: (userId: string) => Promise<void>;
  fetchTransactions: (userId: string, limit?: number, offset?: number) => Promise<void>;
  fetchCatalog: (userId?: string, category?: string) => Promise<void>;
  fetchRedemptions: (userId: string, status?: string) => Promise<void>;
  fetchEarningOpportunities: (userId?: string) => Promise<void>;
  
  redeemItem: (userId: string, itemId: string, quantity?: number, metadata?: Record<string, any>) => Promise<Redemption>;
  
  setSelectedCategory: (category: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090';

export const useMilesStore = create<MilesStore>((set, get) => ({
  balance: null,
  stats: null,
  transactions: [],
  catalog: [],
  redemptions: [],
  earningOpportunities: [],
  selectedCategory: null,
  loading: false,
  error: null,

  fetchBalance: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/miles/balance?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch balance');
      const balance = await response.json();
      set({ balance, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchStats: async (userId: string) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/miles/stats?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch stats');
      const stats = await response.json();
      set({ stats, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchTransactions: async (userId: string, limit = 50, offset = 0) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/miles/transactions?user_id=${userId}&limit=${limit}&offset=${offset}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const transactions = await response.json();
      set({ transactions, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchCatalog: async (userId?: string, category?: string) => {
    set({ loading: true, error: null });
    try {
      let url = `${API_URL}/api/miles/catalog?`;
      if (userId) url += `user_id=${userId}&`;
      if (category) url += `category=${category}&`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch catalog');
      const catalog = await response.json();
      set({ catalog, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchRedemptions: async (userId: string, status?: string) => {
    set({ loading: true, error: null });
    try {
      let url = `${API_URL}/api/miles/redemptions?user_id=${userId}`;
      if (status) url += `&status=${status}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch redemptions');
      const redemptions = await response.json();
      set({ redemptions, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  fetchEarningOpportunities: async (userId?: string) => {
    set({ loading: true, error: null });
    try {
      let url = `${API_URL}/api/miles/earning-opportunities`;
      if (userId) url += `?user_id=${userId}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch earning opportunities');
      const earningOpportunities = await response.json();
      set({ earningOpportunities, loading: false });
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
    }
  },

  redeemItem: async (userId: string, itemId: string, quantity = 1, metadata = {}) => {
    set({ loading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/api/miles/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          item_id: itemId,
          quantity,
          metadata,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || 'Failed to redeem item');
      }
      
      const redemption = await response.json();
      set({ loading: false });
      
      await get().fetchBalance(userId);
      await get().fetchRedemptions(userId);
      
      return redemption;
    } catch (error) {
      set({ error: (error as Error).message, loading: false });
      throw error;
    }
  },

  setSelectedCategory: (category) => set({ selectedCategory: category }),
  
  clearError: () => set({ error: null }),
  
  reset: () => set({
    balance: null,
    stats: null,
    transactions: [],
    catalog: [],
    redemptions: [],
    earningOpportunities: [],
    selectedCategory: null,
    loading: false,
    error: null,
  }),
}));

export type { MilesStore };
