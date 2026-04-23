import { beforeEach, describe, expect, it } from 'vitest';
import { useOutfitSavesStore } from '../outfitSaves';

beforeEach(() => {
  useOutfitSavesStore.getState().clear();
});

describe('outfitSaves store', () => {
  it('starts empty', () => {
    expect(useOutfitSavesStore.getState().isSaved('x')).toBe(false);
  });

  it('toggle saves an outfit', () => {
    useOutfitSavesStore.getState().toggle('a|b');
    expect(useOutfitSavesStore.getState().isSaved('a|b')).toBe(true);
  });

  it('toggle unsaves a saved outfit', () => {
    useOutfitSavesStore.getState().toggle('a|b');
    useOutfitSavesStore.getState().toggle('a|b');
    expect(useOutfitSavesStore.getState().isSaved('a|b')).toBe(false);
  });

  it('saves multiple independent outfits', () => {
    useOutfitSavesStore.getState().toggle('a|b');
    useOutfitSavesStore.getState().toggle('c|d');
    expect(useOutfitSavesStore.getState().isSaved('a|b')).toBe(true);
    expect(useOutfitSavesStore.getState().isSaved('c|d')).toBe(true);
    expect(useOutfitSavesStore.getState().isSaved('e|f')).toBe(false);
  });

  it('toggle ignores empty string', () => {
    useOutfitSavesStore.getState().toggle('');
    expect(Object.keys(useOutfitSavesStore.getState().savedIds)).toHaveLength(0);
  });

  it('clear removes all saved outfits', () => {
    useOutfitSavesStore.getState().toggle('a|b');
    useOutfitSavesStore.getState().toggle('c|d');
    useOutfitSavesStore.getState().clear();
    expect(useOutfitSavesStore.getState().isSaved('a|b')).toBe(false);
    expect(Object.keys(useOutfitSavesStore.getState().savedIds)).toHaveLength(0);
  });
});
