-- EduFunnel SUS (System Usability Scale)
-- Jalankan di Supabase SQL Editor SETELAH supabase_schema.sql dan supabase_admin.sql.

begin;

-- ========== Fungsi hitung skor SUS ==========
-- Butir ganjil: jawaban - 1. Butir genap: 5 - jawaban. Jumlahkan (0-40), kali 2,5.
create or replace function public.sus_score(answers int[])
returns numeric language plpgsql immutable as $$
declare
  total int := 0;
  i int;
begin
  if answers is null or array_length(answers, 1) <> 10 then
    return null;
  end if;
  for i in 1..10 loop
    if answers[i] is null or answers[i] < 1 or answers[i] > 5 then
      return null;
    end if;
    if i % 2 = 1 then
      total := total + (answers[i] - 1);
    else
      total := total + (5 - answers[i]);
    end if;
  end loop;
  return total * 2.5;
end $$;

-- ========== Daftar pertanyaan (bisa diedit admin) ==========
create table if not exists public.sus_questions (
  id bigint generated always as identity primary key,
  nomor smallint not null unique check (nomor between 1 and 10),
  teks text not null,
  created_at timestamptz not null default now()
);

-- ========== Jawaban responden ==========
create table if not exists public.sus_responses (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid(),
  nama text not null,
  peran text,
  sumber_trafik text,
  jawaban int[] not null check (array_length(jawaban, 1) = 10),
  skor numeric(5, 2),
  created_at timestamptz not null default now()
);

-- Skor selalu dihitung ulang di database, nilai dari browser diabaikan.
create or replace function public.sus_set_score()
returns trigger language plpgsql as $$
begin
  new.skor := public.sus_score(new.jawaban);
  if new.skor is null then
    raise exception 'Jawaban SUS harus 10 butir dengan nilai 1-5';
  end if;
  return new;
end $$;

drop trigger if exists trg_sus_set_score on public.sus_responses;
create trigger trg_sus_set_score
before insert or update on public.sus_responses
for each row execute function public.sus_set_score();

-- ========== RLS ==========
alter table public.sus_questions enable row level security;
alter table public.sus_responses enable row level security;

drop policy if exists "Baca pertanyaan SUS" on public.sus_questions;
create policy "Baca pertanyaan SUS" on public.sus_questions
  for select to anon, authenticated using (true);

drop policy if exists "Admin kelola pertanyaan SUS" on public.sus_questions;
create policy "Admin kelola pertanyaan SUS" on public.sus_questions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Isi kuesioner SUS" on public.sus_responses;
create policy "Isi kuesioner SUS" on public.sus_responses
  for insert to anon, authenticated with check (true);

drop policy if exists "Baca hasil SUS" on public.sus_responses;
create policy "Baca hasil SUS" on public.sus_responses
  for select to authenticated using (true);

drop policy if exists "Admin kelola hasil SUS" on public.sus_responses;
create policy "Admin kelola hasil SUS" on public.sus_responses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ========== Isi awal: 10 pertanyaan SUS standar (bahasa Indonesia) ==========
insert into public.sus_questions (nomor, teks) values
(1,  'Saya pikir saya akan sering menggunakan sistem ini.'),
(2,  'Saya merasa sistem ini terlalu rumit padahal tidak perlu.'),
(3,  'Saya pikir sistem ini mudah digunakan.'),
(4,  'Saya pikir saya membutuhkan bantuan orang teknis untuk bisa menggunakan sistem ini.'),
(5,  'Saya merasa fungsi-fungsi di sistem ini terpadu dengan baik.'),
(6,  'Saya pikir ada terlalu banyak ketidakkonsistenan di sistem ini.'),
(7,  'Saya membayangkan kebanyakan orang akan cepat belajar menggunakan sistem ini.'),
(8,  'Saya merasa sistem ini sangat membingungkan untuk digunakan.'),
(9,  'Saya merasa sangat percaya diri saat menggunakan sistem ini.'),
(10, 'Saya perlu belajar banyak hal dulu sebelum bisa menggunakan sistem ini dengan baik.')
on conflict (nomor) do nothing;

commit;
