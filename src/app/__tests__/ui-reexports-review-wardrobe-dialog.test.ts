import { describe, it, expect } from 'vitest';

import { ReviewWardrobeDialog as AppReviewWardrobeDialog } from '../components/ReviewWardrobeDialog';
import { ReviewWardrobeDialog as UiReviewWardrobeDialog } from '../../ui/components/ReviewWardrobeDialog';

describe('ReviewWardrobeDialog ui entrypoint', () => {
  it('keeps ReviewWardrobeDialog wired through src/ui', () => {
    expect(UiReviewWardrobeDialog).toBe(AppReviewWardrobeDialog);
  });
});

