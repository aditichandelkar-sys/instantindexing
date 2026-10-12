import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, encryptSession } from '@/lib/gsc-auth';
import { saveGscAuthFile } from '@/lib/storage';
import { GscAuthSession } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  const baseUrl = request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${baseUrl}/?gsc_error=${encodeURIComponent(error)}#search-console`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?gsc_error=missing_code#search-console`);
  }

  // State verification check for CSRF defense
  const storedState = request.cookies.get('gsc_oauth_state')?.value;
  if (storedState && state && storedState !== state) {
    console.warn('OAuth State Mismatch: potential CSRF or expired session');
    return NextResponse.redirect(`${baseUrl}/?gsc_error=state_mismatch#search-console`);
  }

  try {
    const redirectUri = request.cookies.get('gsc_oauth_redirect_uri')?.value || `${baseUrl}/auth/google/callback`;
    const { tokens, user } = await exchangeCodeForTokens(code, redirectUri);

    // Verify Search Console permission was actually granted
    if (tokens.scope && !tokens.scope.includes('webmasters')) {
      return NextResponse.redirect(
        `${baseUrl}/?gsc_error=${encodeURIComponent('Search Console permissions were not granted. Please check the Search Console permission box on Google consent screen.')}#search-console`
      );
    }

    const session: GscAuthSession = {
      connectedAt: new Date().toISOString(),
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + ((tokens.expires_in || 3600) * 1000),
        token_type: tokens.token_type,
        scope: tokens.scope,
      },
      user: user || { email: 'Connected Google Account' },
    };

    // Save to backup file storage
    saveGscAuthFile(session);

    // Save to encrypted session cookie
    const encryptedCookie = encryptSession(session);
    const redirectResponse = NextResponse.redirect(`${baseUrl}/?gsc=connected#search-console`);

    redirectResponse.cookies.set('gsc_session', encryptedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Clear temporary state and redirect cookies
    redirectResponse.cookies.delete('gsc_oauth_state');
    redirectResponse.cookies.delete('gsc_oauth_redirect_uri');

    return redirectResponse;
  } catch (err: any) {
    console.error('OAuth Callback Error:', err.message);
    return NextResponse.redirect(
      `${baseUrl}/?gsc_error=${encodeURIComponent(err.message || 'auth_failed')}#search-console`
    );
  }
}
