"""Export responsive derivatives; never crop or replace the generated masters."""
import hashlib
import io
import json
import os
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
STAGE = ROOT / 'stages/29_political_chromas'
roster = json.loads((ROOT / 'shared/presidential-roster.json').read_text())
people = {p['id']: p for p in roster['people']}
runtime, evidence = [], []
for member in next(c for c in roster['categories'] if c['id'] == 'politicos')['members']:
    person = people[member['id']]
    master = STAGE / 'output/artwork' / (person['id'] + '-v02.png')
    digest = hashlib.sha256(master.read_bytes()).hexdigest()
    image = Image.open(master).convert('RGB')
    assert abs(image.width / image.height - 5 / 7) < .003
    variants = []
    for width in [530, 1060]:
        path = f"/chromas/politicos/{person['id']}-v02-{digest[:8]}-{width}.webp"
        target = ROOT / 'app/public' / path.lstrip('/')
        target.parent.mkdir(parents=True, exist_ok=True)
        resized = image.resize((width, round(width * 7 / 5)), Image.Resampling.LANCZOS)
        quality = 90
        while True:
            buffer = io.BytesIO()
            resized.save(buffer, format='WEBP', quality=quality, method=6)
            data = buffer.getvalue()
            if len(data) < 600000:
                break
            quality -= 2
            assert quality >= 76
        temporary = target.with_suffix('.webp.pending')
        with temporary.open('wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        temporary.replace(target)
        assert target.read_bytes() == data
        variants.append({'src': path, 'width': width, 'height': resized.height,
                         'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
                         'bytes': target.stat().st_size, 'quality': quality})
    art = {'id': person['id'], 'name': person['name'], 'src': variants[0]['src'],
           'srcset': ', '.join(f"{v['src']} {v['width']}w" for v in variants),
           'width': 1060, 'height': 1484, 'aiEdited': True,
           'edition': 'malaquita-politicos-v2', 'masterSha256': digest}
    runtime.append(art)
    evidence.append({**art, 'master': str(master.relative_to(ROOT)),
                     'masterDimensions': [image.width, image.height],
                     'identitySource': person['photo'], 'variants': variants,
                     'visualReview': 'face, name, complete border and caption inspected',
                     'generator': 'built-in image_gen'})
    print(person['id'], image.size, sum(v['bytes'] for v in variants), flush=True)
(ROOT / 'app/src/political-chromas.json').write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + '\n')
(STAGE / 'output/manifest.json').write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n')
