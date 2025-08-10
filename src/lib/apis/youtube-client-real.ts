// Client YouTube Data API v3 - VRAIES APIs COMPLÈTES
// Documentation: https://developers.google.com/youtube/v3/docs

import axios, { AxiosInstance } from 'axios';

interface YouTubeSearchResult {
  kind: string;
  etag: string;
  nextPageToken?: string;
  regionCode: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeVideo[];
}

interface YouTubeVideo {
  kind: string;
  etag: string;
  id: {
    kind: string;
    videoId: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
    };
    channelTitle: string;
    liveBroadcastContent: string;
    publishTime: string;
  };
}

interface YouTubeVideoStatistics {
  kind: string;
  etag: string;
  items: Array<{
    kind: string;
    etag: string;
    id: string;
    statistics: {
      viewCount: string;
      likeCount?: string;
      dislikeCount?: string;
      favoriteCount: string;
      commentCount?: string;
    };
  }>;
}

interface YouTubeMetrics {
  volume: number;
  competition_level: 'low' | 'medium' | 'high';
  competition_score: number;
  trend_direction: 'rising' | 'stable' | 'declining';
  trend_score: number;
  saturation_score: number;
  avg_views: number;
  median_views: number;
  total_videos: number;
  recent_uploads_30d: number;
  top_creator_dominance: number;
  calculated_at: Date;
}

/**
 * CLIENT YOUTUBE DATA API v3 - IMPLÉMENTATION COMPLÈTE
 * 
 * HYPOTHÈSES BASÉES SUR LA DOCUMENTATION OFFICIELLE:
 * 1. search.list coûte 100 unités de quota
 * 2. videos.list coûte 1 unité de quota  
 * 3. Quota quotidien: 10,000 unités
 * 4. Format des réponses selon la doc officielle
 * 5. Les type beats sont titrés "[Artist] Type Beat" ou similaire
 */
export class YouTubeClientReal {
  private client: AxiosInstance;
  private quotaUsed: number = 0;
  private readonly QUOTA_LIMIT = 10000;
  
  // Coûts en unités de quota selon la documentation YouTube
  private readonly QUOTA_COSTS = {
    search: 100,        // search.list
    videos: 1,          // videos.list
    channels: 1         // channels.list
  };

  constructor() {
    this.client = axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0'
      }
    });

    // Intercepteur pour ajouter la clé API à chaque requête
    this.client.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        key: process.env.YOUTUBE_API_KEY
      };
      return config;
    });

    // Intercepteur pour gérer les erreurs et quotas
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403) {
          const errorData = error.response.data;
          if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded') {
            throw new Error('YouTube API quota exceeded for today');
          }
        }
        throw error;
      }
    );
  }

  /**
   * RECHERCHE DE VIDÉOS YOUTUBE
   * HYPOTHÈSE: La recherche retourne des résultats pertinents pour "artist type beat"
   * FORMAT ATTENDU: Selon la documentation YouTube Data API v3
   * INFÉRENCE: Les type beats sont généralement titrés "[Artist] Type Beat" ou "Type Beat - [Artist]"
   */
  async searchVideos(params: {
    q: string;
    maxResults?: number;
    order?: 'relevance' | 'date' | 'viewCount' | 'rating';
    publishedAfter?: string;
    publishedBefore?: string;
  }): Promise<YouTubeSearchResult> {
    this.checkQuota(this.QUOTA_COSTS.search);

    try {
      console.log(`🔍 YouTube Search: "${params.q}" (${params.maxResults || 25} results)`);
      
      const response = await this.client.get<YouTubeSearchResult>('/search', {
        params: {
          part: 'snippet',
          type: 'video',
          maxResults: params.maxResults || 25,
          order: params.order || 'relevance',
          q: params.q,
          publishedAfter: params.publishedAfter,
          publishedBefore: params.publishedBefore,
          regionCode: 'US', // Focus sur le marché US
          relevanceLanguage: 'en'
        }
      });

      this.quotaUsed += this.QUOTA_COSTS.search;
      console.log(`✅ YouTube Search completed. Quota used: ${this.quotaUsed}/${this.QUOTA_LIMIT}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ YouTube Search failed:', error);
      throw new Error(`YouTube search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * OBTENIR LES STATISTIQUES DES VIDÉOS
   * HYPOTHÈSE: Les statistiques YouTube fournissent viewCount, likeCount, commentCount
   * FORMAT ATTENDU: Selon la documentation YouTube Data API v3 videos.list
   * INFÉRENCE: viewCount est toujours présent, autres métriques peuvent être absentes
   */
  async getVideoStatistics(videoIds: string[]): Promise<YouTubeVideoStatistics> {
    this.checkQuota(this.QUOTA_COSTS.videos);

    try {
      console.log(`📊 Getting statistics for ${videoIds.length} videos`);
      
      const response = await this.client.get<YouTubeVideoStatistics>('/videos', {
        params: {
          part: 'statistics',
          id: videoIds.join(','),
          maxResults: 50 // Limite API YouTube
        }
      });

      this.quotaUsed += this.QUOTA_COSTS.videos;
      return response.data;
    } catch (error) {
      console.error('❌ YouTube Statistics failed:', error);
      throw new Error(`YouTube statistics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ANALYSE COMPLÈTE DES MÉTRIQUES TYPE BEAT
   * 
   * HYPOTHÈSES ET INFÉRENCES:
   * 1. Les type beats récents (30 derniers jours) indiquent la tendance
   * 2. Le volume total indique la demande (pageInfo.totalResults)
   * 3. La distribution des vues indique la concurrence
   * 4. Les créateurs dominants indiquent la saturation du marché
   * 5. Les titres contiennent généralement "type beat" + nom d'artiste
   */
  async analyzeTypeBeatMetrics(artistName: string): Promise<YouTubeMetrics> {
    const searchQuery = `${artistName} type beat`;
    console.log(`🎯 Analyzing type beat metrics for: ${artistName}`);

    try {
      // 1. Recherche principale pour le volume total
      const mainSearch = await this.searchVideos({
        q: searchQuery,
        maxResults: 50,
        order: 'relevance'
      });

      // 2. Recherche récente pour les tendances (30 derniers jours)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSearch = await this.searchVideos({
        q: searchQuery,
        maxResults: 50,
        order: 'date',
        publishedAfter: thirtyDaysAgo.toISOString()
      });

      // 3. Obtenir les statistiques détaillées
      const allVideoIds = [
        ...mainSearch.items.map(item => item.id.videoId),
        ...recentSearch.items.map(item => item.id.videoId)
      ].filter((id, index, arr) => arr.indexOf(id) === index); // Dédupliquer

      const statistics = await this.getVideoStatistics(allVideoIds.slice(0, 50));

      // 4. Calculer les métriques
      const metrics = this.calculateMetrics(mainSearch, recentSearch, statistics, artistName);
      
      console.log(`✅ Analysis completed for ${artistName}:`, {
        volume: metrics.volume,
        competition: metrics.competition_level,
        trend: metrics.trend_direction,
        total_videos: metrics.total_videos
      });

      return metrics;

    } catch (error) {
      console.error(`❌ Failed to analyze ${artistName}:`, error);
      throw error;
    }
  }

  /**
   * CALCUL DES MÉTRIQUES BASÉ SUR LES DONNÉES YOUTUBE RÉELLES
   * 
   * HYPOTHÈSES ET ALGORITHMES:
   * - Volume: pageInfo.totalResults (peut être approximatif selon YouTube)
   * - Concurrence: Coefficient de variation des vues (écart-type/moyenne)
   * - Tendance: Ratio uploads récents vs volume total
   * - Saturation: Indice de concentration Herfindahl-Hirschman des créateurs
   */
  private calculateMetrics(
    mainSearch: YouTubeSearchResult,
    recentSearch: YouTubeSearchResult,
    statistics: YouTubeVideoStatistics,
    artistName: string
  ): YouTubeMetrics {
    
    // VOLUME: Estimation basée sur totalResults (peut être approximatif selon YouTube)
    const volume = Math.min(mainSearch.pageInfo.totalResults, 1000000); // Cap réaliste
    
    // STATISTIQUES DES VUES
    const viewCounts = statistics.items
      .map(item => parseInt(item.statistics.viewCount))
      .filter(count => !isNaN(count))
      .sort((a, b) => b - a);

    const avgViews = viewCounts.length > 0 
      ? viewCounts.reduce((sum, views) => sum + views, 0) / viewCounts.length 
      : 0;
    
    const medianViews = viewCounts.length > 0
      ? viewCounts[Math.floor(viewCounts.length / 2)]
      : 0;

    // CONCURRENCE: Basée sur la distribution des vues
    const viewsStdDev = this.calculateStandardDeviation(viewCounts);
    const competitionScore = this.calculateCompetitionScore(avgViews, medianViews, viewsStdDev);
    
    let competitionLevel: 'low' | 'medium' | 'high';
    if (competitionScore < 0.3) competitionLevel = 'low';
    else if (competitionScore < 0.7) competitionLevel = 'medium';
    else competitionLevel = 'high';

    // TENDANCE: Basée sur les uploads récents
    const recentUploads = recentSearch.items.length;
    const trendScore = this.calculateTrendScore(recentUploads, volume);
    
    let trendDirection: 'rising' | 'stable' | 'declining';
    if (trendScore > 0.6) trendDirection = 'rising';
    else if (trendScore > 0.3) trendDirection = 'stable';
    else trendDirection = 'declining';

    // SATURATION: Dominance des créateurs
    const channelCounts = this.calculateChannelDominance(mainSearch.items);
    const saturationScore = this.calculateSaturationScore(channelCounts);

    return {
      volume,
      competition_level: competitionLevel,
      competition_score: competitionScore,
      trend_direction: trendDirection,
      trend_score: trendScore,
      saturation_score: saturationScore,
      avg_views: Math.round(avgViews),
      median_views: medianViews,
      total_videos: mainSearch.items.length,
      recent_uploads_30d: recentUploads,
      top_creator_dominance: channelCounts.dominance,
      calculated_at: new Date()
    };
  }

  /**
   * CALCUL DU SCORE DE CONCURRENCE
   * HYPOTHÈSE: Une grande variance dans les vues indique une concurrence élevée
   * ALGORITHME: Coefficient de variation + ratio médiane/moyenne
   */
  private calculateCompetitionScore(avgViews: number, medianViews: number, stdDev: number): number {
    if (avgViews === 0) return 0;
    
    // Coefficient de variation (écart-type / moyenne)
    const coefficientOfVariation = stdDev / avgViews;
    
    // Ratio médiane/moyenne (proche de 1 = distribution équilibrée)
    const medianRatio = medianViews / avgViews;
    
    // Score composite (0-1, plus élevé = plus de concurrence)
    return Math.min(1, (coefficientOfVariation * 0.7) + ((1 - medianRatio) * 0.3));
  }

  /**
   * CALCUL DU SCORE DE TENDANCE
   * HYPOTHÈSE: Plus d'uploads récents = tendance croissante
   * ALGORITHME: Ratio uploads récents / volume total (normalisé)
   */
  private calculateTrendScore(recentUploads: number, totalVolume: number): number {
    if (totalVolume === 0) return 0;
    
    // Ratio uploads récents / volume total (normalisé)
    const recentRatio = recentUploads / Math.min(totalVolume, 1000);
    
    // Score normalisé (0-1)
    return Math.min(1, recentRatio * 10);
  }

  /**
   * CALCUL DE LA DOMINANCE DES CRÉATEURS
   * HYPOTHÈSE: Concentration élevée de créateurs = marché saturé
   * ALGORITHME: Indice Herfindahl-Hirschman adapté
   */
  private calculateChannelDominance(videos: YouTubeVideo[]): { dominance: number; uniqueChannels: number } {
    const channelCounts: { [channelId: string]: number } = {};
    
    videos.forEach(video => {
      const channelId = video.snippet.channelId;
      channelCounts[channelId] = (channelCounts[channelId] || 0) + 1;
    });

    const uniqueChannels = Object.keys(channelCounts).length;
    const totalVideos = videos.length;
    
    if (totalVideos === 0) return { dominance: 0, uniqueChannels: 0 };

    // Calcul de l'indice de concentration Herfindahl-Hirschman
    const herfindahlIndex = Object.values(channelCounts)
      .map(count => Math.pow(count / totalVideos, 2))
      .reduce((sum, squared) => sum + squared, 0);

    return {
      dominance: herfindahlIndex,
      uniqueChannels
    };
  }

  /**
   * CALCUL DU SCORE DE SATURATION
   * HYPOTHÈSE: Dominance élevée + peu de créateurs uniques = saturation élevée
   */
  private calculateSaturationScore(channelData: { dominance: number; uniqueChannels: number }): number {
    const { dominance, uniqueChannels } = channelData;
    
    // Normalisation du nombre de créateurs uniques (plus = moins saturé)
    const diversityScore = Math.min(1, uniqueChannels / 20); // 20 créateurs = diversité maximale
    
    // Score de saturation (0-1, plus élevé = plus saturé)
    return Math.min(1, dominance + (1 - diversityScore) * 0.3);
  }

  /**
   * CALCUL DE L'ÉCART-TYPE
   */
  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const squaredDifferences = values.map(value => Math.pow(value - mean, 2));
    const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * VÉRIFICATION DU QUOTA
   */
  private checkQuota(cost: number): void {
    if (this.quotaUsed + cost > this.QUOTA_LIMIT) {
      throw new Error(`YouTube API quota would be exceeded. Used: ${this.quotaUsed}, Cost: ${cost}, Limit: ${this.QUOTA_LIMIT}`);
    }
  }

  /**
   * OBTENIR L'USAGE DU QUOTA
   */
  getQuotaUsage(): { used: number; remaining: number; limit: number } {
    return {
      used: this.quotaUsed,
      remaining: this.QUOTA_LIMIT - this.quotaUsed,
      limit: this.QUOTA_LIMIT
    };
  }

  /**
   * HEALTH CHECK
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; quota?: any }> {
    try {
      // Test simple avec une recherche minimale
      await this.searchVideos({ q: 'test', maxResults: 1 });
      
      return {
        status: 'healthy',
        quota: this.getQuotaUsage()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export function createYouTubeClientReal(): YouTubeClientReal {
  return new YouTubeClientReal();
}

