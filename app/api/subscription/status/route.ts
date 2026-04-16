export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getSubscriptionStatus } from '@/lib/subscription';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ isPremium: false, tier: 'FREE', loading: false });
    }

    const status = await getSubscriptionStatus(session.user.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error('Subscription status error:', error);
    return NextResponse.json({ isPremium: false, tier: 'FREE' }, { status: 500 });
  }
}
