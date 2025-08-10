// Client Spotify Web API - VRAIES APIs COMPLÈTES
// Documentation: https://developer.spotify.com/documentation/web-api

import axios, { AxiosInstance } from 'axios';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

interface SpotifyArtist {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
  followers: {
    total: number;
  };
  images: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  external_urls: {
    spotify: string;
  };
}

interface SpotifySearchResponse {
  artists: {
    href: string;
    items: SpotifyArtist[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  };
}

interface SpotifyRecommendationsResponse {
  tracks: Array<{
    artists: SpotifyArtist[];
    id: string;
    name: string;
    popularity: number;
  }>;
  seeds: Array<{
    afterFilteringSize: number;
    afterRelinkingSize: number;
    href: string;
    id: string;
    initialPoolSize: number;
    type: string;
  }>;
}

interface SpotifyRelatedArtistsResponse {
  artists: SpotifyArtist[];
}

interface SimilarArtist {
  name: string;
  id: string;
  genres: string[];
  popularity: number;
  followers: number;
  similarity_score: number;
  source: 'spotify';
}

/**
 * CLIENT SPOTIFY WEB API - IMPLÉMENTATION COMPLÈTE
 * 
 * HYPOTHÈSES BASÉES SUR LA DOCUMENTATION OFFICIELLE:
 * 1. OAuth Client Credentials Flow pour l'authentification
 * 2. Rate limiting: ~100 requêtes par minute par application
 * 3. search endpoint retourne jusqu'à 50 résultats par page
 * 4. recommendations endpoint utilise des seed artists
 * 5. related-artists endpoint retourne jusqu'à 20 artistes similaires
 * 6. Popularité sur échelle 0-100 (100 = plus populaire)
 */
export class SpotifyClient {
  private client: AxiosInstance;
  private authClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private requestCount: number = 0;
  private lastResetTime: number = Date.now();
  private readonly RATE_LIMIT = 100; // Requêtes par minute

  constructor() {
    // Client pour les requêtes API
    this.client = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      timeout: 30000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0'
      }
    });

    // Client pour l'authentification
    this.authClient = axios.create({
      baseURL: 'https://accounts.spotify.com',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Intercepteur pour ajouter le token d'accès
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });

    // Intercepteur pour gérer les erreurs et rate limiting
    this.client.interceptors.response.use(
      (response) => {
        this.trackRequest();
        return response;
      },
      async (error) => {
        if (error.response?.status === 401) {
          // Token expiré, forcer le renouvellement
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          throw new Error('Spotify authentication failed');
        }
        if (error.response?.status === 429) {
          // Rate limit atteint
          const retryAfter = error.response.headers['retry-after'] || 60;
          throw new Error(`Spotify rate limit exceeded. Retry after ${retryAfter} seconds`);
        }
        throw error;
      }
    );
  }

  /**
   * AUTHENTIFICATION OAUTH CLIENT CREDENTIALS
   * HYPOTHÈSE: Client Credentials Flow selon la doc Spotify
   * FORMAT ATTENDU: { access_token, token_type, expires_in }
   * INFÉRENCE: Token valide pendant expires_in secondes
   */
  private async authenticate(): Promise<void> {
    try {
      console.log('🔐 Authenticating with Spotify...');
      
      const credentials = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');

      const response = await this.authClient.post<SpotifyTokenResponse>('/api/token', 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min de marge
      
      console.log(`✅ Spotify authentication successful. Token expires in ${response.data.expires_in}s`);
    } catch (error) {
      console.error('❌ Spotify authentication failed:', error);
      throw new Error(`Spotify authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * VÉRIFICATION ET RENOUVELLEMENT DU TOKEN
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
  }

  /**
   * TRACKING DES REQUÊTES POUR RATE LIMITING
   * HYPOTHÈSE: Limite de ~100 requêtes par minute
   */
  private trackRequest(): void {
    const now = Date.now();
    
    // Reset du compteur chaque minute
    if (now - this.lastResetTime >= 60000) {
      this.requestCount = 0;
      this.lastResetTime = now;
    }
    
    this.requestCount++;
    
    if (this.requestCount >= this.RATE_LIMIT) {
      console.warn(`⚠️ Approaching Spotify rate limit: ${this.requestCount}/${this.RATE_LIMIT}`);
    }
  }

  /**
   * RECHERCHE D'ARTISTES SPOTIFY
   * HYPOTHÈSE: search endpoint retourne des artistes pertinents
   * FORMAT ATTENDU: { artists: { items: SpotifyArtist[], total: number } }
   * INFÉRENCE: Résultats triés par pertinence par défaut
   */
  async searchArtists(query: string, limit: number = 20): Promise<SpotifyArtist[]> {
    try {
      console.log(`🔍 Spotify Search: "${query}" (${limit} results)`);
      
      const response = await this.client.get<SpotifySearchResponse>('/search', {
        params: {
          q: query,
          type: 'artist',
          limit: Math.min(limit, 50), // Limite API Spotify
          market: 'US' // Focus sur le marché US
        }
      });

      console.log(`✅ Found ${response.data.artists.items.length} artists for "${query}"`);
      return response.data.artists.items;
    } catch (error) {
      console.error(`❌ Spotify search failed for "${query}":`, error);
      throw new Error(`Spotify search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }


  /**
   * OBTENIR DES RECOMMANDATIONS D'ARTISTES
   * HYPOTHÈSE: recommendations endpoint avec seed_artists retourne des tracks d'artistes similaires
   * FORMAT ATTENDU: { tracks: [{ artists: SpotifyArtist[] }] }
   * INFÉRENCE: Extraction des artistes uniques des tracks recommandées
   */
  async getRecommendedArtists(seedArtistIds: string | string[], limit: number = 20): Promise<SpotifyArtist[]> {
    try {
      // ✅ Normaliser l'input en array
      const artistIds = Array.isArray(seedArtistIds) ? seedArtistIds : [seedArtistIds];
      
      console.log(`🎵 Getting recommendations for ${artistIds.length} seed artists: ${artistIds.slice(0, 3).join(', ')}${artistIds.length > 3 ? '...' : ''}`);
      
      const response = await this.client.get<SpotifyRecommendationsResponse>('/recommendations', {
        params: {
          seed_artists: artistIds.slice(0, 5).join(','), // Max 5 seeds selon l'API Spotify
          limit: Math.min(limit, 100), // Limite API
          market: 'US'
        }
      });

      // Extraire les artistes uniques des tracks recommandées
      const artistsMap = new Map<string, SpotifyArtist>();
      
      response.data.tracks.forEach(track => {
        track.artists.forEach(artist => {
          // Éviter les artistes de seed dans les résultats
          if (!artistIds.includes(artist.id) && !artistsMap.has(artist.id)) {
            artistsMap.set(artist.id, artist);
          }
        });
      });

      const uniqueArtists = Array.from(artistsMap.values());
      console.log(`✅ Found ${uniqueArtists.length} unique recommended artists`);
      
      return uniqueArtists;
    } catch (error) {
      console.error(`❌ Failed to get recommendations:`, error);
      throw new Error(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * RECHERCHE D'ARTISTES SIMILAIRES COMPLÈTE
   * ALGORITHME HYBRIDE:
   * 1. Recherche de l'artiste principal
   * 2. Obtention des artistes similaires via related-artists
   * 3. Obtention de recommandations supplémentaires
   * 4. Calcul des scores de similarité basés sur genres et popularité
   * 5. Déduplication et tri par score
   */
  async findSimilarArtists(artistName: string, options: {
    limit?: number;
    minSimilarity?: number;
    includeMetrics?: boolean;
  } = {}): Promise<SimilarArtist[]> {
    const { limit = 10, minSimilarity = 0.3, includeMetrics = true } = options;
    
    try {
      console.log(`🎯 Finding similar artists to: ${artistName}`);
      
      // 1. Rechercher l'artiste principal
      const searchResults = await this.searchArtists(artistName, 5);
      if (searchResults.length === 0) {
        throw new Error(`Artist "${artistName}" not found on Spotify`);
      }
      
      const mainArtist = searchResults[0]; // Prendre le plus pertinent
      console.log(`✅ Found main artist: ${mainArtist.name} (popularity: ${mainArtist.popularity})`);

      
      // 3. Obtenir des recommandations supplémentaires
      const recommendedArtists = await this.getRecommendedArtists([mainArtist.id], 50);
      
      // 4. Combiner et dédupliquer
      const allSimilarArtists = new Map<string, SpotifyArtist>();
      
      recommendedArtists.forEach(artist => allSimilarArtists.set(artist.id, artist));
      
      // Exclure l'artiste principal
      allSimilarArtists.delete(mainArtist.id);
      
      // 5. Calculer les scores de similarité
      const similarArtists: SimilarArtist[] = Array.from(allSimilarArtists.values())
        .map(artist => ({
          name: artist.name,
          id: artist.id,
          genres: artist.genres,
          popularity: artist.popularity,
          followers: artist.followers.total,
          similarity_score: this.calculateSimilarityScore(mainArtist, artist),
          source: 'spotify' as const
        }))
        .filter(artist => artist.similarity_score >= minSimilarity)
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, limit);

      console.log(`✅ Found ${similarArtists.length} similar artists with similarity >= ${minSimilarity}`);
      
      return similarArtists;
    } catch (error) {
      console.error(`❌ Failed to find similar artists for "${artistName}":`, error);
      throw error;
    }
  }

  /**
   * CALCUL DU SCORE DE SIMILARITÉ
   * ALGORITHME BASÉ SUR:
   * 1. Similarité des genres (Jaccard similarity)
   * 2. Proximité de popularité (distance normalisée)
   * 3. Bonus pour les artistes moins populaires (opportunité)
   * 
   * HYPOTHÈSES:
   * - Genres partagés = forte similarité musicale
   * - Popularité similaire = audience similaire
   * - Popularité plus faible = meilleure opportunité
   */
  private calculateSimilarityScore(mainArtist: SpotifyArtist, candidateArtist: SpotifyArtist): number {
    // 1. Similarité des genres (Jaccard)
    const mainGenres = new Set(mainArtist.genres);
    const candidateGenres = new Set(candidateArtist.genres);
    const intersection = new Set([...mainGenres].filter(g => candidateGenres.has(g)));
    const union = new Set([...mainGenres, ...candidateGenres]);
    
    const genreSimilarity = union.size > 0 ? intersection.size / union.size : 0;

    // 2. Proximité de popularité (0-1, 1 = très proche)
    const popularityDiff = Math.abs(mainArtist.popularity - candidateArtist.popularity);
    const popularitySimilarity = Math.max(0, 1 - (popularityDiff / 100));

    // 3. Bonus d'opportunité (artistes moins populaires)
    const opportunityBonus = candidateArtist.popularity < mainArtist.popularity 
      ? (mainArtist.popularity - candidateArtist.popularity) / 200 // Max 0.5 bonus
      : 0;

    // Score composite
    const score = (genreSimilarity * 0.6) + (popularitySimilarity * 0.3) + opportunityBonus;
    
    return Math.min(1, Math.max(0, score));
  }

  /**
   * OBTENIR LES DÉTAILS D'UN ARTISTE
   */
  async getArtistDetails(artistId: string): Promise<SpotifyArtist> {
    try {
      const response = await this.client.get<SpotifyArtist>(`/artists/${artistId}`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to get artist details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * HEALTH CHECK
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; error?: string; rateLimit?: any }> {
    try {
      await this.ensureValidToken();
      
      // Test simple avec une recherche
      await this.searchArtists('test', 1);
      
      return {
        status: 'healthy',
        rateLimit: {
          requestCount: this.requestCount,
          limit: this.RATE_LIMIT,
          resetTime: new Date(this.lastResetTime + 60000).toISOString()
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
  getUsageStats(): { requestCount: number; limit: number; tokenExpiresAt: string } {
    return {
      requestCount: this.requestCount,
      limit: this.RATE_LIMIT,
      tokenExpiresAt: new Date(this.tokenExpiresAt).toISOString()
    };
  }
}

export function createSpotifyClient(): SpotifyClient {
  return new SpotifyClient();
}

