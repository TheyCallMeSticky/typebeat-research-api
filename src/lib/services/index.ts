// Export centralisé de tous les services

// Services principaux
export { ScoringService } from './scoring';
export { YouTubeAnalyzer } from './youtube-analyzer';
export { SimilarityCalculator } from './similarity-calculator';
export { ArtistAnalyzer } from './artist-analyzer';

// Utilitaires
export { MathUtils } from './math-utils';

// Types et interfaces
export type { YouTubeSearchResult, YouTubeAnalysisResult } from './youtube-analyzer';
export type { ArtistSimilarityData } from './similarity-calculator';
export type { 
  AnalysisContext, 
  SuggestionCandidate 
} from './artist-analyzer';

// Import des classes pour les factories
import { ScoringService } from './scoring';
import { ArtistAnalyzer } from './artist-analyzer';

// Configuration par défaut pour les services
export const DEFAULT_SCORING_CONFIG = {
  weights: {
    volume_weight: 0.3,
    competition_weight: 0.25,
    trend_weight: 0.2,
    similarity_weight: 0.15,
    saturation_weight: 0.1,
  },
  min_volume_threshold: 100,
  max_competition_threshold: 0.8,
  min_similarity_threshold: 0.3,
  trend_boost_factor: 1.5,
  recency_decay_factor: 0.95,
};

// Factory pour créer les services avec configuration
export function createScoringService(config = DEFAULT_SCORING_CONFIG) {
  return new ScoringService(config);
}

export function createArtistAnalyzer(config = DEFAULT_SCORING_CONFIG) {
  return new ArtistAnalyzer(config);
}

