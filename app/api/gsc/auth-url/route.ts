import { NextRequest, NextResponse } from 'next/server';
import { generateAuthUrl, getRedirectUri } from '@/lib/gsc-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Detect calling host and protocol
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
    const proto = request.headers.get('x-forwarded-proto') || (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');

    let dynamicRedirectUri = '';
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      dynamicRedirectUri = `http://${host}/auth/google/callback`;
    } else if (host.includes('indexmetrix.vercel.app')) {
      dynamicRedirectUri = 'https://indexmetrix.vercel.app/auth/google/callback';
    } else if (host.includes('indexmetrixx.vercel.app')) {
      dynamicRedirectUri = 'https://indexmetrixx.vercel.app/auth/google/callback';
    } else {
      dynamicRedirectUri = getRedirectUri();
    }

    const { url, state } = generateAuthUrl(dynamicRedirectUri);
    const response = NextResponse.json({ url, state, redirectUri: dynamicRedirectUri });

    // Store state in a temporary HTTP-only cookie to prevent CSRF
    response.cookies.set('gsc_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    // Store the exact redirect_uri used so token exchange matches 100%
    response.cookies.set('gsc_oauth_redirect_uri', dynamicRedirectUri, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to generate Google OAuth authorization URL' },
      { status: 400 }
    );
  }
}
