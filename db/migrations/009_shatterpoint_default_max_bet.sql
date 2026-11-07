UPDATE public.games
SET configuration = configuration
  || jsonb_build_object(
    'minBetCents',
    CASE
      WHEN jsonb_typeof(configuration->'minBetCents') = 'number'
        AND (configuration->>'minBetCents') ~ '^[0-9]+$'
        AND (configuration->>'minBetCents')::int BETWEEN 100 AND 75000
        THEN (configuration->>'minBetCents')::int
      ELSE 100
    END,
    'maxBetCents',
    CASE
      WHEN jsonb_typeof(configuration->'maxBetCents') = 'number'
        AND (configuration->>'maxBetCents') ~ '^[0-9]+$'
        AND (configuration->>'maxBetCents')::int = 10000
        THEN 75000
      WHEN jsonb_typeof(configuration->'maxBetCents') = 'number'
        AND (configuration->>'maxBetCents') ~ '^[0-9]+$'
        AND (configuration->>'maxBetCents')::int BETWEEN 100 AND 75000
        THEN (configuration->>'maxBetCents')::int
      ELSE 75000
    END
  ),
  updated_at = now()
WHERE slug = 'shatterpoint';
