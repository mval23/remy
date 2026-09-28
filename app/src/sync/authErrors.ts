/** Turn Supabase sign-in errors into plain words. */
export function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/invalid login credentials/i.test(msg)) return 'That email and password don’t match. Check both, or reset your password.';
  if (/email not confirmed/i.test(msg)) return 'Confirm your email first: open the link Supabase sent you, then sign in here.';
  if (/already registered|already been registered|already exists/i.test(msg)) return 'There’s already an account with this email. Sign in instead.';
  if (/password should be|weak password|at least \d+ characters/i.test(msg)) return 'Choose a longer password: at least 8 characters.';
  if (/rate limit|too many|for security purposes/i.test(msg)) return 'Too many attempts just now. Wait a minute and try again.';
  if (/fetch|network/i.test(msg)) return 'Couldn’t reach the sync service. Check your internet connection and try again.';
  if (/invalid.*email|unable to validate email/i.test(msg)) return 'That doesn’t look like an email address.';
  return `Something went wrong (${msg}).`;
}
