'use strict';

import { describe, expect, it } from 'vitest';
import { returnsFromPrices } from './publicTickFeed';

describe('returnsFromPrices', () => {
  it('computes fractional returns', () => {
    const r = returnsFromPrices([100, 101, 100.5]);
    expect(r).toHaveLength(2);
    expect(r[0]).toBeCloseTo(0.01, 5);
    expect(r[1]).toBeCloseTo((100.5 - 101) / 101, 5);
  });
});
