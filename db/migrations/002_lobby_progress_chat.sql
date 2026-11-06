CREATE TABLE IF NOT EXISTS public.player_progression (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  total_xp bigint NOT NULL DEFAULT 0 CHECK (total_xp >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.player_progression (user_id, total_xp)
SELECT u.id, COALESCE(FLOOR(SUM(b.wager_amount) * 4)::bigint, 0)
FROM neon_auth."user" u
LEFT JOIN public.bets b ON b.user_id = u.id AND b.status IN ('pending', 'settled')
GROUP BY u.id
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.lobby_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 240 AND body = btrim(body)),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lobby_chat_messages_created_idx
  ON public.lobby_chat_messages (created_at DESC, id DESC);
