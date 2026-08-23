-- Per-exercise warm-up flag on routine slots and live session snapshots.
-- Independent of gym / cardio / tendon. Warm-up sets stay on workout_sets.

alter table public.template_items
  add column if not exists is_warmup boolean not null default false;

alter table public.session_exercises
  add column if not exists is_warmup boolean not null default false;
