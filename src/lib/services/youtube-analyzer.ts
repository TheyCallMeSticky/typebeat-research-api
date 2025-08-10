// Service d'analyse des métriques YouTube pour type beats

import { VolumeMetrics, CompetitionMetrics, TrendMetrics, SaturationMetrics } from '@/types/scoring';
import { YouTubeVideo } from '@/types/artist';

export interface YouTubeSearchResult {
  videos: YouTubeVideo[];
  totalResults: number;
  nextPageToken?: string;
}

export interface YouTubeAnalysisResult {
  volumeMetrics: VolumeMetrics;
  competitionMetrics: CompetitionMetrics;
  trendMetrics: TrendMetrics;
  saturationMetrics: SaturationMetrics;
}

export class YouTubeAnalyzer {
  /**
   * Analyse le volume de recherche pour un artiste
   */
  static analyzeVolume(searchResults: YouTubeSearchResult, query: string): VolumeMetrics {
    const { videos, totalResults } = searchResults;

    // Estimation du volume de recherche mensuel basé sur les résultats
    const monthlySearchesEstimate = this.estimateMonthlySearches(totalResults, videos);

    // Uploads récents (30 derniers jours)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentUploads = videos.filter(video => 
      new Date(video.publishedAt) >= thirtyDaysAgo
    ).length;

    // Vues moyennes du top 20
    const top20Videos = videos.slice(0, 20);
    const avgViewsTop20 = top20Videos.reduce((sum, video) => 
      sum + (video.viewCount || 0), 0
    ) / Math.max(top20Videos.length, 1);

    return {
      total_results: totalResults,
      monthly_searches_estimate: monthlySearchesEstimate,
      recent_uploads_30d: recentUploads,
      avg_views_top_20: Math.round(avgViewsTop20),
      search_query: query,
      calculated_at: new Date()
    };
  }

  /**
   * Analyse la concurrence
   */
  static analyzeCompetition(videos: YouTubeVideo[]): CompetitionMetrics {
    if (videos.length === 0) {
      return this.getDefaultCompetitionMetrics();
    }

    const totalVideos = videos.length;
    const views = videos.map(v => v.viewCount || 0).filter(v => v > 0);
    
    // Statistiques des vues
    const avgViews = views.reduce((a, b) => a + b, 0) / Math.max(views.length, 1);
    const sortedViews = views.sort((a, b) => b - a);
    const medianViews = sortedViews[Math.floor(sortedViews.length / 2)] || 0;

    // Dominance des top créateurs
    const channelViews = new Map<string, number>();
    videos.forEach(video => {
      const channel = video.channelTitle;
      const currentViews = channelViews.get(channel) || 0;
      channelViews.set(channel, currentViews + (video.viewCount || 0));
    });

    const totalViews = Array.from(channelViews.values()).reduce((a, b) => a + b, 0);
    const topChannelViews = Math.max(...Array.from(channelViews.values()));
    const topCreatorDominance = totalViews > 0 ? topChannelViews / totalViews : 0;

    // Fréquence d'upload (vidéos par semaine)
    const uploadFrequency = this.calculateUploadFrequency(videos);

    // Score de qualité basé sur engagement et durée
    const qualityScore = this.calculateQualityScore(videos);

    // Barrière d'entrée
    const barrierToEntry = this.assessBarrierToEntry(avgViews, totalVideos, topCreatorDominance);

    return {
      total_videos: totalVideos,
      avg_views: Math.round(avgViews),
      median_views: Math.round(medianViews),
      top_creator_dominance: Math.round(topCreatorDominance * 100) / 100,
      upload_frequency: Math.round(uploadFrequency * 10) / 10,
      quality_score: Math.round(qualityScore * 10) / 10,
      barrier_to_entry: barrierToEntry
    };
  }

  /**
   * Analyse les tendances
   */
  static analyzeTrends(videos: YouTubeVideo[]): TrendMetrics {
    if (videos.length === 0) {
      return this.getDefaultTrendMetrics();
    }

    // Analyse temporelle des uploads
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const recent3Months = videos.filter(v => new Date(v.publishedAt) >= threeMonthsAgo);
    const previous3Months = videos.filter(v => {
      const date = new Date(v.publishedAt);
      return date >= sixMonthsAgo && date < threeMonthsAgo;
    });

    // Calcul du taux de croissance
    const recentCount = recent3Months.length;
    const previousCount = previous3Months.length;
    const growthRate3m = previousCount > 0 ? 
      ((recentCount - previousCount) / previousCount) * 100 : 0;

    // Direction de la tendance
    let trendDirection: 'rising' | 'stable' | 'declining';
    if (growthRate3m > 10) {
      trendDirection = 'rising';
    } else if (growthRate3m < -10) {
      trendDirection = 'declining';
    } else {
      trendDirection = 'stable';
    }

    // Facteur de tendance
    const trendFactor = Math.max(0.5, Math.min(2.0, 1 + (growthRate3m / 100)));

    // Score de momentum basé sur l'accélération des uploads
    const momentumScore = this.calculateMomentumScore(videos);

    // Facteur de saisonnalité (simplifié)
    const seasonalityFactor = this.calculateSeasonalityFactor(videos);

    return {
      trend_direction: trendDirection,
      trend_factor: Math.round(trendFactor * 100) / 100,
      growth_rate_3m: Math.round(growthRate3m * 10) / 10,
      seasonality_factor: Math.round(seasonalityFactor * 100) / 100,
      momentum_score: Math.round(momentumScore)
    };
  }

  /**
   * Analyse la saturation du marché
   */
  static analyzeSaturation(videos: YouTubeVideo[]): SaturationMetrics {
    if (videos.length === 0) {
      return this.getDefaultSaturationMetrics();
    }

    // Analyse des créateurs
    const channels = new Set(videos.map(v => v.channelTitle));
    const uniqueChannels = channels.size;
    const totalVideos = videos.length;

    // Ratio nouveaux vs établis (basé sur la fréquence d'apparition)
    const channelFrequency = new Map<string, number>();
    videos.forEach(video => {
      const channel = video.channelTitle;
      channelFrequency.set(channel, (channelFrequency.get(channel) || 0) + 1);
    });

    const newCreators = Array.from(channelFrequency.values()).filter(freq => freq <= 2).length;
    const newCreatorsRatio = newCreators / uniqueChannels;

    // Saturation du marché (basée sur la concentration)
    const marketSaturation = this.calculateMarketSaturation(channelFrequency, totalVideos);

    // Diversité du contenu (basée sur la variation des titres et durées)
    const contentDiversity = this.calculateContentDiversity(videos);

    // Opportunité de niche
    const nicheOpportunity = this.calculateNicheOpportunity(
      marketSaturation, 
      newCreatorsRatio, 
      contentDiversity
    );

    return {
      market_saturation: Math.round(marketSaturation * 100) / 100,
      new_creators_ratio: Math.round(newCreatorsRatio * 100) / 100,
      content_diversity: Math.round(contentDiversity * 100) / 100,
      niche_opportunity: Math.round(nicheOpportunity * 100) / 100
    };
  }

  /**
   * Analyse complète YouTube
   */
  static analyzeComplete(searchResults: YouTubeSearchResult, query: string): YouTubeAnalysisResult {
    const { videos } = searchResults;

    return {
      volumeMetrics: this.analyzeVolume(searchResults, query),
      competitionMetrics: this.analyzeCompetition(videos),
      trendMetrics: this.analyzeTrends(videos),
      saturationMetrics: this.analyzeSaturation(videos)
    };
  }

  // Méthodes utilitaires privées

  private static estimateMonthlySearches(totalResults: number, videos: YouTubeVideo[]): number {
    // Estimation basée sur le nombre de résultats et l'activité récente
    const baseEstimate = Math.min(totalResults * 2, 100000); // Cap à 100k
    
    // Ajustement basé sur les vues récentes
    const recentVideos = videos.slice(0, 10);
    const avgRecentViews = recentVideos.reduce((sum, v) => sum + (v.viewCount || 0), 0) / 10;
    const viewsMultiplier = Math.min(avgRecentViews / 10000, 2); // Max 2x
    
    return Math.round(baseEstimate * (1 + viewsMultiplier * 0.3));
  }

  private static calculateUploadFrequency(videos: YouTubeVideo[]): number {
    if (videos.length < 2) return 0;

    // Calcul sur les 30 derniers jours
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentVideos = videos.filter(v => new Date(v.publishedAt) >= thirtyDaysAgo);
    return (recentVideos.length / 30) * 7; // Conversion en vidéos par semaine
  }

  private static calculateQualityScore(videos: YouTubeVideo[]): number {
    if (videos.length === 0) return 5;

    let totalScore = 0;
    let validVideos = 0;

    videos.slice(0, 20).forEach(video => {
      let score = 5; // Score de base

      // Bonus pour engagement (likes/vues)
      if (video.viewCount && video.likeCount) {
        const engagementRate = video.likeCount / video.viewCount;
        score += Math.min(engagementRate * 1000, 2); // Max +2
      }

      // Bonus pour commentaires
      if (video.viewCount && video.commentCount) {
        const commentRate = video.commentCount / video.viewCount;
        score += Math.min(commentRate * 500, 1); // Max +1
      }

      // Bonus pour durée appropriée (2-5 minutes optimal pour type beats)
      if (video.duration) {
        const durationMinutes = this.parseDuration(video.duration);
        if (durationMinutes >= 2 && durationMinutes <= 5) {
          score += 1;
        }
      }

      totalScore += score;
      validVideos++;
    });

    return validVideos > 0 ? totalScore / validVideos : 5;
  }

  private static assessBarrierToEntry(
    avgViews: number, 
    totalVideos: number, 
    dominance: number
  ): 'low' | 'medium' | 'high' {
    let score = 0;

    // Facteurs qui augmentent la barrière
    if (avgViews > 100000) score += 2;
    else if (avgViews > 50000) score += 1;

    if (totalVideos > 10000) score += 2;
    else if (totalVideos > 5000) score += 1;

    if (dominance > 0.5) score += 2;
    else if (dominance > 0.3) score += 1;

    if (score >= 4) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }

  private static calculateMomentumScore(videos: YouTubeVideo[]): number {
    if (videos.length < 10) return 50;

    // Analyse de l'accélération des uploads sur différentes périodes
    const now = new Date();
    const periods = [7, 14, 30]; // jours
    const uploadCounts = periods.map(days => {
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      return videos.filter(v => new Date(v.publishedAt) >= cutoff).length;
    });

    // Calcul du momentum (accélération positive = score élevé)
    const momentum = (uploadCounts[0] * 4 + uploadCounts[1] * 2 + uploadCounts[2]) / 7;
    return Math.min(Math.max(momentum * 10, 0), 100);
  }

  private static calculateSeasonalityFactor(videos: YouTubeVideo[]): number {
    // Analyse simplifiée de la saisonnalité
    const monthCounts = new Array(12).fill(0);
    
    videos.forEach(video => {
      const month = new Date(video.publishedAt).getMonth();
      monthCounts[month]++;
    });

    const avgMonthly = monthCounts.reduce((a, b) => a + b, 0) / 12;
    const currentMonth = new Date().getMonth();
    const currentMonthCount = monthCounts[currentMonth];

    return avgMonthly > 0 ? currentMonthCount / avgMonthly : 1;
  }

  private static calculateMarketSaturation(
    channelFrequency: Map<string, number>, 
    totalVideos: number
  ): number {
    const frequencies = Array.from(channelFrequency.values());
    const topCreatorVideos = Math.max(...frequencies);
    const top5CreatorVideos = frequencies
      .sort((a, b) => b - a)
      .slice(0, 5)
      .reduce((a, b) => a + b, 0);

    return Math.min(top5CreatorVideos / totalVideos, 1);
  }

  private static calculateContentDiversity(videos: YouTubeVideo[]): number {
    if (videos.length === 0) return 0;

    // Analyse de la diversité des titres
    const words = new Set<string>();
    videos.forEach(video => {
      const titleWords = video.title
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 3);
      titleWords.forEach(word => words.add(word));
    });

    const uniqueWordsRatio = words.size / (videos.length * 5); // Estimation 5 mots significatifs par titre
    return Math.min(uniqueWordsRatio, 1);
  }

  private static calculateNicheOpportunity(
    saturation: number, 
    newCreatorsRatio: number, 
    diversity: number
  ): number {
    // Opportunité = faible saturation + nouveaux créateurs + diversité
    return (1 - saturation) * 0.5 + newCreatorsRatio * 0.3 + diversity * 0.2;
  }

  private static parseDuration(duration: string): number {
    // Parse ISO 8601 duration (PT2M30S -> 2.5 minutes)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 60 + minutes + seconds / 60;
  }

  // Métriques par défaut pour les cas d'erreur

  private static getDefaultCompetitionMetrics(): CompetitionMetrics {
    return {
      total_videos: 0,
      avg_views: 0,
      median_views: 0,
      top_creator_dominance: 0,
      upload_frequency: 0,
      quality_score: 5,
      barrier_to_entry: 'low'
    };
  }

  private static getDefaultTrendMetrics(): TrendMetrics {
    return {
      trend_direction: 'stable',
      trend_factor: 1.0,
      growth_rate_3m: 0,
      seasonality_factor: 1.0,
      momentum_score: 50
    };
  }

  private static getDefaultSaturationMetrics(): SaturationMetrics {
    return {
      market_saturation: 0,
      new_creators_ratio: 1,
      content_diversity: 1,
      niche_opportunity: 1
    };
  }
}

