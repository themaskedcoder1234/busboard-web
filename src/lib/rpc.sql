-- Run this in your Supabase SQL editor
-- Atomically increments the processed count on a job
-- This prevents race conditions when multiple workers update the same job

create or replace function increment_job_processed(job_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.jobs
  set processed = processed + 1
  where id = job_id;
end;
$$;
