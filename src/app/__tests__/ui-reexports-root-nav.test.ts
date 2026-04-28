import { describe, it, expect } from 'vitest';

import { Root as AppRoot } from '../components/Root';
import { Sidebar as AppSidebar } from '../components/Sidebar';
import { BottomTabBar as AppBottomTabBar } from '../components/BottomTabBar';

import { Root as UiRoot } from '../../ui/components/Root';
import { Sidebar as UiSidebar } from '../../ui/components/Sidebar';
import { BottomTabBar as UiBottomTabBar } from '../../ui/components/BottomTabBar';

describe('UI component re-export stubs', () => {
  it('keeps Root wired to the new UI layer', () => {
    expect(AppRoot).toBe(UiRoot);
  });

  it('keeps Sidebar wired to the new UI layer', () => {
    expect(AppSidebar).toBe(UiSidebar);
  });

  it('keeps BottomTabBar wired to the new UI layer', () => {
    expect(AppBottomTabBar).toBe(UiBottomTabBar);
  });
});

