import { databasePool } from '@/lib/db'

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!idPattern.test(id)) return new Response('Image not found.', { status: 404 })

  try {
    const { rows } = await databasePool.query<{ imageData: Buffer; contentType: string }>(
      `SELECT image_data AS "imageData", content_type AS "contentType"
       FROM public.carousel_images WHERE id = $1::uuid AND image_data IS NOT NULL`,
      [id],
    )
    const image = rows[0]
    if (!image) return new Response('Image not found.', { status: 404 })
    return new Response(new Uint8Array(image.imageData), {
      headers: {
        'Content-Type': image.contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[v0] Carousel image unavailable:', error instanceof Error ? error.message : 'unknown error')
    return new Response('Image unavailable.', { status: 503 })
  }
}
