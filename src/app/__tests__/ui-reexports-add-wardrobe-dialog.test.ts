import { describe, it, expect } from 'vitest';

import { AddWardrobeDialog as AppAddWardrobeDialog } from '../components/AddWardrobeDialog';
import { AddWardrobeDialog as UiAddWardrobeDialog } from '../../ui/components/AddWardrobeDialog';

describe('AddWardrobeDialog ui entrypoint', () => {
  it('keeps AddWardrobeDialog wired through src/ui', () => {
    expect(UiAddWardrobeDialog).toBe(AppAddWardrobeDialog);
  });
});
