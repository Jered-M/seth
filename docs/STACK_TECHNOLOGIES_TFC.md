# SetH / SENTINEL — Stack technique & cohérence TFC

Document de synthèse pour présentation (M. Elie) — alignement mémoire TFC ↔ application déployée.

---

## 1. Vue d'ensemble

| Couche | Technologie | Rôle |
|--------|-------------|------|
| **Frontend** | React 18 + Vite + TypeScript | Interface utilisateur SPA |
| **UI** | Tailwind CSS + Framer Motion | Design système tactique / dark |
| **Cartographie 2D** | Leaflet + OpenStreetMap | Suivi GPS matériels connectés |
| **Cartographie 3D** | MapLibre GL JS + OpenFreeMap | Visualisation 3D sans clé API |
| **Backend** | Flask (Python 3.11) | API REST, JWT, workflows |
| **ORM** | SQLAlchemy | Modèles & requêtes PostgreSQL |
| **Base de données** | PostgreSQL (Supabase) | Données production |
| **Auth** | Flask-JWT-Extended | Tokens Bearer, rôles RBAC |
| **Déploiement** | Docker + Render | Conteneur multi-stage, keep-alive |
| **Géolocalisation** | Geolocation API (navigateur) | GPS natif mobile / WiFi desktop |

---

## 2. Fonctionnalités implémentées (cahier des charges)

### 2.1 Géolocalisation instantanée à la connexion

- À chaque **login**, le frontend envoie `latitude`, `longitude`, `accuracy` (API `navigator.geolocation`, haute précision sur mobile).
- Le backend vérifie la **zone autorisée** (`AuthorizedZone` — cercle ou polygone).
- **Notification** aux admins département, admin général et agent sécurité : qui s'est connecté, à quelle heure, dans quel département, **IN_ZONE** ou **OUT_OF_ZONE**.
- Alerte automatique si connexion **hors zone**.

### 2.2 Carte — matériels connectés

- Endpoint `GET /api/user/tracking/live-positions`
- Affiche tous les appareils des utilisateurs **connectés** (8 h) avec statut :
  - **Sortie autorisée** (`AUTHORIZED_EXIT`)
  - **En attente** (`PENDING`)
  - **Hors zone** (`OUT_OF_ZONE`)
  - **En panne** (`MAINTENANCE`)
  - **Sur site** (`ON_SITE`)
- Clic sur marqueur → popup détaillée (opérateur, département, GPS, zone).

### 2.3 Workflow sortie matériel (3 niveaux)

1. Utilisateur → demande sortie  
2. Admin département → validation  
3. Admin général → validation  
4. **Agent sécurité** → **Autoriser passage** (avec coordonnées GPS de l'agent)

### 2.4 Historique passages (admins)

- `GET /api/user/tracking/passage-history`
- Sur site avec autorisation / sortis avec matériel / connexions / tentatives frauduleuses avec **coordonnées GPS**

### 2.5 Admin général — incidents

- `POST /api/admin/incidents/:id/resolve` — trancher un incident  
- `POST /api/admin/devices/:id/restore` — restituer matériel saisi  
- `POST /api/requests/:id/force-confirm-exit` — valider sortie si agent non notifié

---

## 3. Modèle de sécurité (RBAC)

| Rôle | Code | Accès principal |
|------|------|-----------------|
| Admin général | `ADMIN_GENERAL` | Global, KPIs, validation finale, incidents |
| Admin département | `ADMIN_DEPT` | Son département, utilisateurs, carte |
| Agent sécurité | `SECURITY_AGENT` | Autoriser passage, file sorties |
| Superviseur | `SUPERVISOR` | Équipements, alertes |
| Utilisateur | `USER` | Son matériel, demandes sortie |

---

## 4. Cohérence TFC ↔ Application

| Chapitre TFC typique | Implémentation SetH |
|----------------------|---------------------|
| Analyse des besoins | Rôles multi-niveaux, traçabilité matériel |
| Conception UML | `docs/ARCHITECTURE_FLUX_SECURITE.md`, diagrammes PlantUML |
| Choix technologiques | Stack ci-dessus (justification : open source, Supabase, sans Mapbox payant) |
| Sécurité | JWT, MFA, géofencing, journal d'audit (`SecurityLog`) |
| Géolocalisation | GPS navigateur + zones `AuthorizedZone` |
| Tests | Comptes seed, endpoints `/api/auth/dev/seed-status` |
| Déploiement | Dockerfile multi-stage, Render, GitHub Actions keep-alive |

---

## 5. Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|--------------|------|
| superadmin@seth.com | SuperSecret123! | Admin général |
| admin-it@seth.com | AdminIT123! | Admin département |
| security@seth.com | Security123! | Agent sécurité |
| user@seth.com | User123! | Utilisateur |

---

## 6. URLs API clés

```
POST /api/auth/login              # + location GPS
GET  /api/user/tracking/live-positions
GET  /api/user/tracking/passage-history
GET  /api/requests/pending/security
POST /api/requests/:id/confirm-exit
POST /api/requests/:id/force-confirm-exit
POST /api/admin/devices/:id/restore
POST /api/admin/incidents/:id/resolve
GET  /api/security/alerts
GET  /api/security/logs
```

---

*SetH v2 — SENTINEL Security OS — Juin 2026*
