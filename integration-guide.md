# Guide d'intégration TypeBeat Research API

## 🐳 Intégration Docker Compose

### 1. Structure des fichiers

Placez le dossier `typebeat-research-api` dans le répertoire racine de votre projet :

```
votre-projet/
├── TypeFlick-core/
├── TypeFlick-site/
├── beat-metadata-api/
├── typebeat-research-api/     ← Nouveau service
├── docker-compose.yml
└── .env
```

### 2. Mise à jour du docker-compose.yml

Ajoutez la section suivante à votre `docker-compose.yml` existant :

```yaml
  #─────────────────────────────── TYPEBEAT RESEARCH API
  typebeat-research-api:
    container_name: typebeat-research-api
    build:
      context: ./typebeat-research-api
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    environment:
      NODE_ENV: production
      PORT: 3002
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/typeflick1
      REDIS_HOST: redis
      REDIS_PORT: 6379
      REDIS_DB: 2
      YOUTUBE_API_KEY: ${YOUTUBE_API_KEY:?err}
      SPOTIFY_CLIENT_ID: ${SPOTIFY_CLIENT_ID:?err}
      SPOTIFY_CLIENT_SECRET: ${SPOTIFY_CLIENT_SECRET:?err}
      LASTFM_API_KEY: ${LASTFM_API_KEY:?err}
      LASTFM_SHARED_SECRET: ${LASTFM_SHARED_SECRET:-}
      GENIUS_CLIENT_ID: ${GENIUS_CLIENT_ID:-}
      GENIUS_CLIENT_SECRET: ${GENIUS_CLIENT_SECRET:-}
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

### 3. Variables d'environnement

Ajoutez ces variables à votre fichier `.env` :

```bash
# TypeBeat Research API Keys
YOUTUBE_API_KEY=your_youtube_api_key_here
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
LASTFM_API_KEY=your_lastfm_api_key_here
LASTFM_SHARED_SECRET=your_lastfm_shared_secret_here
GENIUS_CLIENT_ID=your_genius_client_id_here
GENIUS_CLIENT_SECRET=your_genius_client_secret_here
```

### 4. Mise à jour du service Next.js

Ajoutez cette variable d'environnement à votre service `nextjs` :

```yaml
nextjs:
  # ... configuration existante
  environment:
    # ... variables existantes
    TYPEBEAT_API_URL: http://typebeat-research-api:3002
```

## 🚀 Démarrage

### 1. Build et démarrage

```bash
# Build tous les services
docker-compose build

# Démarrer tous les services
docker-compose up -d

# Vérifier les logs
docker-compose logs typebeat-research-api
```

### 2. Test de l'API

```bash
# Utiliser le script de test
./typebeat-research-api/test_artistfinder.sh

# Ou test manuel
curl http://localhost:3002/api/health
```

## 📡 Endpoints disponibles

### Health Check
```
GET /api/health
```

### Suggestions d'artistes
```
POST /api/research/suggestions
{
  "artist_name": "Drake",
  "limit": 5,
  "include_metrics": true
}
```

### Artistes similaires
```
GET /api/artists/similar?artist=Lil%20Baby&limit=3
POST /api/artists/similar
{
  "artist_name": "Future",
  "limit": 5,
  "min_similarity": 0.3
}
```

### Calcul de métriques
```
GET /api/metrics/calculate?artist=Travis%20Scott
POST /api/metrics/calculate
{
  "artist_name": "Kendrick Lamar",
  "include_youtube": true,
  "include_spotify": true
}
```

## 🔧 Configuration avancée

### Cache Redis

L'API utilise Redis DB 2 pour éviter les conflits avec vos autres services.

### Rate Limiting

- YouTube: 10 req/sec (quota 10,000/jour)
- Spotify: 100 req/min
- Last.fm: 5 req/sec
- Genius: 60 req/min

### Monitoring

```bash
# Vérifier la santé
curl http://localhost:3002/api/health

# Statistiques d'utilisation
curl http://localhost:3002/api/stats

# Logs en temps réel
docker-compose logs -f typebeat-research-api
```

## 🔗 Intégration avec vos services

### Depuis TypeFlick-site (Next.js)

```typescript
// lib/typebeat-api.ts
const TYPEBEAT_API_URL = process.env.TYPEBEAT_API_URL || 'http://localhost:3002';

export async function findSimilarArtists(artistName: string) {
  const response = await fetch(`${TYPEBEAT_API_URL}/api/research/suggestions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artist_name: artistName, limit: 10 })
  });
  return response.json();
}
```

### Depuis TypeFlick-core (Python)

```python
import requests

TYPEBEAT_API_URL = "http://typebeat-research-api:3002"

def get_artist_suggestions(artist_name: str, limit: int = 5):
    response = requests.post(
        f"{TYPEBEAT_API_URL}/api/research/suggestions",
        json={"artist_name": artist_name, "limit": limit}
    )
    return response.json()
```

## 🛠️ Développement

### Mode développement

```bash
# Dans le dossier typebeat-research-api
npm run dev

# Ou avec Docker
docker-compose up typebeat-research-api
```

### Tests

```bash
# Tests unitaires
npm test

# Tests d'intégration
./test_artistfinder.sh

# Tests avec Docker
docker-compose exec typebeat-research-api npm test
```

## 📊 Monitoring et logs

### Logs structurés

L'API produit des logs JSON pour faciliter l'analyse :

```bash
docker-compose logs typebeat-research-api | jq '.'
```

### Métriques

- Cache hit rate
- Quotas API utilisés
- Temps de réponse
- Erreurs par endpoint

### Health checks

Docker Compose vérifie automatiquement la santé du service toutes les 30 secondes.

## 🔒 Sécurité

### Variables sensibles

- Utilisez des secrets Docker en production
- Ne commitez jamais les clés API
- Configurez CORS selon vos besoins

### Rate limiting

L'API respecte automatiquement les limites des APIs externes et peut être configurée pour limiter les clients.

## 🚨 Troubleshooting

### Problèmes courants

1. **API ne démarre pas** : Vérifiez les clés API dans `.env`
2. **Erreurs Redis** : Assurez-vous que Redis est démarré
3. **Quotas dépassés** : Surveillez l'usage YouTube
4. **Timeouts** : Ajustez les timeouts dans la configuration

### Debug

```bash
# Logs détaillés
docker-compose logs -f typebeat-research-api

# Entrer dans le container
docker-compose exec typebeat-research-api sh

# Vérifier les variables d'environnement
docker-compose exec typebeat-research-api env | grep API
```

