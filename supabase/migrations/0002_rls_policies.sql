-- 0002_rls_policies.sql
-- Strict Row Level Security & Anti-Spam Analytics Rate-Limiting

alter table public.profiles enable row level security;
alter table public.community_tactics enable row level security;
alter table public.community_schedules enable row level security;
alter table public.wonderkids enable row level security;
alter table public.community_shortlists enable row level security;
alter table public.user_interactions enable row level security;
alter table public.analytics_events enable row level security;

-- profiles
create policy "profiles_public_read"
  on public.profiles for select
  using (true);

create policy "profiles_owner_insert"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "profiles_owner_update"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- community_tactics: Public read ONLY for approved items (or own pending items)
create policy "tactics_public_read_approved"
  on public.community_tactics for select
  using (moderation_status = 'approved' or auth.uid() = author_id);

create policy "tactics_owner_insert"
  on public.community_tactics for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "tactics_owner_update"
  on public.community_tactics for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "tactics_owner_delete"
  on public.community_tactics for delete
  to authenticated
  using (auth.uid() = author_id);

-- community_schedules
create policy "schedules_public_read"
  on public.community_schedules for select
  using (true);

create policy "schedules_owner_insert"
  on public.community_schedules for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "schedules_owner_update"
  on public.community_schedules for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "schedules_owner_delete"
  on public.community_schedules for delete
  to authenticated
  using (auth.uid() = author_id);

-- wonderkids: Curated read-only to public; writes via service_role (`pnpm db:seed`)
create policy "wonderkids_public_read_curated"
  on public.wonderkids for select
  using (is_curated = true);

-- community_shortlists
create policy "shortlists_public_read"
  on public.community_shortlists for select
  using (true);

create policy "shortlists_owner_insert"
  on public.community_shortlists for insert
  to authenticated
  with check (auth.uid() = author_id);

create policy "shortlists_owner_update"
  on public.community_shortlists for update
  to authenticated
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "shortlists_owner_delete"
  on public.community_shortlists for delete
  to authenticated
  using (auth.uid() = author_id);

-- user_interactions
create policy "interactions_owner_read"
  on public.user_interactions for select
  to authenticated
  using (auth.uid() = user_id);

create policy "interactions_owner_insert"
  on public.user_interactions for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "interactions_owner_delete"
  on public.user_interactions for delete
  to authenticated
  using (auth.uid() = user_id);

-- analytics_events: Anti-spam cooldown (max 1 identical event per actor_hash per 60s + max 45 events/min)
create or replace function public.can_record_analytics_event(
  p_actor_hash text,
  p_entity_type text,
  p_entity_id text,
  p_event_type text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_actor_hash is not null
    and char_length(p_actor_hash) between 8 and 128
    and not exists (
      select 1
      from public.analytics_events ae
      where ae.actor_hash = p_actor_hash
        and ae.entity_type = p_entity_type
        and ae.entity_id = p_entity_id
        and ae.event_type = p_event_type
        and ae.created_at > now() - interval '60 seconds'
    )
    and (
      select count(*)
      from public.analytics_events ae
      where ae.actor_hash = p_actor_hash
        and ae.created_at > now() - interval '1 minute'
    ) < 45;
$$;

create policy "analytics_events_ratelimited_insert"
  on public.analytics_events for insert
  with check (
    public.can_record_analytics_event(actor_hash, entity_type, entity_id, event_type)
  );
