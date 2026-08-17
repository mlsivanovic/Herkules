-- Explicit skip: a session can now be marked skipped (intentional rest)
-- rather than only inferred from a missed planned day.

alter table public.workout_sessions
  drop constraint if exists workout_sessions_status_check;

alter table public.workout_sessions
  add constraint workout_sessions_status_check
  check (status in ('in_progress', 'completed', 'skipped'));

alter table public.workout_sessions
  drop constraint if exists session_status_times;

alter table public.workout_sessions
  add constraint session_status_times check (
    (status = 'in_progress' and ended_at is null)
    or (status = 'completed' and ended_at is not null)
    or (status = 'skipped' and ended_at is not null)
  );
