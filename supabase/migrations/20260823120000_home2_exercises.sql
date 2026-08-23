-- System-catalog exercises introduced by the Home 2-day starter.
insert into public.exercises
  (id, owner_id, name, category, measurement, muscle_groups, equipment, instructions, video_url)
values
  ('11111111-1111-4111-8111-111111111239', null, 'Reverse Lunge', 'strength', 'weight_reps', array['quads', 'glutes'], array['dumbbells'], 'Hold dumbbells at the sides. Step one foot back, drop the rear knee under control, and push through the front foot to stand. Keep the torso tall. Finish one side or alternate, and log per leg.', 'https://www.youtube.com/results?search_query=Reverse%20Lunge%20proper%20form'),
  ('11111111-1111-4111-8111-111111111240', null, 'TRX Face Pull', 'strength', 'reps', array['rear delts', 'upper back', 'rotator cuff'], array['trx'], 'Hold the TRX handles with palms in. Lean back and pull the hands toward the temples with the elbows high, then add a small external rotation so the fists finish beside the head. Control the return. Step the feet forward to make it harder.', 'https://www.youtube.com/results?search_query=TRX%20Face%20Pull%20proper%20form'),
  ('11111111-1111-4111-8111-111111111241', null, 'TRX Body Saw', 'strength', 'reps', array['core', 'abs', 'shoulders'], array['trx'], 'Feet in the TRX straps, plank on hands or forearms. Push the feet back to lengthen the body, then pull until the shoulders return over the hands. Keep the ribs down and the hips from sagging. Stop if the lower back takes over.', 'https://www.youtube.com/results?search_query=TRX%20Body%20Saw%20proper%20form'),
  ('11111111-1111-4111-8111-111111111242', null, 'Suitcase Hold', 'strength', 'duration', array['core', 'obliques', 'forearms'], array['dumbbells'], 'Stand tall with one dumbbell at the side. Do not lean toward or away from the load. Brace as if you expect a shove. Switch hands after the prescribed time. Log the hold time, not a walk.', 'https://www.youtube.com/results?search_query=Suitcase%20Hold%20proper%20form')
on conflict (id) do update
  set name = excluded.name,
      category = excluded.category,
      measurement = excluded.measurement,
      muscle_groups = excluded.muscle_groups,
      equipment = excluded.equipment,
      instructions = excluded.instructions,
      video_url = excluded.video_url,
      updated_at = now()
  where public.exercises.owner_id is null;
