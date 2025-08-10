// Types pour le système de scoring et métriques

export interface VolumeMetrics {
  total_results: number;
  monthly_searches_estimate: number;
  recent_uploads_30d: number;
  avg_views_top_20: number;
  search_query: string;
  calculated_at: Date;
}

export interface CompetitionMetrics {
  total_videos: number;
  avg_views: number;
  median_views: number;
  top_creator_dominance: number; // 0-1, 1 = très dominé par quelques créateurs
  upload_frequency: number; // vidéos par semaine
  quality_score: number; // basé sur durée, engagement, etc.
  barrier_to_entry: 'low' | 'medium' | 'high';
}

export interface TrendMetrics {
  trend_direction: 'rising' | 'stable' | 'declining';
  trend_factor: number; // 0.5-2.0, 1.0 = stable
  growth_rate_3m: number; // pourcentage de croissance sur 3 mois
  seasonality_factor: number;
  momentum_score: number; // 0-100
}

export interface SaturationMetrics {
  market_saturation: number; // 0-1, 1 = très saturé
  new_creators_ratio: number; // ratio nouveaux vs établis
  content_diversity: number; // 0-1, 1 = très diversifié
  niche_opportunity: number; // 0-1, 1 = grande opportunité
}

export interface SimilarityMetrics {
  spotify_similarity: number; // basé sur genres et popularité
  lastfm_similarity: number; // score Last.fm 0-1
  genre_overlap: number; // 0-1
  style_compatibility: number; // 0-1
  audience_overlap: number; // 0-1 estimé
}

export interface FinalScore {
  artist_name: string;
  overall_score: number; // 0-10
  volume_score: number;
  competition_score: number;
  trend_score: number;
  similarity_score: number;
  confidence_level: 'low' | 'medium' | 'high';
  calculated_at: Date;
}

export interface ScoreBreakdown {
  volume_metrics: VolumeMetrics;
  competition_metrics: CompetitionMetrics;
  trend_metrics: TrendMetrics;
  saturation_metrics: SaturationMetrics;
  similarity_metrics: SimilarityMetrics;
  final_score: FinalScore;
}

// Configuration du scoring

export interface ScoringWeights {
  volume_weight: number; // défaut: 0.3
  competition_weight: number; // défaut: 0.25
  trend_weight: number; // défaut: 0.2
  similarity_weight: number; // défaut: 0.15
  saturation_weight: number; // défaut: 0.1
}

export interface ScoringConfig {
  weights: ScoringWeights;
  min_volume_threshold: number;
  max_competition_threshold: number;
  min_similarity_threshold: number;
  trend_boost_factor: number;
  recency_decay_factor: number;
}

// Types pour les résultats de calcul

export interface CalculationResult {
  success: boolean;
  data?: ScoreBreakdown;
  error?: string;
  processing_time_ms: number;
  cached: boolean;
  cache_ttl?: number;
}

export interface BatchCalculationResult {
  total_processed: number;
  successful: number;
  failed: number;
  results: Array<{
    artist_name: string;
    result: CalculationResult;
  }>;
  total_processing_time_ms: number;
}

