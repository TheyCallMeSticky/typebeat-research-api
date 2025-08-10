// Service de calcul de scoring pour les artistes type beat

import { 
  VolumeMetrics, 
  CompetitionMetrics, 
  TrendMetrics, 
  SaturationMetrics, 
  SimilarityMetrics, 
  FinalScore,
  ScoreBreakdown,
  ScoringConfig
} from '@/types/scoring';

export class ScoringService {
  private config: ScoringConfig;

  constructor(config: ScoringConfig) {
    this.config = config;
  }

  /**
   * Calcule le score de volume basé sur les métriques YouTube
   */
  calculateVolumeScore(metrics: VolumeMetrics): number {
    const {
      total_results,
      monthly_searches_estimate,
      recent_uploads_30d,
      avg_views_top_20
    } = metrics;

    // Normalisation des métriques (0-10)
    const resultsScore = Math.min(total_results / 10000, 1) * 10; // Max à 10k résultats
    const searchesScore = Math.min(monthly_searches_estimate / 50000, 1) * 10; // Max à 50k recherches
    const uploadsScore = Math.min(recent_uploads_30d / 100, 1) * 10; // Max à 100 uploads/mois
    const viewsScore = Math.min(avg_views_top_20 / 500000, 1) * 10; // Max à 500k vues moyennes

    // Pondération : recherches (40%), résultats (30%), vues (20%), uploads (10%)
    const volumeScore = (
      searchesScore * 0.4 +
      resultsScore * 0.3 +
      viewsScore * 0.2 +
      uploadsScore * 0.1
    );

    return Math.round(volumeScore * 100) / 100;
  }

  /**
   * Calcule le score de concurrence (inversé : moins de concurrence = meilleur score)
   */
  calculateCompetitionScore(metrics: CompetitionMetrics): number {
    const {
      total_videos,
      avg_views,
      top_creator_dominance,
      upload_frequency,
      quality_score,
      barrier_to_entry
    } = metrics;

    // Scores inversés (moins de concurrence = mieux)
    const videosScore = Math.max(0, 10 - (total_videos / 5000)); // Pénalité après 5k vidéos
    const viewsScore = Math.max(0, 10 - (avg_views / 100000)); // Pénalité après 100k vues moyennes
    const dominanceScore = (1 - top_creator_dominance) * 10; // Moins de dominance = mieux
    const frequencyScore = Math.max(0, 10 - (upload_frequency / 10)); // Pénalité après 10 uploads/semaine
    
    // Score de qualité (inversé car haute qualité = plus de concurrence)
    const qualityPenalty = Math.max(0, 10 - quality_score);

    // Score de barrière d'entrée
    const barrierScore = barrier_to_entry === 'low' ? 8 : 
                        barrier_to_entry === 'medium' ? 5 : 2;

    // Pondération
    const competitionScore = (
      videosScore * 0.25 +
      viewsScore * 0.25 +
      dominanceScore * 0.2 +
      frequencyScore * 0.15 +
      qualityPenalty * 0.1 +
      barrierScore * 0.05
    );

    return Math.round(competitionScore * 100) / 100;
  }

  /**
   * Calcule le score de tendance
   */
  calculateTrendScore(metrics: TrendMetrics): number {
    const {
      trend_direction,
      trend_factor,
      growth_rate_3m,
      momentum_score
    } = metrics;

    // Score de direction
    const directionScore = trend_direction === 'rising' ? 10 :
                          trend_direction === 'stable' ? 6 : 2;

    // Score de facteur de tendance (1.0 = stable, >1.0 = croissance, <1.0 = déclin)
    const factorScore = Math.min(trend_factor * 5, 10); // Max 10 pour facteur 2.0

    // Score de croissance (0-100% -> 0-10)
    const growthScore = Math.min(growth_rate_3m / 10, 10);

    // Score de momentum (0-100 -> 0-10)
    const momentumScoreNormalized = momentum_score / 10;

    // Pondération
    const trendScore = (
      directionScore * 0.3 +
      factorScore * 0.3 +
      growthScore * 0.2 +
      momentumScoreNormalized * 0.2
    );

    return Math.round(trendScore * 100) / 100;
  }

  /**
   * Calcule le score de saturation (inversé : moins saturé = mieux)
   */
  calculateSaturationScore(metrics: SaturationMetrics): number {
    const {
      market_saturation,
      new_creators_ratio,
      content_diversity,
      niche_opportunity
    } = metrics;

    // Scores (certains inversés)
    const saturationScore = (1 - market_saturation) * 10; // Moins saturé = mieux
    const newCreatorsScore = new_creators_ratio * 10; // Plus de nouveaux = mieux
    const diversityScore = content_diversity * 10; // Plus diversifié = mieux
    const opportunityScore = niche_opportunity * 10; // Plus d'opportunité = mieux

    // Pondération
    const finalSaturationScore = (
      saturationScore * 0.3 +
      newCreatorsScore * 0.25 +
      diversityScore * 0.2 +
      opportunityScore * 0.25
    );

    return Math.round(finalSaturationScore * 100) / 100;
  }

  /**
   * Calcule le score de similarité
   */
  calculateSimilarityScore(metrics: SimilarityMetrics): number {
    const {
      spotify_similarity,
      lastfm_similarity,
      genre_overlap,
      style_compatibility,
      audience_overlap
    } = metrics;

    // Tous les scores sont déjà normalisés 0-1
    const spotifyScore = spotify_similarity * 10;
    const lastfmScore = lastfm_similarity * 10;
    const genreScore = genre_overlap * 10;
    const styleScore = style_compatibility * 10;
    const audienceScore = audience_overlap * 10;

    // Pondération
    const similarityScore = (
      spotifyScore * 0.3 +
      lastfmScore * 0.25 +
      genreScore * 0.2 +
      styleScore * 0.15 +
      audienceScore * 0.1
    );

    return Math.round(similarityScore * 100) / 100;
  }

  /**
   * Calcule le score final pondéré
   */
  calculateFinalScore(
    volumeScore: number,
    competitionScore: number,
    trendScore: number,
    saturationScore: number,
    similarityScore: number,
    artistName: string
  ): FinalScore {
    const { weights } = this.config;

    // Score global pondéré
    const overallScore = (
      volumeScore * weights.volume_weight +
      competitionScore * weights.competition_weight +
      trendScore * weights.trend_weight +
      saturationScore * weights.saturation_weight +
      similarityScore * weights.similarity_weight
    );

    // Niveau de confiance basé sur la cohérence des scores
    const scores = [volumeScore, competitionScore, trendScore, saturationScore, similarityScore];
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, score) => acc + Math.pow(score - avgScore, 2), 0) / scores.length;
    const standardDeviation = Math.sqrt(variance);

    let confidenceLevel: 'low' | 'medium' | 'high';
    if (standardDeviation < 1.5) {
      confidenceLevel = 'high';
    } else if (standardDeviation < 3) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    return {
      artist_name: artistName,
      overall_score: Math.round(overallScore * 100) / 100,
      volume_score: volumeScore,
      competition_score: competitionScore,
      trend_score: trendScore,
      similarity_score: similarityScore,
      confidence_level: confidenceLevel,
      calculated_at: new Date()
    };
  }

  /**
   * Calcule le score complet pour un artiste
   */
  calculateCompleteScore(
    volumeMetrics: VolumeMetrics,
    competitionMetrics: CompetitionMetrics,
    trendMetrics: TrendMetrics,
    saturationMetrics: SaturationMetrics,
    similarityMetrics: SimilarityMetrics,
    artistName: string
  ): ScoreBreakdown {
    const volumeScore = this.calculateVolumeScore(volumeMetrics);
    const competitionScore = this.calculateCompetitionScore(competitionMetrics);
    const trendScore = this.calculateTrendScore(trendMetrics);
    const saturationScore = this.calculateSaturationScore(saturationMetrics);
    const similarityScore = this.calculateSimilarityScore(similarityMetrics);

    const finalScore = this.calculateFinalScore(
      volumeScore,
      competitionScore,
      trendScore,
      saturationScore,
      similarityScore,
      artistName
    );

    return {
      volume_metrics: volumeMetrics,
      competition_metrics: competitionMetrics,
      trend_metrics: trendMetrics,
      saturation_metrics: saturationMetrics,
      similarity_metrics: similarityMetrics,
      final_score: finalScore
    };
  }

  /**
   * Applique des bonus/malus contextuels
   */
  applyContextualAdjustments(score: FinalScore, context: {
    isNewArtist?: boolean;
    hasRecentHit?: boolean;
    isRegionalArtist?: boolean;
    hasLabelSupport?: boolean;
  }): FinalScore {
    let adjustedScore = score.overall_score;

    // Bonus pour nouveaux artistes (plus d'opportunité)
    if (context.isNewArtist) {
      adjustedScore += 0.5;
    }

    // Malus pour artistes avec hit récent (plus de concurrence attendue)
    if (context.hasRecentHit) {
      adjustedScore -= 0.3;
    }

    // Bonus pour artistes régionaux (niches moins exploitées)
    if (context.isRegionalArtist) {
      adjustedScore += 0.2;
    }

    // Malus pour artistes avec support label (plus de concurrence)
    if (context.hasLabelSupport) {
      adjustedScore -= 0.2;
    }

    return {
      ...score,
      overall_score: Math.max(0, Math.min(10, Math.round(adjustedScore * 100) / 100))
    };
  }

  /**
   * Valide les seuils minimums selon la configuration
   */
  validateThresholds(scoreBreakdown: ScoreBreakdown): boolean {
    const { final_score, volume_metrics, competition_metrics, similarity_metrics } = scoreBreakdown;
    const { 
      min_volume_threshold, 
      max_competition_threshold, 
      min_similarity_threshold 
    } = this.config;

    // Vérifications des seuils
    const volumeValid = volume_metrics.monthly_searches_estimate >= min_volume_threshold;
    const competitionValid = competition_metrics.total_videos <= (max_competition_threshold * 10000);
    const similarityValid = similarity_metrics.spotify_similarity >= min_similarity_threshold;

    return volumeValid && competitionValid && similarityValid;
  }
}

