from app import create_app
from app.seeds import seed_data

app = create_app()

if __name__ == "__main__":
    with app.app_context():
        seed_data()
        print("✅ Seeding terminé avec succès.")
