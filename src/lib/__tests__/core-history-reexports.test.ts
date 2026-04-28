import { describe, it, expect } from 'vitest';

import { clearAllHistory as libClearAllHistory } from '../api';
import { clearAllHistory as coreClearAllHistory } from '../../core/history';

describe('core/history re-exports', () => {
  it('re-exports clearAllHistory', () => {
    expect(coreClearAllHistory).toBe(libClearAllHistory);
  });
});

