import 'server-only'

import { randomUUID } from 'node:crypto'
import { databasePool, withTransaction } from '@/lib/db'
import type { CarouselImageRecord } from '@/lib/casino-data'

const SETTING_PREFIX = 'carousel_image:'
const INITIALIZED_KEY = 'carousel_images_initialized'
export const DEFAULT_CAROUSEL_IMAGE_ID = '00000000-0000-4000-8000-000000000001'
export const DEFAULT_CAROUSEL_IMAGE_URL = '/fizz-header-promo.png'
const DEFAULT_CAROUSEL_IMAGE_ALT = 'Fizz supports Visa and Mastercard, with KFC and McDonald\'s gift cards coming in the future.'

let storageReady: Promise<void> | undefined

export function isMissingCarouselTable(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '42P01'
}

export async function ensureCarouselImageSettings() {
  if (!storageReady) {
    storageReady = withTransaction(async (client) => {
      const { rows } = await client.query<{ setting_key: string }>(
        `INSERT INTO public.site_settings (setting_key, setting_value)
         VALUES ($1, '{"initialized": true}'::jsonb)
         ON CONFLICT (setting_key) DO NOTHING
         RETURNING setting_key`,
        [INITIALIZED_KEY],
      )
      if (!rows[0]) return

      await client.query(
        `INSERT INTO public.site_settings (setting_key, setting_value)
         VALUES (
           $1,
           jsonb_build_object(
             'id', $2::text,
             'imageUrl', $3::text,
             'contentType', $4::text,
             'altText', $5::text,
             'createdAt', now()::text,
             'dataBase64', null
           )
         )
         ON CONFLICT (setting_key) DO NOTHING`,
        [
          `${SETTING_PREFIX}${DEFAULT_CAROUSEL_IMAGE_ID}`,
          DEFAULT_CAROUSEL_IMAGE_ID,
          DEFAULT_CAROUSEL_IMAGE_URL,
          'image/png',
          DEFAULT_CAROUSEL_IMAGE_ALT,
        ],
      )
    })
  }

  try {
    await storageReady
  } catch (error) {
    storageReady = undefined
    throw error
  }
}

export async function getCarouselImageSettings(): Promise<CarouselImageRecord[]> {
  const { rows } = await databasePool.query<CarouselImageRecord>(
    `SELECT setting_value->>'id' AS id,
            setting_value->>'imageUrl' AS "imageUrl",
            setting_value->>'contentType' AS "contentType",
            setting_value->>'altText' AS "altText",
            setting_value->>'createdAt' AS "createdAt"
     FROM public.site_settings
     WHERE left(setting_key, length($1)) = $1
     ORDER BY (setting_value->>'createdAt')::timestamptz ASC, setting_key ASC`,
    [SETTING_PREFIX],
  )
  return rows
}

export async function addCarouselImageSetting(input: {
  bytes: Uint8Array
  contentType: string
  altText: string
}): Promise<CarouselImageRecord> {
  const id = randomUUID()
  const { rows } = await databasePool.query<CarouselImageRecord>(
    `INSERT INTO public.site_settings (setting_key, setting_value)
     VALUES (
       $1,
       jsonb_build_object(
         'id', $2::text,
         'imageUrl', null,
         'contentType', $3::text,
         'altText', $4::text,
         'createdAt', now()::text,
         'dataBase64', $5::text
       )
     )
     RETURNING setting_value->>'id' AS id,
               setting_value->>'imageUrl' AS "imageUrl",
               setting_value->>'contentType' AS "contentType",
               setting_value->>'altText' AS "altText",
               setting_value->>'createdAt' AS "createdAt"`,
    [`${SETTING_PREFIX}${id}`, id, input.contentType, input.altText, Buffer.from(input.bytes).toString('base64')],
  )
  const image = rows[0]
  if (!image) throw new Error('Carousel image was not returned after insert')
  return image
}

export async function getCarouselImageSettingData(id: string) {
  const { rows } = await databasePool.query<{ dataBase64: string | null; contentType: string }>(
    `SELECT setting_value->>'dataBase64' AS "dataBase64",
            setting_value->>'contentType' AS "contentType"
     FROM public.site_settings
     WHERE setting_key = $1`,
    [`${SETTING_PREFIX}${id}`],
  )
  return rows[0] ?? null
}

export async function deleteCarouselImageSetting(id: string) {
  const { rowCount } = await databasePool.query(
    `DELETE FROM public.site_settings WHERE setting_key = $1`,
    [`${SETTING_PREFIX}${id}`],
  )
  return (rowCount ?? 0) > 0
}
