export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { activateSubscription } from '@/lib/subscription';

// Google Play satın alma doğrulama API'si
// Mobil uygulama bu endpoint'i çağırarak satın almayı doğrular
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Giriş yapmalısınız' }, { status: 401 });
    }

    const { purchaseToken, productId, packageName } = await request.json();

    if (!purchaseToken || !productId) {
      return NextResponse.json(
        { error: 'purchaseToken ve productId gerekli' },
        { status: 400 }
      );
    }

    // Google Play Developer API ile doğrulama
    const verifyResult = await verifyGooglePlayPurchase(
      packageName || process.env.GOOGLE_PLAY_PACKAGE_NAME || '',
      productId,
      purchaseToken
    );

    if (!verifyResult.valid) {
      return NextResponse.json(
        { error: verifyResult.error || 'Satın alma doğrulanamadı' },
        { status: 400 }
      );
    }

    // Plan süresini belirle
    const now = new Date();
    let periodEnd: Date;
    let planName: string;

    if (productId.includes('yearly') || productId.includes('yillik')) {
      periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      planName = 'GOOGLE_YEARLY';
    } else {
      periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      planName = 'GOOGLE_MONTHLY';
    }

    // Aboneliği aktifle
    await activateSubscription(
      session.user.id,
      planName,
      periodEnd,
      'GOOGLE_PLAY',
      purchaseToken
    );

    return NextResponse.json({
      success: true,
      message: 'Premium üyelik aktif edildi!',
      expiresAt: periodEnd.toISOString(),
      plan: planName,
    });
  } catch (error: any) {
    console.error('Google Play verify error:', error);
    return NextResponse.json(
      { error: error.message || 'Doğrulama hatası' },
      { status: 500 }
    );
  }
}

async function verifyGooglePlayPurchase(
  packageName: string,
  productId: string,
  purchaseToken: string
): Promise<{ valid: boolean; error?: string; expiryTime?: number }> {
  try {
    const accessToken = await getGoogleAccessToken();
    if (!accessToken) {
      return { valid: false, error: 'Google API erişim hatası' };
    }

    // Google Play Developer API - Subscriptions:get
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Play API error:', response.status, errorData);
      return { valid: false, error: 'Google Play doğrulama başarısız' };
    }

    const data = await response.json();

    // paymentState: 0=Pending, 1=Received, 2=Free Trial, 3=Deferred
    // cancelReason: 0=User cancelled, 1=System cancelled
    const isActive = !data.cancelReason && 
      (data.paymentState === 1 || data.paymentState === 2);

    if (!isActive) {
      return { valid: false, error: 'Abonelik aktif değil' };
    }

    return {
      valid: true,
      expiryTime: parseInt(data.expiryTimeMillis),
    };
  } catch (error: any) {
    console.error('Google Play verification error:', error);
    return { valid: false, error: 'Doğrulama sırasında hata oluştu' };
  }
}

async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const serviceAccountKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY;
    if (!serviceAccountKey) {
      console.error('GOOGLE_PLAY_SERVICE_ACCOUNT_KEY env var eksik');
      return null;
    }

    const key = JSON.parse(serviceAccountKey);

    // JWT oluştur
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(key.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;

    // Token al
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!tokenResponse.ok) {
      console.error('Google OAuth token error:', await tokenResponse.text());
      return null;
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Google access token error:', error);
    return null;
  }
}
