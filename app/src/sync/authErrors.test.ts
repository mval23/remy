import { describe, expect, it } from 'vitest';
import { friendlyAuthError } from './authErrors';

describe('sign-in error messages', () => {
  it('explains the common Supabase errors in plain words', () => {
    expect(friendlyAuthError(new Error('Invalid login credentials'))).toContain('don’t match');
    expect(friendlyAuthError(new Error('Email not confirmed'))).toContain('Confirm your email');
    expect(friendlyAuthError(new Error('User already registered'))).toContain('Sign in instead');
    expect(friendlyAuthError(new Error('Password should be at least 6 characters.'))).toContain('at least 8');
    expect(friendlyAuthError(new Error('email rate limit exceeded'))).toContain('Wait a minute');
    expect(friendlyAuthError(new TypeError('Failed to fetch'))).toContain('internet connection');
  });

  it('keeps unknown errors visible', () => {
    expect(friendlyAuthError('Something odd')).toContain('Something odd');
  });
});
