// Export centralisé de tous les clients API

// Clients API
export { YouTubeClient } from './youtube-client';
export { SpotifyClient } from './spotify-client';
export { LastFmClient } from './lastfm-client';
export { GeniusClient } from './genius-client';
export { APIOrchestrator } from './api-orchestrator';

// Types et interfaces
export type { YouTubeSearchParams, YouTubeSearchResponse, YouTubeVideoDetails } from './youtube-client';
export type { SpotifySearchResponse, SpotifyArtistItem, SpotifyRelatedArtistsResponse } from './spotify-client';
export type { LastFmSimilarArtistsResponse, LastFmArtistItem, LastFmArtistInfoResponse } from './lastfm-client';
export type { GeniusSearchResponse, GeniusArtist, GeniusArtistResponse, GeniusArtistData } from './genius-client';
export type { 
  APICredentials, 
  APIUsageStats, 
  ArtistAnalysisResult 
} from './api-orchestrator';

// Import des classes pour les factories
import { YouTubeClient } from './youtube-client';
import { SpotifyClient } from './spotify-client';
import { LastFmClient } from './lastfm-client';
import { GeniusClient } from './genius-client';
import { APIOrchestrator, APICredentials } from './api-orchestrator';
import { RedisClient, CacheConfig } from '../cache/redis-client';

/**
 * Crée un orchestrateur API avec les credentials d'environnement
 */
export function createAPIOrchestrator(cacheConfig?: Partial<CacheConfig>): APIOrchestrator {
  // Récupérer les credentials depuis les variables d'environnement
  const credentials: APICredentials = {
    youtube: {
      apiKey: process.env.YOUTUBE_API_KEY || ''
    },
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
    },
    lastfm: {
      apiKey: process.env.LASTFM_API_KEY || '',
      sharedSecret: process.env.LASTFM_SHARED_SECRET || ''
    },
    genius: {
      clientId: process.env.GENIUS_CLIENT_ID || '',
      clientSecret: process.env.GENIUS_CLIENT_SECRET || ''
    }
  };

  // Vérifier que les credentials essentiels sont présents
  const missingCredentials: string[] = [];
  
  if (!credentials.youtube.apiKey) missingCredentials.push('YOUTUBE_API_KEY');
  if (!credentials.spotify.clientId) missingCredentials.push('SPOTIFY_CLIENT_ID');
  if (!credentials.spotify.clientSecret) missingCredentials.push('SPOTIFY_CLIENT_SECRET');
  if (!credentials.lastfm.apiKey) missingCredentials.push('LASTFM_API_KEY');

  if (missingCredentials.length > 0) {
    throw new Error(`Missing required API credentials: ${missingCredentials.join(', ')}`);
  }

  // Configuration du cache Redis
  const defaultCacheConfig: CacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'typebeat:',
    defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '3600')
  };

  const finalCacheConfig = { ...defaultCacheConfig, ...cacheConfig };
  const redisClient = new RedisClient(finalCacheConfig);

  return new APIOrchestrator(credentials, redisClient);
}

/**
 * Crée des clients API individuels
 */
export function createYouTubeClient(): YouTubeClient {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY environment variable is required');
  }
  return new YouTubeClient(apiKey);
}

export function createSpotifyClient(): SpotifyClient {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET environment variables are required');
  }
  
  return new SpotifyClient(clientId, clientSecret);
}

export function createLastFmClient(): LastFmClient {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) {
    throw new Error('LASTFM_API_KEY environment variable is required');
  }
  return new LastFmClient(apiKey);
}

export function createGeniusClient(): GeniusClient {
  const clientId = process.env.GENIUS_CLIENT_ID;
  const clientSecret = process.env.GENIUS_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('GENIUS_CLIENT_ID and GENIUS_CLIENT_SECRET environment variables are required');
  }
  
  return new GeniusClient(clientId, clientSecret);
}

export function createRedisClient(config?: Partial<CacheConfig>): RedisClient {
  const defaultConfig: CacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'typebeat:',
    defaultTTL: parseInt(process.env.REDIS_DEFAULT_TTL || '3600')
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new RedisClient(finalConfig);
}

// Utilitaires pour la validation des credentials
export function validateAPICredentials(): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  // Credentials obligatoires
  if (!process.env.YOUTUBE_API_KEY) missing.push('YOUTUBE_API_KEY');
  if (!process.env.SPOTIFY_CLIENT_ID) missing.push('SPOTIFY_CLIENT_ID');
  if (!process.env.SPOTIFY_CLIENT_SECRET) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!process.env.LASTFM_API_KEY) missing.push('LASTFM_API_KEY');

  // Credentials optionnels mais recommandés
  if (!process.env.LASTFM_SHARED_SECRET) warnings.push('LASTFM_SHARED_SECRET (optional but recommended)');
  if (!process.env.GENIUS_CLIENT_ID) warnings.push('GENIUS_CLIENT_ID (optional)');
  if (!process.env.GENIUS_CLIENT_SECRET) warnings.push('GENIUS_CLIENT_SECRET (optional)');

  return {
    valid: missing.length === 0,
    missing,
    warnings
  };
}

// Configuration par défaut pour les tests
export const TEST_CREDENTIALS: APICredentials = {
  youtube: { apiKey: 'test_youtube_key' },
  spotify: { clientId: 'test_spotify_id', clientSecret: 'test_spotify_secret' },
  lastfm: { apiKey: 'test_lastfm_key', sharedSecret: 'test_lastfm_secret' },
  genius: { clientId: 'test_genius_id', clientSecret: 'test_genius_secret' }
};

