create table public.hospitalops_workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  name text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now()
);
create index hospitalops_workspaces_owner_idx on public.hospitalops_workspaces(owner_id);

create table public.hospitalops_members (
  workspace_id uuid not null references public.hospitalops_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'manager')),
  primary key (workspace_id, user_id)
);
create index hospitalops_members_user_idx on public.hospitalops_members(user_id, workspace_id);

create table public.hospitalops_entries (
  workspace_id uuid not null references public.hospitalops_workspaces(id) on delete cascade,
  entry_id text not null check (length(entry_id) between 1 and 300),
  payload jsonb not null,
  version bigint not null default 1 check (version > 0),
  primary key (workspace_id, entry_id)
);

alter table public.hospitalops_workspaces enable row level security;
alter table public.hospitalops_members enable row level security;
alter table public.hospitalops_entries enable row level security;
revoke all on public.hospitalops_workspaces, public.hospitalops_members, public.hospitalops_entries from public, anon, authenticated;
grant select, insert on public.hospitalops_workspaces, public.hospitalops_members to authenticated;
grant select, insert, delete on public.hospitalops_entries to authenticated;
grant update (payload, version) on public.hospitalops_entries to authenticated;

create policy hospitalops_members_own_select on public.hospitalops_members
  for select to authenticated using (user_id = (select auth.uid()));
create policy hospitalops_workspace_member_select on public.hospitalops_workspaces
  for select to authenticated using (owner_id = (select auth.uid()) or exists (
    select 1 from public.hospitalops_members m where m.workspace_id = id and m.user_id = (select auth.uid())
  ));
create policy hospitalops_workspace_owner_insert on public.hospitalops_workspaces
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy hospitalops_owner_grants_members on public.hospitalops_members
  for insert to authenticated with check (
    exists (select 1 from public.hospitalops_workspaces w
      where w.id = workspace_id and w.owner_id = (select auth.uid()))
    and ((role = 'owner' and user_id = (select auth.uid()))
      or (role = 'manager' and user_id <> (select auth.uid())))
  );
create policy hospitalops_member_entries on public.hospitalops_entries
  for all to authenticated using (exists (
    select 1 from public.hospitalops_members m
      where m.workspace_id = hospitalops_entries.workspace_id and m.user_id = (select auth.uid())
  )) with check (exists (
    select 1 from public.hospitalops_members m
      where m.workspace_id = hospitalops_entries.workspace_id and m.user_id = (select auth.uid())
  ));

create function public.hospitalops_create_workspace(workspace_name text)
returns uuid language plpgsql security invoker set search_path = ''
as $fn$
declare
  new_id uuid := gen_random_uuid();
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'Sign-in required' using errcode = '42501'; end if;
  insert into public.hospitalops_workspaces(id, owner_id, name) values (new_id, caller, btrim(workspace_name));
  insert into public.hospitalops_members(workspace_id, user_id, role) values (new_id, caller, 'owner');
  return new_id;
end;
$fn$;

create function public.hospitalops_save_entries(target_workspace uuid, changes jsonb)
returns void language plpgsql security invoker set search_path = ''
as $fn$
declare
  change jsonb;
  expected bigint;
  item_id text;
  affected int;
begin
  if not exists (select 1 from public.hospitalops_members m where m.workspace_id = target_workspace and m.user_id = auth.uid()) then
    raise exception 'Workspace access denied' using errcode = '42501';
  end if;
  if changes is null or jsonb_typeof(changes) <> 'array' or jsonb_array_length(changes) > 100 then
    raise exception 'Invalid batch size' using errcode = '22023';
  end if;
  for change in select value from jsonb_array_elements(changes) order by value->>'id'
  loop
    item_id := change->>'id';
    expected := (change->>'version')::bigint;
    if change->>'action' = 'delete' and expected is not null then
      delete from public.hospitalops_entries e
        where e.workspace_id = target_workspace and e.entry_id = item_id and e.version = expected;
    elsif change->>'action' = 'write' and change ? 'payload' and expected is not null then
      update public.hospitalops_entries e set payload = change->'payload', version = expected + 1
        where e.workspace_id = target_workspace and e.entry_id = item_id and e.version = expected;
    elsif change->>'action' = 'write' and change ? 'payload' then
      insert into public.hospitalops_entries(workspace_id, entry_id, payload)
        values (target_workspace, item_id, change->'payload') on conflict do nothing;
    else
      raise exception 'Invalid entry change' using errcode = '22023';
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'HospitalOps write conflict' using errcode = '40001'; end if;
  end loop;
end;
$fn$;

revoke all on function public.hospitalops_create_workspace(text), public.hospitalops_save_entries(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.hospitalops_create_workspace(text), public.hospitalops_save_entries(uuid, jsonb) to authenticated;
create schema hospitalops_private;
revoke all on schema hospitalops_private from public,anon,authenticated;
grant usage on schema hospitalops_private to authenticated;
create function hospitalops_private.is_owner(target_workspace uuid)
returns boolean language sql stable security definer set search_path=''
as $fn$
  select auth.uid() is not null and exists (
    select 1 from public.hospitalops_workspaces w where w.id=target_workspace and w.owner_id=auth.uid()
  )
$fn$;
revoke all on function hospitalops_private.is_owner(uuid) from public,anon,authenticated;
grant execute on function hospitalops_private.is_owner(uuid) to authenticated;
alter policy hospitalops_owner_grants_members on public.hospitalops_members with check (
  hospitalops_private.is_owner(workspace_id)
  and ((role='owner' and user_id=(select auth.uid())) or (role='manager' and user_id<>(select auth.uid())))
);
