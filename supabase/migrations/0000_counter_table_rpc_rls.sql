create table if not exists public.counter (
  id int primary key,
  value int not null default 0
);

alter table public.counter enable row level security;

insert into public.counter (id, value)
values (1, 0)
on conflict (id) do nothing;

create or replace function public.increment_counter()
returns int
language plpgsql
security invoker
set search_path = public
as $$
declare
  new_value int;
begin
  update public.counter
  set value = value + 1
  where id = 1
  returning value into new_value;

  return new_value;
end;
$$;

grant execute on function public.increment_counter() to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'counter'
      and policyname = 'Allow public read access on counter'
  ) then
    create policy "Allow public read access on counter"
      on public.counter
      for select
      to anon, authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'counter'
      and policyname = 'Allow public update on counter'
  ) then
    create policy "Allow public update on counter"
      on public.counter
      for update
      to anon, authenticated
      using (id = 1)
      with check (id = 1);
  end if;
end
$$;
