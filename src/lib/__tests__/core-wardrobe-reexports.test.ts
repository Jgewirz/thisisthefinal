import { describe, it, expect } from 'vitest';

import { analyzeClothingPhoto as libAnalyzeClothingPhoto, WARDROBE_CATEGORIES as libCats } from '../wardrobeApi';
import { analyzeClothingPhoto as coreAnalyzeClothingPhoto, WARDROBE_CATEGORIES as coreCats } from '../../core/wardrobe';

describe('core/wardrobe re-exports', () => {
  it('re-exports wardrobeApi symbols', () => {
    expect(coreAnalyzeClothingPhoto).toBe(libAnalyzeClothingPhoto);
    expect(coreCats).toBe(libCats);
  });
});

