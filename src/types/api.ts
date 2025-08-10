// Types pour les requêtes et réponses API

import { Artist, SearchFilters } from './artist';
import { ScoreBreakdown, FinalScore, ScoringConfig } from './scoring';

// Re-export ScoringConfig pour faciliter l'import
export type { ScoringConfig } from './scoring';

// Types pour les requêtes

export interface SuggestionsRequest {
  artist: string;
  limit?: number;
  filters?: SearchFilters;
}

export interface MetricsCalculationRequest {
  artist_name: string;
  force_refresh?: boolean;
}

export interface SimilarArtistsRequest {
  artist: string;
  source?: 'spotify' | 'lastfm' | 'all';
  limit?: number;
}

// Types pour les réponses

export interface ArtistSuggestion {
  artist: string;
  score: number;
  metrics: {
    volume: number;
    competition: 'low' | 'medium' | 'high';
    trend: 'rising' | 'stable' | 'declining';
    saturation: number;
  };
  details: {
    genre: string;
    bpm?: number;
    reason: string;
    confidence: 'low' | 'medium' | 'high';
  };
  sources: {
    spotify?: boolean;
    lastfm?: boolean;
    youtube?: boolean;
  };
}

export interface SuggestionsResponse {
  suggestions: ArtistSuggestion[];
  query_info: {
    original_artist: string;
    filters_applied: SearchFilters;
    total_candidates_analyzed: number;
  };
  metadata: {
    cached: boolean;
    processing_time: string;
    api_calls_used: {
      youtube: number;
      spotify: number;
      lastfm: number;
    };
  };
}

export interface SimilarArtistsResponse {
  similar_artists: Array<{
    name: string;
    similarity_score?: number;
    source: 'spotify' | 'lastfm';
    genres?: string[];
    popularity?: number;
  }>;
  source_artist: string;
  total_found: number;
  cached: boolean;
}

export interface MetricsResponse {
  artist_name: string;
  metrics: ScoreBreakdown;
  cached: boolean;
  last_calculated: string;
}

// Types pour les erreurs

export interface APIError {
  error: string;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

export interface ValidationError extends APIError {
  field: string;
  value: unknown;
  expected: string;
}

// Types pour les réponses standardisées

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  metadata?: {
    timestamp: string;
    request_id: string;
    processing_time_ms: number;
    rate_limit?: {
      remaining: number;
      reset_time: string;
    };
  };
}

// Types pour la pagination

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_items: number;
    items_per_page: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Types pour les statistiques d'usage

export interface UsageStats {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  avg_response_time_ms: number;
  api_calls_breakdown: {
    youtube: number;
    spotify: number;
    lastfm: number;
    genius?: number;
  };
  cache_hit_rate: number;
  most_requested_artists: Array<{
    artist: string;
    request_count: number;
  }>;
}

// Types pour la configuration de l'API

export interface APIConfig {
  rate_limiting: {
    requests_per_minute: number;
    requests_per_hour: number;
    burst_limit: number;
  };
  cache: {
    default_ttl_seconds: number;
    max_cache_size_mb: number;
    cleanup_interval_minutes: number;
  };
  external_apis: {
    youtube: {
      quota_limit_daily: number;
      requests_per_second: number;
    };
    spotify: {
      requests_per_minute: number;
    };
    lastfm: {
      requests_per_second: number;
    };
  };
}

