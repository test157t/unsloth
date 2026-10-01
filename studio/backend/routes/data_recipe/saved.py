"""Existing fork recipe endpoints, backed by the canonical Studio recipe library."""
import time
from uuid import uuid4
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from storage import data_recipes_db as db
from storage.fork_recipe_migration import import_record

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

@router.get('/saved')
def list_recipes():
    return db.list_recipes()

@router.post('/saved/import')
def import_recipes(records: list[LegacyRecipe]):
    conn = db.get_connection()
    try:
        conn.execute('BEGIN IMMEDIATE')
        imported = sum(import_record(conn, item.model_dump(exclude_none=True)) for item in records)
        conn.commit()
        return {'imported': imported}
    finally:
        conn.close()

@router.get('/saved/{recipe_id}')
def get_recipe(recipe_id: str):
    record = db.get_recipe(recipe_id)
    if record is None:
        raise HTTPException(404, 'Recipe not found')
    return record

@router.post('/saved')
def save_recipe(item: RecipeInput):
    key = item.id or str(uuid4())
    existing = db.get_recipe(key)
    now = int(time.time() * 1000)
    record = {**(existing or {}), **item.model_dump(exclude_none=True), 'id': key,
              'name': item.name.strip() or 'Unnamed',
              'createdAt': existing['createdAt'] if existing else now, 'updatedAt': now}
    try:
        return db.upsert_recipe(record, existing['updatedAt'] if existing else None)
    except db.RecipeDeleted:
        raise HTTPException(410, 'Recipe was deleted')
    except db.RecipeConflict:
        raise HTTPException(409, 'Recipe was changed in another window')

@router.delete('/saved/{recipe_id}')
def delete_recipe(recipe_id: str):
    db.delete_recipe(recipe_id)
    return {'deleted': True}
