import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from routes.data_recipe import saved
from utils.account_context import AccountContext, run_as

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    app = FastAPI()
    app.include_router(saved.router)
    with TestClient(app) as client:
        yield client

def recipe(**extra):
    return {'name': 'My recipe', 'payload': {'nodes': [], 'edges': []}, **extra}

def test_recipe_is_shared_across_addresses_and_survives_new_client(client):
    record = client.post('/saved', json=recipe(), headers={'Host': 'localhost:8981'}).json()
    assert client.get('/saved', headers={'Host': 'nitralpc.tail887134.ts.net:4453'}).json() == [record]
    with TestClient(client.app) as another_browser:
        assert another_browser.get('/saved').json() == [record]
    updated = client.post('/saved', json=recipe(id=record['id'], name='Updated')).json()
    assert updated['createdAt'] == record['createdAt']
    assert client.get('/saved/' + record['id']).json()['name'] == 'Updated'
    client.delete('/saved/' + record['id'])
    assert client.get('/saved').json() == []

def test_browser_import_is_idempotent_and_does_not_resurrect_deletion(client):
    record = recipe(id='old-browser-id', createdAt=10, updatedAt=20)
    assert client.post('/saved/import', json=[record]).json()['imported'] == 1
    assert client.post('/saved/import', json=[record]).json()['imported'] == 0
    client.delete('/saved/old-browser-id')
    assert client.post('/saved/import', json=[record]).json()['imported'] == 0
    assert client.get('/saved').json() == []

def test_import_preserves_server_edit_and_browser_copy(client):
    client.post('/saved', json=recipe(id='shared', name='Server edit'))
    record = recipe(id='shared', createdAt=10, updatedAt=20)
    client.post('/saved/import', json=[record])
    records = client.get('/saved').json()
    assert len(records) == 2
    assert {item['name'] for item in records} == {'Server edit', 'My recipe (recovered browser copy)'}
    assert client.post('/saved/import', json=[record]).json()['imported'] == 0

def test_account_isolation(client):
    alice = AccountContext('alice-id', 'alice')
    bob = AccountContext('bob-id', 'bob')
    run_as(alice, saved.save_recipe, saved.RecipeInput(**recipe()))
    assert len(run_as(alice, saved.list_recipes)) == 1
    assert run_as(bob, saved.list_recipes) == []
    assert saved.list_recipes() == []
