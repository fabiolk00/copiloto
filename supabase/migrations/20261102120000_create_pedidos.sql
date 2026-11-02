-- Local order ledger for Mercado Pago checkouts (Checkout Pro today, Pix via
-- Orders API next). The application never trusts price/payer data from the
-- browser; everything here is written by trusted server code only.

create table if not exists public.pedidos (
  id bigint generated always as identity primary key,
  external_reference text not null unique,
  area_slug text not null,
  trilha text check (trilha in ('crescer', 'mudar')),
  payer_email text not null,
  amount numeric(10, 2) not null,
  currency text not null default 'BRL',
  status text not null default 'pendente'
    check (status in ('pendente', 'pago', 'cancelado', 'expirado', 'falhou')),
  -- Incremented each time a new Pix is generated for the same order (e.g.
  -- after expiration), so each attempt gets its own deterministic
  -- X-Idempotency-Key without colliding with the previous one.
  attempt integer not null default 1,
  mp_order_id text unique,
  qr_code text,
  qr_code_base64 text,
  ticket_url text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pedidos_status_idx on public.pedidos (status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pedidos_set_updated_at on public.pedidos;
create trigger pedidos_set_updated_at
  before update on public.pedidos
  for each row
  execute function public.set_updated_at();

-- No policies on purpose: this table is only ever reached from trusted
-- server code over the direct Postgres connection (DATABASE_URL), whose role
-- owns the table and bypasses RLS. The anon/authenticated roles used by
-- PostgREST/supabase-js get zero access by default.
alter table public.pedidos enable row level security;

-- Dedup ledger for Mercado Pago webhook deliveries (same notification can be
-- redelivered; `event_key` = "{type}:{data_id}" makes re-processing a no-op).
create table if not exists public.pedido_webhook_eventos (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  type text not null,
  data_id text not null,
  received_at timestamptz not null default now()
);

alter table public.pedido_webhook_eventos enable row level security;
