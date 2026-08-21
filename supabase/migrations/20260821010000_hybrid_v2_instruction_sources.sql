-- Every movement used by Hybrid V2 gets a direct instructional source.
-- Search-result URLs are intentionally replaced with stable exercise pages.
with sources(id, title, provider, url) as (values
  ('11111111-1111-4111-8111-111111111107'::uuid, 'Romanian Deadlift', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/'),
  ('11111111-1111-4111-8111-111111111110'::uuid, 'How to Set Up an Exercise Bike Properly', 'Hospital for Special Surgery', 'https://www.hss.edu/health-library/move-better/set-up-exercise-bike'),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'Indoor Rowing Technique', 'Concept2', 'https://www.concept2.com/training/rowing-technique'),
  ('11111111-1111-4111-8111-111111111120'::uuid, 'Trap Bar Deadlift', 'BarBend', 'https://barbend.com/trap-bar-deadlift/'),
  ('11111111-1111-4111-8111-111111111135'::uuid, 'Walking Lunges', 'Healthline', 'https://www.healthline.com/health/exercise-fitness/walking-lunges'),
  ('11111111-1111-4111-8111-111111111136'::uuid, 'Bulgarian Split Squat', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/366/bulgarian-split-squat/'),
  ('11111111-1111-4111-8111-111111111137'::uuid, 'Landmine Press', 'BarBend', 'https://barbend.com/landmine-press/'),
  ('11111111-1111-4111-8111-111111111138'::uuid, 'Standing Calf Raises', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/73/standing-calf-raises-wall/'),
  ('11111111-1111-4111-8111-111111111139'::uuid, 'Chest Press', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/19/chest-press/'),
  ('11111111-1111-4111-8111-111111111143'::uuid, 'Single-arm Row', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/126/single-arm-row/'),
  ('11111111-1111-4111-8111-111111111145'::uuid, 'Goblet Squat', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/362/goblet-squat/'),
  ('11111111-1111-4111-8111-111111111154'::uuid, 'Farmer''s Carry', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/359/farmer-s-carry/'),
  ('11111111-1111-4111-8111-111111111155'::uuid, 'Swing', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/391/swing/'),
  ('11111111-1111-4111-8111-111111111162'::uuid, 'Seated Calf Raise', 'NASM', 'https://blog.nasm.org/calf-workouts'),
  ('11111111-1111-4111-8111-111111111165'::uuid, 'Seated Lat Pulldown', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/158/seated-lat-pulldown/'),
  ('11111111-1111-4111-8111-111111111167'::uuid, 'Face Pull', 'NASM', 'https://www.nasm.org/resource-center/exercise-library/face-pull'),
  ('11111111-1111-4111-8111-111111111169'::uuid, 'Triceps Pushdowns', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/185/triceps-pushdowns/'),
  ('11111111-1111-4111-8111-111111111177'::uuid, 'Push-up', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/41/push-up/'),
  ('11111111-1111-4111-8111-111111111180'::uuid, 'TRX Inverted Row', 'TRX Training', 'https://www.trxtraining.com/blogs/news/trx-inverted-row'),
  ('11111111-1111-4111-8111-111111111210'::uuid, 'Dead Hang Pull-up Progression', 'NASM', 'https://blog.nasm.org/how-to-get-better-at-pull-ups'),
  ('11111111-1111-4111-8111-111111111217'::uuid, 'Rotator Cuff Exercises', 'E3 Rehab', 'https://e3rehab.com/rotator-cuff-exercises/'),
  ('11111111-1111-4111-8111-111111111218'::uuid, 'Chest-Supported Row', 'BarBend', 'https://barbend.com/chest-supported-row/'),
  ('11111111-1111-4111-8111-111111111219'::uuid, 'Wrist Curl — Extension', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/29/wrist-curl-extension/'),
  ('11111111-1111-4111-8111-111111111220'::uuid, 'Biceps Curl Isometric', 'Physio REHAB', 'https://www.youtube.com/watch?v=AcYtCygs2y0'),
  ('11111111-1111-4111-8111-111111111223'::uuid, 'Kettlebell Deadlift', 'NASM', 'https://www.nasm.org/resource-center/exercise-library/kettlebell-deadlift'),
  ('11111111-1111-4111-8111-111111111224'::uuid, 'Single-leg Romanian Deadlift', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/329/single-leg-romanian-deadlift/'),
  ('11111111-1111-4111-8111-111111111225'::uuid, 'Half Kneeling Cable Press', 'University of Sussex', 'https://www.sussex.ac.uk/webteam/gateway/file.php?name=half-kneeling-cable-press.pdf&site=79'),
  ('11111111-1111-4111-8111-111111111226'::uuid, 'Step-up', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/28/step-up/'),
  ('11111111-1111-4111-8111-111111111227'::uuid, 'Suitcase Carry', 'Men''s Health', 'https://www.menshealth.com/fitness/a42086000/how-to-do-suitcase-carry/'),
  ('11111111-1111-4111-8111-111111111228'::uuid, 'Pallof Press', 'BarBend', 'https://barbend.com/pallof-press/'),
  ('11111111-1111-4111-8111-111111111229'::uuid, 'Supine Dead Bug', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/147/supine-dead-bug/'),
  ('11111111-1111-4111-8111-111111111230'::uuid, 'Rotator Cuff and Shoulder Conditioning Program', 'AAOS OrthoInfo', 'https://www.orthoinfo.org/recovery/rotator-cuff-and-shoulder-conditioning-program/'),
  ('11111111-1111-4111-8111-111111111231'::uuid, 'Wrist Supination and Pronation', 'ACE', 'https://www.acefitness.org/resources/everyone/exercise-library/31/wrist-supination-and-pronation/')
)
update public.exercises e
set source_title = sources.title,
    source_provider = sources.provider,
    source_url = sources.url,
    source_verified_at = date '2026-08-21',
    video_url = sources.url,
    updated_at = now()
from sources
where e.id = sources.id;
