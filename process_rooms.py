import os
from PIL import Image

SRC = {
    "chambre_jour": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/9a494916-image.png",
    "chambre_nuit": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/4532ebd0-image.png",
    "cuisine_jour": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/cccf4377-image.png",
    "cuisine_nuit": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/72113eb8-image.png",
    "salon_jour": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/348c152b-image.png",
    "salon_nuit": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/c304995b-image.png",
    "sdb_jour": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/b9c81f55-image.png",
    "sdb_nuit": "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/6780f1ef-image.png",
}

OUT = "assets/rooms"
os.makedirs(OUT, exist_ok=True)
TARGET_W = 900

for name, path in SRC.items():
    im = Image.open(path).convert("RGB")
    w, h = im.size
    ratio = TARGET_W / w
    im2 = im.resize((TARGET_W, int(h * ratio)), Image.LANCZOS)
    out_path = os.path.join(OUT, name + ".jpg")
    im2.save(out_path, "JPEG", quality=82, optimize=True)
    print(name, im2.size, os.path.getsize(out_path))
