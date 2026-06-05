import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/app/_lib/db';

export async function GET(req: NextRequest) {
  const session = req.cookies.get('yepper_session')?.value;

  if (!session) {
    return NextResponse.json({ success: false, message: 'No session' }, { status: 200 });
  }

  const result = await query<{
    id: number;
    google_id: string;
    email: string;
    full_name: string | null;
    avatar: string | null;
    business_name: string | null;
    is_registered_entity: boolean;
    location: string | null;
    business_sector: string | null;
    logo_url: string | null;
  }>(
    `SELECT id, google_id, email, full_name, avatar,
            business_name, is_registered_entity, location, business_sector, logo_url
     FROM businesses
     WHERE id = $1
     LIMIT 1;`,
    [session],
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ success: false, message: 'Session not found.' }, { status: 200 });
  }

  const user = result.rows[0];

  return NextResponse.json({
    success: true,
    data: {
      user: {
        user_uuid: String(user.id),
        id: String(user.id),
        google_id: user.google_id,
        fullname: user.full_name ?? '',
        email: user.email,
        business_name: user.business_name ?? undefined,
        is_registered_entity: user.is_registered_entity,
        location: user.location ?? undefined,
        business_sector: user.business_sector ?? undefined,
        logo_url: user.logo_url ?? undefined,
        status: 'verified',
        role: 'advertiser',
        avatar: user.avatar ?? undefined,
      },
    },
  });
}
