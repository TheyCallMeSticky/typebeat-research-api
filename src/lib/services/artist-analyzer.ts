// Service orchestrateur pour l'analyse complète d'artistes type beat

import { ScoreBreakdown, ScoringConfig, CalculationResult } from '@/types/scoring';
import { Artist, SearchFilters } from '@/types/artist';
import { ArtistSuggestion } from '@/types/api';

import { ScoringService } from './scoring';
import { YouTubeAnalyzer, YouTubeAnalysisResult } from './youtube-analyzer';
import { SimilarityCalculator, ArtistSimilarityData } from './similarity-calculator';

export interface AnalysisContext {
  mainArtist: Artist;
  candidateArtist: Artist;
  filters?: SearchFilters;
  forceRefresh?: boolean;
}

export interface SuggestionCandidate {
  artist: Artist;
  scoreBreakdown: ScoreBreakdown;
  suggestion: ArtistSuggestion;
  processingTime: number;
}

export class ArtistAnalyzer {
  private scoringService: ScoringService;
  private config: ScoringConfig;

  constructor(config: ScoringConfig) {
    this.config = config;
    this.scoringService = new ScoringService(config);
  }

  /**
   * Analyse complète d'un artiste candidat par rapport à un artiste principal
   */
  async analyzeCandidate(context: AnalysisContext): Promise<CalculationResult> {
    const startTime = Date.now();

    try {
      const { mainArtist, candidateArtist } = context;

      // 1. Analyse YouTube pour les métriques de volume et concurrence
      const youtubeAnalysis = await this.analyzeYouTubeMetrics(candidateArtist.name);

      // 2. Calcul des métriques de similarité
      const similarityData: ArtistSimilarityData = {
        mainArtist,
        candidateArtist,
        // TODO: Ajouter les données Spotify et Last.fm réelles
      };
      const similarityMetrics = SimilarityCalculator.calculateSimilarityMetrics(similarityData);

      // 3. Calcul du score complet
      const scoreBreakdown = this.scoringService.calculateCompleteScore(
        youtubeAnalysis.volumeMetrics,
        youtubeAnalysis.competitionMetrics,
        youtubeAnalysis.trendMetrics,
        youtubeAnalysis.saturationMetrics,
        similarityMetrics,
        candidateArtist.name
      );

      // 4. Validation des seuils
      const isValid = this.scoringService.validateThresholds(scoreBreakdown);

      if (!isValid) {
        return {
          success: false,
          error: 'Artist does not meet minimum thresholds',
          processing_time_ms: Date.now() - startTime,
          cached: false
        };
      }

      return {
        success: true,
        data: scoreBreakdown,
        processing_time_ms: Date.now() - startTime,
        cached: false
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during analysis',
        processing_time_ms: Date.now() - startTime,
        cached: false
      };
    }
  }

  /**
   * Génère une suggestion d'artiste basée sur l'analyse
   */
  generateSuggestion(
    scoreBreakdown: ScoreBreakdown,
    mainArtist: Artist,
    candidateArtist: Artist
  ): ArtistSuggestion {
    const { final_score, volume_metrics, competition_metrics, trend_metrics } = scoreBreakdown;

    // Détermination du niveau de concurrence
    let competitionLevel: 'low' | 'medium' | 'high';
    if (competition_metrics.barrier_to_entry === 'low' && competition_metrics.total_videos < 5000) {
      competitionLevel = 'low';
    } else if (competition_metrics.barrier_to_entry === 'high' || competition_metrics.total_videos > 15000) {
      competitionLevel = 'high';
    } else {
      competitionLevel = 'medium';
    }

    // Génération de la raison
    const reason = this.generateReason(scoreBreakdown, mainArtist, candidateArtist);

    // Détermination du genre principal
    const genre = candidateArtist.genres[0] || 'Hip Hop';

    return {
      artist: candidateArtist.name,
      score: final_score.overall_score,
      metrics: {
        volume: volume_metrics.monthly_searches_estimate,
        competition: competitionLevel,
        trend: trend_metrics.trend_direction,
        saturation: scoreBreakdown.saturation_metrics.market_saturation
      },
      details: {
        genre,
        reason,
        confidence: final_score.confidence_level
      },
      sources: {
        spotify: true, // TODO: Basé sur les données réelles
        lastfm: true,  // TODO: Basé sur les données réelles
        youtube: true
      }
    };
  }

  /**
   * Traite une liste de candidats et retourne les meilleures suggestions
   */
  async processCandidates(
    mainArtist: Artist,
    candidates: Artist[],
    limit: number = 3,
    filters?: SearchFilters
  ): Promise<SuggestionCandidate[]> {
    const results: SuggestionCandidate[] = [];

    for (const candidate of candidates) {
      const context: AnalysisContext = {
        mainArtist,
        candidateArtist: candidate,
        filters
      };

      const analysisResult = await this.analyzeCandidate(context);

      if (analysisResult.success && analysisResult.data) {
        const suggestion = this.generateSuggestion(
          analysisResult.data,
          mainArtist,
          candidate
        );

        results.push({
          artist: candidate,
          scoreBreakdown: analysisResult.data,
          suggestion,
          processingTime: analysisResult.processing_time_ms
        });
      }
    }

    // Tri par score décroissant et limitation
    return results
      .sort((a, b) => b.suggestion.score - a.suggestion.score)
      .slice(0, limit);
  }

  /**
   * Applique les filtres aux candidats
   */
  applyFilters(candidates: Artist[], filters?: SearchFilters): Artist[] {
    if (!filters) return candidates;

    return candidates.filter(artist => {
      // Filtre par genre
      if (filters.genre) {
        const hasGenre = artist.genres.some(g => 
          g.toLowerCase().includes(filters.genre!.toLowerCase())
        );
        if (!hasGenre) return false;
      }

      // Filtre par popularité
      if (filters.popularity_range && artist.popularity !== undefined) {
        const [min, max] = filters.popularity_range;
        if (artist.popularity < min || artist.popularity > max) {
          return false;
        }
      }

      // TODO: Ajouter d'autres filtres (BPM, région, etc.)

      return true;
    });
  }

  /**
   * Calcule les statistiques d'analyse pour un batch
   */
  calculateBatchStats(results: SuggestionCandidate[]): {
    totalProcessed: number;
    avgScore: number;
    avgProcessingTime: number;
    scoreDistribution: { low: number; medium: number; high: number };
  } {
    const totalProcessed = results.length;
    const avgScore = results.reduce((sum, r) => sum + r.suggestion.score, 0) / totalProcessed;
    const avgProcessingTime = results.reduce((sum, r) => sum + r.processingTime, 0) / totalProcessed;

    const scoreDistribution = {
      low: results.filter(r => r.suggestion.score < 4).length,
      medium: results.filter(r => r.suggestion.score >= 4 && r.suggestion.score < 7).length,
      high: results.filter(r => r.suggestion.score >= 7).length
    };

    return {
      totalProcessed,
      avgScore: Math.round(avgScore * 100) / 100,
      avgProcessingTime: Math.round(avgProcessingTime),
      scoreDistribution
    };
  }

  // Méthodes privées

  private async analyzeYouTubeMetrics(artistName: string): Promise<YouTubeAnalysisResult> {
    // TODO: Intégrer avec l'API YouTube réelle
    // Pour l'instant, retourner des données simulées
    
    const mockSearchResults = {
      videos: [], // TODO: Données réelles
      totalResults: Math.floor(Math.random() * 20000) + 1000,
      nextPageToken: undefined
    };

    const query = `${artistName} type beat`;
    return YouTubeAnalyzer.analyzeComplete(mockSearchResults, query);
  }

  private generateReason(
    scoreBreakdown: ScoreBreakdown,
    mainArtist: Artist,
    candidateArtist: Artist
  ): string {
    const { final_score, volume_metrics, competition_metrics, trend_metrics, similarity_metrics } = scoreBreakdown;

    const reasons: string[] = [];

    // Raison basée sur la similarité
    if (similarity_metrics.genre_overlap > 0.7) {
      reasons.push(`Style ${candidateArtist.genres[0] || 'similaire'} compatible`);
    }

    // Raison basée sur le volume
    if (volume_metrics.monthly_searches_estimate > 5000) {
      reasons.push('Volume de recherche élevé');
    } else if (volume_metrics.monthly_searches_estimate > 1000) {
      reasons.push('Volume de recherche modéré');
    }

    // Raison basée sur la concurrence
    if (competition_metrics.barrier_to_entry === 'low') {
      reasons.push('Faible barrière d\'entrée');
    } else if (competition_metrics.total_videos < 5000) {
      reasons.push('Concurrence limitée');
    }

    // Raison basée sur les tendances
    if (trend_metrics.trend_direction === 'rising') {
      reasons.push('Tendance croissante');
    }

    // Raison basée sur la popularité
    if (candidateArtist.popularity && mainArtist.popularity) {
      const popularityRatio = candidateArtist.popularity / mainArtist.popularity;
      if (popularityRatio < 0.8) {
        reasons.push('Moins saturé que l\'artiste principal');
      }
    }

    // Raison par défaut si aucune raison spécifique
    if (reasons.length === 0) {
      if (final_score.overall_score > 7) {
        reasons.push('Excellent potentiel global');
      } else if (final_score.overall_score > 5) {
        reasons.push('Bon potentiel de niche');
      } else {
        reasons.push('Opportunité émergente');
      }
    }

    return reasons.slice(0, 2).join(', ');
  }

  /**
   * Optimise l'ordre d'analyse des candidats
   */
  optimizeCandidateOrder(candidates: Artist[], mainArtist: Artist): Artist[] {
    // Prioriser les artistes avec des genres similaires
    return candidates.sort((a, b) => {
      const similarityA = SimilarityCalculator.calculateGenreOverlap(
        mainArtist.genres,
        a.genres
      );
      const similarityB = SimilarityCalculator.calculateGenreOverlap(
        mainArtist.genres,
        b.genres
      );

      return similarityB - similarityA;
    });
  }

  /**
   * Valide qu'un artiste candidat est approprié pour l'analyse
   */
  validateCandidate(candidate: Artist, mainArtist: Artist): boolean {
    // Éviter l'auto-analyse
    if (candidate.name.toLowerCase() === mainArtist.name.toLowerCase()) {
      return false;
    }

    // Vérifier qu'il y a au moins un genre
    if (candidate.genres.length === 0) {
      return false;
    }

    // Vérifier la similarité minimale
    const genreOverlap = SimilarityCalculator.calculateGenreOverlap(
      mainArtist.genres,
      candidate.genres
    );

    return genreOverlap >= this.config.min_similarity_threshold;
  }
}

