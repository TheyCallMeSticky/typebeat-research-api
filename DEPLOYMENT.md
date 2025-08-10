# Guide de Déploiement - TypeBeat Research API

## Vue d'ensemble du déploiement

Ce guide couvre les différentes stratégies de déploiement pour l'API TypeBeat Research, depuis les environnements de développement jusqu'aux déploiements de production à grande échelle. L'architecture modulaire de l'API permet une flexibilité maximale dans le choix des plateformes et des configurations de déploiement.

## Déploiement local avec Docker

### Configuration Docker Compose

Le déploiement local utilise Docker Compose pour orchestrer tous les services nécessaires :

```yaml
# docker-compose.yml
version: '3.8'

volumes:
  postgres_data:
  redis_data:

services:
  # Base de données PostgreSQL
  postgres:
    image: postgres:16.4-alpine
    container_name: typebeat-db
    environment:
      POSTGRES_DB: typebeat_research
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Cache Redis
  redis:
    image: redis:7-alpine
    container_name: typebeat-cache
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes --maxmemory 2gb --maxmemory-policy allkeys-lru
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # API TypeBeat Research
  typebeat-research-api:
    container_name: typebeat-research-api
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3002:3002"
    volumes:
      - ./:/app
      - /app/node_modules
    environment:
      NODE_ENV: development
      PORT: 3002
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/typebeat_research
      REDIS_HOST: redis
      REDIS_PORT: 6379
      # Variables API (à définir dans .env.local)
    env_file:
      - .env.local
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3002/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Commandes de déploiement local

```bash
# Démarrage complet
docker-compose up -d

# Vérification des services
docker-compose ps
docker-compose logs -f typebeat-research-api

# Arrêt et nettoyage
docker-compose down
docker-compose down -v  # Supprime aussi les volumes
```

## Déploiement en production

### Configuration de production

#### Dockerfile de production optimisé

```dockerfile
# Dockerfile.prod
# ---------- install deps ---------
FROM node:20-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

# ---------- build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---------- production runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

# Installer les dépendances système
RUN apk add --no-cache curl dumb-init

# Créer un utilisateur non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copier les fichiers nécessaires
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Définir les permissions
RUN chown -R nextjs:nodejs /app
USER nextjs

# Configuration de production
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

EXPOSE 3002

# Utiliser dumb-init pour la gestion des signaux
ENTRYPOINT ["dumb-init", "--"]
CMD ["pnpm", "start"]
```

#### Variables d'environnement de production

```bash
# .env.production
NODE_ENV=production
PORT=3002

# Sécurité
API_KEY_REQUIRED=true
CORS_ORIGIN=https://yourdomain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Base de données (utiliser des URLs sécurisées)
DATABASE_URL=postgres://user:password@db-host:5432/typebeat_research
REDIS_URL=redis://redis-host:6379

# APIs externes (utiliser des secrets management)
YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
LASTFM_API_KEY=${LASTFM_API_KEY}
LASTFM_SHARED_SECRET=${LASTFM_SHARED_SECRET}
GENIUS_CLIENT_ID=${GENIUS_CLIENT_ID}
GENIUS_CLIENT_SECRET=${GENIUS_CLIENT_SECRET}

# Monitoring
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_METRICS=true
METRICS_PORT=9090

# Performance
CACHE_TTL_DEFAULT=3600
YOUTUBE_QUOTA_DAILY_LIMIT=10000
ENABLE_REQUEST_COMPRESSION=true
```

### Déploiement sur cloud providers

#### AWS ECS avec Fargate

```yaml
# ecs-task-definition.json
{
  "family": "typebeat-research-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::account:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "typebeat-api",
      "image": "your-registry/typebeat-research-api:latest",
      "portMappings": [
        {
          "containerPort": 3002,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3002"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:database-url"
        },
        {
          "name": "YOUTUBE_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:region:account:secret:youtube-api-key"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/typebeat-research-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "curl -f http://localhost:3002/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

#### Google Cloud Run

```yaml
# cloudrun.yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: typebeat-research-api
  annotations:
    run.googleapis.com/ingress: all
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "1"
        autoscaling.knative.dev/maxScale: "10"
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/memory: "2Gi"
        run.googleapis.com/cpu: "1000m"
    spec:
      containerConcurrency: 100
      timeoutSeconds: 300
      containers:
      - image: gcr.io/project-id/typebeat-research-api:latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3002"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-url
              key: url
        resources:
          limits:
            cpu: "1000m"
            memory: "2Gi"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 10
```

#### Azure Container Instances

```yaml
# azure-container-group.yaml
apiVersion: 2021-03-01
location: eastus
name: typebeat-research-api
properties:
  containers:
  - name: typebeat-api
    properties:
      image: your-registry.azurecr.io/typebeat-research-api:latest
      resources:
        requests:
          cpu: 1
          memoryInGb: 2
      ports:
      - port: 3002
        protocol: TCP
      environmentVariables:
      - name: NODE_ENV
        value: production
      - name: PORT
        value: "3002"
      - name: DATABASE_URL
        secureValue: "postgres://..."
      livenessProbe:
        httpGet:
          path: /api/health
          port: 3002
        initialDelaySeconds: 30
        periodSeconds: 30
  osType: Linux
  restartPolicy: Always
  ipAddress:
    type: Public
    ports:
    - protocol: TCP
      port: 3002
```

### Kubernetes

#### Déploiement Kubernetes complet

```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: typebeat-research-api
  labels:
    app: typebeat-research-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: typebeat-research-api
  template:
    metadata:
      labels:
        app: typebeat-research-api
    spec:
      containers:
      - name: typebeat-api
        image: your-registry/typebeat-research-api:latest
        ports:
        - containerPort: 3002
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3002"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: typebeat-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: typebeat-secrets
              key: redis-url
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3002
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3002
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: typebeat-research-api-service
spec:
  selector:
    app: typebeat-research-api
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3002
  type: LoadBalancer
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: typebeat-research-api-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - api.typebeat-research.com
    secretName: typebeat-api-tls
  rules:
  - host: api.typebeat-research.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: typebeat-research-api-service
            port:
              number: 80
```

## Configuration des services de données

### PostgreSQL en production

#### Configuration optimisée

```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
work_mem = 4MB
min_wal_size = 1GB
max_wal_size = 4GB
```

#### Schéma de base de données

```sql
-- init.sql
CREATE DATABASE typebeat_research;

\c typebeat_research;

-- Table pour les métriques d'artistes
CREATE TABLE artist_metrics (
    id SERIAL PRIMARY KEY,
    artist_name VARCHAR(255) NOT NULL,
    volume INTEGER,
    competition_score FLOAT,
    trend_score FLOAT,
    saturation_score FLOAT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(artist_name)
);

-- Index pour les recherches fréquentes
CREATE INDEX idx_artist_metrics_name ON artist_metrics(artist_name);
CREATE INDEX idx_artist_metrics_updated ON artist_metrics(last_updated);

-- Table pour le cache des artistes similaires
CREATE TABLE similar_artists_cache (
    id SERIAL PRIMARY KEY,
    source_artist VARCHAR(255) NOT NULL,
    similar_artist VARCHAR(255) NOT NULL,
    similarity_score FLOAT,
    source_platform VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_similar_artists_source ON similar_artists_cache(source_artist);
CREATE INDEX idx_similar_artists_expires ON similar_artists_cache(expires_at);
```

### Redis en production

#### Configuration Redis optimisée

```conf
# redis.conf
# Mémoire
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistance
save 900 1
save 300 10
save 60 10000
appendonly yes
appendfsync everysec

# Réseau
tcp-keepalive 300
timeout 0

# Sécurité
requirepass your_redis_password
rename-command FLUSHDB ""
rename-command FLUSHALL ""
rename-command DEBUG ""

# Performance
tcp-backlog 511
databases 16
```

## Monitoring et observabilité

### Métriques Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'typebeat-research-api'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: /metrics
    scrape_interval: 30s
```

### Dashboards Grafana

```json
{
  "dashboard": {
    "title": "TypeBeat Research API",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{endpoint}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "API Quotas",
        "type": "stat",
        "targets": [
          {
            "expr": "youtube_quota_remaining",
            "legendFormat": "YouTube Quota Remaining"
          }
        ]
      }
    ]
  }
}
```

### Alerting

```yaml
# alertmanager.yml
groups:
- name: typebeat-api-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: YouTubeQuotaLow
    expr: youtube_quota_remaining < 1000
    for: 1m
    labels:
      severity: warning
    annotations:
      summary: "YouTube quota running low"
      description: "Only {{ $value }} quota units remaining"

  - alert: APIDown
    expr: up{job="typebeat-research-api"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "API is down"
      description: "TypeBeat Research API is not responding"
```

## Sécurité en production

### Configuration HTTPS

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.typebeat-research.com;

    ssl_certificate /etc/ssl/certs/typebeat-api.crt;
    ssl_certificate_key /etc/ssl/private/typebeat-api.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    location / {
        proxy_pass http://localhost:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Gestion des secrets

#### AWS Secrets Manager

```bash
# Créer les secrets
aws secretsmanager create-secret \
    --name "typebeat-api/database-url" \
    --description "Database connection URL" \
    --secret-string "postgres://user:pass@host:5432/db"

aws secretsmanager create-secret \
    --name "typebeat-api/youtube-api-key" \
    --description "YouTube Data API key" \
    --secret-string "your-youtube-api-key"
```

#### Kubernetes Secrets

```bash
# Créer les secrets Kubernetes
kubectl create secret generic typebeat-secrets \
    --from-literal=database-url="postgres://..." \
    --from-literal=youtube-api-key="..." \
    --from-literal=spotify-client-id="..." \
    --from-literal=spotify-client-secret="..."
```

## Stratégies de déploiement

### Blue-Green Deployment

```bash
#!/bin/bash
# deploy-blue-green.sh

# Variables
NEW_VERSION=$1
CURRENT_COLOR=$(kubectl get service typebeat-api -o jsonpath='{.spec.selector.color}')
NEW_COLOR=$([ "$CURRENT_COLOR" = "blue" ] && echo "green" || echo "blue")

echo "Deploying version $NEW_VERSION to $NEW_COLOR environment"

# Déployer la nouvelle version
kubectl set image deployment/typebeat-api-$NEW_COLOR \
    typebeat-api=your-registry/typebeat-research-api:$NEW_VERSION

# Attendre que le déploiement soit prêt
kubectl rollout status deployment/typebeat-api-$NEW_COLOR

# Tester la nouvelle version
if curl -f http://typebeat-api-$NEW_COLOR/api/health; then
    echo "Health check passed, switching traffic"
    
    # Basculer le trafic
    kubectl patch service typebeat-api \
        -p '{"spec":{"selector":{"color":"'$NEW_COLOR'"}}}'
    
    echo "Traffic switched to $NEW_COLOR"
    
    # Optionnel: supprimer l'ancienne version après validation
    # kubectl delete deployment typebeat-api-$CURRENT_COLOR
else
    echo "Health check failed, rolling back"
    exit 1
fi
```

### Rolling Updates

```yaml
# deployment.yaml avec stratégie rolling update
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  replicas: 3
```

### Canary Deployment

```yaml
# canary-deployment.yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: typebeat-research-api
spec:
  replicas: 5
  strategy:
    canary:
      steps:
      - setWeight: 20
      - pause: {duration: 10m}
      - setWeight: 40
      - pause: {duration: 10m}
      - setWeight: 60
      - pause: {duration: 10m}
      - setWeight: 80
      - pause: {duration: 10m}
  selector:
    matchLabels:
      app: typebeat-research-api
  template:
    metadata:
      labels:
        app: typebeat-research-api
    spec:
      containers:
      - name: typebeat-api
        image: your-registry/typebeat-research-api:latest
```

## Maintenance et mise à jour

### Procédures de maintenance

```bash
#!/bin/bash
# maintenance.sh

# Mise en mode maintenance
kubectl scale deployment typebeat-research-api --replicas=0

# Sauvegarde de la base de données
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql

# Mise à jour de la base de données si nécessaire
psql $DATABASE_URL < migration.sql

# Redémarrage des services
kubectl scale deployment typebeat-research-api --replicas=3

# Vérification
kubectl rollout status deployment/typebeat-research-api
curl -f http://api.typebeat-research.com/api/health
```

### Monitoring des performances

```bash
# Script de monitoring automatisé
#!/bin/bash
# monitor.sh

while true; do
    # Vérifier la santé de l'API
    if ! curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
        echo "$(date): API health check failed" >> /var/log/typebeat-monitor.log
        # Envoyer une alerte
        curl -X POST https://hooks.slack.com/... -d '{"text":"API Down"}'
    fi
    
    # Vérifier l'utilisation des quotas
    QUOTA=$(curl -s http://localhost:3002/api/health | jq '.details.api_quotas.youtube_quota_remaining')
    if [ "$QUOTA" -lt 1000 ]; then
        echo "$(date): YouTube quota low: $QUOTA" >> /var/log/typebeat-monitor.log
    fi
    
    sleep 300  # Vérifier toutes les 5 minutes
done
```

