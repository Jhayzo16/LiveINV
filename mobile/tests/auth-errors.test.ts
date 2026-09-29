import { expect, it } from 'vitest'
import { authErrorMessage } from '../src/auth-errors'

it('distinguishes credentials, confirmation, rate limits, and connectivity', () => {
  expect(authErrorMessage({ code: 'invalid_credentials', status: 400 })).toContain('email or password is incorrect')
  expect(authErrorMessage({ code: 'email_not_confirmed' })).toContain('not been confirmed')
  expect(authErrorMessage({ status: 429 })).toContain('Too many')
  for (const error of [{ name: 'AuthRetryableFetchError' }, { name: 'AbortError' }, { message: 'Network request failed' }, { status: 0 }]) {
    expect(authErrorMessage(error)).toContain('Cannot reach')
  }
})
it('does not expose raw server responses in the login UI', () => {
  expect(authErrorMessage({ status: 500, message: 'internal server detail' })).not.toContain('internal server detail')
  expect(authErrorMessage({ message: 'unknown internal detail' })).not.toContain('unknown internal detail')
})
