// Client pour YouTube Data API v3

import axios, { AxiosInstance } from 'axios';
import { YouTubeVideo } from '@/types/artist';
import { externalAPIs } from '@/lib/config';

export interface YouTubeSearchParams {
  q: string;
  maxResults?: number;
  order?: 'relevance' | 'date' | 'rating' | 'viewCount' | 'title';
  publishedAfter?: string;
  publishedBefore?: string;
  regionCode?: string;
  type?: 'video' | 'channel' | 'playlist';
}

export interface YouTubeSearchResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  prevPageToken?: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeVideoItem[];
}

export interface YouTubeVideoItem {
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

export interface YouTubeVideoDetails {
  kind: string;
  etag: string;
  items: Array<{
    kind: string;
    etag: string;
    id: string;
    snippet: {
      publishedAt: string;
      channelId: string;
      title: string;
      description: string;
      channelTitle: string;
      tags?: string[];
      categoryId: string;
      liveBroadcastContent: string;
      defaultLanguage?: string;
      defaultAudioLanguage?: string;
    };
    contentDetails: {
      duration: string;
      dimension: string;
      definition: string;
      caption: string;
      licensedContent: boolean;
      contentRating: object;
      projection: string;
    };
    statistics: {
      viewCount: string;
      likeCount?: string;
      dislikeCount?: string;
      favoriteCount: string;
      commentCount?: string;
    };
  }>;
}

export class YouTubeClient {
  private client: AxiosInstance;
  private apiKey: string;
  private quotaUsed: number = 0;
  private dailyQuotaLimit: number;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.dailyQuotaLimit = externalAPIs.youtube.quotaLimitDaily;
    
    this.client = axios.create({
      baseURL: externalAPIs.youtube.baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0'
      }
    });

    // Intercepteur pour le rate limiting
    this.client.interceptors.request.use(async (config) => {
      await this.checkRateLimit();
      return config;
    });

    // Intercepteur pour gérer les erreurs
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
   * Recherche de vidéos YouTube
   */
  async searchVideos(params: YouTubeSearchParams): Promise<{
    videos: YouTubeVideo[];
    totalResults: number;
    nextPageToken?: string;
  }> {
    try {
      const searchParams = {
        part: 'snippet',
        key: this.apiKey,
        type: 'video',
        maxResults: Math.min(params.maxResults || 50, 50),
        q: params.q,
        order: params.order || 'relevance',
        ...(params.publishedAfter && { publishedAfter: params.publishedAfter }),
        ...(params.publishedBefore && { publishedBefore: params.publishedBefore }),
        ...(params.regionCode && { regionCode: params.regionCode })
      };

      console.log(`🔍 Searching YouTube for: "${params.q}"`);
      
      const response = await this.client.get<YouTubeSearchResponse>('/search', {
        params: searchParams
      });

      // Coût en quota : 100 unités pour une recherche
      this.quotaUsed += externalAPIs.youtube.searchCostUnits;

      const videoIds = response.data.items.map(item => item.id.videoId);
      
      // Récupérer les détails des vidéos (statistiques, durée)
      const videoDetails = await this.getVideoDetails(videoIds);

      // Convertir au format interne
      const videos = this.convertToInternalFormat(response.data.items, videoDetails);

      console.log(`✅ Found ${videos.length} videos (${response.data.pageInfo.totalResults} total)`);

      return {
        videos,
        totalResults: response.data.pageInfo.totalResults,
        nextPageToken: response.data.nextPageToken
      };

    } catch (error) {
      console.error('❌ YouTube search error:', error);
      throw new Error(`YouTube search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère les détails des vidéos (statistiques, durée)
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeVideoDetails> {
    if (videoIds.length === 0) {
      return { kind: 'youtube#videoListResponse', etag: '', items: [] };
    }

    try {
      const response = await this.client.get<YouTubeVideoDetails>('/videos', {
        params: {
          part: 'snippet,contentDetails,statistics',
          key: this.apiKey,
          id: videoIds.join(',')
        }
      });

      // Coût en quota : 1 unité par vidéo
      this.quotaUsed += videoIds.length * externalAPIs.youtube.videoCostUnits;

      return response.data;

    } catch (error) {
      console.error('❌ YouTube video details error:', error);
      // Retourner une réponse vide plutôt que de faire échouer toute la recherche
      return { kind: 'youtube#videoListResponse', etag: '', items: [] };
    }
  }

  /**
   * Recherche spécifique pour les type beats d'un artiste
   */
  async searchTypeBeat(artistName: string, options: {
    maxResults?: number;
    timeRange?: 'week' | 'month' | '3months' | 'year' | 'all';
    region?: string;
  } = {}): Promise<{
    videos: YouTubeVideo[];
    totalResults: number;
    query: string;
  }> {
    const query = `${artistName} type beat`;
    
    // Calcul des dates pour le filtre temporel
    let publishedAfter: string | undefined;
    if (options.timeRange && options.timeRange !== 'all') {
      const now = new Date();
      const daysBack = {
        'week': 7,
        'month': 30,
        '3months': 90,
        'year': 365
      }[options.timeRange];
      
      const pastDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      publishedAfter = pastDate.toISOString();
    }

    const searchResult = await this.searchVideos({
      q: query,
      maxResults: options.maxResults || 50,
      order: 'relevance',
      publishedAfter,
      regionCode: options.region
    });

    return {
      ...searchResult,
      query
    };
  }

  /**
   * Analyse des tendances temporelles pour un artiste
   */
  async analyzeTrends(artistName: string): Promise<{
    recent: { videos: YouTubeVideo[]; count: number };
    older: { videos: YouTubeVideo[]; count: number };
    growthRate: number;
  }> {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    // Recherche des 3 derniers mois
    const recentSearch = await this.searchTypeBeat(artistName, {
      maxResults: 50,
      timeRange: '3months'
    });

    // Recherche des 3-6 mois précédents
    const olderSearch = await this.searchVideos({
      q: `${artistName} type beat`,
      maxResults: 50,
      publishedAfter: sixMonthsAgo.toISOString(),
      publishedBefore: threeMonthsAgo.toISOString()
    });

    const recentCount = recentSearch.videos.length;
    const olderCount = olderSearch.videos.length;
    
    // Calcul du taux de croissance
    const growthRate = olderCount > 0 ? ((recentCount - olderCount) / olderCount) * 100 : 0;

    return {
      recent: { videos: recentSearch.videos, count: recentCount },
      older: { videos: olderSearch.videos, count: olderCount },
      growthRate
    };
  }

  /**
   * Vérifie les limites de quota et rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    // Vérification du quota quotidien
    if (this.quotaUsed >= this.dailyQuotaLimit) {
      throw new Error('Daily YouTube API quota limit reached');
    }

    // Rate limiting : max 10 requêtes par seconde
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Convertit les données YouTube au format interne
   */
  private convertToInternalFormat(
    searchItems: YouTubeVideoItem[],
    videoDetails: YouTubeVideoDetails
  ): YouTubeVideo[] {
    const detailsMap = new Map(
      videoDetails.items.map(item => [item.id, item])
    );

    return searchItems.map(item => {
      const details = detailsMap.get(item.id.videoId);
      
      return {
        id: item.id.videoId,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        viewCount: details?.statistics.viewCount ? parseInt(details.statistics.viewCount) : undefined,
        likeCount: details?.statistics.likeCount ? parseInt(details.statistics.likeCount) : undefined,
        commentCount: details?.statistics.commentCount ? parseInt(details.statistics.commentCount) : undefined,
        duration: details?.contentDetails.duration,
        thumbnails: {
          default: item.snippet.thumbnails.default,
          medium: item.snippet.thumbnails.medium,
          high: item.snippet.thumbnails.high
        }
      };
    });
  }

  /**
   * Obtient les statistiques d'utilisation du quota
   */
  getQuotaUsage(): { used: number; limit: number; remaining: number; percentage: number } {
    const remaining = this.dailyQuotaLimit - this.quotaUsed;
    const percentage = (this.quotaUsed / this.dailyQuotaLimit) * 100;

    return {
      used: this.quotaUsed,
      limit: this.dailyQuotaLimit,
      remaining,
      percentage: Math.round(percentage * 100) / 100
    };
  }

  /**
   * Remet à zéro le compteur de quota (à appeler chaque jour)
   */
  resetQuota(): void {
    this.quotaUsed = 0;
  }
}

