"""Point d'entrée CLI pour le seeding — lancer depuis backend/ :

    python seed.py

La logique est dans app/seeds.py (module importé, ne pas exécuter directement).
"""
from app import create_app
from app.seeds import seed_data

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        seed_data()
        print("✅ Seeding terminé avec succès.")
