create table if not exists public.detector_symbol_signals_latest (
  symbol text primary key,
  market text not null check (market in ('kr', 'us')),
  asof timestamptz not null,
  mentions integer not null default 0 check (mentions >= 0),
  neg_count integer not null default 0 check (neg_count >= 0),
  pos_count integer not null default 0 check (pos_count >= 0),
  panic_score double precision not null check (panic_score >= 0 and panic_score <= 100),
  euphoria_score double precision not null check (euphoria_score >= 0 and euphoria_score <= 100),
  signal_quality double precision not null check (signal_quality >= 0 and signal_quality <= 1),
  mention_velocity_z double precision not null default 0,
  confidence_grade text not null check (confidence_grade in ('A', 'B', 'C', 'D')),
  source_diversity integer not null default 1 check (source_diversity >= 0),
  detector_mode text not null default 'normal',
  extra jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.detector_market_state_latest (
  market text primary key check (market in ('kr', 'us')),
  asof timestamptz not null,
  regime text not null,
  fear_index double precision not null check (fear_index >= 0 and fear_index <= 100),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.detector_status (
  singleton boolean primary key default true check (singleton),
  collector_last_run_at timestamptz,
  collector_errors integer not null default 0,
  llm_provider text not null default 'gemini',
  llm_last_run_at timestamptz,
  llm_degraded boolean not null default false,
  detector_mode text not null default 'normal',
  us_cooldown_until timestamptz,
  hold_list jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists detector_symbol_signals_market_asof_idx
on public.detector_symbol_signals_latest(market, asof desc);

alter table public.detector_symbol_signals_latest enable row level security;
alter table public.detector_market_state_latest enable row level security;
alter table public.detector_status enable row level security;

drop trigger if exists detector_symbol_signals_updated_at on public.detector_symbol_signals_latest;
create trigger detector_symbol_signals_updated_at
before update on public.detector_symbol_signals_latest
for each row execute function public.set_updated_at();

drop trigger if exists detector_market_state_updated_at on public.detector_market_state_latest;
create trigger detector_market_state_updated_at
before update on public.detector_market_state_latest
for each row execute function public.set_updated_at();

drop trigger if exists detector_status_updated_at on public.detector_status;
create trigger detector_status_updated_at
before update on public.detector_status
for each row execute function public.set_updated_at();

insert into public.detector_status (singleton, collector_errors, llm_provider, llm_degraded, detector_mode, hold_list)
values (true, 0, 'gemini', false, 'normal', '[]'::jsonb)
on conflict (singleton)
do nothing;
