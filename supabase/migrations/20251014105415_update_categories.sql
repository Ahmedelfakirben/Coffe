-- Ensure the categories table exists
create table if not exists public.categories (
    id uuid primary key default gen_random_uuid(),
    name text not null unique,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create the updated_at trigger function if it doesn't exist
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Drop existing trigger if exists
drop trigger if exists handle_categories_updated_at on public.categories;

-- Create the trigger
create trigger handle_categories_updated_at
    before update on public.categories
    for each row
    execute function public.handle_updated_at();

-- Enable RLS on categories table
alter table public.categories enable row level security;

-- Drop existing policies
drop policy if exists "Categories are viewable by authenticated users" on public.categories;
drop policy if exists "Categories are insertable by authenticated users" on public.categories;
drop policy if exists "Categories are updatable by authenticated users" on public.categories;
drop policy if exists "Categories are viewable by all authenticated users" on public.categories;
drop policy if exists "Categories are editable by admins only" on public.categories;
drop policy if exists "Categories are updatable by admins only" on public.categories;
drop policy if exists "Categories are deletable by admins only" on public.categories;

-- Create new policies
create policy "Categories are viewable by all authenticated users"
    on public.categories
    for select
    using (auth.role() = 'authenticated');

create policy "Categories are editable by admins only"
    on public.categories
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.employee_profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Categories are updatable by admins only"
    on public.categories
    for update
    to authenticated
    using (
        exists (
            select 1 from public.employee_profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

create policy "Categories are deletable by admins only"
    on public.categories
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.employee_profiles
            where id = auth.uid()
            and role = 'admin'
        )
    );

-- Grant permissions
grant usage on schema public to anon, authenticated;
grant all on public.categories to anon, authenticated;