import { describe, it, expect } from 'vitest';

import { EditWardrobeDialog as AppEditWardrobeDialog } from '../components/EditWardrobeDialog';
import { EditWardrobeDialog as UiEditWardrobeDialog } from '../../ui/components/EditWardrobeDialog';

describe('EditWardrobeDialog ui entrypoint', () => {
  it('keeps EditWardrobeDialog wired through src/ui', () => {
    expect(UiEditWardrobeDialog).toBe(AppEditWardrobeDialog);
  });
});
