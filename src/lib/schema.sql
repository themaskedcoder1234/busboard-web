-- Run this in your Supabase SQL editor (supabase.com → your project → SQL Editor)

-- ── Users profile (extends Supabase auth.users) ───────────────────────────────
create table public.profiles (
  id           uuid references auth.users on delete cascade primary key,
  email        text,
  flickr_token        text,
  flickr_token_secret text,
  flickr_user_id      text,
  flickr_username     text,
  created_at   timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Jobs ──────────────────────────────────────────────────────────────────────
create table public.jobs (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  status       text default 'pending',   -- pending | processing | complete | failed
  total        int  default 0,
  processed    int  default 0,
  found        int  default 0,
  zip_url      text,
  created_at   timestamptz default now(),
  completed_at timestamptz
);

alter table public.jobs enable row level security;

create policy "Users can read own jobs"
  on public.jobs for select using (auth.uid() = user_id);

create policy "Users can insert own jobs"
  on public.jobs for insert with check (auth.uid() = user_id);

-- ── Photos ────────────────────────────────────────────────────────────────────
create table public.photos (
  id           uuid default gen_random_uuid() primary key,
  job_id       uuid references public.jobs on delete cascade not null,
  user_id      uuid references auth.users on delete cascade not null,
  original_name text,
  reg          text,
  new_name     text,
  storage_path text,   -- path in Supabase storage
  date_str     text,
  address      text,
  lat          float,
  lon          float,
  flickr_id    text,
  status       text default 'pending',  -- pending | done | failed
  error        text,
  created_at   timestamptz default now()
);

alter table public.photos enable row level security;

create policy "Users can read own photos"
  on public.photos for select using (auth.uid() = user_id);

-- ── Storage bucket ────────────────────────────────────────────────────────────
-- Run this separately in the Supabase dashboard → Storage → New bucket
-- Name: "photos", Public: false

-- ── Token system (run after initial setup) ────────────────────────────────────
alter table public.profiles
  add column if not exists tokens   int     default 0     not null,
  add column if not exists is_admin boolean default false not null;

create table if not exists public.token_transactions (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  amount     int  not null,
  reason     text,
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

alter table public.token_transactions enable row level security;

create policy "Users can read own token transactions"
  on public.token_transactions for select using (auth.uid() = user_id);
