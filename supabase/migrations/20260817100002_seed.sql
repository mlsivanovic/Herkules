-- Seed: exactly 15 representative system exercises for v1 testing.
-- The full curated library (with verified video links) arrives in a later
-- phase — video_url stays NULL here because we never invent links.
-- Stable UUIDs make the seed idempotent across environments.

insert into public.exercises
  (id, owner_id, name, category, measurement, muscle_groups, equipment, instructions)
values
  (
    '11111111-1111-4111-8111-111111111101', null, 'Barbell Back Squat', 'strength', 'weight_reps',
    array['quads', 'glutes', 'hamstrings', 'core'], array['barbell', 'rack'],
    'Set the bar on the upper back, feet shoulder-width apart. Brace the core, break at the hips and knees, and descend until the thighs reach parallel. Drive through the whole foot to return upright, keeping the chest up throughout.'
  ),
  (
    '11111111-1111-4111-8111-111111111102', null, 'Barbell Bench Press', 'strength', 'weight_reps',
    array['chest', 'triceps', 'shoulders'], array['barbell', 'bench'],
    'Lie flat with eyes under the bar, grip slightly wider than shoulders. Lower the bar to the mid-chest with elbows roughly 45 degrees from the torso, then press up and slightly back until the arms lock out.'
  ),
  (
    '11111111-1111-4111-8111-111111111103', null, 'Deadlift', 'strength', 'weight_reps',
    array['hamstrings', 'glutes', 'back', 'core'], array['barbell'],
    'Stand with the mid-foot under the bar, hinge down and grip just outside the legs. Take the slack out, brace hard, and push the floor away while dragging the bar up the shins. Finish tall, then hinge the bar back down with a neutral spine.'
  ),
  (
    '11111111-1111-4111-8111-111111111104', null, 'Overhead Press', 'strength', 'weight_reps',
    array['shoulders', 'triceps', 'core'], array['barbell'],
    'Hold the bar at the collarbone with a shoulder-width grip. Brace the glutes and abs, press the bar straight up while moving the head slightly back, and finish with the bar stacked over the hips. Lower under control.'
  ),
  (
    '11111111-1111-4111-8111-111111111105', null, 'Pull-Up', 'strength', 'weight_reps',
    array['lats', 'biceps', 'upper back'], array['pull-up bar'],
    'Hang from the bar with an overhand grip slightly wider than the shoulders. Pull the elbows down toward the floor until the chin clears the bar, then lower all the way to straight arms. Avoid swinging.'
  ),
  (
    '11111111-1111-4111-8111-111111111106', null, 'Barbell Row', 'strength', 'weight_reps',
    array['upper back', 'lats', 'biceps'], array['barbell'],
    'Hinge to about 45 degrees with a flat back and the bar hanging under the shoulders. Row the bar toward the lower ribs, squeezing the shoulder blades, then extend the arms fully under control.'
  ),
  (
    '11111111-1111-4111-8111-111111111107', null, 'Romanian Deadlift', 'strength', 'weight_reps',
    array['hamstrings', 'glutes', 'lower back'], array['barbell'],
    'Start standing with the bar at the hips. Push the hips back with a slight knee bend, letting the bar slide down the thighs until a strong hamstring stretch (just below the knees). Drive the hips forward to stand.'
  ),
  (
    '11111111-1111-4111-8111-111111111108', null, 'Dumbbell Biceps Curl', 'strength', 'weight_reps',
    array['biceps'], array['dumbbells'],
    'Stand tall with a dumbbell in each hand, palms forward. Curl the weights up without swinging the torso or moving the elbows forward. Lower slowly to full extension.'
  ),
  (
    '11111111-1111-4111-8111-111111111109', null, 'Treadmill Run', 'cardio', 'distance_duration',
    array['full body'], array['treadmill'],
    'Run at a steady, conversational pace or follow the planned intervals. Log the total distance and duration of the running portion only, excluding warm-up walk.'
  ),
  (
    '11111111-1111-4111-8111-111111111110', null, 'Stationary Bike', 'cardio', 'distance_duration',
    array['quads', 'glutes', 'calves'], array['stationary bike'],
    'Set the saddle so the knee stays slightly bent at the bottom of the pedal stroke. Ride at the planned cadence and resistance, logging total distance and duration.'
  ),
  (
    '11111111-1111-4111-8111-111111111111', null, 'Rowing Machine', 'cardio', 'distance_duration',
    array['full body'], array['rower'],
    'Drive with the legs first, then hinge back and pull the handle to the lower ribs. Reverse the order on the return: arms, torso, legs. Log the total distance and duration.'
  ),
  (
    '11111111-1111-4111-8111-111111111112', null, 'Jump Rope', 'cardio', 'duration',
    array['calves', 'shoulders'], array['jump rope'],
    'Spin the rope from the wrists, jumping just high enough for the rope to pass. Keep the rhythm steady for the planned duration, counting only continuous jumping time.'
  ),
  (
    '11111111-1111-4111-8111-111111111113', null, 'Cat-Cow Stretch', 'mobility', 'duration',
    array['spine'], array['mat'],
    'On all fours, alternate between arching the back and looking up (cow) and rounding the spine and tucking the chin (cow to cat). Move slowly with the breath for the planned duration.'
  ),
  (
    '11111111-1111-4111-8111-111111111114', null, 'Hip Flexor Stretch', 'mobility', 'duration',
    array['hip flexors'], array['mat'],
    'From a half-kneeling position, tuck the pelvis and shift the weight gently forward until a stretch appears in the front of the hip. Hold steady, breathing slowly, then switch sides.'
  ),
  (
    '11111111-1111-4111-8111-111111111115', null, 'Thoracic Rotation', 'mobility', 'duration',
    array['thoracic spine'], array['mat'],
    'Sit back on the heels with one hand behind the head. Rotate the elbow up toward the ceiling, following it with the eyes, then return. Move within a comfortable range, alternating sides.'
  )
on conflict (id) do nothing;
