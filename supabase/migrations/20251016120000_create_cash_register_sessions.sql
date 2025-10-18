-- Create cash register sessions table for apertura/cierre de caja
create extension if not exists pgcrypto;

create table if not exists public.cash_register_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null,
  opening_amount numeric(12,2) not null check (opening_amount >= 0),
  opened_at timestamptz not null default timezone('utc'::text, now()),
  closing_amount numeric(12,2) null check (closing_amount >= 0),
  closed_at timestamptz null,
  status text not null default 'open' check (status in ('open','closed')),
  notes text null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

-- Fix foreign key reference to employee_profiles
do $$
begin
  if exists (select 1 from information_schema.table_constraints where constraint_name = 'cash_register_sessions_employee_id_fkey' and table_name = 'cash_register_sessions') then
    alter table public.cash_register_sessions drop constraint cash_register_sessions_employee_id_fkey;
  end if;
  alter table public.cash_register_sessions add constraint cash_register_sessions_employee_id_fkey foreign key (employee_id) references public.employee_profiles(id) on delete cascade;
end $$;

-- Indexes
create index if not exists idx_cash_sessions_employee on public.cash_register_sessions(employee_id);
create index if not exists idx_cash_sessions_opened_at on public.cash_register_sessions(opened_at desc);
create index if not exists idx_cash_sessions_closed_at on public.cash_register_sessions(closed_at desc);

-- Enable RLS
alter table public.cash_register_sessions enable row level security;

-- Ensure idempotency: drop policies if they already exist
drop policy if exists "Cash sessions viewable by owner or admins" on public.cash_register_sessions;
drop policy if exists "Cash sessions insertable by owner" on public.cash_register_sessions;
drop policy if exists "Cash sessions updatable by owner or admins" on public.cash_register_sessions;

-- Policies: allow owner and admins
create policy "Cash sessions viewable by owner or admins"
  on public.cash_register_sessions
  for select
  to authenticated
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.employee_profiles ep
      where ep.id = auth.uid() and ep.role = 'admin' and ep.active = true
    )
  );

create policy "Cash sessions insertable by owner"
  on public.cash_register_sessions
  for insert
  to authenticated
  with check (
    employee_id = auth.uid() and status = 'open'
  );

create policy "Cash sessions updatable by owner or admins"
  on public.cash_register_sessions
  for update
  to authenticated
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.employee_profiles ep
      where ep.id = auth.uid() and ep.role = 'admin' and ep.active = true
    )
  )
  with check (
    -- allow closing an open session or editing notes
    status in ('open','closed')
  );

-- Updated at trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists handle_cash_sessions_updated_at on public.cash_register_sessions;
create trigger handle_cash_sessions_updated_at
  before update on public.cash_register_sessions
  for each row
  execute function public.handle_updated_at();