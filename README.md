# SetH - Plateforme de Gestion des Équipements

Plateforme moderne de gestion des équipements informatiques avec traçabilité complète.

## Architecture
- **Backend**: Flask (REST + GraphQL + Prisma)
- **Frontend**: React (Vite + Tailwind CSS + Framer Motion)
- **Base de données**: SQLite (via Prisma)

## Installation

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. `python -m prisma db push`
4. `python -m prisma generate`
5. `python seed.py`
6. `python run.py`

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Rôles
- **Admin**: Gestion totale, Approbation des sorties.
- **Technicien**: Attribution, Maintenance.
- **Utilisateur**: Consultation, Demande de sortie.
- **Portier**: Confirmation physique des entrées/sorties.
