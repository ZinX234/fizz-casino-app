ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS withdrawals_user_idempotency_idx
  ON public.withdrawals (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.manual_deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_id uuid NOT NULL REFERENCES public.deposits(id) ON DELETE RESTRICT,
  first_name text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 80),
  last_name text NOT NULL CHECK (length(btrim(last_name)) BETWEEN 1 AND 80),
  payment_email text NOT NULL CHECK (length(payment_email) BETWEEN 3 AND 254),
  fizz_username text NOT NULL CHECK (length(btrim(fizz_username)) BETWEEN 2 AND 60),
  fizz_email text NOT NULL CHECK (length(fizz_email) BETWEEN 3 AND 254),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS manual_deposit_requests_deposit_idx
  ON public.manual_deposit_requests (deposit_id);
CREATE INDEX IF NOT EXISTS manual_deposit_requests_status_created_idx
  ON public.manual_deposit_requests (status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.player_tips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  recipient_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE TABLE IF NOT EXISTS public.lobby_rains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 60 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','settled')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.lobby_rain_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rain_id uuid NOT NULL REFERENCES public.lobby_rains(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rain_id, user_id)
);

ALTER TABLE public.player_tips
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS player_tips_sender_idempotency_idx
  ON public.player_tips (sender_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.lobby_rains
  ADD COLUMN IF NOT EXISTS idempotency_key text;
CREATE UNIQUE INDEX IF NOT EXISTS lobby_rains_host_idempotency_idx
  ON public.lobby_rains (host_user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS lobby_rains_active_idx
  ON public.lobby_rains (status, closes_at DESC);
CREATE INDEX IF NOT EXISTS lobby_rain_entries_user_idx
  ON public.lobby_rain_entries (user_id, joined_at DESC);

ALTER TABLE public.wallet_transactions
  DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;
ALTER TABLE public.wallet_transactions
  ADD CONSTRAINT wallet_transactions_type_check
  CHECK (type = ANY (ARRAY[
    'deposit'::text, 'withdrawal'::text, 'withdrawal_reversal'::text,
    'bet'::text, 'payout'::text, 'bonus'::text, 'adjustment'::text,
    'tip'::text, 'rain'::text
  ]));

CREATE INDEX IF NOT EXISTS player_tips_sender_created_idx
  ON public.player_tips (sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS player_tips_recipient_created_idx
  ON public.player_tips (recipient_user_id, created_at DESC);
