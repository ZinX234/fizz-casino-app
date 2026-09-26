CREATE TABLE IF NOT EXISTS public.site_settings (
  setting_key text PRIMARY KEY,
  setting_value jsonb NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (setting_key, setting_value)
VALUES ('kick_live', '{"isLive": false}'::jsonb)
ON CONFLICT (setting_key) DO NOTHING;
