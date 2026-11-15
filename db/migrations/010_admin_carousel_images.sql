CREATE TABLE IF NOT EXISTS public.carousel_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_data bytea,
  image_url text UNIQUE,
  content_type text NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
  alt_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (image_data IS NOT NULL AND image_url IS NULL AND octet_length(image_data) <= 4194304)
    OR (image_data IS NULL AND image_url IS NOT NULL)
  )
);

INSERT INTO public.carousel_images (image_url, content_type, alt_text)
VALUES (
  '/fizz-header-promo.png',
  'image/png',
  'Fizz supports Visa and Mastercard, with KFC and McDonald''s gift cards coming in the future.'
)
ON CONFLICT (image_url) DO NOTHING;
