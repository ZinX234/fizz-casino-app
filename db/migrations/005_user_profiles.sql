CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY,
  username text NOT NULL UNIQUE CHECK (username ~ '^[a-z0-9_]{3,20}$'),
  fizz_email text NOT NULL CHECK (length(btrim(fizz_email)) BETWEEN 3 AND 254 AND position('@' IN fizz_email) > 1),
  paypal_first_name text NOT NULL CHECK (length(btrim(paypal_first_name)) BETWEEN 1 AND 80),
  paypal_last_name text NOT NULL CHECK (length(btrim(paypal_last_name)) BETWEEN 1 AND 80),
  paypal_email text NOT NULL CHECK (length(btrim(paypal_email)) BETWEEN 3 AND 254 AND position('@' IN paypal_email) > 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);
  
