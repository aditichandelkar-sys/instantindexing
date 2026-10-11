import { NextResponse } from 'next/server';
import { generateAuthUrl } from '@/lib/gsc-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { url, state } = generateAuthUrl();
    const response = NextResponse.json({ url, state });

    // Store state in a temporary HTTP-only cookie to prevent CSRF
    response.cookies.set('gsc_oauth_state', state, {
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
