import { describe, it, expect } from 'vitest';

import {
  SavedDrawer as AppSavedDrawer,
  savedItemHref as AppSavedItemHref,
  savedItemTitle as AppSavedItemTitle,
} from '../components/SavedDrawer';

import {
  SavedDrawer as UiSavedDrawer,
  savedItemHref as UiSavedItemHref,
  savedItemTitle as UiSavedItemTitle,
} from '../../ui/components/SavedDrawer';

describe('SavedDrawer ui entrypoint', () => {
  it('keeps SavedDrawer wired through src/ui', () => {
    expect(UiSavedDrawer).toBe(AppSavedDrawer);
  });

  it('keeps savedItemHref and savedItemTitle wired through src/ui', () => {
    expect(UiSavedItemHref).toBe(AppSavedItemHref);
    expect(UiSavedItemTitle).toBe(AppSavedItemTitle);
  });
});
