-- 0001_initial_schema.sql
-- FM27 Tactics Generator: Core Community, Wonderkids & Analytics Tables

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null check (char_length(username) between 2 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.community_tactics (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 4000),
  game_version text not null default '27.0',
  ip_formation text not null,
  oop_formation text not null,
  playstyle_tag text not null check (
    playstyle_tag in ('gegenpress', 'possession', 'counter', 'wing_play', 'balanced')
  ),
  mentality smallint not null check (mentality between 1 and 7),
  tactic_json jsonb not null,
  fmf_storage_path text not null,
  balance_score numeric(5, 2) not null default 0 check (balance_score between 0 and 100),
  guide_quality numeric(4, 2) not null default 0.50 check (guide_quality between 0 and 1),
  upvotes_count integer not null default 0 check (upvotes_count >= 0),
  bookmarks_count integer not null default 0 check (bookmarks_count >= 0),
  downloads_count integer not null default 0 check (downloads_count >= 0),
  moderation_status text not null default 'pending' check (
    moderation_status in ('pending', 'approved', 'rejected')
  ),
  embedding vector(768),
  created_at timestamptz not null default now()
);

create table if not exists public.community_schedules (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  focus_tags text[] not null default '{}',
  game_version text not null default '27.0',
  schedule_json jsonb not null,
  upvotes_count integer not null default 0 check (upvotes_count >= 0),
  bookmarks_count integer not null default 0 check (bookmarks_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.wonderkids (
  id uuid primary key default gen_random_uuid(),
  uid integer unique not null check (uid > 0),
  name text not null,
  age smallint not null check (age between 15 and 21),
  club text not null,
  nationality text not null,
  positions text[] not null default '{}',
  estimated_price numeric(8, 2) not null default 0 check (estimated_price >= 0),
  pa_range text not null,
  attributes_json jsonb not null,
  game_version text not null default '27.0',
  is_curated boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.community_shortlists (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 3 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  wonderkid_ids uuid[] not null default '{}',
  game_version text not null default '27.0',
  upvotes_count integer not null default 0 check (upvotes_count >= 0),
  bookmarks_count integer not null default 0 check (bookmarks_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('tactic', 'schedule', 'shortlist')),
  target_id uuid not null,
  action_type text not null check (action_type in ('upvote', 'bookmark')),
  created_at timestamptz not null default now(),
  constraint user_interactions_unique_action unique (user_id, target_type, target_id, action_type)
);

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (
    entity_type in ('tactic', 'schedule', 'shortlist', 'wonderkid')
  ),
  entity_id text not null check (char_length(entity_id) between 1 and 120),
  event_type text not null check (
    event_type in ('view', 'bookmark', 'shortlist_add', 'upvote', 'download')
  ),
  actor_hash text,
  created_at timestamptz not null default now()
);

-- Core B-Tree & GIN Indexes
create index if not exists idx_community_tactics_public_feed
  on public.community_tactics (moderation_status, game_version, playstyle_tag, upvotes_count desc, created_at desc);

create index if not exists idx_community_tactics_formations
  on public.community_tactics (ip_formation, oop_formation);

create index if not exists idx_community_schedules_feed
  on public.community_schedules (game_version, upvotes_count desc, created_at desc);

create index if not exists idx_wonderkids_positions
  on public.wonderkids using gin (positions);

create index if not exists idx_analytics_events_window
  on public.analytics_events (entity_type, created_at desc, entity_id);

create index if not exists idx_analytics_events_ratelimit
  on public.analytics_events (actor_hash, entity_type, entity_id, event_type, created_at desc)
  where actor_hash is not null;

-- Atomic counter trigger for upvotes_count & bookmarks_count
create or replace function public.sync_user_interaction_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta integer := case when tg_op = 'INSERT' then 1 else -1 end;
  v_row record := case when tg_op = 'INSERT' then new else old end;
begin
  if v_row.target_type = 'tactic' then
    if v_row.action_type = 'upvote' then
      update public.community_tactics
      set upvotes_count = greatest(0, upvotes_count + v_delta)
      where id = v_row.target_id;
    elsif v_row.action_type = 'bookmark' then
      update public.community_tactics
      set bookmarks_count = greatest(0, bookmarks_count + v_delta)
      where id = v_row.target_id;
    end if;
  elsif v_row.target_type = 'schedule' then
    if v_row.action_type = 'upvote' then
      update public.community_schedules
      set upvotes_count = greatest(0, upvotes_count + v_delta)
      where id = v_row.target_id;
    elsif v_row.action_type = 'bookmark' then
      update public.community_schedules
      set bookmarks_count = greatest(0, bookmarks_count + v_delta)
      where id = v_row.target_id;
    end if;
  elsif v_row.target_type = 'shortlist' then
    if v_row.action_type = 'upvote' then
      update public.community_shortlists
      set upvotes_count = greatest(0, upvotes_count + v_delta)
      where id = v_row.target_id;
    elsif v_row.action_type = 'bookmark' then
      update public.community_shortlists
      set bookmarks_count = greatest(0, bookmarks_count + v_delta)
      where id = v_row.target_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_user_interaction_counters on public.user_interactions;
create trigger trg_sync_user_interaction_counters
  after insert or delete on public.user_interactions
  for each row execute function public.sync_user_interaction_counters();
