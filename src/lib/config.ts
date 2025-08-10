// Configuration centralisée de l'application

import { APIConfig, ScoringConfig } from '@/types/api';
import { ScoringWeights } from '@/types/scoring';

// Validation des variables d'environnement requises
const requiredEnvVars = [
  'YOUTUBE_API_KEY',
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'LASTFM_API_KEY'
];

function validateEnvironment() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

// Configuration des APIs externes
export const apiKeys = {
  youtube: process.env.YOUTUBE_API_KEY!,
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID!,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET!,
  },
  lastfm: process.env.LASTFM_API_KEY!,
  genius: process.env.GENIUS_ACCESS_TOKEN,
};

// Configuration de la base de données
export const database = {
  url: process.env.DATABASE_URL || 'postgresql://localhost:5432/typebeat_research',
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'typebeat_research',
  username: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || '',
  ssl: process.env.NODE_ENV === 'production',
};

// Configuration Redis
export const redis = {
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  db: 0,
};

// Configuration du cache
export const cache = {
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL_SECONDS || '3600'),
  similarArtistsTTL: parseInt(process.env.CACHE_SIMILAR_ARTISTS_TTL_SECONDS || '604800'), // 7 jours
  metricsTTL: parseInt(process.env.CACHE_METRICS_TTL_SECONDS || '86400'), // 1 jour
  youtubeSearchTTL: parseInt(process.env.CACHE_YOUTUBE_SEARCH_TTL_SECONDS || '21600'), // 6 heures
  maxSizeMB: 100,
  cleanupIntervalMinutes: 60,
};

// Configuration du rate limiting
export const rateLimiting = {
  requestsPerMinute: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '100'),
  requestsPerHour: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_HOUR || '1000'),
  burstLimit: 10,
};

// Configuration des APIs externes
export const externalAPIs = {
  youtube: {
    baseURL: 'https://www.googleapis.com/youtube/v3',
    quotaLimitDaily: parseInt(process.env.YOUTUBE_QUOTA_LIMIT_DAILY || '10000'),
    requestsPerSecond: 10,
    searchCostUnits: 100,
    videoCostUnits: 1,
  },
  spotify: {
    baseURL: 'https://api.spotify.com/v1',
    authURL: 'https://accounts.spotify.com/api/token',
    requestsPerMinute: parseInt(process.env.SPOTIFY_REQUESTS_PER_MINUTE || '100'),
    tokenExpiryBuffer: 300, // 5 minutes
  },
  lastfm: {
    baseURL: 'http://ws.audioscrobbler.com/2.0/',
    requestsPerSecond: parseInt(process.env.LASTFM_REQUESTS_PER_SECOND || '5'),
    requestsPerMinute: 300,
  },
  genius: {
    baseURL: 'https://api.genius.com',
    requestsPerMinute: 60,
  },
};

// Configuration du scoring
export const scoringWeights: ScoringWeights = {
  volume_weight: parseFloat(process.env.SCORING_VOLUME_WEIGHT || '0.3'),
  competition_weight: parseFloat(process.env.SCORING_COMPETITION_WEIGHT || '0.25'),
  trend_weight: parseFloat(process.env.SCORING_TREND_WEIGHT || '0.2'),
  similarity_weight: parseFloat(process.env.SCORING_SIMILARITY_WEIGHT || '0.15'),
  saturation_weight: parseFloat(process.env.SCORING_SATURATION_WEIGHT || '0.1'),
};

export const scoringConfig: ScoringConfig = {
  weights: scoringWeights,
  min_volume_threshold: 100,
  max_competition_threshold: 0.8,
  min_similarity_threshold: 0.3,
  trend_boost_factor: 1.5,
  recency_decay_factor: 0.95,
};

// Configuration de l'application
export const app = {
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  enableAPIDocs: process.env.ENABLE_API_DOCS === 'true',
  debug: process.env.DEBUG === 'true',
};

// Configuration des logs
export const logging = {
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.LOG_FORMAT || 'json',
};

// Configuration de sécurité
export const security = {
  apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

// Configuration complète de l'API
export const apiConfig: APIConfig = {
  rate_limiting: {
    requests_per_minute: rateLimiting.requestsPerMinute,
    requests_per_hour: rateLimiting.requestsPerHour,
    burst_limit: rateLimiting.burstLimit,
  },
  cache: {
    default_ttl_seconds: cache.defaultTTL,
    max_cache_size_mb: cache.maxSizeMB,
    cleanup_interval_minutes: cache.cleanupIntervalMinutes,
  },
  external_apis: {
    youtube: {
      quota_limit_daily: externalAPIs.youtube.quotaLimitDaily,
      requests_per_second: externalAPIs.youtube.requestsPerSecond,
    },
    spotify: {
      requests_per_minute: externalAPIs.spotify.requestsPerMinute,
    },
    lastfm: {
      requests_per_second: externalAPIs.lastfm.requestsPerSecond,
    },
  },
};

// Validation de l'environnement au démarrage
if (process.env.NODE_ENV !== 'test') {
  validateEnvironment();
}

// Export par défaut
const config = {
  apiKeys,
  database,
  redis,
  cache,
  rateLimiting,
  externalAPIs,
  scoringConfig,
  app,
  logging,
  security,
  apiConfig,
};

export default config;

