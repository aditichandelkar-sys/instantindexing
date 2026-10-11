import { NextRequest, NextResponse } from 'next/server';
import { getCredentials, saveCredentials } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { email: string } }
) {
  const email = decodeURIComponent(params.email);
  const creds = getCredentials();
  creds.serviceAccounts = (creds.serviceAccounts || []).filter((sa: any) => sa.client_email !== email);
  saveCredentials(creds);

  return NextResponse.json({ success: true, message: `Removed service account: ${email}` });
}
