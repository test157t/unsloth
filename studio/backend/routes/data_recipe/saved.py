"""Account-scoped saved recipes, shared by every browser origin."""
import hashlib
import json
import sqlite3
import time
from contextlib import contextmanager
from uuid import uuid4, uuid5, NAMESPACE_URL

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from utils.paths.storage_roots import account_path, ensure_account_dir

router = APIRouter()

class RecipeInput(BaseModel):
    id: str | None = Field(None, max_length=200)
    name: str = Field(min_length=1, max_length=1000)
    payload: dict
    learningRecipeId: str | None = None
    learningRecipeTitle: str | None = None

class LegacyRecipe(RecipeInput):
    id: str = Field(min_length=1, max_length=200)
    createdAt: int = Field(ge=0)
    updatedAt: int = Field(ge=0)

@contextmanager
def database():
    path = account_path('data-recipes/saved-recipes.sqlite3')
    ensure_account_dir(path.parent)
    connection = sqlite3.connect(path, timeout=30)
    try:
        with connection:
            connection.execute('BEGIN IMMEDIATE')
            connection.execute('CREATE TABLE IF NOT EXISTS recipes (id TEXT PRIMARY KEY, record TEXT NOT NULL)')
            connection.execute('CREATE TABLE IF NOT EXISTS imports (fingerprint TEXT PRIMARY KEY)')
            yield connection
    finally:
        connection.close()

def read(db, key):
    row = db.execute('SELECT record FROM recipes WHERE id=?', (key,)).fetchone()
    return json.loads(row[0]) if row else None

def write(db, record):
    db.execute('INSERT OR REPLACE INTO recipes VALUES (?, ?)', (record['id'], json.dumps(record, ensure_ascii=False)))

@router.get('/saved')
def list_recipes():
    with database() as db:
        records = [json.loads(row[0]) for row in db.execute('SELECT record FROM recipes')]
    return sorted(records, key=lambda record: record['updatedAt'], reverse=True)

@router.post('/saved/import')
def import_recipes(records: list[LegacyRecipe]):
    imported = 0
    with database() as db:
        for item in records:
            record = item.model_dump(exclude_none=True)
            fingerprint = hashlib.sha256(json.dumps(record, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            if db.execute('SELECT 1 FROM imports WHERE fingerprint=?', (fingerprint,)).fetchone():
                continue
            existing = read(db, record['id'])
            if existing and existing != record:
                # Preserve both versions, never replace a server edit with an old browser copy.
                record['id'] = str(uuid5(NAMESPACE_URL, 'unsloth-recipe-import:' + fingerprint))
                record['name'] += ' (recovered browser copy)'
            if not existing or existing != item.model_dump(exclude_none=True):
                write(db, record)
                imported += 1
            db.execute('INSERT INTO imports VALUES (?)', (fingerprint,))
    return {'imported': imported}

@router.get('/saved/{recipe_id}')
def get_recipe(recipe_id: str):
    with database() as db:
        record = read(db, recipe_id)
    if record is None:
        raise HTTPException(404, 'Recipe not found')
    return record

@router.post('/saved')
def save_recipe(item: RecipeInput):
    with database() as db:
        key = item.id or str(uuid4())
        existing = read(db, key)
        now = int(time.time() * 1000)
        record = {**(existing or {}), **item.model_dump(exclude_none=True), 'id': key,
                  'name': item.name.strip() or 'Unnamed',
                  'createdAt': existing['createdAt'] if existing else now, 'updatedAt': now}
        write(db, record)
    return record

@router.delete('/saved/{recipe_id}')
def delete_recipe(recipe_id: str):
    with database() as db:
        db.execute('DELETE FROM recipes WHERE id=?', (recipe_id,))
    return {'deleted': True}
