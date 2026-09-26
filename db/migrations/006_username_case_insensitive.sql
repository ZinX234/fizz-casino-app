ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_username_check,
  ADD CONSTRAINT user_profiles_username_check CHECK (username ~ '^[A-Za-z0-9_]{3,20}$');

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_case_insensitive_idx
  ON public.user_profiles (lower(username));
