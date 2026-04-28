import { describe, it, expect } from 'vitest';

import { WardrobeScreen as AppWardrobeScreen } from '../components/WardrobeScreen';
import { WardrobeScreen as UiWardrobeScreen } from '../../ui/screens/WardrobeScreen';

describe('WardrobeScreen ui entrypoint', () => {
  it('keeps WardrobeScreen wired through src/ui', () => {
    expect(UiWardrobeScreen).toBe(AppWardrobeScreen);
  });
});
