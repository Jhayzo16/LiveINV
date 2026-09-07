// Test-only Auth responses. No real account or password is created or used.
export async function mockAdminAuth(page) {
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-09-07T00:00:00Z' }
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expiresAt, aud: 'authenticated', role: 'authenticated' })}.test-signature`
  await page.route('**/auth/v1/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/token')) {
      const body = route.request().postDataJSON()
      if (body.email !== user.email || body.password !== 'test-password') {
        await route.fulfill({ status: 400, json: { code: 'invalid_credentials', msg: 'Invalid login credentials' } })
      } else {
        await route.fulfill({ json: { access_token: token, refresh_token: 'test-refresh', token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, user } })
      }
    } else if (path.endsWith('/user')) await route.fulfill({ json: user })
    else if (path.endsWith('/logout')) await route.fulfill({ json: {} })
    else await route.fulfill({ status: 400, json: { message: 'Unexpected Auth request in test' } })
  })
  await page.route('**/rest/v1/admin_users?*', route => route.fulfill({ json: [{ user_id: user.id }] }))
}

export async function signInMockAdmin(page) {
  await page.getByLabel('Email address').fill('admin@example.test')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('navigation', { name: 'Primary navigation' }).waitFor()
}
