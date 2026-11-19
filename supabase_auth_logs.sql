-- EduFunnel: log siapa yang mendaftar dan login (lengkap dengan tanggal & jam)
-- Jalankan di Supabase SQL Editor SETELAH supabase_schema.sql dan supabase_admin.sql
begin;

create table if not exists public.auth_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  email text,
  full_name text,
  event text not null check (event in ('register', 'login')),
  created_at timestamptz not null default now()
);

create index if not exists auth_logs_created_at_idx on public.auth_logs (created_at desc);

alter table public.auth_logs enable row level security;

-- Hanya admin yang boleh melihat log. Tidak ada policy tulis untuk browser:
-- pengisian dilakukan otomatis oleh trigger di bawah.
drop policy if exists "Admin lihat auth_logs" on public.auth_logs;
create policy "Admin lihat auth_logs" on public.auth_logs
  for select to authenticated using (public.is_admin());

revoke all on public.auth_logs from anon, authenticated;
grant select on public.auth_logs to authenticated;

-- Tampilan yang rapi: hari, tanggal, dan jam dalam WIB
create or replace view public.auth_logs_view
with (security_invoker = true) as
select
  id,
  event,
  full_name,
  email,
  (array['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'])
    [extract(dow from created_at at time zone 'Asia/Jakarta')::int + 1] as hari,
  to_char(created_at at time zone 'Asia/Jakarta', 'YYYY-MM-DD') as tanggal,
  to_char(created_at at time zone 'Asia/Jakarta', 'HH24:MI:SS') as jam_wib,
  created_at
from public.auth_logs;

revoke all on public.auth_logs_view from anon, authenticated;
grant select on public.auth_logs_view to authenticated;

-- Catat otomatis saat akun baru terdaftar
create or replace function public.log_auth_register()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.auth_logs (user_id, email, full_name, event)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'register');
  return new;
exception when others then
  return new; -- jangan sampai pencatatan log menggagalkan pendaftaran
end $$;

drop trigger if exists on_auth_user_registered on auth.users;
create trigger on_auth_user_registered
  after insert on auth.users
  for each row execute function public.log_auth_register();

-- Catat otomatis setiap kali user berhasil login
create or replace function public.log_auth_login()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.auth_logs (user_id, email, full_name, event)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name', 'login');
  return new;
exception when others then
  return new; -- jangan sampai pencatatan log menggagalkan login
end $$;

drop trigger if exists on_auth_user_login on auth.users;
create trigger on_auth_user_login
  after update of last_sign_in_at on auth.users
  for each row
  when (new.last_sign_in_at is not null
        and old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.log_auth_login();

-- Isi riwayat untuk akun yang sudah ada sebelum tabel ini dibuat (aman dijalankan ulang)
insert into public.auth_logs (user_id, email, full_name, event, created_at)
select u.id, u.email, u.raw_user_meta_data ->> 'full_name', 'register', u.created_at
from auth.users u
where not exists (
  select 1 from public.auth_logs l where l.user_id = u.id and l.event = 'register'
);

commit;
