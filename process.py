import os
from PIL import Image
from collections import deque

SRC = [
    ("neutre_debout", "/mnt/user-data/uploads/Teckel_debout_neutre.png"),
    ("neutre_assis", "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/94f3de0c-Teckel_assis_neutre.png"),
    ("neutre_allonge", "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/14e25c79-Teckel_allonge__neutre.png"),
    ("neutre_endormi", "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/3a38550b-Teckel_endromit_neutre.png"),
    ("neutre_marche", "/root/.claude/uploads/d38fde65-bec7-5c46-9f74-d0bea5b83ef6/4d164964-Teckel_marche_neutre.png"),
    ("neutre_joyeux", "/mnt/user-data/uploads/Teckel_joyeux_neutre.png"),
    ("neutre_triste", "/mnt/user-data/uploads/Teckel_triste_neutre.png"),
    ("neutre_etonne", "/mnt/user-data/uploads/Teckel_e_tonne__neutre.png"),

    ("mariniere_debout", "/mnt/user-data/uploads/Teckel_debout_mariniere.png"),
    ("mariniere_assis", "/mnt/user-data/uploads/Teckel_assis_mariniere.png"),
    ("mariniere_allonge", "/mnt/user-data/uploads/Teckel_allonge__mariniere.png"),
    ("mariniere_endormi", "/mnt/user-data/uploads/Teckel_endormi_mariniere.png"),
    ("mariniere_marche", "/mnt/user-data/uploads/Teckel_marche_mariniere.png"),
    ("mariniere_triste", "/mnt/user-data/uploads/Teckel_triste_mariniere.png"),
    ("mariniere_etonne", "/mnt/user-data/uploads/Teckel_e_tonne__mariniere.png"),

    ("pull_rose_assis", "/mnt/user-data/uploads/Teckel_assis_pull_rose.png"),
    ("pull_rose_allonge", "/mnt/user-data/uploads/Teckel_allonge__pull_rose.png"),
    ("pull_rose_endormi", "/mnt/user-data/uploads/Teckel_endormi_pull_rose.png"),
    ("pull_rose_marche", "/mnt/user-data/uploads/Teckel_marche_pull_rose.png"),
    ("pull_rose_joyeux", "/mnt/user-data/uploads/Teckel_joyeux_pull_rose.png"),
]

OUT_DIR = "assets"
os.makedirs(OUT_DIR, exist_ok=True)

def make_transparent(im, tol=18):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    visited = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))

    def is_whiteish(p):
        r, g, b, a = p
        return r > 255 - tol and g > 255 - tol and b > 255 - tol

    while q:
        x, y = q.popleft()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        idx = y * w + x
        if visited[idx]:
            continue
        p = px[x, y]
        if not is_whiteish(p):
            continue
        visited[idx] = 1
        px[x, y] = (255, 255, 255, 0)
        q.append((x - 1, y))
        q.append((x + 1, y))
        q.append((x, y - 1))
        q.append((x, y + 1))
    return im

MAX_W = 500

for name, path in SRC:
    if not os.path.exists(path):
        print("MISSING", name, path)
        continue
    im = Image.open(path)
    im = make_transparent(im)
    w, h = im.size
    if w > MAX_W:
        ratio = MAX_W / w
        im = im.resize((MAX_W, int(h * ratio)), Image.LANCZOS)
    out_path = os.path.join(OUT_DIR, f"{name}.png")
    im.save(out_path, optimize=True)
    print("OK", name, im.size, os.path.getsize(out_path))
