"""One-time, credential-free import into Studio's existing account-scoped settings DB."""
import json
from pathlib import Path
from storage.studio_db import get_app_setting, upsert_app_settings

source=Path("D:/Github/ErisHub/data")
state=json.loads((source/"app-state.json").read_text(encoding="utf-8"))
modules={item["id"]:item for item in state["modules"]}
profiles=[]
for folder in (source/"agents").iterdir():
    if not folder.is_dir():
        continue
    for file in folder.glob("*.json"):
        profile=json.loads(file.read_text(encoding="utf-8"))
        if not profile.get("id") or not isinstance(profile.get("blocks"),list):
            continue
        profiles.append({key:profile[key] for key in ("id","name","assistantName","blocks") if key in profile})
old=get_app_setting("companion_presentation",{})
value={"vrm":{**modules["vrm"]["settings"],**old.get("vrm",{})},"hypno":{**modules["hypno"]["settings"],**old.get("hypno",{}),"sessionActive":False,"sessionPaused":False},"profiles":old.get("profiles") or profiles}
upsert_app_settings({"companion_presentation":value})
print(f"Imported presentation settings and {len(value['profiles'])} prompt profiles; no provider credentials or conversations imported.")
