#!/usr/bin/env python3

import os, json, re, sys, datetime, pathlib

IMAGES_DIR = sys.argv[1] if len(sys.argv) > 1 else "images"
OUT = sys.argv[2] if len(sys.argv) > 2 else "comics.json"

def slugify(s):
    return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', s.lower()))

def main():
    if not os.path.isdir(IMAGES_DIR):
        print(f"Images folder '{IMAGES_DIR}' not found.", file=sys.stderr)
        sys.exit(1)
    files = [f for f in os.listdir(IMAGES_DIR) if f.lower().endswith(('.png','.jpg','.jpeg','.webp','.gif'))]
    files.sort()
    today = datetime.date.today().isoformat()
    comics = []
    for i, fname in enumerate(files, start=1):
        stem = pathlib.Path(fname).stem
        title = stem.replace('-', ' ').replace('_',' ').title()
        comics.append({
            "slug": slugify(f"{stem}-{i}"),
            "title": title,
            "image": f"{IMAGES_DIR}/{fname}",
            "alt": title,
            "caption_md": "",
            "date": today,
            "shareText": ""
        })
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(comics, f, ensure_ascii=False, indent=2)
    print(f"Wrote {OUT} with {len(comics)} entries.")

if __name__ == "__main__":
    main()
