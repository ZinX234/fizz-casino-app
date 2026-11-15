import { auth } from '@/lib/auth/server'
import { getCasinoAdminAccess } from '@/lib/casino-games'
import { consumeUserRateLimit, databasePool } from '@/lib/db'
import { isAllowedRequestOrigin } from '@/lib/request-security'

const maxImageBytes = 4 * 1024 * 1024
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function detectedImageType(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 && bytes[4] === 13 && bytes[5] === 10 && bytes[6] === 26 && bytes[7] === 10) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg'
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp'
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(String.fromCharCode(...bytes.slice(0, 6)))) return 'image/gif'
  return null
}

async function getAdminSession(request: Request) {
  if (!isAllowedRequestOrigin(request)) return { response: Response.json({ error: 'Request origin is not allowed.' }, { status: 403 }) }
  const { data: session } = await auth.getSession()
  if (!session?.user?.id || !session.user.email) return { response: Response.json({ error: 'Authentication required.' }, { status: 401 }) }
  const access = await getCasinoAdminAccess(session.user.id, session.user.email)
  if (!access.authorized) return { response: Response.json({ error: 'Administrator access is restricted.' }, { status: 403 }) }
  return { userId: session.user.id }
}

export async function POST(request: Request) {
  const admin = await getAdminSession(request)
  if ('response' in admin) return admin.response
  if (!(await consumeUserRateLimit(admin.userId, 'admin-carousel-image-upload', 10, 60))) {
    return Response.json({ error: 'Please wait before uploading more carousel images.' }, { status: 429 })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > maxImageBytes + 32_768) return Response.json({ error: 'Image upload is too large.' }, { status: 413 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Invalid image upload.' }, { status: 400 })
  }

  const image = form.get('image')
  const altText = form.get('altText')
  if (!(image instanceof File) || typeof altText !== 'string' || !altText.trim() || altText.trim().length > 200) {
    return Response.json({ error: 'Choose an image and enter a description of 1–200 characters.' }, { status: 400 })
  }
  if (image.size === 0 || image.size > maxImageBytes) {
    return Response.json({ error: 'Image must be larger than 0 bytes and no larger than 4 MB.' }, { status: 413 })
  }

  const bytes = new Uint8Array(await image.arrayBuffer())
  const contentType = detectedImageType(bytes)
  if (!contentType || contentType !== image.type) {
    return Response.json({ error: 'Upload a valid PNG, JPEG, WebP, or GIF image.' }, { status: 400 })
  }

  try {
    const { rows } = await databasePool.query<{ id: string; createdAt: string }>(
      `INSERT INTO public.carousel_images (image_data, content_type, alt_text)
       VALUES ($1, $2, $3)
       RETURNING id::text, created_at::text AS "createdAt"`,
      [Buffer.from(bytes), contentType, altText.trim()],
    )
    const row = rows[0]
    if (!row) throw new Error('Carousel image was not returned after insert')
    return Response.json({
      image: { id: row.id, imageUrl: null, contentType, altText: altText.trim(), createdAt: row.createdAt },
    }, { status: 201 })
  } catch (error) {
    console.error('[v0] Carousel image upload failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The carousel image could not be saved.' }, { status: 503 })
  }
}

export async function DELETE(request: Request) {
  const admin = await getAdminSession(request)
  if ('response' in admin) return admin.response
  if (!(await consumeUserRateLimit(admin.userId, 'admin-carousel-image-delete', 20, 60))) {
    return Response.json({ error: 'Please wait before removing more carousel images.' }, { status: 429 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid image removal request.' }, { status: 400 })
  }
  if (!payload || typeof payload !== 'object' || !('id' in payload) || typeof payload.id !== 'string' || !idPattern.test(payload.id)) {
    return Response.json({ error: 'Choose a valid carousel image.' }, { status: 400 })
  }

  try {
    const { rowCount } = await databasePool.query(
      'DELETE FROM public.carousel_images WHERE id = $1::uuid',
      [payload.id],
    )
    if (!rowCount) return Response.json({ error: 'Carousel image was not found.' }, { status: 404 })
    return Response.json({ removed: true })
  } catch (error) {
    console.error('[v0] Carousel image removal failed:', error instanceof Error ? error.message : 'unknown error')
    return Response.json({ error: 'The carousel image could not be removed.' }, { status: 503 })
  }
}
