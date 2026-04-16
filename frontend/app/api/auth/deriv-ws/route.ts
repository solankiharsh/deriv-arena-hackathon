import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  const session = await getSession();
  if (!session?.dt || !session?.da) {
    return NextResponse.json({ wsUrl: null }, { status: 401 });
  }

  const clientId = process.env.NEXT_PUBLIC_DERIV_APP_ID || process.env.DERIV_APP_ID;
  if (!clientId) {
    return NextResponse.json({ wsUrl: null, error: 'App ID not configured' }, { status: 500 });
  }

  try {
    const otpRes = await fetch(
      `https://api.derivws.com/trading/v1/options/accounts/${session.da}/otp`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.dt}`,
          'Deriv-App-ID': clientId,
        },
      },
    );

    if (!otpRes.ok) {
      const errBody = await otpRes.text();
      console.error('[deriv-ws] OTP request failed:', otpRes.status, errBody);
      return NextResponse.json({ wsUrl: null, error: 'OTP request failed' }, { status: 502 });
    }

    const otpData = await otpRes.json();
    const wsUrl = otpData.data?.url || otpData.url;

    if (!wsUrl) {
      console.error('[deriv-ws] No WebSocket URL in OTP response:', JSON.stringify(otpData).slice(0, 300));
      return NextResponse.json({ wsUrl: null, error: 'No WebSocket URL returned' }, { status: 502 });
    }

    return NextResponse.json({ wsUrl });
  } catch (err) {
    console.error('[deriv-ws] OTP request error:', err);
    return NextResponse.json({ wsUrl: null, error: 'OTP request failed' }, { status: 500 });
  }
}
