import { describe, it, expect } from 'vitest';

import { ConfirmDialog as AppConfirmDialog } from '../components/ConfirmDialog';
import { ProfileDialog as AppProfileDialog } from '../components/ProfileDialog';
import { SettingsDialog as AppSettingsDialog } from '../components/SettingsDialog';

import { ConfirmDialog as UiConfirmDialog } from '../../ui/components/ConfirmDialog';
import { ProfileDialog as UiProfileDialog } from '../../ui/components/ProfileDialog';
import { SettingsDialog as UiSettingsDialog } from '../../ui/components/SettingsDialog';

describe('UI dialog re-export stubs', () => {
  it('keeps ConfirmDialog wired to the new UI layer', () => {
    expect(AppConfirmDialog).toBe(UiConfirmDialog);
  });

  it('keeps SettingsDialog wired to the new UI layer', () => {
    expect(AppSettingsDialog).toBe(UiSettingsDialog);
  });

  it('keeps ProfileDialog wired to the new UI layer', () => {
    expect(AppProfileDialog).toBe(UiProfileDialog);
  });
});

