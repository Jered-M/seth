# Configuration MySQL pour SetH

## Étapes de configuration :

1. **Créer la base de données MySQL** :
```sql
CREATE DATABASE seth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. **Mettre à jour le fichier `.env`** avec vos identifiants MySQL :
```
DATABASE_URL="mysql://UTILISATEUR:MOT_DE_PASSE@localhost:3306/seth_db"
```

Format de la DATABASE_URL :
- `mysql://` - Le protocole
- `UTILISATEUR` - Votre nom d'utilisateur MySQL (ex: root)
- `MOT_DE_PASSE` - Votre mot de passe MySQL
- `localhost:3306` - Hôte et port MySQL
- `seth_db` - Nom de la base de données

3. **Appliquer le schéma Prisma** :
```bash
cd backend
python -m prisma db push
```

4. **Créer les données de test** :
```bash
python seed.py
```

5. **Démarrer le serveur** :
```bash
python run.py
```

## Identifiants de test créés :
- **Email**: admin@seth.com
- **Mot de passe**: admin123
