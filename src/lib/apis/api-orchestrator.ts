// Orchestrateur API unifié - VRAIES APIs COMPLÈTES
// Coordonne YouTube, Spotify, Last.fm et Genius

import { createYouTubeClient } from './youtube-client';
import { createSpotifyClient } from './spotify-client';
import { createLastFmClient } from './lastfm-client';
import { createGeniusClient } from './genius-client';
import { createRedisClient } from '../cache/redis-client';

interface Artist {
  name: string;
  id?: string;
  genres: string[];
  popularity: number;
  followers: number;
  source: 'spotify' | 'lastfm' | 'genius';
}

interface SimilarityMetrics {
  spotify_similarity: number;
  lastfm_similarity: number;
  genre_overlap: number;
  style_compatibility: number;
  audience_overlap: number;
}

interface SimilarArtistCandidate {
  artist: Artist;
  similarity: SimilarityMetrics;
  sources: string[];
}

interface FindSimilarArtistsResult {
  mainArtist: Artist;
  candidates: SimilarArtistCandidate[];
  processingTime: number;
}

interface YouTubeMetricsResult {
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

interface ArtistAnalysisResult {
  artist: Artist;
  youtube_metrics?: YouTubeMetricsResult;
  genius_metrics?: {
    followers: number;
    total_pageviews: number;
    hot_songs_count: number;
    popularity_score: number;
  };
  lastfm_stats?: {
    listeners: number;
    playcount: number;
    tags: string[];
  };
  processing_time: number;
}

/**
 * ORCHESTRATEUR API UNIFIÉ - IMPLÉMENTATION COMPLÈTE
 * 
 * RESPONSABILITÉS:
 * 1. Coordonner les appels aux 4 APIs externes
 * 2. Gérer le cache Redis intelligent
 * 3. Fusionner les données de sources multiples
 * 4. Calculer les scores de similarité cross-platform
 * 5. Gérer les fallbacks gracieux
 * 6. Optimiser les performances avec parallélisation
 */
export class APIOrchestrator {
  private youtubeClient;
  private spotifyClient;
  private lastfmClient;
  private geniusClient;
  private cacheClient;

  constructor() {
    this.youtubeClient = createYouTubeClient();
    this.spotifyClient = createSpotifyClient();
    this.lastfmClient = createLastFmClient();
    this.geniusClient = createGeniusClient();
    this.cacheClient = createRedisClient();
  }

  /**
   * ANALYSE COMPLÈTE D'UN ARTISTE
   * ALGORITHME:
   * 1. Vérification du cache
   * 2. Recherche parallèle sur toutes les plateformes
   * 3. Enrichissement avec métadonnées
   * 4. Fusion des données
   * 5. Mise en cache du résultat
   */
  async analyzeArtist(artistName: string, forceRefresh: boolean = false): Promise<ArtistAnalysisResult | null> {
    const startTime = Date.now();
    const cacheKey = `artist_analysis:${artistName.toLowerCase()}`;

    try {
      console.log(`🎯 Starting complete analysis for: ${artistName}`);

      // 1. Vérifier le cache (sauf si forceRefresh)
      if (!forceRefresh) {
        try {
          const cached = await this.cacheClient.get(cacheKey);
          if (cached) {
            console.log(`✅ Found cached analysis for ${artistName}`);
            return JSON.parse(cached);
          }
        } catch (error) {
          console.warn(`⚠️ Cache read failed for ${artistName}:`, error);
        }
      }

      // 2. Recherche parallèle sur toutes les plateformes
      console.log(`🔍 Searching ${artistName} across all platforms...`);
      
      const [spotifyResults, lastfmResults, geniusResults] = await Promise.allSettled([
        this.spotifyClient.searchArtists(artistName, 1),
        this.lastfmClient.searchArtists(artistName, 1),
        this.geniusClient.findArtist(artistName)
      ]);

      // 3. Extraire l'artiste principal (priorité Spotify > Last.fm > Genius)
      let mainArtist: Artist | null = null;

      if (spotifyResults.status === 'fulfilled' && spotifyResults.value.length > 0) {
        const spotifyArtist = spotifyResults.value[0];
        mainArtist = {
          name: spotifyArtist.name,
          id: spotifyArtist.id,
          genres: spotifyArtist.genres,
          popularity: spotifyArtist.popularity,
          followers: spotifyArtist.followers.total,
          source: 'spotify'
        };
      } else if (lastfmResults.status === 'fulfilled' && lastfmResults.value.length > 0) {
        const lastfmArtist = lastfmResults.value[0];
        mainArtist = {
          name: lastfmArtist.name,
          id: lastfmArtist.mbid || undefined,
          genres: [], // Sera enrichi plus tard
          popularity: 0, // Sera calculé plus tard
          followers: 0, // Sera enrichi plus tard
          source: 'lastfm'
        };
      } else if (geniusResults.status === 'fulfilled' && geniusResults.value) {
        const geniusArtist = geniusResults.value;
        mainArtist = {
          name: geniusArtist.name,
          id: geniusArtist.id.toString(),
          genres: [],
          popularity: 0,
          followers: geniusArtist.stats?.followers_count || 0,
          source: 'genius'
        };
      }

      if (!mainArtist) {
        console.log(`❌ Artist "${artistName}" not found on any platform`);
        return null;
      }

      console.log(`✅ Found main artist: ${mainArtist.name} (source: ${mainArtist.source})`);

      // 4. Enrichissement parallèle avec métadonnées détaillées
      console.log(`📊 Enriching ${mainArtist.name} with detailed metrics...`);
      
      const [youtubeMetrics, geniusMetrics, lastfmStats] = await Promise.allSettled([
        this.youtubeClient.analyzeTypeBeatMetrics(mainArtist.name),
        this.geniusClient.analyzeArtistMetrics(mainArtist.name),
        this.lastfmClient.getArtistStats(mainArtist.name)
      ]);

      // 5. Enrichir avec tags Last.fm si pas de genres
      if (mainArtist.genres.length === 0) {
        try {
          const tags = await this.lastfmClient.getArtistTopTags(mainArtist.name);
          mainArtist.genres = tags.slice(0, 5); // Top 5 tags comme genres
        } catch (error) {
          console.warn(`⚠️ Failed to get tags for ${mainArtist.name}`);
        }
      }

      // 6. Construire le résultat final
      const result: ArtistAnalysisResult = {
        artist: mainArtist,
        processing_time: Date.now() - startTime
      };

      // Ajouter les métriques YouTube si disponibles
      if (youtubeMetrics.status === 'fulfilled') {
        result.youtube_metrics = youtubeMetrics.value;
        console.log(`✅ YouTube metrics: ${youtubeMetrics.value.volume} volume, ${youtubeMetrics.value.competition_level} competition`);
      } else {
        console.warn(`⚠️ YouTube metrics failed:`, youtubeMetrics.reason);
      }

      // Ajouter les métriques Genius si disponibles
      if (geniusMetrics.status === 'fulfilled' && geniusMetrics.value) {
        result.genius_metrics = {
          followers: geniusMetrics.value.followers,
          total_pageviews: geniusMetrics.value.total_pageviews,
          hot_songs_count: geniusMetrics.value.hot_songs_count,
          popularity_score: geniusMetrics.value.popularity_score
        };
        console.log(`✅ Genius metrics: ${geniusMetrics.value.followers} followers, ${geniusMetrics.value.total_pageviews} pageviews`);
      } else {
        console.warn(`⚠️ Genius metrics failed or unavailable`);
      }

      // Ajouter les stats Last.fm si disponibles
      if (lastfmStats.status === 'fulfilled') {
        try {
          const tags = await this.lastfmClient.getArtistTopTags(mainArtist.name);
          result.lastfm_stats = {
            listeners: lastfmStats.value.listeners,
            playcount: lastfmStats.value.playcount,
            tags
          };
          console.log(`✅ Last.fm stats: ${lastfmStats.value.listeners} listeners, ${lastfmStats.value.playcount} plays`);
        } catch (error) {
          result.lastfm_stats = {
            listeners: lastfmStats.value.listeners,
            playcount: lastfmStats.value.playcount,
            tags: []
          };
        }
      } else {
        console.warn(`⚠️ Last.fm stats failed:`, lastfmStats.reason);
      }

      // 7. Mettre en cache le résultat (TTL: 24h)
      try {
        await this.cacheClient.setWithTTL(cacheKey, JSON.stringify(result), 86400);
        console.log(`💾 Cached analysis for ${artistName}`);
      } catch (error) {
        console.warn(`⚠️ Failed to cache analysis:`, error);
      }

      console.log(`✅ Complete analysis finished for ${artistName} in ${Date.now() - startTime}ms`);
      return result;

    } catch (error) {
      console.error(`❌ Failed to analyze ${artistName}:`, error);
      throw error;
    }
  }

  /**
   * RECHERCHE D'ARTISTES SIMILAIRES CROSS-PLATFORM
   * ALGORITHME:
   * 1. Recherche parallèle sur Spotify et Last.fm
   * 2. Déduplication et fusion des résultats
   * 3. Calcul des scores de similarité cross-platform
   * 4. Enrichissement avec métadonnées
   * 5. Tri par score de similarité composite
   */
  async findSimilarArtists(artistName: string, options: {
    limit?: number;
    minSimilarity?: number;
    includeMetrics?: boolean;
    sources?: ('spotify' | 'lastfm')[];
  } = {}): Promise<FindSimilarArtistsResult> {
    const startTime = Date.now();
    const { limit = 10, minSimilarity = 0.3, includeMetrics = true, sources = ['spotify', 'lastfm'] } = options;

    try {
      console.log(`🎯 Finding similar artists to: ${artistName} (sources: ${sources.join(', ')})`);

      // 1. Obtenir l'artiste principal pour référence
      const mainArtistAnalysis = await this.analyzeArtist(artistName);
      if (!mainArtistAnalysis) {
        throw new Error(`Main artist "${artistName}" not found`);
      }

      const mainArtist = mainArtistAnalysis.artist;

      // 2. Recherche parallèle d'artistes similaires
      const searchPromises: Promise<any>[] = [];
      
      if (sources.includes('spotify')) {
        searchPromises.push(
          this.spotifyClient.findSimilarArtists(artistName, { limit: limit * 2, minSimilarity: 0.2 })
        );
      }
      
      if (sources.includes('lastfm')) {
        searchPromises.push(
          this.lastfmClient.findSimilarArtistsWithMetadata(artistName, { limit: limit * 2, minSimilarity: 0.2 })
        );
      }

      const results = await Promise.allSettled(searchPromises);

      // 3. Fusionner et dédupliquer les résultats
      const allCandidates = new Map<string, SimilarArtistCandidate>();

      // Traiter les résultats Spotify
      if (sources.includes('spotify') && results[0]?.status === 'fulfilled') {
        const spotifyArtists = results[0].value;
        console.log(`✅ Found ${spotifyArtists.length} similar artists from Spotify`);

        for (const spotifyArtist of spotifyArtists) {
          const key = spotifyArtist.name.toLowerCase();
          
          if (!allCandidates.has(key)) {
            allCandidates.set(key, {
              artist: {
                name: spotifyArtist.name,
                id: spotifyArtist.id,
                genres: spotifyArtist.genres,
                popularity: spotifyArtist.popularity,
                followers: spotifyArtist.followers,
                source: 'spotify'
              },
              similarity: {
                spotify_similarity: spotifyArtist.similarity_score,
                lastfm_similarity: 0,
                genre_overlap: this.calculateGenreOverlap(mainArtist.genres, spotifyArtist.genres),
                style_compatibility: spotifyArtist.similarity_score,
                audience_overlap: this.calculateAudienceOverlap(mainArtist.popularity, spotifyArtist.popularity)
              },
              sources: ['spotify']
            });
          } else {
            // Mettre à jour avec les données Spotify
            const existing = allCandidates.get(key)!;
            existing.similarity.spotify_similarity = spotifyArtist.similarity_score;
            existing.sources.push('spotify');
          }
        }
      }

      // Traiter les résultats Last.fm
      const lastfmIndex = sources.includes('spotify') ? 1 : 0;
      if (sources.includes('lastfm') && results[lastfmIndex]?.status === 'fulfilled') {
        const lastfmArtists = results[lastfmIndex].value;
        console.log(`✅ Found ${lastfmArtists.length} similar artists from Last.fm`);

        for (const lastfmArtist of lastfmArtists) {
          const key = lastfmArtist.name.toLowerCase();
          
          if (!allCandidates.has(key)) {
            allCandidates.set(key, {
              artist: {
                name: lastfmArtist.name,
                id: undefined,
                genres: lastfmArtist.tags,
                popularity: this.calculatePopularityFromLastFm(lastfmArtist.listeners, lastfmArtist.playcount),
                followers: lastfmArtist.listeners,
                source: 'lastfm'
              },
              similarity: {
                spotify_similarity: 0,
                lastfm_similarity: lastfmArtist.similarity_score,
                genre_overlap: this.calculateGenreOverlap(mainArtist.genres, lastfmArtist.tags),
                style_compatibility: lastfmArtist.similarity_score,
                audience_overlap: 0.5 // Valeur par défaut
              },
              sources: ['lastfm']
            });
          } else {
            // Mettre à jour avec les données Last.fm
            const existing = allCandidates.get(key)!;
            existing.similarity.lastfm_similarity = lastfmArtist.similarity_score;
            existing.sources.push('lastfm');
          }
        }
      }

      // 4. Calculer les scores de similarité composite
      const candidates: SimilarArtistCandidate[] = Array.from(allCandidates.values())
        .map(candidate => {
          // Score composite basé sur les sources disponibles
          const spotifyWeight = candidate.sources.includes('spotify') ? 0.6 : 0;
          const lastfmWeight = candidate.sources.includes('lastfm') ? 0.4 : 0;
          const totalWeight = spotifyWeight + lastfmWeight;

          if (totalWeight === 0) return candidate;

          const compositeScore = (
            candidate.similarity.spotify_similarity * spotifyWeight +
            candidate.similarity.lastfm_similarity * lastfmWeight
          ) / totalWeight;

          // Bonus pour artistes présents sur plusieurs plateformes
          const crossPlatformBonus = candidate.sources.length > 1 ? 0.1 : 0;

          candidate.similarity.style_compatibility = Math.min(1, compositeScore + crossPlatformBonus);

          return candidate;
        })
        .filter(candidate => candidate.similarity.style_compatibility >= minSimilarity)
        .sort((a, b) => b.similarity.style_compatibility - a.similarity.style_compatibility)
        .slice(0, limit);

      console.log(`✅ Found ${candidates.length} similar artists with similarity >= ${minSimilarity}`);

      return {
        mainArtist,
        candidates,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`❌ Failed to find similar artists for ${artistName}:`, error);
      throw error;
    }
  }

  /**
   * CALCUL DES MÉTRIQUES YOUTUBE POUR UN ARTISTE
   */
  async calculateYouTubeMetrics(artistName: string): Promise<YouTubeMetricsResult> {
    const cacheKey = `youtube_metrics:${artistName.toLowerCase()}`;

    try {
      // Vérifier le cache (TTL: 6h pour les métriques YouTube)
      const cached = await this.cacheClient.get(cacheKey);
      if (cached) {
        console.log(`✅ Found cached YouTube metrics for ${artistName}`);
        return JSON.parse(cached);
      }

      console.log(`📊 Calculating YouTube metrics for: ${artistName}`);
      const metrics = await this.youtubeClient.analyzeTypeBeatMetrics(artistName);

      // Mettre en cache (TTL: 6h)
      await this.cacheClient.setWithTTL(cacheKey, JSON.stringify(metrics), 21600);

      return metrics;
    } catch (error) {
      console.error(`❌ Failed to calculate YouTube metrics for ${artistName}:`, error);
      throw error;
    }
  }

  /**
   * HEALTH CHECK DE TOUTES LES APIs
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      youtube: 'healthy' | 'unhealthy';
      spotify: 'healthy' | 'unhealthy';
      lastfm: 'healthy' | 'unhealthy';
      genius: 'healthy' | 'unhealthy';
      redis: 'healthy' | 'unhealthy';
    };
    details: any;
  }> {
    console.log(`🏥 Running health check on all services...`);

    const [youtubeHealth, spotifyHealth, lastfmHealth, geniusHealth, redisHealth] = await Promise.allSettled([
      this.youtubeClient.healthCheck(),
      this.spotifyClient.healthCheck(),
      this.lastfmClient.healthCheck(),
      this.geniusClient.healthCheck(),
      this.cacheClient.ping()
    ]);

    const services = {
      youtube: youtubeHealth.status === 'fulfilled' && youtubeHealth.value.status === 'healthy' ? 'healthy' : 'unhealthy',
      spotify: spotifyHealth.status === 'fulfilled' && spotifyHealth.value.status === 'healthy' ? 'healthy' : 'unhealthy',
      lastfm: lastfmHealth.status === 'fulfilled' && lastfmHealth.value.status === 'healthy' ? 'healthy' : 'unhealthy',
      genius: geniusHealth.status === 'fulfilled' && geniusHealth.value.status === 'healthy' ? 'healthy' : 'unhealthy',
      redis: redisHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy'
    } as const;

    // Déterminer le statut global
    const healthyCount = Object.values(services).filter(status => status === 'healthy').length;
    const totalServices = Object.keys(services).length;

    let globalStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalServices) {
      globalStatus = 'healthy';
    } else if (healthyCount >= totalServices - 1) { // Au moins 4/5 services fonctionnent
      globalStatus = 'degraded';
    } else {
      globalStatus = 'unhealthy';
    }

    const details = {
      youtube: youtubeHealth.status === 'fulfilled' ? youtubeHealth.value : { error: youtubeHealth.reason },
      spotify: spotifyHealth.status === 'fulfilled' ? spotifyHealth.value : { error: spotifyHealth.reason },
      lastfm: lastfmHealth.status === 'fulfilled' ? lastfmHealth.value : { error: lastfmHealth.reason },
      genius: geniusHealth.status === 'fulfilled' ? geniusHealth.value : { error: geniusHealth.reason },
      redis: redisHealth.status === 'fulfilled' ? { status: 'healthy' } : { error: redisHealth.reason }
    };

    console.log(`✅ Health check completed. Status: ${globalStatus} (${healthyCount}/${totalServices} services healthy)`);

    return {
      status: globalStatus,
      services,
      details
    };
  }

  /**
   * UTILITAIRES PRIVÉS
   */
  private calculateGenreOverlap(genres1: string[], genres2: string[]): number {
    if (genres1.length === 0 || genres2.length === 0) return 0;
    
    const set1 = new Set(genres1.map(g => g.toLowerCase()));
    const set2 = new Set(genres2.map(g => g.toLowerCase()));
    const intersection = new Set([...set1].filter(g => set2.has(g)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateAudienceOverlap(popularity1: number, popularity2: number): number {
    const diff = Math.abs(popularity1 - popularity2);
    return Math.max(0, 1 - (diff / 100));
  }

  private calculatePopularityFromLastFm(listeners: number, playcount: number): number {
    // Convertir les stats Last.fm en score de popularité 0-100
    const listenerScore = Math.min(100, (listeners / 1000000) * 100); // 1M listeners = 100
    const playcountScore = Math.min(100, (playcount / 50000000) * 100); // 50M plays = 100
    
    return Math.round((listenerScore * 0.6) + (playcountScore * 0.4));
  }
}

export function createAPIOrchestrator(): APIOrchestrator {
  return new APIOrchestrator();
}

