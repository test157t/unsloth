"""Non-destructive, account-scoped migration from the fork's former recipe store."""
import hashlib
import json
import sqlite3
from uuid import NAMESPACE_URL, uuid5

from utils.paths.storage_roots import account_path


def fingerprint(record):
    return hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def import_record(conn, record, suffix=" (recovered browser copy)"):
    digest = fingerprint(record)
    if conn.execute("SELECT 1 FROM fork_recipe_imports WHERE fingerprint=?", (digest,)).fetchone():
        return 0
    existing = conn.execute("SELECT * FROM data_recipes WHERE id=?", (record["id"],)).fetchone()
    if conn.execute("SELECT 1 FROM data_recipe_tombstones WHERE id=?", (record["id"],)).fetchone():
        return 0
    if existing:
        from storage.data_recipes_db import _recipe_from_row
        if _recipe_from_row(existing) != record:
            record = {**record, "id": str(uuid5(NAMESPACE_URL, "unsloth-recipe-import:" + digest)),
                      "name": record["name"] + suffix}
    from storage.data_recipes_db import _recipe_params
    count = conn.execute(
        "INSERT OR IGNORE INTO data_recipes "
        "(id,name,payload_json,learning_recipe_id,learning_recipe_title,created_at,updated_at) "
        "SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM data_recipe_tombstones WHERE id=?1)",
        _recipe_params(record),
    ).rowcount
    conn.execute("INSERT OR IGNORE INTO fork_recipe_imports VALUES (?)", (digest,))
    return count


def migrate(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS fork_recipe_imports (fingerprint TEXT PRIMARY KEY)")
    conn.execute("CREATE TABLE IF NOT EXISTS fork_recipe_migrations (name TEXT PRIMARY KEY)")
    conn.execute("CREATE TABLE IF NOT EXISTS data_recipe_execution_tombstones (id TEXT PRIMARY KEY)")
    if conn.execute("SELECT 1 FROM fork_recipe_migrations WHERE name='saved-recipes-v1'").fetchone():
        return
    source = account_path("data-recipes/saved-recipes.sqlite3")
    # Same-account path, read-only source, all destination writes and receipt atomic.
    conn.execute("BEGIN IMMEDIATE")
    try:
        if conn.execute("SELECT 1 FROM fork_recipe_migrations WHERE name='saved-recipes-v1'").fetchone():
            conn.commit()
            return
        if source.is_file():
            legacy = sqlite3.connect(source.resolve().as_uri() + "?mode=ro", uri=True)
            try:
                for (raw,) in legacy.execute("SELECT record FROM recipes"):
                    import_record(conn, json.loads(raw), " (recovered fork copy)")
                for (digest,) in legacy.execute("SELECT fingerprint FROM imports"):
                    conn.execute("INSERT OR IGNORE INTO fork_recipe_imports VALUES (?)", (digest,))
            finally:
                legacy.close()
        conn.execute("INSERT OR IGNORE INTO fork_recipe_migrations VALUES ('saved-recipes-v1')")
        conn.commit()
    except Exception:
        conn.rollback()
        raise
