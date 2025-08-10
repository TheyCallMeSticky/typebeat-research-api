// Orchestrateur pour toutes les APIs externes avec cache intelligent

import { YouTubeClient } from './youtube-client';
import { SpotifyClient } from './spotify-client';
import { LastFmClient } from './lastfm-client';
import { GeniusClient } from './genius-client';
import { RedisClient } from '../cache/redis-client';

import { Artist, SpotifyArtist, LastFmArtist, YouTubeVideo } from '@/types/artist';
import { VolumeMetrics, CompetitionMetrics, TrendMetrics, SaturationMetrics, SimilarityMetrics } from '@/types/scoring';
import { YouTubeAnalyzer } from '../services/youtube-analyzer';
import { SimilarityCalculator, ArtistSimilarityData } from '../services/similarity-calculator';

export interface APICredentials {
  youtube: {
    apiKey: string;
  };
  spotify: {
    clientId: string;
    clientSecret: string;
  };
  lastfm: {
    apiKey: string;
    sharedSecret: string;
  };
  genius: {
    clientId: string;
    clientSecret: string;
  };
}

export interface APIUsageStats {
  youtube: {
    quotaUsed: number;
    quotaLimit: number;
    quotaRemaining: number;
  };
  spotify: {
    requestCount: number;
    hasValidToken: boolean;
  };
  lastfm: {
    requestsInLastSecond: number;
    totalRequests: number;
  };
  genius: {
    requestCount: number;
    hasAccessToken: boolean;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    totalKeys: number;
  };
}

export interface ArtistAnalysisResult {
  mainArtist: Artist;
  spotifyData?: SpotifyArtist;
  lastfmData?: LastFmArtist;
  geniusData?: any;
  relatedArtists: {
    spotify: SpotifyArtist[];
    lastfm: LastFmArtist[];
  };
  youtubeMetrics: {
    volume: VolumeMetrics;
    competition: CompetitionMetrics;
    trends: TrendMetrics;
    saturation: SaturationMetrics;
  };
  similarityMetrics: SimilarityMetrics;
  processingTime: number;
  cached: boolean;
}

export class APIOrchestrator {
  private youtube: YouTubeClient;
  private spotify: SpotifyClient;
  private lastfm: LastFmClient;
  private genius: GeniusClient;
  private cache: RedisClient;
  private isInitialized: boolean = false;

  constructor(credentials: APICredentials, cache: RedisClient) {
    this.youtube = new YouTubeClient(credentials.youtube.apiKey);
    this.spotify = new SpotifyClient(credentials.spotify.clientId, credentials.spotify.clientSecret);
    this.lastfm = new LastFmClient(credentials.lastfm.apiKey);
    this.genius = new GeniusClient(credentials.genius.clientId, credentials.genius.clientSecret);
    this.cache = cache;
  }

  /**
   * Initialise tous les services
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing API Orchestrator...');
      
      // Initialiser le cache Redis
      if (!this.cache.isReady()) {
        await this.cache.connect();
      }

      // Vérifier la disponibilité des APIs
      const healthChecks = await Promise.allSettled([
        this.checkYouTubeHealth(),
        this.checkSpotifyHealth(),
        this.checkLastFmHealth(),
        this.checkGeniusHealth()
      ]);

      const results = healthChecks.map((result, index) => {
        const apiNames = ['YouTube', 'Spotify', 'Last.fm', 'Genius'];
        const apiName = apiNames[index];
        
        if (result.status === 'fulfilled' && result.value) {
          console.log(`✅ ${apiName} API ready`);
          return true;
        } else {
          console.warn(`⚠️ ${apiName} API not available`);
          return false;
        }
      });

      const availableAPIs = results.filter(Boolean).length;
      console.log(`🎯 API Orchestrator initialized with ${availableAPIs}/4 APIs available`);
      
      this.isInitialized = true;

    } catch (error) {
      console.error('❌ Failed to initialize API Orchestrator:', error);
      throw new Error('API Orchestrator initialization failed');
    }
  }

  /**
   * Analyse complète d'un artiste avec cache intelligent
   */
  async analyzeArtist(artistName: string, options: {
    forceRefresh?: boolean;
    includeRelated?: boolean;
    maxRelated?: number;
  } = {}): Promise<ArtistAnalysisResult> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('artist_analysis', artistName, JSON.stringify(options));

    try {
      // Vérifier le cache si pas de refresh forcé
      if (!options.forceRefresh) {
        const cached = await this.cache.get<ArtistAnalysisResult>(cacheKey);
        if (cached) {
          console.log(`💾 Using cached analysis for "${artistName}"`);
          return {
            ...cached,
            processingTime: Date.now() - startTime,
            cached: true
          };
        }
      }

      console.log(`🔍 Starting complete analysis for "${artistName}"`);

      // 1. Recherche de base sur toutes les plateformes
      const [spotifyResult, lastfmResult, geniusResult] = await Promise.allSettled([
        this.getSpotifyArtistData(artistName),
        this.getLastFmArtistData(artistName),
        this.getGeniusArtistData(artistName)
      ]);

      const spotifyData = spotifyResult.status === 'fulfilled' ? spotifyResult.value : undefined;
      const lastfmData = lastfmResult.status === 'fulfilled' ? lastfmResult.value : undefined;
      const geniusData = geniusResult.status === 'fulfilled' ? geniusResult.value : undefined;

      // 2. Créer l'objet artiste principal
      const mainArtist = this.createMainArtist(artistName, spotifyData, lastfmData);

      // 3. Récupérer les artistes similaires si demandé
      let relatedArtists: { spotify: SpotifyArtist[]; lastfm: LastFmArtist[] } = { spotify: [], lastfm: [] };
      if (options.includeRelated) {
        relatedArtists = await this.getRelatedArtists(artistName, options.maxRelated || 20);
      }

      // 4. Analyser YouTube
      const youtubeMetrics = await this.analyzeYouTubeMetrics(artistName);

      // 5. Calculer les métriques de similarité
      const similarityMetrics = this.calculateSimilarityMetrics(
        mainArtist,
        spotifyData,
        lastfmData,
        relatedArtists
      );

      const result: ArtistAnalysisResult = {
        mainArtist,
        spotifyData,
        lastfmData,
        geniusData,
        relatedArtists,
        youtubeMetrics,
        similarityMetrics,
        processingTime: Date.now() - startTime,
        cached: false
      };

      // Mettre en cache le résultat
      await this.cache.set(cacheKey, result, undefined, 'artist_analysis');

      console.log(`✅ Analysis completed for "${artistName}" in ${result.processingTime}ms`);
      return result;

    } catch (error) {
      console.error(`❌ Analysis failed for "${artistName}":`, error);
      throw new Error(`Artist analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recherche d'artistes similaires avec scoring
   */
  async findSimilarArtists(
    mainArtistName: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      includeMetrics?: boolean;
      sources?: ('spotify' | 'lastfm')[];
    } = {}
  ): Promise<{
    mainArtist: Artist;
    candidates: Array<{
      artist: Artist;
      similarity: SimilarityMetrics;
      sources: string[];
    }>;
    processingTime: number;
  }> {
    const startTime = Date.now();
    const cacheKey = this.cache.generateKey('similar_artists', mainArtistName, JSON.stringify(options));

    try {
      // Vérifier le cache
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        console.log(`💾 Using cached similar artists for "${mainArtistName}"`);
        return cached;
      }

      console.log(`🔍 Finding similar artists for "${mainArtistName}"`);

      // 1. Analyser l'artiste principal
      const mainAnalysis = await this.analyzeArtist(mainArtistName, { includeRelated: true });

      // 2. Collecter tous les candidats
      const candidates = new Map<string, {
        artist: Artist;
        sources: string[];
        spotifyData?: SpotifyArtist;
        lastfmData?: LastFmArtist;
      }>();

      // Ajouter les artistes Spotify
      if (!options.sources || options.sources.includes('spotify')) {
        mainAnalysis.relatedArtists.spotify.forEach(spotifyArtist => {
          const artist = this.convertSpotifyToArtist(spotifyArtist);
          candidates.set(artist.name.toLowerCase(), {
            artist,
            sources: ['spotify'],
            spotifyData: spotifyArtist
          });
        });
      }

      // Ajouter les artistes Last.fm
      if (!options.sources || options.sources.includes('lastfm')) {
        mainAnalysis.relatedArtists.lastfm.forEach(lastfmArtist => {
          const artist = this.convertLastFmToArtist(lastfmArtist);
          const key = artist.name.toLowerCase();
          
          if (candidates.has(key)) {
            // Fusionner les sources
            const existing = candidates.get(key)!;
            existing.sources.push('lastfm');
            existing.lastfmData = lastfmArtist;
          } else {
            candidates.set(key, {
              artist,
              sources: ['lastfm'],
              lastfmData: lastfmArtist
            });
          }
        });
      }

      // 3. Calculer les métriques de similarité pour chaque candidat
      const candidatesWithSimilarity = Array.from(candidates.values()).map(candidate => {
        const similarityData: ArtistSimilarityData = {
          mainArtist: mainAnalysis.mainArtist,
          candidateArtist: candidate.artist,
          spotifyData: candidate.spotifyData ? {
            mainArtist: mainAnalysis.spotifyData!,
            candidateArtist: candidate.spotifyData,
            isRelated: true
          } : undefined,
          lastfmData: candidate.lastfmData ? {
            similarityScore: candidate.lastfmData.match,
            sharedTags: [] // TODO: Implémenter si nécessaire
          } : undefined
        };

        const similarity = SimilarityCalculator.calculateSimilarityMetrics(similarityData);

        return {
          artist: candidate.artist,
          similarity,
          sources: candidate.sources
        };
      });

      // 4. Filtrer et trier
      const filtered = candidatesWithSimilarity
        .filter(candidate => {
          if (options.minSimilarity) {
            const avgSimilarity = (
              candidate.similarity.spotify_similarity +
              candidate.similarity.lastfm_similarity +
              candidate.similarity.genre_overlap +
              candidate.similarity.style_compatibility +
              candidate.similarity.audience_overlap
            ) / 5;
            return avgSimilarity >= options.minSimilarity;
          }
          return true;
        })
        .sort((a, b) => {
          // Trier par score de similarité global
          const scoreA = (a.similarity.spotify_similarity + a.similarity.lastfm_similarity + a.similarity.genre_overlap) / 3;
          const scoreB = (b.similarity.spotify_similarity + b.similarity.lastfm_similarity + b.similarity.genre_overlap) / 3;
          return scoreB - scoreA;
        })
        .slice(0, options.limit || 20);

      const result = {
        mainArtist: mainAnalysis.mainArtist,
        candidates: filtered,
        processingTime: Date.now() - startTime
      };

      // Mettre en cache
      await this.cache.set(cacheKey, result, undefined, 'artist_suggestions');

      console.log(`✅ Found ${filtered.length} similar artists for "${mainArtistName}"`);
      return result;

    } catch (error) {
      console.error(`❌ Similar artists search failed for "${mainArtistName}":`, error);
      throw new Error(`Similar artists search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Analyse YouTube avec cache
   */
  async analyzeYouTubeMetrics(artistName: string): Promise<{
    volume: VolumeMetrics;
    competition: CompetitionMetrics;
    trends: TrendMetrics;
    saturation: SaturationMetrics;
  }> {
    const cacheKey = this.cache.generateKey('youtube_metrics', artistName);

    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        console.log(`📺 Analyzing YouTube metrics for "${artistName}"`);
        
        const searchResult = await this.youtube.searchTypeBeat(artistName, {
          maxResults: 50
        });

        const analysis = YouTubeAnalyzer.analyzeComplete(searchResult, searchResult.query);
        
        return {
          volume: analysis.volumeMetrics,
          competition: analysis.competitionMetrics,
          trends: analysis.trendMetrics,
          saturation: analysis.saturationMetrics
        };
      },
      undefined,
      'youtube_search'
    );
  }

  /**
   * Obtient les statistiques d'utilisation de toutes les APIs
   */
  async getUsageStats(): Promise<APIUsageStats> {
    const youtubeStats = this.youtube.getQuotaUsage();
    const spotifyStats = this.spotify.getUsageStats();
    const lastfmStats = this.lastfm.getUsageStats();
    const geniusStats = this.genius.getUsageStats();
    const cacheStats = await this.cache.getStats();

    return {
      youtube: {
        quotaUsed: youtubeStats.used,
        quotaLimit: youtubeStats.limit,
        quotaRemaining: youtubeStats.remaining
      },
      spotify: {
        requestCount: spotifyStats.requestCount,
        hasValidToken: spotifyStats.hasValidToken
      },
      lastfm: {
        requestsInLastSecond: lastfmStats.requestsInLastSecond,
        totalRequests: lastfmStats.totalRequests
      },
      genius: {
        requestCount: geniusStats.requestCount,
        hasAccessToken: geniusStats.hasAccessToken
      },
      cache: {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        hitRate: cacheStats.hitRate,
        totalKeys: cacheStats.totalKeys
      }
    };
  }

  /**
   * Nettoie le cache et optimise les performances
   */
  async optimizeCache(): Promise<{
    deletedEntries: number;
    memoryFreed: string;
    optimizationTime: number;
  }> {
    const startTime = Date.now();
    
    console.log('🧹 Starting cache optimization...');
    
    const deletedEntries = await this.cache.cleanup();
    const statsAfter = await this.cache.getStats();
    
    const result = {
      deletedEntries,
      memoryFreed: statsAfter.memoryUsage,
      optimizationTime: Date.now() - startTime
    };
    
    console.log(`✅ Cache optimization completed: ${deletedEntries} entries removed in ${result.optimizationTime}ms`);
    
    return result;
  }

  // Méthodes privées

  private async getSpotifyArtistData(artistName: string): Promise<SpotifyArtist | undefined> {
    const cacheKey = this.cache.generateKey('spotify_artist', artistName);
    
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const result = await this.spotify.searchArtists(artistName, 1);
        return result.artists[0];
      },
      undefined,
      'spotify_artist'
    );
  }

  private async getLastFmArtistData(artistName: string): Promise<LastFmArtist | undefined> {
    const cacheKey = this.cache.generateKey('lastfm_artist', artistName);
    
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        const result = await this.lastfm.analyzeArtist(artistName);
        return result.artistInfo || undefined;
      },
      undefined,
      'lastfm_artist_info'
    );
  }

  private async getGeniusArtistData(artistName: string): Promise<any> {
    const cacheKey = this.cache.generateKey('genius_artist', artistName);
    
    return await this.cache.getOrSet(
      cacheKey,
      async () => {
        return await this.genius.findArtist(artistName);
      },
      undefined,
      'genius_artist'
    );
  }

  private async getRelatedArtists(artistName: string, maxResults: number): Promise<{
    spotify: SpotifyArtist[];
    lastfm: LastFmArtist[];
  }> {
    const [spotifyRelated, lastfmRelated] = await Promise.allSettled([
      this.spotify.findSimilarArtists(artistName, maxResults),
      this.lastfm.getSimilarArtists(artistName, maxResults)
    ]);

    return {
      spotify: spotifyRelated.status === 'fulfilled' ? spotifyRelated.value.relatedArtists : [],
      lastfm: lastfmRelated.status === 'fulfilled' ? lastfmRelated.value.similarArtists : []
    };
  }

  private createMainArtist(
    name: string,
    spotifyData?: SpotifyArtist,
    lastfmData?: LastFmArtist
  ): Artist {
    return {
      id: spotifyData?.spotify_id || name.toLowerCase().replace(/\s+/g, '-'),
      name: spotifyData?.name || lastfmData?.name || name,
      genres: spotifyData?.genres || [],
      popularity: spotifyData?.popularity
    };
  }

  private convertSpotifyToArtist(spotifyArtist: SpotifyArtist): Artist {
    return {
      id: spotifyArtist.spotify_id,
      name: spotifyArtist.name,
      genres: spotifyArtist.genres,
      popularity: spotifyArtist.popularity
    };
  }

  private convertLastFmToArtist(lastfmArtist: LastFmArtist): Artist {
    return {
      id: lastfmArtist.name.toLowerCase().replace(/\s+/g, '-'),
      name: lastfmArtist.name,
      genres: [], // Last.fm ne fournit pas de genres dans cette structure
      popularity: Math.round(lastfmArtist.match * 100) // Convertir le score de match en popularité
    };
  }

  private calculateSimilarityMetrics(
    mainArtist: Artist,
    spotifyData?: SpotifyArtist,
    lastfmData?: LastFmArtist,
    relatedArtists?: { spotify: SpotifyArtist[]; lastfm: LastFmArtist[] }
  ): SimilarityMetrics {
    // Calcul basique pour l'artiste principal
    return {
      spotify_similarity: spotifyData ? 1.0 : 0.0,
      lastfm_similarity: lastfmData ? 1.0 : 0.0,
      genre_overlap: 1.0,
      style_compatibility: 1.0,
      audience_overlap: 1.0
    };
  }

  // Health checks

  private async checkYouTubeHealth(): Promise<boolean> {
    try {
      await this.youtube.searchVideos({ q: 'test', maxResults: 1 });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkSpotifyHealth(): Promise<boolean> {
    try {
      await this.spotify.searchArtists('test', 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkLastFmHealth(): Promise<boolean> {
    try {
      await this.lastfm.searchArtists('test', 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkGeniusHealth(): Promise<boolean> {
    try {
      return await this.genius.checkAvailability();
    } catch (error) {
      return false;
    }
  }

  /**
   * Ferme toutes les connexions
   */
  async shutdown(): Promise<void> {
    console.log('🔌 Shutting down API Orchestrator...');
    await this.cache.disconnect();
    console.log('✅ API Orchestrator shutdown complete');
  }
}

