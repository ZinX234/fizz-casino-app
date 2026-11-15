import { databasePool } from '@/lib/db'
import { getCarouselImageSettingData, isMissingCarouselTable } from '@/lib/carousel-images'

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!idPattern.test(id)) return new Response('Image not found.', { status: 404 })

  try {
    const storedImage = await getCarouselImageSettingData(id)
    if (storedImage?.dataBase64) {
      return new Response(new Uint8Array(Buffer.from(storedImage.dataBase64, 'base64')), {
        headers: {
          'Content-Type': storedImage.contentType,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      })
    }

    let legacyImage: { imageData: Buffer; contentType: string } | undefined
    try {
      const { rows } = await databasePool.query<{ imageData: Buffer; contentType: string }>(
        `SELECT image_data AS "imageData", content_type AS "contentType"
         FROM public.carousel_images WHERE id = $1::uuid AND image_data IS NOT NULL`,
        [id],
      )
      legacyImage = rows[0]
    } catch (error) {
      if (!isMissingCarouselTable(error)) throw error
    }
    if (!legacyImage) return new Response('Image not found.', { status: 404 })

    return new Response(new Uint8Array(legacyImage.imageData), {
      headers: {
        'Content-Type': legacyImage.contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('[v0] Carousel image unavailable:', error instanceof Error ? error.message : 'unknown error')
    return new Response('Image unavailable.', { status: 503 })
  }
}
