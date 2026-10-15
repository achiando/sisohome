import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Check if user exists
    const user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal if user exists for security
      return NextResponse.json({ success: true });
    }

    // TODO: Generate password reset token and send email
    // For now, just return success
    // In production, you would:
    // 1. Generate a reset token
    // 2. Store it in the database with expiration
    // 3. Send email with reset link

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: 'Reset password failed' },
      { status: 500 }
    );
  }
}
