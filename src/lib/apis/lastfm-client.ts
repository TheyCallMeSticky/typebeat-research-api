// Client Last.fm API - VRAIES APIs COMPLÈTES
// Documentation: https://www.last.fm/api

import axios, { AxiosInstance } from 'axios';

interface LastFmArtist {
  name: string;
  mbid?: string;
  url: string;
  image: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
  }>;
  streamable: string;
  ontour?: string;
  stats?: {
    listeners: string;
    playcount: string;
  };
  similar?: {
    artist: LastFmSimilarArtist[];
  };
  tags?: {
    tag: Array<{
      name: string;
      url: string;
    }>;
  };
  bio?: {
    published: string;
    summary: string;
    content: string;
  };
}

interface LastFmSimilarArtist {
  name: string;
  url: string;
  image: Array<{
    '#text': string;
    size: string;
  }>;
  match: string; // Score de similarité (0-1)
}

interface LastFmSearchResponse {
  results: {
    'opensearch:Query': {
      '#text': string;
      role: string;
      searchTerms: string;
      startPage: string;
    };
    'opensearch:totalResults': string;
    'opensearch:startIndex': string;
    'opensearch:itemsPerPage': string;
    artistmatches: {
      artist: LastFmArtist[];
    };
    '@attr': {
      for: string;
    };
  };
}

interface LastFmArtistInfoResponse {
  artist: LastFmArtist;
}

interface LastFmSimilarArtistsResponse {
  similarartists: {
    artist: LastFmSimilarArtist[];
    '@attr': {
      artist: string;
    };
  };
}

interface LastFmTopTagsResponse {
  toptags: {
    tag: Array<{
      name: string;
      count: number;
      url: string;
    }>;
    '@attr': {
      artist: string;
    };
  };
}

interface SimilarArtistLastFm {
  name: string;
  similarity_score: number;
  listeners: number;
  playcount: number;
  tags: string[];
  source: 'lastfm';
  url: string;
}

/**
 * CLIENT LAST.FM API - IMPLÉMENTATION COMPLÈTE
 * 
 * HYPOTHÈSES BASÉES SUR LA DOCUMENTATION OFFICIELLE:
 * 1. Rate limiting: 5 requêtes par seconde par clé API
 * 2. Format JSON avec structure spécifique (opensearch, @attr)
 * 3. artist.search retourne jusqu'à 50 résultats par page
 * 4. artist.getSimilar retourne jusqu'à 100 artistes similaires
 * 5. Match score dans getSimilar va de 0 à 1 (1 = très similaire)
 * 6. Statistiques (listeners, playcount) en format string
 */
export class LastFmClient {
  private client: AxiosInstance;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();
  private readonly RATE_LIMIT = 5; // Requêtes par seconde
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://ws.audioscrobbler.com/2.0',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0'
      }
    });

    // Intercepteur pour ajouter les paramètres communs
    this.client.interceptors.request.use((config) => {
      config.params = {
        ...config.params,
        api_key: process.env.LASTFM_API_KEY,
        format: 'json'
      };
      return config;
    });

    // Intercepteur pour gérer les erreurs
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403) {
          throw new Error('Last.fm API key invalid or rate limit exceeded');
        }
        if (error.response?.status === 429) {
          throw new Error('Last.fm rate limit exceeded');
        }
        throw error;
      }
    );
  }

  /**
   * GESTION DU RATE LIMITING (5 REQ/SEC)
   * HYPOTHÈSE: Last.fm limite à 5 requêtes par seconde
   * IMPLÉMENTATION: Queue avec délai automatique
   */
  private async makeRateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        await request();
        
        // Attendre 200ms entre les requêtes (5 req/sec max)
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * RECHERCHE D'ARTISTES LAST.FM
   * HYPOTHÈSE: artist.search retourne des artistes pertinents
   * FORMAT ATTENDU: { results: { artistmatches: { artist: LastFmArtist[] } } }
   * INFÉRENCE: Résultats triés par pertinence
   */
  async searchArtists(query: string, limit: number = 30): Promise<LastFmArtist[]> {
    return this.makeRateLimitedRequest(async () => {
      try {
        console.log(`🔍 Last.fm Search: "${query}" (${limit} results)`);
        
        const response = await this.client.get<LastFmSearchResponse>('/', {
          params: {
            method: 'artist.search',
            artist: query,
            limit: Math.min(limit, 50) // Limite API Last.fm
          }
        });

        const artists = response.data.results?.artistmatches?.artist || [];
        console.log(`✅ Found ${artists.length} artists for "${query}"`);
        
        return Array.isArray(artists) ? artists : [artists]; // Gérer le cas d'un seul résultat
      } catch (error) {
        console.error(`❌ Last.fm search failed for "${query}":`, error);
        throw new Error(`Last.fm search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * OBTENIR LES INFORMATIONS DÉTAILLÉES D'UN ARTISTE
   * HYPOTHÈSE: artist.getInfo retourne stats complètes (listeners, playcount)
   * FORMAT ATTENDU: { artist: { stats: { listeners, playcount }, tags, bio } }
   * INFÉRENCE: Statistiques en format string, conversion nécessaire
   */
  async getArtistInfo(artistName: string): Promise<LastFmArtist> {
    return this.makeRateLimitedRequest(async () => {
      try {
        console.log(`📊 Getting Last.fm info for: ${artistName}`);
        
        const response = await this.client.get<LastFmArtistInfoResponse>('/', {
          params: {
            method: 'artist.getInfo',
            artist: artistName,
            autocorrect: 1 // Correction automatique des noms
          }
        });

        console.log(`✅ Retrieved info for ${artistName}`);
        return response.data.artist;
      } catch (error) {
        console.error(`❌ Failed to get Last.fm info for ${artistName}:`, error);
        throw new Error(`Failed to get artist info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * OBTENIR LES ARTISTES SIMILAIRES
   * HYPOTHÈSE: artist.getSimilar retourne jusqu'à 100 artistes avec scores
   * FORMAT ATTENDU: { similarartists: { artist: [{ name, match }] } }
   * INFÉRENCE: Match score de 0 à 1 (string), conversion en number nécessaire
   */
  async getSimilarArtists(artistName: string, limit: number = 50): Promise<LastFmSimilarArtist[]> {
    return this.makeRateLimitedRequest(async () => {
      try {
        console.log(`🎯 Getting similar artists for: ${artistName} (${limit} results)`);
        
        const response = await this.client.get<LastFmSimilarArtistsResponse>('/', {
          params: {
            method: 'artist.getSimilar',
            artist: artistName,
            limit: Math.min(limit, 100), // Limite API Last.fm
            autocorrect: 1
          }
        });

        const similarArtists = response.data.similarartists?.artist || [];
        console.log(`✅ Found ${similarArtists.length} similar artists for ${artistName}`);
        
        return Array.isArray(similarArtists) ? similarArtists : [similarArtists];
      } catch (error) {
        console.error(`❌ Failed to get similar artists for ${artistName}:`, error);
        throw new Error(`Failed to get similar artists: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });
  }

  /**
   * OBTENIR LES TAGS PRINCIPAUX D'UN ARTISTE
   * HYPOTHÈSE: artist.getTopTags retourne les genres/styles musicaux
   * FORMAT ATTENDU: { toptags: { tag: [{ name, count }] } }
   * INFÉRENCE: Tags triés par count (popularité)
   */
  async getArtistTopTags(artistName: string): Promise<string[]> {
    return this.makeRateLimitedRequest(async () => {
      try {
        console.log(`🏷️ Getting top tags for: ${artistName}`);
        
        const response = await this.client.get<LastFmTopTagsResponse>('/', {
          params: {
            method: 'artist.getTopTags',
            artist: artistName,
            autocorrect: 1
          }
        });

        const tags = response.data.toptags?.tag || [];
        const tagNames = (Array.isArray(tags) ? tags : [tags])
          .map(tag => tag.name)
          .slice(0, 10); // Top 10 tags

        console.log(`✅ Found ${tagNames.length} tags for ${artistName}`);
        return tagNames;
      } catch (error) {
        console.error(`❌ Failed to get tags for ${artistName}:`, error);
        return []; // Retourner un tableau vide en cas d'erreur
      }
    });
  }

  /**
   * RECHERCHE D'ARTISTES SIMILAIRES COMPLÈTE AVEC MÉTADONNÉES
   * ALGORITHME:
   * 1. Recherche de l'artiste principal
   * 2. Obtention des artistes similaires avec scores
   * 3. Enrichissement avec informations détaillées (stats, tags)
   * 4. Filtrage par score de similarité minimum
   * 5. Tri par score décroissant
   */
  async findSimilarArtistsWithMetadata(artistName: string, options: {
    limit?: number;
    minSimilarity?: number;
    includeMetrics?: boolean;
  } = {}): Promise<SimilarArtistLastFm[]> {
    const { limit = 10, minSimilarity = 0.3, includeMetrics = true } = options;
    
    try {
      console.log(`🎯 Finding similar artists to: ${artistName} (Last.fm)`);
      
      // 1. Vérifier que l'artiste existe
      try {
        await this.getArtistInfo(artistName);
      } catch (error) {
        throw new Error(`Artist "${artistName}" not found on Last.fm`);
      }

      // 2. Obtenir les artistes similaires
      const similarArtists = await this.getSimilarArtists(artistName, limit * 2);
      
      if (similarArtists.length === 0) {
        throw new Error(`No similar artists found for "${artistName}" on Last.fm`);
      }

      // 3. Enrichir avec métadonnées (en parallèle pour optimiser)
      const enrichedArtists: SimilarArtistLastFm[] = [];
      
      for (const similarArtist of similarArtists) {
        try {
          const matchScore = parseFloat(similarArtist.match);
          
          // Filtrer par score minimum
          if (matchScore < minSimilarity) continue;

          let artistInfo: LastFmArtist | null = null;
          let tags: string[] = [];

          if (includeMetrics) {
            try {
              // Obtenir les infos détaillées et tags en parallèle
              const [info, artistTags] = await Promise.all([
                this.getArtistInfo(similarArtist.name),
                this.getArtistTopTags(similarArtist.name)
              ]);
              
              artistInfo = info;
              tags = artistTags;
            } catch (error) {
              console.warn(`⚠️ Failed to get metadata for ${similarArtist.name}:`, error);
            }
          }

          enrichedArtists.push({
            name: similarArtist.name,
            similarity_score: matchScore,
            listeners: artistInfo?.stats ? parseInt(artistInfo.stats.listeners) || 0 : 0,
            playcount: artistInfo?.stats ? parseInt(artistInfo.stats.playcount) || 0 : 0,
            tags,
            source: 'lastfm',
            url: similarArtist.url
          });

        } catch (error) {
          console.warn(`⚠️ Failed to process ${similarArtist.name}:`, error);
          continue;
        }
      }

      // 4. Trier par score de similarité et limiter
      const finalResults = enrichedArtists
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

      console.log(`✅ Found ${finalResults.length} similar artists with similarity >= ${minSimilarity}`);
      
      return finalResults;
    } catch (error) {
      console.error(`❌ Failed to find similar artists for "${artistName}":`, error);
      throw error;
    }
  }

  /**
   * OBTENIR LES STATISTIQUES D'ÉCOUTE D'UN ARTISTE
   * HYPOTHÈSE: Les stats Last.fm reflètent la popularité réelle
   * INFÉRENCE: listeners = audience unique, playcount = écoutes totales
   */
  async getArtistStats(artistName: string): Promise<{ listeners: number; playcount: number }> {
    try {
      const artistInfo = await this.getArtistInfo(artistName);
      
      return {
        listeners: artistInfo.stats ? parseInt(artistInfo.stats.listeners) || 0 : 0,
        playcount: artistInfo.stats ? parseInt(artistInfo.stats.playcount) || 0 : 0
      };
    } catch (error) {
      console.warn(`⚠️ Failed to get stats for ${artistName}:`, error);
      return { listeners: 0, playcount: 0 };
    }
  }

  /**
   * HEALTH CHECK
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; rateLimit?: any }> {
    try {
      // Test simple avec une recherche
      await this.searchArtists('test', 1);
      
      return {
        status: 'healthy',
        rateLimit: {
          requestsPerSecond: this.RATE_LIMIT,
          queueLength: this.requestQueue.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * OBTENIR LES STATISTIQUES D'UTILISATION
   */
  getUsageStats(): { queueLength: number; rateLimit: number; isProcessing: boolean } {
    return {
      queueLength: this.requestQueue.length,
      rateLimit: this.RATE_LIMIT,
      isProcessing: this.isProcessingQueue
    };
  }
}

export function createLastFmClient(): LastFmClient {
  return new LastFmClient();
}

