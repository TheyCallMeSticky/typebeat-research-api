# Guide d'Installation - TypeBeat Research API

## Prérequis système

### Environnement de développement

- **Node.js** : Version 20.x ou supérieure
- **pnpm** : Version 9.x (gestionnaire de paquets recommandé)
- **Docker** : Version 24.x ou supérieure (pour les services de données)
- **Docker Compose** : Version 2.x ou supérieure
- **Git** : Pour le clonage du repository

### Services externes requis

- **Redis** : Pour le système de cache (peut être déployé via Docker)
- **PostgreSQL** : Pour la persistance des données (optionnel, peut être déployé via Docker)

### Clés API requises

Avant l'installation, vous devez obtenir les clés API suivantes :

1. **YouTube Data API v3** (Google Cloud Console)
2. **Spotify Web API** (Spotify Developer Dashboard)  
3. **Last.fm API** (Last.fm Developer Portal)
4. **Genius API** (Genius Developer Portal) - optionnel

## Installation rapide

### 1. Clonage et configuration initiale

```bash
# Cloner le repository
git clone <repository-url>
cd typebeat-research-api

# Installer les dépendances
pnpm install

# Copier le fichier d'environnement
cp .env.example .env.local
```

### 2. Configuration des variables d'environnement

Éditez le fichier `.env.local` avec vos clés API :

```bash
# Configuration du serveur
NODE_ENV=development
PORT=3002

# Base de données
DATABASE_URL=postgres://postgres:postgres@localhost:5432/typeflick1

# Cache Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# APIs externes
YOUTUBE_API_KEY=your_youtube_api_key_here
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
LASTFM_API_KEY=your_lastfm_api_key_here
LASTFM_SHARED_SECRET=your_lastfm_shared_secret_here
GENIUS_CLIENT_ID=your_genius_client_id_here
GENIUS_CLIENT_SECRET=your_genius_client_secret_here
```

### 3. Démarrage des services de données

```bash
# Démarrer Redis et PostgreSQL via Docker
docker-compose up -d redis postgres

# Vérifier que les services sont actifs
docker-compose ps
```

### 4. Lancement de l'application

```bash
# Mode développement avec hot-reload
pnpm dev

# L'API sera accessible sur http://localhost:3002
```

### 5. Vérification de l'installation

```bash
# Test de santé de l'API
curl http://localhost:3002/api/health

# Test d'une requête simple
curl -X POST http://localhost:3002/api/research/suggestions \
  -H "Content-Type: application/json" \
  -d '{"artist": "Drake", "limit": 3}'
```

## Installation avec Docker

### Configuration Docker complète

Si vous préférez une installation entièrement containerisée :

```bash
# Construire et démarrer tous les services
docker-compose up -d

# Vérifier les logs
docker-compose logs -f typebeat-research-api

# L'API sera accessible sur http://localhost:3002
```

### Dockerfile de production

Pour un déploiement en production, utilisez le Dockerfile optimisé :

```bash
# Construire l'image de production
docker build -f Dockerfile.prod -t typebeat-research-api:prod .

# Démarrer en mode production
docker run -d \
  --name typebeat-api \
  -p 3002:3002 \
  --env-file .env.production \
  typebeat-research-api:prod
```

## Configuration avancée

### Optimisation des performances

#### Configuration Redis

Pour optimiser les performances du cache Redis :

```bash
# Dans redis.conf ou via variables d'environnement
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### Configuration des quotas API

Ajustez les limites selon vos quotas disponibles :

```bash
# Dans .env.local
YOUTUBE_QUOTA_DAILY_LIMIT=10000
SPOTIFY_RATE_LIMIT_PER_MINUTE=100
LASTFM_RATE_LIMIT_PER_SECOND=5
GENIUS_RATE_LIMIT_PER_MINUTE=60
```

### Monitoring et observabilité

#### Configuration des logs

```bash
# Niveau de logging
LOG_LEVEL=info

# Format des logs (json pour production)
LOG_FORMAT=json

# Destination des logs
LOG_FILE=/var/log/typebeat-api.log
```

#### Métriques et monitoring

L'API expose des métriques Prometheus sur `/metrics` :

```bash
# Activer les métriques
ENABLE_METRICS=true
METRICS_PORT=9090
```

## Obtention des clés API

### YouTube Data API v3

1. Accédez à [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant
3. Activez l'API YouTube Data v3
4. Créez des credentials (clé API)
5. Configurez les restrictions d'usage si nécessaire

**Quota par défaut** : 10,000 unités/jour (≈100 recherches d'artistes)

### Spotify Web API

1. Accédez à [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Créez une nouvelle application
3. Notez le Client ID et Client Secret
4. Configurez les URLs de redirection si nécessaire

**Limites** : ~100 requêtes/minute par application

### Last.fm API

1. Accédez à [Last.fm API](https://www.last.fm/api/account/create)
2. Créez un compte développeur
3. Créez une nouvelle application
4. Récupérez la clé API et le shared secret

**Limites** : 5 requêtes/seconde

### Genius API

1. Accédez à [Genius Developer Portal](https://genius.com/developers)
2. Créez une nouvelle application
3. Récupérez le Client ID et Client Secret
4. Générez un access token si nécessaire

**Limites** : ~60 requêtes/minute (non documenté officiellement)

## Dépannage

### Problèmes courants

#### L'API ne démarre pas

```bash
# Vérifier les logs
docker-compose logs typebeat-research-api

# Vérifier la configuration
pnpm run type-check

# Vérifier les services de données
docker-compose ps
```

#### Erreurs de connexion aux APIs externes

```bash
# Tester les clés API individuellement
curl "https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&key=YOUR_KEY"

# Vérifier le health check
curl http://localhost:3002/api/health
```

#### Problèmes de cache Redis

```bash
# Vérifier la connexion Redis
docker-compose exec redis redis-cli ping

# Vider le cache si nécessaire
docker-compose exec redis redis-cli FLUSHALL
```

### Logs et debugging

#### Activation du mode debug

```bash
# Dans .env.local
NODE_ENV=development
LOG_LEVEL=debug
DEBUG=typebeat:*
```

#### Analyse des performances

```bash
# Activer le profiling
ENABLE_PROFILING=true

# Analyser les métriques
curl http://localhost:3002/api/health | jq '.details.performance_metrics'
```

## Mise à jour

### Mise à jour des dépendances

```bash
# Vérifier les mises à jour disponibles
pnpm outdated

# Mettre à jour les dépendances
pnpm update

# Vérifier la compatibilité
pnpm run type-check
pnpm run build
```

### Migration de version

Lors de la mise à jour vers une nouvelle version majeure :

1. Sauvegardez votre configuration actuelle
2. Consultez le CHANGELOG pour les breaking changes
3. Mettez à jour les variables d'environnement si nécessaire
4. Testez en environnement de développement avant la production

## Sécurité

### Bonnes pratiques

1. **Rotation des clés API** : Renouvelez régulièrement vos clés API
2. **Variables d'environnement** : Ne jamais committer les clés dans le code
3. **HTTPS** : Utilisez toujours HTTPS en production
4. **Rate limiting** : Configurez des limites appropriées
5. **Monitoring** : Surveillez les accès et les erreurs

### Configuration de sécurité

```bash
# Dans .env.production
NODE_ENV=production
ENABLE_CORS=true
CORS_ORIGIN=https://yourdomain.com
API_KEY_REQUIRED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

