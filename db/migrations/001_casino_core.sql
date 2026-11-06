CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  role_id text NOT NULL REFERENCES public.roles(id),
  granted_by uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  currency char(3) NOT NULL DEFAULT 'USD',
  balance numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  type text NOT NULL CHECK (type IN ('deposit','withdrawal','withdrawal_reversal','bet','payout','bonus','adjustment')),
  amount numeric(18,2) NOT NULL CHECK (amount <> 0),
  balance_before numeric(18,2) NOT NULL CHECK (balance_before >= 0),
  balance_after numeric(18,2) NOT NULL CHECK (balance_after >= 0),
  reference_type text,
  reference_id uuid,
  idempotency_key text UNIQUE,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (balance_after = balance_before + amount)
);

CREATE OR REPLACE FUNCTION public.prevent_wallet_transaction_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'wallet_transactions is append-only; create a compensating entry instead';
END;
$$;

CREATE TRIGGER wallet_transactions_append_only
BEFORE UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_transaction_mutation();

CREATE TABLE IF NOT EXISTS public.deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'paymegate',
  external_transaction_id text NOT NULL UNIQUE,
  provider_order_id text UNIQUE,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','expired','cancelled')),
  checkout_url text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  amount numeric(18,2) NOT NULL CHECK (amount > 0),
  currency char(3) NOT NULL DEFAULT 'USD',
  method text NOT NULL,
  destination_token text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','processing','paid','rejected','cancelled','failed')),
  reviewed_by uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  review_note text,
  provider_reference text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  provider text NOT NULL,
  category text NOT NULL CHECK (category IN ('slots','blackjack','roulette','other')),
  description text NOT NULL DEFAULT '',
  cover_image_url text,
  status text NOT NULL DEFAULT 'hidden' CHECK (status IN ('available','hidden','maintenance')),
  featured boolean NOT NULL DEFAULT false,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  game_session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE RESTRICT,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE RESTRICT,
  wager_amount numeric(18,2) NOT NULL CHECK (wager_amount > 0),
  payout_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (payout_amount >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','settled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.game_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id uuid NOT NULL UNIQUE REFERENCES public.bets(id) ON DELETE RESTRICT,
  outcome jsonb NOT NULL,
  payout_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (payout_amount >= 0),
  server_seed_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  bonus_type text NOT NULL CHECK (bonus_type IN ('fixed','percentage','free_spins')),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  wagering_multiplier numeric(8,2) NOT NULL DEFAULT 1 CHECK (wagering_multiplier >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bonus_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  bonus_id uuid NOT NULL REFERENCES public.bonuses(id) ON DELETE RESTRICT,
  bonus_balance numeric(18,2) NOT NULL CHECK (bonus_balance >= 0),
  wagering_required numeric(18,2) NOT NULL CHECK (wagering_required >= 0),
  wagering_completed numeric(18,2) NOT NULL DEFAULT 0 CHECK (wagering_completed >= 0),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','expired','cancelled')),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.vip_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  wagering_threshold numeric(18,2) NOT NULL CHECK (wagering_threshold >= 0),
  bonus_percentage numeric(8,2) NOT NULL DEFAULT 0 CHECK (bonus_percentage >= 0),
  benefits jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vip_memberships (
  user_id uuid PRIMARY KEY REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  vip_level_id uuid REFERENCES public.vip_levels(id) ON DELETE SET NULL,
  lifetime_wagered numeric(18,2) NOT NULL DEFAULT 0 CHECK (lifetime_wagered >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  vip_level_id uuid REFERENCES public.vip_levels(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address inet,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','closed')),
  assigned_to uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
  sender_user_id uuid REFERENCES neon_auth."user"(id) ON DELETE SET NULL,
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 8000),
  internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  rate_key text PRIMARY KEY,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0)
);

CREATE TABLE IF NOT EXISTS public.responsible_gaming_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  limit_type text NOT NULL CHECK (limit_type IN ('deposit','loss','session_time','cooling_off','self_exclusion','suspension')),
  limit_amount numeric(18,2) CHECK (limit_amount IS NULL OR limit_amount >= 0),
  period text CHECK (period IS NULL OR period IN ('day','week','month','per_session')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS wallet_transactions_user_created_idx ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS deposits_user_created_idx ON public.deposits(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS withdrawals_user_created_idx ON public.withdrawals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS games_available_category_idx ON public.games(status, category, featured);
CREATE INDEX IF NOT EXISTS bets_user_created_idx ON public.bets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS game_sessions_user_started_idx ON public.game_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS bonus_claims_user_status_idx ON public.bonus_claims(user_id, status);
CREATE INDEX IF NOT EXISTS promotions_active_dates_idx ON public.promotions(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS webhook_events_received_idx ON public.webhook_events(received_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_user_status_idx ON public.support_tickets(user_id, status);
CREATE INDEX IF NOT EXISTS responsible_gaming_user_type_idx ON public.responsible_gaming_limits(user_id, limit_type, starts_at DESC);

INSERT INTO public.roles (id, name, description) VALUES
  ('player', 'Player', 'Standard player access'),
  ('admin', 'Administrator', 'Authorized casino administration'),
  ('support', 'Support', 'Customer support access')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_wallet_transaction()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_balance numeric(18,2);
DECLARE prior_ledger_write text;
BEGIN
  SELECT balance INTO current_balance FROM public.wallets WHERE id = NEW.wallet_id FOR UPDATE;
  IF current_balance IS NULL OR NEW.balance_before <> current_balance THEN
    RAISE EXCEPTION 'wallet balance changed; transaction must be retried';
  END IF;
  IF NEW.balance_after <> current_balance + NEW.amount OR NEW.balance_after < 0 THEN
    RAISE EXCEPTION 'invalid wallet transaction balance';
  END IF;
  prior_ledger_write := coalesce(current_setting('app.wallet_ledger_write', true), 'off');
  PERFORM set_config('app.wallet_ledger_write', 'on', true);
  UPDATE public.wallets SET balance = NEW.balance_after, updated_at = now() WHERE id = NEW.wallet_id;
  PERFORM set_config('app.wallet_ledger_write', prior_ledger_write, true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_transaction_apply_balance
BEFORE INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_wallet_transaction();

CREATE OR REPLACE FUNCTION public.prevent_wallet_balance_change_without_ledger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.balance IS DISTINCT FROM OLD.balance AND current_setting('app.wallet_ledger_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'wallet balance changes must be recorded in wallet_transactions';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER wallet_balance_ledger_guard
BEFORE UPDATE OF balance ON public.wallets
FOR EACH ROW EXECUTE FUNCTION public.prevent_wallet_balance_change_without_ledger();

COMMENT ON TABLE public.wallet_transactions IS 'Append-only ledger. Every wallet balance change is applied atomically by the ledger trigger.';
COMMENT ON TABLE public.webhook_events IS 'Provider event deduplication and replay-protection record.';
COMMENT ON TABLE public.games IS 'Live game catalog; only database rows with status=available are shown to players.';
COMMENT ON TABLE public.vip_levels IS 'Configurable VIP levels; no levels are inserted until configured by an administrator.';
COMMENT ON TABLE public.bonuses IS 'Configured bonus offers; no sample or promotional records are preloaded.';
COMMENT ON TABLE public.promotions IS 'Database-backed promotions; no placeholder offers are preloaded.';
COMMENT ON TABLE public.responsible_gaming_limits IS 'Per-player cooling-off, self-exclusion, limit and suspension records.';

-- Wallet ledger inserts apply their balance change atomically through the database trigger.

