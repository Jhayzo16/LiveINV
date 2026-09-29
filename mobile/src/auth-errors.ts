type AuthFailure = { code?: string; status?: number; name?: string; message?: string }

export function authErrorMessage(error: AuthFailure): string {
  if (error.code === 'invalid_credentials') return 'The email or password is incorrect. Use your existing LiveINV website account.'
  if (error.code === 'email_not_confirmed') return 'This account’s email has not been confirmed yet. Confirm it before signing in.'
  if (error.status === 429 || error.code === 'over_request_rate_limit') return 'Too many sign-in attempts. Wait a moment, then try again.'
  if (error.name === 'AuthRetryableFetchError' || error.name === 'AbortError' || error.status === 0 || /network|fetch|timed?\s*out|cancel|abort/i.test(error.message || '')) {
    return 'Cannot reach the sign-in server. Check the emulator’s internet connection, then try again.'
  }
  if (error.status && error.status >= 500) return 'The sign-in server is temporarily unavailable. Please try again shortly.'
  if (error.status === 401 || error.status === 403) return 'Your saved session is no longer valid. Sign in again with your LiveINV account.'
  return 'Sign-in could not be completed. Please try again or check your account with the LiveINV administrator.'
}
