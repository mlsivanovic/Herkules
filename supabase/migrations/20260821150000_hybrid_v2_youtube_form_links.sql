-- Keep the verified written instruction source and restore the original
-- YouTube "proper form" search as a separate video link for Hybrid V2.
with videos(id, url) as (values
  ('11111111-1111-4111-8111-111111111107'::uuid, 'https://www.youtube.com/results?search_query=Romanian%20Deadlift%20proper%20form'),
  ('11111111-1111-4111-8111-111111111110'::uuid, 'https://www.youtube.com/results?search_query=Stationary%20Bike%20proper%20form'),
  ('11111111-1111-4111-8111-111111111111'::uuid, 'https://www.youtube.com/results?search_query=Rowing%20Machine%20proper%20form'),
  ('11111111-1111-4111-8111-111111111120'::uuid, 'https://www.youtube.com/results?search_query=Trap%20Bar%20Deadlift%20proper%20form'),
  ('11111111-1111-4111-8111-111111111135'::uuid, 'https://www.youtube.com/results?search_query=Walking%20Lunge%20proper%20form'),
  ('11111111-1111-4111-8111-111111111136'::uuid, 'https://www.youtube.com/results?search_query=Bulgarian%20Split%20Squat%20proper%20form'),
  ('11111111-1111-4111-8111-111111111137'::uuid, 'https://www.youtube.com/results?search_query=Landmine%20Press%20proper%20form'),
  ('11111111-1111-4111-8111-111111111138'::uuid, 'https://www.youtube.com/results?search_query=Standing%20Calf%20Raise%20proper%20form'),
  ('11111111-1111-4111-8111-111111111139'::uuid, 'https://www.youtube.com/results?search_query=Dumbbell%20Bench%20Press%20proper%20form'),
  ('11111111-1111-4111-8111-111111111143'::uuid, 'https://www.youtube.com/results?search_query=One-Arm%20Dumbbell%20Row%20proper%20form'),
  ('11111111-1111-4111-8111-111111111145'::uuid, 'https://www.youtube.com/results?search_query=Goblet%20Squat%20proper%20form'),
  ('11111111-1111-4111-8111-111111111154'::uuid, 'https://www.youtube.com/results?search_query=Farmer%20Carry%20proper%20form'),
  ('11111111-1111-4111-8111-111111111155'::uuid, 'https://www.youtube.com/results?search_query=Kettlebell%20Swing%20proper%20form'),
  ('11111111-1111-4111-8111-111111111162'::uuid, 'https://www.youtube.com/results?search_query=Seated%20Calf%20Raise%20proper%20form'),
  ('11111111-1111-4111-8111-111111111165'::uuid, 'https://www.youtube.com/results?search_query=Neutral-Grip%20Lat%20Pulldown%20proper%20form'),
  ('11111111-1111-4111-8111-111111111167'::uuid, 'https://www.youtube.com/results?search_query=Face%20Pull%20proper%20form'),
  ('11111111-1111-4111-8111-111111111169'::uuid, 'https://www.youtube.com/results?search_query=Cable%20Triceps%20Pushdown%20proper%20form'),
  ('11111111-1111-4111-8111-111111111177'::uuid, 'https://www.youtube.com/results?search_query=Push-Up%20proper%20form'),
  ('11111111-1111-4111-8111-111111111180'::uuid, 'https://www.youtube.com/results?search_query=Inverted%20Row%20proper%20form'),
  ('11111111-1111-4111-8111-111111111210'::uuid, 'https://www.youtube.com/results?search_query=Dead%20Hang%20proper%20form'),
  ('11111111-1111-4111-8111-111111111217'::uuid, 'https://www.youtube.com/results?search_query=Cable%20External%20Rotation%20rotator%20cuff%20proper%20form'),
  ('11111111-1111-4111-8111-111111111218'::uuid, 'https://www.youtube.com/results?search_query=Chest%20Supported%20Dumbbell%20Row%20proper%20form'),
  ('11111111-1111-4111-8111-111111111219'::uuid, 'https://www.youtube.com/results?search_query=Wrist%20Extension%20dumbbell%20proper%20form'),
  ('11111111-1111-4111-8111-111111111220'::uuid, 'https://www.youtube.com/results?search_query=Isometric%20Hammer%20Curl%20proper%20form'),
  ('11111111-1111-4111-8111-111111111223'::uuid, 'https://www.youtube.com/results?search_query=Kettlebell%20Deadlift%20proper%20form'),
  ('11111111-1111-4111-8111-111111111224'::uuid, 'https://www.youtube.com/results?search_query=Single%20Leg%20Romanian%20Deadlift%20proper%20form'),
  ('11111111-1111-4111-8111-111111111225'::uuid, 'https://www.youtube.com/results?search_query=Half%20Kneeling%20One%20Arm%20Cable%20Press%20proper%20form'),
  ('11111111-1111-4111-8111-111111111226'::uuid, 'https://www.youtube.com/results?search_query=Step-Up%20exercise%20proper%20form'),
  ('11111111-1111-4111-8111-111111111227'::uuid, 'https://www.youtube.com/results?search_query=Suitcase%20Carry%20proper%20form'),
  ('11111111-1111-4111-8111-111111111228'::uuid, 'https://www.youtube.com/results?search_query=Pallof%20Press%20proper%20form'),
  ('11111111-1111-4111-8111-111111111229'::uuid, 'https://www.youtube.com/results?search_query=Dead%20Bug%20proper%20form'),
  ('11111111-1111-4111-8111-111111111230'::uuid, 'https://www.youtube.com/results?search_query=Scaption%20Raise%20proper%20form'),
  ('11111111-1111-4111-8111-111111111231'::uuid, 'https://www.youtube.com/results?search_query=Wrist%20Pronation%20Supination%20dumbbell%20proper%20form')
)
update public.exercises e
set video_url = videos.url,
    updated_at = now()
from videos
where e.id = videos.id
  and e.owner_id is null;

update public.training_plans
set source_version = 3,
    updated_at = now()
where source_key = 'hybrid-4-day'
  and source_version < 3;
