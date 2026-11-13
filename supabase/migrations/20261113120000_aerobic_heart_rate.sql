-- Watch workouts imported from Health Connect can land in the aerobic log.
-- They carry average and peak heart rate, and a few more sports.

alter table public.aerobic_activities
  add column if not exists avg_bpm smallint
    check (avg_bpm is null or (avg_bpm > 0 and avg_bpm <= 250)),
  add column if not exists max_bpm smallint
    check (max_bpm is null or (max_bpm > 0 and max_bpm <= 250));

alter table public.aerobic_activities
  drop constraint if exists aerobic_activities_bpm_order;

alter table public.aerobic_activities
  add constraint aerobic_activities_bpm_order
  check (avg_bpm is null or max_bpm is null or avg_bpm <= max_bpm);

alter table public.aerobic_activities
  drop constraint if exists aerobic_activities_activity_type_check;

alter table public.aerobic_activities
  add constraint aerobic_activities_activity_type_check
  check (activity_type in (
    'walking',
    'running',
    'hiking',
    'cycling',
    'rowing',
    'elliptical',
    'basketball',
    'table_tennis',
    'tennis',
    'swimming',
    'football',
    'volleyball',
    'other'
  ));
