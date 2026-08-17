-- Role of an exercise *in this routine/session* (not the catalog category).
-- Same movement can be gym work one day and tendon work the next.

alter table public.template_items
  add column if not exists block_role text not null default 'gym'
    check (block_role in ('gym', 'cardio', 'tendon'));

alter table public.session_exercises
  add column if not exists block_role text not null default 'gym'
    check (block_role in ('gym', 'cardio', 'tendon'));
