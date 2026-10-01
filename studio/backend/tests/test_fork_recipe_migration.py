import json
import sqlite3

from storage import data_recipes_db as db
from storage import studio_db
from storage.fork_recipe_migration import fingerprint
from utils.account_context import AccountContext, run_as
from utils.paths.storage_roots import account_path


def record(name="Saved fork recipe"):
    return dict(id="fork-recipe", name=name, payload={"nodes": [{"id": "keep-me"}]}, createdAt=10, updatedAt=20)


def write_old_store():
    path = account_path("data-recipes/saved-recipes.sqlite3")
    path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.execute("CREATE TABLE recipes (id TEXT PRIMARY KEY, record TEXT NOT NULL)")
        conn.execute("CREATE TABLE imports (fingerprint TEXT PRIMARY KEY)")
        conn.execute("INSERT INTO recipes VALUES (?,?)", ("fork-recipe", json.dumps(record())))
        deleted = {**record(), "id": "previously-deleted"}
        conn.execute("INSERT INTO imports VALUES (?)", (fingerprint(deleted),))
    return path


def test_saved_fork_recipes_migrate_once_without_changing_source():
    path = write_old_store()
    before = path.read_bytes()
    assert db.list_recipes() == [record()]
    assert path.read_bytes() == before
    db.delete_recipe("fork-recipe")
    assert db.list_recipes() == []
    assert db.import_legacy([{**record(), "id": "previously-deleted"}], []) == {"recipes": 0, "executions": 0}
    assert path.read_bytes() == before


def test_collision_recovers_both_saved_versions():
    write_old_store()
    conn = studio_db.get_connection()
    with conn:
        conn.execute("INSERT INTO data_recipes (id,name,payload_json,created_at,updated_at) VALUES (?,?,?,?,?)",
                     ("fork-recipe", "New upstream edit", "{}", 10, 30))
    conn.close()
    records = db.list_recipes()
    assert {r["name"] for r in records} == {"New upstream edit", "Saved fork recipe (recovered fork copy)"}
    assert db.list_recipes() == records


def test_migration_stays_in_original_account():
    alice = AccountContext("alice", "Alice")
    bob = AccountContext("bob", "Bob")
    run_as(alice, write_old_store)
    assert run_as(bob, db.list_recipes) == []
    assert run_as(alice, db.list_recipes) == [record()]
    assert db.list_recipes() == []


def test_deleted_execution_cannot_be_restored_by_queued_save_or_import():
    db.upsert_recipe(record())
    execution = dict(id="run", recipeId="fork-recipe", createdAt=30, status="completed")
    assert db.upsert_execution(execution)
    db.delete_execution("fork-recipe", "run")
    assert not db.upsert_execution(execution)
    assert db.import_legacy([], [execution])["executions"] == 0
    assert db.list_executions("fork-recipe") == []
