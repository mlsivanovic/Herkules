-- System-catalog exercises introduced by the Hybrid V6 recipe.
insert into public.exercises
  (id, owner_id, name, category, measurement, muscle_groups, equipment, instructions, video_url)
values
  ('11111111-1111-4111-8111-111111111232', null, 'Machine Row', 'strength', 'weight_reps', array['upper back', 'lats', 'biceps'], array['row machine'], 'Sit tall with the chest supported if the machine provides it. Pull the elbows toward the hips, pause, and return under control.', 'https://www.youtube.com/results?search_query=Machine%20Row%20proper%20form'),
  ('11111111-1111-4111-8111-111111111233', null, 'Cable Lateral Raise', 'strength', 'weight_reps', array['side delts', 'shoulders'], array['cable'], 'Raise the arm in the scapular plane with a soft elbow. Stop near shoulder height and lower slowly without shrugging.', 'https://www.youtube.com/results?search_query=Cable%20Lateral%20Raise%20proper%20form'),
  ('11111111-1111-4111-8111-111111111234', null, 'Strict Press', 'strength', 'weight_reps', array['shoulders', 'triceps', 'core'], array['barbell'], 'Stand tall, brace the trunk, and press overhead without leg drive. Keep the ribs down and lower with control.', 'https://www.youtube.com/results?search_query=Strict%20Press%20proper%20form'),
  ('11111111-1111-4111-8111-111111111235', null, 'Box Jump', 'strength', 'reps', array['quads', 'glutes', 'calves'], array['plyo box'], 'Jump onto a stable box from a balanced stance and land quietly with knees tracking the feet. Step down rather than jumping down.', 'https://www.youtube.com/results?search_query=Box%20Jump%20proper%20form'),
  ('11111111-1111-4111-8111-111111111236', null, 'Reverse Fly Machine', 'strength', 'weight_reps', array['rear delts', 'upper back'], array['reverse fly machine'], 'Keep the chest supported and arms softly bent. Open the arms from the rear shoulders and shoulder blades without swinging.', 'https://www.youtube.com/results?search_query=Reverse%20Fly%20Machine%20proper%20form'),
  ('11111111-1111-4111-8111-111111111237', null, 'Single-Arm Cable Triceps Extension', 'strength', 'weight_reps', array['triceps'], array['cable'], 'Keep the elbow stable at the side, extend the arm smoothly, and return slowly without letting the shoulder roll forward.', 'https://www.youtube.com/results?search_query=Single%20Arm%20Cable%20Triceps%20Extension%20proper%20form'),
  ('11111111-1111-4111-8111-111111111238', null, 'Burpee Step-Over', 'strength', 'reps', array['full body', 'chest', 'quads'], array['plyo box'], 'Perform a controlled burpee, stand, then step over a stable low box. Keep the movement smooth; this is conditioning, not a jump drill.', 'https://www.youtube.com/results?search_query=Burpee%20Step%20Over%20proper%20form')
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
