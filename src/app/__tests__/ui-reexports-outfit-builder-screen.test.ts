import { describe, it, expect } from 'vitest';

import { OutfitBuilderScreen as AppOutfitBuilderScreen } from '../components/OutfitBuilderScreen';
import { OutfitBuilderScreen as UiOutfitBuilderScreen } from '../../ui/screens/OutfitBuilderScreen';

describe('OutfitBuilderScreen ui entrypoint', () => {
  it('keeps OutfitBuilderScreen wired through src/ui', () => {
    expect(UiOutfitBuilderScreen).toBe(AppOutfitBuilderScreen);
  });
});
