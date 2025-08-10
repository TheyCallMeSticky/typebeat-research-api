# TypeBeat Research API

> **API complète d'analyse musicale pour identifier les opportunités dans l'écosystème des type beats**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-repo/typebeat-research-api)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node.js-20.x-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

## 🎯 Vue d'ensemble

L'API TypeBeat Research est une solution révolutionnaire qui combine l'intelligence artificielle, l'analyse de données massives et l'intégration multi-plateforme pour identifier les opportunités commerciales dans l'écosystème des type beats. Cette API analyse un artiste populaire et retourne des suggestions d'artistes similaires moins connus avec un meilleur ratio volume de recherche/niveau de concurrence.

### ✨ Fonctionnalités principales

- 🔍 **Analyse cross-platform** : YouTube, Spotify, Last.fm, Genius
- 📊 **Algorithmes de scoring sophistiqués** : Volume, concurrence, tendances, saturation
- ⚡ **Cache Redis intelligent** : 25 types de TTL optimisés
- 🎵 **Suggestions d'artistes similaires** : Basées sur des métriques commerciales
- 📈 **Métriques de marché en temps réel** : Analyse de la demande et de la concurrence
- 🛡️ **Architecture résiliente** : Fallbacks gracieux et gestion d'erreurs robuste

## 🚀 Démarrage rapide

### Prérequis

- Node.js 20.x ou supérieur
- Docker et Docker Compose
- Clés API : YouTube Data v3, Spotify, Last.fm, Genius (optionnel)

### Installation en 5 minutes

```bash
# 1. Cloner le repository
git clone <repository-url>
cd typebeat-research-api

# 2. Installer les dépendances
pnpm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Éditer .env.local avec vos clés API

# 4. Démarrer les services
docker-compose up -d redis postgres

# 5. Lancer l'API
pnpm dev
```

L'API sera accessible sur `http://localhost:3002`

### Test rapide

```bash
# Test de santé
curl http://localhost:3002/api/health

# Recherche d'artistes similaires
curl -X POST http://localhost:3002/api/research/suggestions \
  -H "Content-Type: application/json" \
  -d '{"artist": "Drake", "limit": 3}'
```

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [📚 DOCUMENTATION.md](DOCUMENTATION.md) | Documentation technique complète (50+ pages) |
| [🛠️ INSTALLATION.md](INSTALLATION.md) | Guide d'installation détaillé |
| [🚀 DEPLOYMENT.md](DEPLOYMENT.md) | Guide de déploiement production |
| [🧪 test_artistfinder.sh](test_artistfinder.sh) | Script de test automatisé |

## 🔧 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATIONS                      │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP/HTTPS
┌─────────────────────────▼───────────────────────────────────────┐
│                     NEXT.JS API LAYER                          │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   /suggestions  │ │  /artists/sim   │ │ /metrics/calc   │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                   API ORCHESTRATOR                             │
│  • Parallel API coordination  • Timeout management            │
│  • Response aggregation       • Circuit breakers              │
└─────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────┘
      │         │         │         │         │         │
      ▼         ▼         ▼         ▼         ▼         ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ YouTube  │ │ Spotify  │ │ Last.fm  │ │ Genius   │ │  Redis   │ │PostgreSQL│
│   API    │ │   API    │ │   API    │ │   API    │ │  Cache   │ │    DB    │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

## 🎵 Endpoints API

### POST /api/research/suggestions

Endpoint principal pour obtenir des suggestions d'artistes similaires optimisées pour le potentiel commercial.

```bash
curl -X POST http://localhost:3002/api/research/suggestions \
  -H "Content-Type: application/json" \
  -d '{
    "artist": "Future",
    "limit": 5,
    "filters": {
      "min_volume": 1000,
      "max_competition": 6.0,
      "genres": ["trap", "hip-hop"]
    }
  }'
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      {
        "artist": "Lil Baby",
        "score": 8.5,
        "metrics": {
          "volume": 15000,
          "competition": "medium",
          "trend": "rising",
          "saturation": 0.3
        },
        "details": {
          "genre": "trap",
          "reason": "Similar style with growing demand and moderate competition",
          "confidence": "high"
        }
      }
    ]
  }
}
```

### GET /api/artists/similar

Obtenir des artistes similaires basés uniquement sur la similarité musicale.

```bash
curl "http://localhost:3002/api/artists/similar?artist=Drake&limit=10"
```

### GET /api/metrics/calculate

Analyser les métriques de marché pour un artiste spécifique.

```bash
curl "http://localhost:3002/api/metrics/calculate?artist=Travis%20Scott&timeframe=30d"
```

### GET /api/health

Vérifier la santé du système et des APIs externes.

```bash
curl http://localhost:3002/api/health
```

## 🧮 Algorithmes de scoring

### Score composite

```
Score = (Volume × 0.30) + (Concurrence × 0.25) + (Tendance × 0.25) + (Saturation × 0.20)
```

### Métriques analysées

| Métrique | Source | Description |
|----------|--------|-------------|
| **Volume** | YouTube | Nombre de recherches "artiste type beat" |
| **Concurrence** | YouTube | Indice Herfindahl-Hirschman + variance des vues |
| **Tendance** | YouTube | Momentum basé sur les uploads récents |
| **Saturation** | YouTube | Diversité des créateurs et renouvellement |
| **Similarité** | Spotify + Last.fm | Genres, popularité, artistes liés |

## 🔧 Configuration

### Variables d'environnement requises

```bash
# APIs externes
YOUTUBE_API_KEY=your_youtube_api_key
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
LASTFM_API_KEY=your_lastfm_api_key
LASTFM_SHARED_SECRET=your_lastfm_shared_secret

# Services de données
DATABASE_URL=postgres://user:pass@localhost:5432/typebeat_research
REDIS_HOST=localhost
REDIS_PORT=6379

# Configuration API
NODE_ENV=development
PORT=3002
```

### Obtention des clés API

| Service | URL | Quota |
|---------|-----|-------|
| **YouTube Data v3** | [Google Cloud Console](https://console.cloud.google.com/) | 10,000 unités/jour |
| **Spotify Web API** | [Spotify Developer](https://developer.spotify.com/dashboard) | ~100 req/min |
| **Last.fm API** | [Last.fm Developer](https://www.last.fm/api/account/create) | 5 req/sec |
| **Genius API** | [Genius Developer](https://genius.com/developers) | ~60 req/min |

## 🐳 Déploiement

### Développement

```bash
# Démarrage rapide
docker-compose up -d
```

### Production

```bash
# Déploiement automatisé
./scripts/deploy.sh deploy

# Vérification
./scripts/deploy.sh status

# Rollback si nécessaire
./scripts/deploy.sh rollback backup_20250809_153000.sql
```

### Cloud providers

- **AWS ECS/Fargate** : Configuration ECS incluse
- **Google Cloud Run** : Déploiement serverless
- **Azure Container Instances** : Configuration ARM
- **Kubernetes** : Manifests complets avec Ingress

## 📊 Monitoring

### Métriques exposées

- **HTTP** : Requêtes, latence, codes d'erreur
- **APIs externes** : Appels, quotas, temps de réponse
- **Cache** : Hit rate, latence, utilisation mémoire
- **Business** : Recherches d'artistes, scores générés

### Health checks

```bash
# Santé globale
curl http://localhost:3002/api/health

# Métriques Prometheus
curl http://localhost:3002/metrics
```

### Dashboards

- **Grafana** : Dashboards pré-configurés
- **Prometheus** : Alerting automatique
- **Logs** : Agrégation avec Loki/Promtail

## 🧪 Tests

### Tests automatisés

```bash
# Tests complets
./test_artistfinder.sh

# Tests spécifiques
./test_artistfinder.sh http://localhost:3002
```

### Tests de performance

```bash
# Load testing avec Apache Bench
ab -n 100 -c 10 http://localhost:3002/api/health

# Monitoring en temps réel
watch -n 5 'curl -s http://localhost:3002/api/health | jq ".performance_metrics"'
```

## 🔒 Sécurité

### Fonctionnalités de sécurité

- ✅ **Rate limiting** adaptatif
- ✅ **Validation** stricte des entrées
- ✅ **CORS** configurable
- ✅ **Headers de sécurité** (Helmet.js)
- ✅ **Chiffrement** des clés API au repos
- ✅ **Logs** sécurisés sans données sensibles

### Bonnes pratiques

- Rotation régulière des clés API
- Variables d'environnement pour les secrets
- HTTPS obligatoire en production
- Monitoring des accès et erreurs

## 🤝 Contribution

### Structure du projet

```
typebeat-research-api/
├── src/
│   ├── app/api/          # Endpoints Next.js
│   ├── lib/
│   │   ├── apis/         # Clients APIs externes
│   │   ├── services/     # Services de calcul
│   │   ├── cache/        # Système de cache Redis
│   │   └── config.ts     # Configuration centralisée
│   └── types/            # Types TypeScript
├── docker/               # Configurations Docker
├── scripts/              # Scripts de déploiement
├── examples/             # Exemples d'utilisation
└── docs/                 # Documentation
```

### Développement

```bash
# Installation des dépendances
pnpm install

# Mode développement avec hot-reload
pnpm dev

# Vérification TypeScript
pnpm type-check

# Build de production
pnpm build
```

## 📈 Roadmap

### Version 1.1 (Q4 2025)
- [ ] Support multi-langues (français, espagnol)
- [ ] API GraphQL en complément REST
- [ ] Machine learning pour optimiser les scores
- [ ] Intégration TikTok et Instagram APIs

### Version 1.2 (Q1 2026)
- [ ] Analyse de sentiment des commentaires
- [ ] Prédictions de tendances à 30 jours
- [ ] API de recommandations personnalisées
- [ ] Dashboard web interactif

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- **YouTube Data API v3** pour les métriques de recherche
- **Spotify Web API** pour les données musicales
- **Last.fm API** pour les statistiques d'écoute
- **Genius API** pour les métadonnées culturelles
- **Next.js** pour le framework API
- **Redis** pour le système de cache
- **Docker** pour la containerisation

## 📞 Support

- 📧 **Email** : support@typebeat-research.com
- 📖 **Documentation** : [DOCUMENTATION.md](DOCUMENTATION.md)
- 🐛 **Issues** : [GitHub Issues](https://github.com/your-repo/typebeat-research-api/issues)
- 💬 **Discord** : [Communauté TypeBeat](https://discord.gg/typebeat)

---

**Développé avec ❤️ par Manus AI**

> *Transformez votre approche de la recherche musicale avec l'intelligence artificielle*

