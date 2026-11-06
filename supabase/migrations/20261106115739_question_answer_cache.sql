-- Reuse the existing private history and its owner-only RLS policies.
alter table public.aguirra_messages add column if not exists cache_meta jsonb;
comment on column public.aguirra_messages.cache_meta is 'Versioned answer reuse metadata: context fingerprint, canonical question and original expiration. Never shared across owners.';
