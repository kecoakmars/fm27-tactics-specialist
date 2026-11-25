-- 0003_trending_and_vectors.sql
-- 7-Day Time-Decay Trending Materialized View & pgvector HNSW Semantic Search

-- HNSW cosine index for instant natural-language tactic discovery
create index if not exists idx_community_tactics_embedding_hnsw
  on public.community_tactics
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Materialized View: Exact MASTER_SPEC.md 7-day weighted time-decay formula
-- TrendScore = SUM( W(e) / (1 + hours_since(e)/24)^1.5 )
-- Weights: view = 1, bookmark = 4, shortlist_add = 6, upvote = 5
create materialized view if not exists public.weekly_trending_wonderkids as
with recent_events as (
  select
    ae.entity_id,
    ae.event_type,
    greatest(0.0, extract(epoch from (now() - ae.created_at)) / 3600.0) as hours_since,
    case ae.event_type
      when 'view' then 1.0
      when 'bookmark' then 4.0
      when 'shortlist_add' then 6.0
      when 'upvote' then 5.0
      else 0.0
    end as weight
  from public.analytics_events ae
  where ae.entity_type = 'wonderkid'
    and ae.created_at >= now() - interval '7 days'
),
aggregated as (
  select
    w.id as wonderkid_uuid,
    w.uid,
    w.game_version,
    coalesce(
      sum(re.weight / power(1.0 + (re.hours_since / 24.0), 1.5)),
      0.0
    )::numeric(12, 4) as trend_score,
    count(*) filter (where re.event_type = 'view')::integer as views_7d,
    count(*) filter (where re.event_type = 'shortlist_add')::integer as shortlists_7d
  from public.wonderkids w
  left join recent_events re
    on re.entity_id = w.uid::text or re.entity_id = w.id::text
  where w.is_curated = true
  group by w.id, w.uid, w.game_version
)
select
  a.wonderkid_uuid,
  a.uid,
  a.game_version,
  a.trend_score,
  a.views_7d,
  a.shortlists_7d,
  row_number() over (
    partition by a.game_version
    order by a.trend_score desc, a.shortlists_7d desc, a.uid asc
  )::integer as rank,
  now() as refreshed_at
from aggregated a;

create unique index if not exists idx_weekly_trending_wonderkids_uid
  on public.weekly_trending_wonderkids (uid);

-- RPC for scheduled GitHub Actions / pg_cron refresh
create or replace function public.refresh_weekly_trending_wonderkids()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  refresh materialized view concurrently public.weekly_trending_wonderkids;
end;
$$;

-- RPC for natural-language semantic search via gemini-embedding-2 (768-dim)
create or replace function public.match_community_tactics(
  query_embedding vector(768),
  match_threshold float default 0.35,
  match_count int default 20,
  filter_version text default null
)
returns table (
  id uuid,
  title text,
  description text,
  game_version text,
  ip_formation text,
  oop_formation text,
  playstyle_tag text,
  mentality smallint,
  tactic_json jsonb,
  fmf_storage_path text,
  balance_score numeric,
  upvotes_count integer,
  bookmarks_count integer,
  downloads_count integer,
  created_at timestamptz,
  similarity float
)
language sql
stable
set search_path = public
as $$
  select
    ct.id,
    ct.title,
    ct.description,
    ct.game_version,
    ct.ip_formation,
    ct.oop_formation,
    ct.playstyle_tag,
    ct.mentality,
    ct.tactic_json,
    ct.fmf_storage_path,
    ct.balance_score,
    ct.upvotes_count,
    ct.bookmarks_count,
    ct.downloads_count,
    ct.created_at,
    1 - (ct.embedding <=> query_embedding) as similarity
  from public.community_tactics ct
  where ct.moderation_status = 'approved'
    and ct.embedding is not null
    and (filter_version is null or ct.game_version = filter_version)
    and 1 - (ct.embedding <=> query_embedding) >= match_threshold
  order by ct.embedding <=> query_embedding
  limit least(match_count, 50);
$$;
