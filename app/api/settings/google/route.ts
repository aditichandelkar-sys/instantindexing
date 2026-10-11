import { NextRequest, NextResponse } from 'next/server';
import { getCredentials, saveCredentials } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  const creds = getCredentials();
  const accounts = (creds.serviceAccounts || []).map((sa: any) => ({
    client_email: sa.client_email,
    project_id: sa.project_id,
    private_key_id: sa.private_key_id,
    addedAt: sa.addedAt || 'Default',
  }));

  return NextResponse.json({
    configured: accounts.length > 0,
    accountsCount: accounts.length,
    accounts: accounts,
    dailyQuotaPerAccount: 200,
    totalDailyCapacity: Math.max(200, accounts.length * 200),
    settings: creds.settings || {},
  });
}

export async function POST(request: NextRequest) {
  try {
    const { serviceAccountJson, settings } = await request.json();
    const creds = getCredentials();

    if (serviceAccountJson) {
      let parsed = typeof serviceAccountJson === 'string' ? JSON.parse(serviceAccountJson) : serviceAccountJson;
      if (!parsed.client_email || !parsed.private_key) {
        return NextResponse.json(
          { error: 'Invalid Google Service Account JSON. "client_email" and "private_key" are required.' },
          { status: 400 }
        );
      }

      parsed.addedAt = new Date().toISOString();
      creds.serviceAccounts = creds.serviceAccounts || [];
      const existingIdx = creds.serviceAccounts.findIndex((a: any) => a.client_email === parsed.client_email);
      if (existingIdx >= 0) {
        creds.serviceAccounts[existingIdx] = parsed;
      } else {
        creds.serviceAccounts.push(parsed);
      }
    }

    if (settings) {
      creds.settings = { ...creds.settings, ...settings };
    }

    saveCredentials(creds);
    return NextResponse.json({
      success: true,
      message: 'Google Cloud Service Account credentials updated successfully!',
      accountsCount: creds.serviceAccounts.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to parse JSON credentials: ' + error.message }, { status: 400 });
  }
}
