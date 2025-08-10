// Client Genius API - VRAIES APIs COMPLÈTES
// Documentation: https://docs.genius.com/

import axios, { AxiosInstance } from 'axios';

interface GeniusSearchResponse {
  meta: {
    status: number;
  };
  response: {
    hits: Array<{
      type: string;
      result: {
        id: number;
        title: string;
        primary_artist: GeniusArtist;
        stats: {
          pageviews?: number;
          hot?: boolean;
        };
      };
    }>;
  };
}

interface GeniusArtist {
  id: number;
  name: string;
  url: string;
  image_url: string;
  is_verified?: boolean;
  iq?: number;
  stats?: {
    followers_count?: number;
    following_count?: number;
  };
  description?: {
    plain?: string;
  };
}

interface GeniusArtistResponse {
  meta: {
    status: number;
  };
  response: {
    artist: GeniusArtist;
  };
}

interface GeniusArtistSongsResponse {
  meta: {
    status: number;
  };
  response: {
    songs: Array<{
      id: number;
      title: string;
      stats: {
        pageviews?: number;
        hot?: boolean;
      };
      primary_artist: {
        id: number;
        name: string;
      };
    }>;
    next_page?: number;
  };
}

interface GeniusArtistMetrics {
  name: string;
  id: number;
  followers: number;
  total_pageviews: number;
  hot_songs_count: number;
  verified: boolean;
  popularity_score: number;
  url: string;
}

/**
 * CLIENT GENIUS API - IMPLÉMENTATION COMPLÈTE
 * 
 * HYPOTHÈSES BASÉES SUR LA DOCUMENTATION OFFICIELLE:
 * 1. Rate limiting: Non documenté précisément, estimation ~60 req/min
 * 2. search endpoint retourne hits avec primary_artist
 * 3. artists/{id} retourne détails complets de l'artiste
 * 4. artists/{id}/songs retourne chansons avec stats pageviews
 * 5. Cloudflare peut bloquer certaines requêtes (gestion d'erreurs)
 * 6. pageviews reflètent la popularité sur Genius
 */
export class GeniusClient {
  private client: AxiosInstance;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();
  private readonly RATE_LIMIT = 60; // Estimation: 60 requêtes par minute
  private readonly CLOUDFLARE_RETRY_DELAY = 2000; // 2 secondes

  constructor() {
    this.client = axios.create({
      baseURL: 'https://api.genius.com',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0',
        'Authorization': `Bearer ${process.env.GENIUS_ACCESS_TOKEN}`
      }
    });

    // Intercepteur pour gérer les erreurs et Cloudflare
    this.client.interceptors.response.use(
      (response) => {
        this.trackRequest();
        return response;
      },
      async (error) => {
        // Gestion des erreurs Cloudflare
        if (error.response?.status === 403 || error.response?.status === 503) {
          console.warn('⚠️ Genius API blocked by Cloudflare, retrying...');
          await new Promise(resolve => setTimeout(resolve, this.CLOUDFLARE_RETRY_DELAY));
          throw new Error('Genius API temporarily unavailable (Cloudflare protection)');
        }
        
        if (error.response?.status === 401) {
          throw new Error('Genius API authentication failed - check access token');
        }
        
        if (error.response?.status === 429) {
          throw new Error('Genius API rate limit exceeded');
        }
        
        throw error;
      }
    );
  }

  /**
   * TRACKING DES REQUÊTES POUR RATE LIMITING
   * HYPOTHÈSE: Limite estimée à 60 requêtes par minute
   */
  private trackRequest(): void {
    const now = Date.now();
    
    // Reset du compteur chaque minute
    if (now - this.lastResetTime >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    this.requestCount++;
    
    if (this.requestCount >= this.RATE_LIMIT * 0.8) {
      console.warn(`⚠️ Approaching Genius rate limit: ${this.requestCount}/${this.RATE_LIMIT}`);
    }
  }

  /**
   * RECHERCHE D'ARTISTES GENIUS
   * HYPOTHÈSE: search endpoint retourne des hits avec primary_artist
   * FORMAT ATTENDU: { response: { hits: [{ result: { primary_artist } }] } }
   * INFÉRENCE: Filtrage par type "song" pour obtenir les artistes
   */
  async searchArtists(query: string): Promise<GeniusArtist[]> {
    try {
      console.log(`🔍 Genius Search: "${query}"`);
      
      const response = await this.client.get<GeniusSearchResponse>('/search', {
        params: {
          q: query
        }
      });

      if (response.data.meta.status !== 200) {
        throw new Error(`Genius API error: ${response.data.meta.status}`);
      }

      // Extraire les artistes uniques des résultats
      const artistsMap = new Map<number, GeniusArtist>();
      
      response.data.response.hits.forEach(hit => {
        if (hit.result.primary_artist) {
          const artist = hit.result.primary_artist;
          if (!artistsMap.has(artist.id)) {
            artistsMap.set(artist.id, artist);
          }
        }
      });

      const uniqueArtists = Array.from(artistsMap.values());
      console.log(`✅ Found ${uniqueArtists.length} unique artists for "${query}"`);
      
      return uniqueArtists;
    } catch (error) {
      console.error(`❌ Genius search failed for "${query}":`, error);
      throw new Error(`Genius search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * OBTENIR LES DÉTAILS D'UN ARTISTE
   * HYPOTHÈSE: artists/{id} retourne détails complets avec stats
   * FORMAT ATTENDU: { response: { artist: { stats, description } } }
   * INFÉRENCE: followers_count peut être absent
   */
  async getArtistDetails(artistId: number): Promise<GeniusArtist> {
    try {
      console.log(`📊 Getting Genius details for artist ID: ${artistId}`);
      
      const response = await this.client.get<GeniusArtistResponse>(`/artists/${artistId}`);

      if (response.data.meta.status !== 200) {
        throw new Error(`Genius API error: ${response.data.meta.status}`);
      }

      console.log(`✅ Retrieved details for artist ${response.data.response.artist.name}`);
      return response.data.response.artist;
    } catch (error) {
      console.error(`❌ Failed to get Genius details for artist ${artistId}:`, error);
      throw new Error(`Failed to get artist details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * OBTENIR LES CHANSONS D'UN ARTISTE AVEC STATISTIQUES
   * HYPOTHÈSE: artists/{id}/songs retourne chansons avec pageviews
   * FORMAT ATTENDU: { response: { songs: [{ stats: { pageviews } }] } }
   * INFÉRENCE: pageviews reflètent la popularité, hot indique tendance
   */
  async getArtistSongs(artistId: number, limit: number = 20): Promise<GeniusArtistSongsResponse['response']['songs']> {
    try {
      console.log(`🎵 Getting songs for artist ID: ${artistId} (${limit} songs)`);
      
      const response = await this.client.get<GeniusArtistSongsResponse>(`/artists/${artistId}/songs`, {
        params: {
          per_page: Math.min(limit, 50), // Limite API Genius
          sort: 'popularity' // Trier par popularité
        }
      });

      if (response.data.meta.status !== 200) {
        throw new Error(`Genius API error: ${response.data.meta.status}`);
      }

      console.log(`✅ Retrieved ${response.data.response.songs.length} songs`);
      return response.data.response.songs;
    } catch (error) {
      console.error(`❌ Failed to get songs for artist ${artistId}:`, error);
      throw new Error(`Failed to get artist songs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * ANALYSER LES MÉTRIQUES COMPLÈTES D'UN ARTISTE
   * ALGORITHME:
   * 1. Recherche de l'artiste par nom
   * 2. Obtention des détails complets
   * 3. Récupération des chansons populaires
   * 4. Calcul des métriques agrégées (pageviews totales, hot songs)
   * 5. Calcul d'un score de popularité composite
   */
  async analyzeArtistMetrics(artistName: string): Promise<GeniusArtistMetrics | null> {
    try {
      console.log(`🎯 Analyzing Genius metrics for: ${artistName}`);
      
      // 1. Rechercher l'artiste
      const searchResults = await this.searchArtists(artistName);
      if (searchResults.length === 0) {
        console.log(`⚠️ Artist "${artistName}" not found on Genius`);
        return null;
      }

      // Prendre le premier résultat (plus pertinent)
      const artist = searchResults[0];
      
      // 2. Obtenir les détails complets
      let detailedArtist: GeniusArtist;
      try {
        detailedArtist = await this.getArtistDetails(artist.id);
      } catch (error) {
        console.warn(`⚠️ Failed to get detailed info, using search result`);
        detailedArtist = artist;
      }

      // 3. Obtenir les chansons populaires
      let songs: GeniusArtistSongsResponse['response']['songs'] = [];
      try {
        songs = await this.getArtistSongs(artist.id, 50);
      } catch (error) {
        console.warn(`⚠️ Failed to get songs for ${artistName}`);
      }

      // 4. Calculer les métriques agrégées
      const totalPageviews = songs.reduce((sum, song) => {
        return sum + (song.stats?.pageviews || 0);
      }, 0);

      const hotSongsCount = songs.filter(song => song.stats?.hot).length;

      // 5. Calculer le score de popularité composite
      const popularityScore = this.calculatePopularityScore({
        followers: detailedArtist.stats?.followers_count || 0,
        totalPageviews,
        hotSongsCount,
        songsCount: songs.length,
        verified: detailedArtist.is_verified || false
      });

      const metrics: GeniusArtistMetrics = {
        name: detailedArtist.name,
        id: detailedArtist.id,
        followers: detailedArtist.stats?.followers_count || 0,
        total_pageviews: totalPageviews,
        hot_songs_count: hotSongsCount,
        verified: detailedArtist.is_verified || false,
        popularity_score: popularityScore,
        url: detailedArtist.url
      };

      console.log(`✅ Analysis completed for ${artistName}:`, {
        followers: metrics.followers,
        pageviews: metrics.total_pageviews,
        hotSongs: metrics.hot_songs_count,
        score: metrics.popularity_score
      });

      return metrics;
    } catch (error) {
      console.error(`❌ Failed to analyze ${artistName} on Genius:`, error);
      
      // Retourner null au lieu de throw pour permettre le fallback gracieux
      return null;
    }
  }

  /**
   * CALCUL DU SCORE DE POPULARITÉ GENIUS
   * ALGORITHME COMPOSITE:
   * 1. Followers (normalisé sur 100k)
   * 2. Pageviews totales (normalisé sur 10M)
   * 3. Ratio de hot songs
   * 4. Bonus pour artistes vérifiés
   * 
   * HYPOTHÈSES:
   * - 100k followers = très populaire sur Genius
   * - 10M pageviews = très populaire
   * - Hot songs indiquent tendance actuelle
   * - Vérification = légitimité
   */
  private calculatePopularityScore(metrics: {
    followers: number;
    totalPageviews: number;
    hotSongsCount: number;
    songsCount: number;
    verified: boolean;
  }): number {
    const { followers, totalPageviews, hotSongsCount, songsCount, verified } = metrics;

    // Normalisation des métriques (0-1)
    const followersScore = Math.min(1, followers / 100000); // 100k = score max
    const pageviewsScore = Math.min(1, totalPageviews / 10000000); // 10M = score max
    const hotRatio = songsCount > 0 ? hotSongsCount / songsCount : 0;
    const verifiedBonus = verified ? 0.1 : 0;

    // Score composite (0-10)
    const score = (
      followersScore * 3 +
      pageviewsScore * 4 +
      hotRatio * 2 +
      verifiedBonus
    ) * (10 / 9.1); // Normalisation sur 10

    return Math.min(10, Math.max(0, score));
  }

  /**
   * RECHERCHE SIMPLE D'UN ARTISTE AVEC FALLBACK
   * Méthode simplifiée pour les cas où seules les infos de base sont nécessaires
   */
  async findArtist(artistName: string): Promise<GeniusArtist | null> {
    try {
      const artists = await this.searchArtists(artistName);
      return artists.length > 0 ? artists[0] : null;
    } catch (error) {
      console.warn(`⚠️ Genius search failed for ${artistName}, returning null`);
      return null;
    }
  }

  /**
   * HEALTH CHECK AVEC GESTION CLOUDFLARE
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; rateLimit?: any; cloudflare_blocked?: boolean }> {
    try {
      // Test simple avec une recherche
      await this.searchArtists('test');
      
      return {
        status: 'healthy',
        rateLimit: {
          requestCount: this.requestCount,
          limit: this.RATE_LIMIT,
          resetTime: new Date(this.lastResetTime + 60000).toISOString()
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Distinguer les erreurs Cloudflare des autres
      const isCloudflareError = errorMessage.includes('Cloudflare') || errorMessage.includes('temporarily unavailable');
      
      return {
        status: 'unhealthy',
        error: errorMessage,
        cloudflare_blocked: isCloudflareError
      };
    }
  }

  /**
   * OBTENIR LES STATISTIQUES D'UTILISATION
   */
  getUsageStats(): { requestCount: number; limit: number; resetTime: string } {
    return {
      requestCount: this.requestCount,
      limit: this.RATE_LIMIT,
      resetTime: new Date(this.lastResetTime + 60000).toISOString()
    };
  }

  /**
   * VÉRIFIER LA DISPONIBILITÉ (SANS COMPTER DANS LE RATE LIMIT)
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Test très simple sans utiliser de quota
      const response = await axios.get('https://api.genius.com', {
        timeout: 5000,
        headers: {
          'User-Agent': 'TypeBeat-Research-API/1.0'
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

export function createGeniusClient(): GeniusClient {
  return new GeniusClient();
}

