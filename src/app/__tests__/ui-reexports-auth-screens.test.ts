import { describe, it, expect } from 'vitest';

import { LoginScreen as AppLoginScreen } from '../components/LoginScreen';
import { ForgotPasswordScreen as AppForgotPasswordScreen } from '../components/ForgotPasswordScreen';
import { ResetPasswordScreen as AppResetPasswordScreen } from '../components/ResetPasswordScreen';

import { LoginScreen as UiLoginScreen } from '../../ui/screens/LoginScreen';
import { ForgotPasswordScreen as UiForgotPasswordScreen } from '../../ui/screens/ForgotPasswordScreen';
import { ResetPasswordScreen as UiResetPasswordScreen } from '../../ui/screens/ResetPasswordScreen';

describe('Auth screen ui entrypoints', () => {
  it('keeps LoginScreen wired through src/ui', () => {
    expect(UiLoginScreen).toBe(AppLoginScreen);
  });

  it('keeps ForgotPasswordScreen wired through src/ui', () => {
    expect(UiForgotPasswordScreen).toBe(AppForgotPasswordScreen);
  });

  it('keeps ResetPasswordScreen wired through src/ui', () => {
    expect(UiResetPasswordScreen).toBe(AppResetPasswordScreen);
  });
});
