-- EduFunnel admin: jalankan di Supabase SQL Editor (setelah supabase_schema.sql)
begin;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

drop policy if exists "Admin cek diri sendiri" on public.admin_users;
create policy "Admin cek diri sendiri" on public.admin_users
  for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['summary_metrics','funnel_sources','monthly_channel_traffic','daily_channel_traffic']
  loop
    execute format('drop policy if exists "Admin tulis %1$s" on public.%1$I', t);
    execute format('create policy "Admin tulis %1$s" on public.%1$I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

commit;

-- Jadikan akunmu admin (ganti emailnya, akun harus sudah terdaftar di dashboard):
-- insert into public.admin_users (user_id) select id from auth.users where email = 'EMAIL_KAMU@gmail.com';
