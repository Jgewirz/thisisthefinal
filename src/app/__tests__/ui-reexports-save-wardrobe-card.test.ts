import { describe, it, expect } from 'vitest';

import { SaveButton as AppSaveButton } from '../components/SaveButton';
import { SaveButton as UiSaveButton } from '../../ui/components/SaveButton';
import { WardrobeCard as AppWardrobeCard } from '../components/WardrobeCard';
import { WardrobeCard as UiWardrobeCard } from '../../ui/components/WardrobeCard';

describe('SaveButton and WardrobeCard ui entrypoints', () => {
  it('keeps SaveButton wired through src/ui', () => {
    expect(AppSaveButton).toBe(UiSaveButton);
  });

  it('keeps WardrobeCard wired through src/ui', () => {
    expect(AppWardrobeCard).toBe(UiWardrobeCard);
  });
});
