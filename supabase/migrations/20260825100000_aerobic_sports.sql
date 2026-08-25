-- Add sports to the aerobic activity log (basketball, table tennis, and a few more).

alter table public.aerobic_activities
  drop constraint if exists aerobic_activities_activity_type_check;

alter table public.aerobic_activities
  add constraint aerobic_activities_activity_type_check
  check (activity_type in (
    'walking',
    'cycling',
    'rowing',
    'basketball',
    'table_tennis',
    'tennis',
    'swimming',
    'football',
    'volleyball',
    'other'
  ));
