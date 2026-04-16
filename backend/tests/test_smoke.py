def test_index_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["status"] == "Running"


def test_login_rejects_invalid_credentials(client):
    response = client.post("/api/auth/login", json={"email": "notfound@example.com", "password": "bad"})
    assert response.status_code == 401


def test_supervisor_endpoint_requires_auth(client):
    response = client.get("/api/supervisor/devices")
    assert response.status_code == 401


def test_cors_allows_local_vite_origin(client):
    response = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:3051",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.headers.get("Access-Control-Allow-Origin") == "http://localhost:3051"
