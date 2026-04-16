'use client';

import React, { useState, useEffect } from 'react';
import { useMilesStore, CatalogItem } from '@/lib/stores/miles-store';
import { MilesBalance, MilesIcon, showRedemptionNotification } from '@/components/miles';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const CATEGORIES = [
  { id: 'all', label: 'All Items', icon: '🎁' },
  { id: 'ai_analysis', label: 'AI Analysis', icon: '🤖' },
  { id: 'premium_feature', label: 'Premium Features', icon: '⭐' },
  { id: 'third_party_tool', label: 'Third-party Tools', icon: '🔧' },
  { id: 'marketplace_item', label: 'Marketplace Items', icon: '🛍️' },
  { id: 'trading_benefit', label: 'Trading Benefits', icon: '📈' },
];

export default function MarketplacePage() {
  const [userId] = useState('demo_user');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [isRedemptionOpen, setIsRedemptionOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const { catalog, balance, loading, fetchCatalog, fetchBalance, redeemItem } = useMilesStore();

  useEffect(() => {
    fetchCatalog(userId, selectedCategory === 'all' ? undefined : selectedCategory);
    fetchBalance(userId);
  }, [selectedCategory, userId, fetchCatalog, fetchBalance]);

  const filteredCatalog = catalog.filter(item => {
    if (!searchQuery) return true;
    return (
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleRedeemClick = (item: CatalogItem) => {
    setSelectedItem(item);
    setQuantity(1);
    setIsRedemptionOpen(true);
  };

  const handleConfirmRedemption = async () => {
    if (!selectedItem) return;

    setIsRedeeming(true);
    try {
      await redeemItem(userId, selectedItem.id, quantity);
      showRedemptionNotification(selectedItem.name, parseFloat(selectedItem.final_cost) * quantity);
      setIsRedemptionOpen(false);
      setSelectedItem(null);
    } catch (error) {
      toast.error((error as Error).message || 'Redemption failed');
    } finally {
      setIsRedeeming(false);
    }
  };

  const totalCost = selectedItem ? parseFloat(selectedItem.final_cost) * quantity : 0;
  const canAfford = balance ? parseFloat(balance.current_balance) >= totalCost : false;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Deriv Miles Marketplace</h1>
            <p className="text-muted-foreground">Redeem your miles for exclusive rewards</p>
          </div>
          <MilesBalance userId={userId} showTier className="bg-card border border-border rounded-lg px-4 py-3" />
        </div>

        <div className="flex gap-4 mb-6">
          <Input
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(cat.id)}
              className="whitespace-nowrap"
            >
              <span className="mr-2">{cat.icon}</span>
              {cat.label}
            </Button>
          ))}
        </div>

        {loading && catalog.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-card border border-border rounded-lg p-6 animate-pulse">
                <div className="h-32 bg-muted rounded mb-4"></div>
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-full mb-4"></div>
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        ) : filteredCatalog.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-muted-foreground mb-2">No items found</p>
            <p className="text-muted-foreground">Try adjusting your filters or search query</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCatalog.map(item => {
              const discount = parseFloat(item.discount);
              const hasDiscount = discount > 0;

              return (
                <div key={item.id} className="bg-card border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <MilesIcon size={64} className="text-primary/30" />
                    </div>
                  )}
                  
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        {hasDiscount && (
                          <span className="text-sm text-muted-foreground line-through mr-2">
                            {parseFloat(item.base_cost).toLocaleString()}
                          </span>
                        )}
                        <span className="text-2xl font-bold flex items-center gap-1">
                          <MilesIcon size={20} className="text-yellow-500" />
                          {parseFloat(item.final_cost).toLocaleString()}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-green-600 font-medium ml-2">
                            Save {Math.round(discount)}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.stock_quantity != null && (
                      <div className="text-xs text-muted-foreground mb-3">
                        {item.stock_quantity > 0 ? (
                          <span>{item.stock_quantity} in stock</span>
                        ) : (
                          <span className="text-red-500">Out of stock</span>
                        )}
                      </div>
                    )}

                    <Button
                      onClick={() => handleRedeemClick(item)}
                      disabled={!item.available || (item.stock_quantity != null && item.stock_quantity <= 0)}
                      className="w-full"
                    >
                      {!item.available ? 'Unavailable' : (item.stock_quantity != null && item.stock_quantity <= 0) ? 'Out of Stock' : 'Redeem'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={isRedemptionOpen} onOpenChange={setIsRedemptionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Redemption</DialogTitle>
            <DialogDescription>
              Review your redemption details before confirming
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-4">
              <div>
                <h3 className="font-semibold mb-1">{selectedItem.name}</h3>
                <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
              </div>

              <div className="flex items-center justify-between border-t border-b border-border py-3">
                <span className="text-sm font-medium">Quantity</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    -
                  </Button>
                  <span className="w-12 text-center">{quantity}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    +
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Unit cost</span>
                  <span className="flex items-center gap-1">
                    <MilesIcon size={16} className="text-yellow-500" />
                    {parseFloat(selectedItem.final_cost).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between font-semibold">
                  <span>Total cost</span>
                  <span className="flex items-center gap-1 text-lg">
                    <MilesIcon size={20} className="text-yellow-500" />
                    {totalCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Your balance</span>
                  <span className={`flex items-center gap-1 ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                    <MilesIcon size={16} className={canAfford ? 'text-green-600' : 'text-red-600'} />
                    {balance ? parseFloat(balance.current_balance).toLocaleString() : 0}
                  </span>
                </div>
                {!canAfford && (
                  <p className="text-sm text-red-600">
                    You need {(totalCost - (balance ? parseFloat(balance.current_balance) : 0)).toLocaleString()} more miles
                  </p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedemptionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmRedemption} disabled={!canAfford || isRedeeming}>
              {isRedeeming ? 'Redeeming...' : 'Confirm Redemption'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
