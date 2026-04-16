# 🗺️ Fonctionnalité de Localisation des Matériels

## Description

La fonctionnalité de localisation des matériels permet à tous les utilisateurs du système de visualiser en temps réel la position géographique de leurs équipements assignés sur une carte 2D et 3D.

## Fonctionnalités Implémentées

### 1. **Backend - Endpoints API**

#### Pour les Utilisateurs

- **`GET /api/user/devices/with-location`**
  - Récupère tous les matériels de l'utilisateur actuellement connecté avec leur localisation
  - Retourne: ID, nom, numéro de série, latitude, longitude, statut, département, assigné à

#### Pour les Administrateurs de Département

- **`GET /api/user/department/devices-map`**
  - Récupère tous les matériels du département de l'administrateur avec leur localisation
  - Nécessite le rôle DEPT_ADMIN
  - Utilisé pour gérer les équipements au niveau départemental

- **`POST /api/user/devices/position`**
  - Met à jour la position GPS d'un matériel (latitude, longitude)
  - Inclut une vérification du géofencing
  - Crée une alerte si le matériel sort d'une zone autorisée

### 2. **Frontend - Pages et Composants**

#### Page Utilisateur - "Suivi en Temps Réel" (`/tracking`)

- **Fonctionnalités:**
  - Affichage des matériels localisés sur une carte interactive
  - Basculement entre vue 2D et vue 3D
  - Rafraîchissement automatique toutes les 30 secondes
  - Bouton de rafraîchissement manuel
  - Gestion des erreurs et état de chargement
  - Liste des matériels avec statut

**Utilisateurs concernés:** Utilisateurs standards et administrateurs

#### Page Administrateur - "Carte Équipements Département" (`/department-equipment-map`)

- **Fonctionnalités:**
  - Vue complète de tous les matériels du département
  - Localisation précise de chaque équipement
  - Informations détaillées (assigné à, statut, coordonnées GPS)
  - Surlignage des matériels sans localisation
  - Liste détaillée avec filtrage par statut

**Utilisateurs concernés:** Administrateurs de département

### 3. **Composants Cartographiques**

#### Map2D.tsx

- Carte interactive utilisant Leaflet
- Marqueurs personnalisés par statut
- Popups informatifs au clic
- Support du zoom et du panoramique
- Fond de carte OpenStreetMap

#### Map3D.tsx

- Visualisation 3D des localisations
- Perspective géographique améliorée
- Compatibilité avec les mêmes données que Map2D

## Modèle de Données

### Device Model

```python
class Device(db.Model):
    id: str (UUID)
    name: str
    serial_number: str
    user_id: str (FK)
    department_id: str (FK)
    status: str (AVAILABLE, IN_USE, MAINTENANCE, OUT_OF_ZONES)
    last_known_lat: float (nullable)
    last_known_lng: float (nullable)
```

## Flux d'Utilisation

### Pour un Utilisateur Standard

1. **Enregistrement du Matériel**
   - Accéder à la page Équipements
   - Enregistrer un nouveau matériel avec numéro de série

2. **Activation de la Localisation**
   - La localisation est activée automatiquement via le navigateur ou une application mobile
   - Les coordonnées GPS sont envoyées à l'endpoint `/api/user/devices/position`

3. **Visualisation**
   - Accéder à "Carte & Suivi" (`/tracking`)
   - Voir tous ses matériels localisés sur la carte
   - Basculer entre vue 2D et 3D

### Pour un Administrateur de Département

1. **Accès à la Gestion**
   - Menu navigation → "Carte Département" (`/department-equipment-map`)

2. **Supervision**
   - Vue complète de tous les matériels du département
   - Identification des matériels sans localisation
   - Suivi en temps réel de la position des équipements
   - Détection des sorties de zone (géofencing)

## États et Statuts

### Statuts d'Équipement

- **AVAILABLE**: Matériel disponible et localisé
- **IN_USE**: Matériel en utilisation
- **MAINTENANCE**: Matériel en maintenance
- **OUT_OF_ZONES**: Matériel sorti d'une zone autorisée (alerte)

### Codes Couleur sur la Carte

- 🟢 **Vert**: Disponible
- 🟠 **Orange**: En utilisation
- 🟡 **Jaune**: En maintenance
- 🔴 **Rouge**: Hors zone autorisée

## Sécurité et Permissions

### Isolation des Données

- Les utilisateurs voient **uniquement** leurs propres matériels
- Les admins de département voient les matériels de leur département
- Les super admins ont une vue complète

### Authentification

- Toutes les requêtes requièrent un token JWT valide
- Validation du rôle utilisateur pour chaque endpoint

### Géofencing

- Détection automatique des sorties de zone
- Création d'alertes de sécurité
- Enregistrement dans les logs de sécurité

## Configuration

### Variables d'Environnement

```
VITE_API_URL=http://192.168.113.1:5000/api
```

### Performance

- Rafraîchissement automatique: 30 secondes par défaut
- Pagination supportée (prête pour extension)
- Optimisation des requêtes via filtrage côté serveur

## Intégration Système

### Dépendances

- **Backend**: Flask, SQLAlchemy, Flask-JWT
- **Frontend**: React, React-Leaflet, Framer Motion

### Points d'Integration

1. Système d'authentification JWT existant
2. Modèle de rôles RBAC
3. Architecture microservices (API REST)
4. Système de logging de sécurité

## Bonne Pratiques

### Pour les Utilisateurs

- Autoriser la géolocalisation du navigateur/appareil mobile
- Vérifier régulièrement l'emplacement de ses matériels
- Signaler tout matériel manquant

### Pour les Administrateurs

- Vérifier quotidiennement les matériels sans localisation
- Répondre aux alertes de sortie de zone immédiatement
- Mettre à jour les zones géofencing régulièrement

## Futures Améliorations Possibles

1. **Historique de Position**: Tracer la route parcourue
2. **Webhook/WebSocket**: Mises à jour en temps réel
3. **Export de Rapports**: Exporter les données de localisation
4. **Alertes Smart**: AlertS personnalisées par département
5. **Intégration Drone**: Localisation GPS améliorée
6. **Géofences Personnalisés**: Créer des zones par département
7. **Stockage Historique**: Archiver les positions anciennes
8. **API Mobile**: Application native pour meilleure localisation

## Dépannage

### Matériels n'apparaissent pas sur la carte

- Vérifier que latitude et longitude sont renseignées
- S'assurer que l'authentification fonctionne
- Vérifier les droits d'accès (rôle utilisateur)

### Carte ne charge pas

- Vérifier la connexion à OpenStreetMap
- Vérifier que le token API est valide
- Consulter la console navigateur pour les erreurs CORS

### Localisation non mise à jour

- Activer la géolocalisation du navigateur
- Vérifier la connexion réseau
- Rafraîchir la page manuellement
