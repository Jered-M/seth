import os
from flask import Flask
from app.database import db, init_db
from sqlalchemy import inspect

app = Flask(__name__)
init_db(app)

with app.app_context():
    inspector = inspect(db.engine)
    tables = inspector.get_table_names()
    print(f"Tables found: {tables}")
    for table in tables:
        columns = [c['name'] for c in inspector.get_columns(table)]
        print(f"Table {table}: {columns}")
