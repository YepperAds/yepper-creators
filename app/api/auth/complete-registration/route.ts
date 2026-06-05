import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/_lib/db';

export async function POST(req: NextRequest) {
  const session = req.cookies.get('yepper_session')?.value;
  const body = await req.json().catch(() => ({}));
  if (!session) {
    return NextResponse.json({ success: false, message: 'No active session.' }, { status: 401 });
  }

  const businessName = String(body.business_name ?? '').trim();
  const location = body.location ? String(body.location).trim() : null;
  const businessSector = body.business_sector ? String(body.business_sector).trim() : null;
  const isRegisteredEntity = Boolean(body.is_registered_entity);

  if (!businessName) {
    return NextResponse.json({ success: false, message: 'Business name is required.' }, { status: 400 });
  }

  await query(
    `UPDATE businesses
     SET business_name = $1,
         location = $2,
         business_sector = $3,
         is_registered_entity = $4,
         updated_at = NOW()
     WHERE id = $5;`,
    [businessName, location, businessSector, isRegisteredEntity, session],
  );

  return NextResponse.json({ success: true, data: { message: 'Onboarding completed.' } });
}
