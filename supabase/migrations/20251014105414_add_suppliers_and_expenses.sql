-- Create suppliers table
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_person text,
  email text,
  phone text,
  address text,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create expenses table
create type public.expense_category as enum ('supplier', 'salary', 'rent', 'utilities', 'maintenance', 'other');

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  category expense_category not null,
  description text not null,
  amount decimal(10,2) not null,
  supplier_id uuid references public.suppliers(id),
  employee_id uuid references auth.users(id),
  receipt_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS (Row Level Security) policies
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;

-- Suppliers policies
create policy "Suppliers are viewable by all users"
  on public.suppliers
  for select
  using (auth.role() = 'authenticated');

create policy "Suppliers are editable by admins only"
  on public.suppliers
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Suppliers are updatable by admins only"
  on public.suppliers
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Expenses policies
create policy "Expenses are viewable by admins only"
  on public.expenses
  for select
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Expenses are insertable by admins only"
  on public.expenses
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.employee_profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

create policy "Expenses are updatable by admins only"
  on public.expenses
  for update
  to authenticated
  using (
    exists (
      select 1 from public.employee_profiles
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- Add updated_at trigger function if not exists
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at
create trigger handle_suppliers_updated_at
  before update on public.suppliers
  for each row
  execute function public.handle_updated_at();

create trigger handle_expenses_updated_at
  before update on public.expenses
  for each row
  execute function public.handle_updated_at();

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on public.suppliers to anon, authenticated;
grant all on public.expenses to anon, authenticated;