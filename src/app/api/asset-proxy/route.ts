// Asset Proxy — solo accesible para Xavier (admin)
// Sirve archivos de R2 para la vista de preview en /admin/proyectos/[id]
// Protegido: solo ADMIN_CLERK_USER_ID puede acceder

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2Client } from '@/lib/r2-client';

const ADMIN_CLERK_USER_ID = process.env.ADMIN_CLERK_USER_ID!;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId || userId !== ADMIN_CLERK_USER_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = req.nextUrl.searchParams.get('key');
  const isDownload = req.nextUrl.searchParams.get('download') === '1';

  if (!key) {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 });
  }

  // Sanitizar: key debe empezar con 'projects/' para prevenir path traversal
  if (!key.startsWith('projects/')) {
    return NextResponse.json({ error: 'Invalid key' }, { status: 400 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ...(isDownload
        ? { ResponseContentDisposition: `attachment; filename="${key.split('/').pop()}"` }
        : {}),
    });

    const signedUrl = await getSignedUrl(r2Client, command, { expiresIn: 86400 });

    // Redirect al presigned URL de descarga
    return NextResponse.redirect(signedUrl);
  } catch (err) {
    console.error('[AssetProxy] R2 error:', err);
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
