// Client pour Spotify Web API

import axios, { AxiosInstance } from 'axios';
import { SpotifyArtist } from '@/types/artist';
import { externalAPIs } from '@/lib/config';

export interface SpotifySearchResponse {
  artists: {
    href: string;
    items: SpotifyArtistItem[];
    limit: number;
    next: string | null;
    offset: number;
    previous: string | null;
    total: number;
  };
}

export interface SpotifyArtistItem {
  external_urls: {
    spotify: string;
  };
  followers: {
    href: string | null;
    total: number;
  };
  genres: string[];
  href: string;
  id: string;
  images: Array<{
    height: number;
    url: string;
    width: number;
  }>;
  name: string;
  popularity: number;
  type: 'artist';
  uri: string;
}

export interface SpotifyRelatedArtistsResponse {
  artists: SpotifyArtistItem[];
}

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export class SpotifyClient {
  private client: AxiosInstance;
  private authClient: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    // Client pour les requêtes API
    this.client = axios.create({
      baseURL: externalAPIs.spotify.baseURL,
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0'
      }
    });

    // Client pour l'authentification
    this.authClient = axios.create({
      baseURL: externalAPIs.spotify.authURL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Intercepteur pour ajouter le token d'authentification
    this.client.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      await this.checkRateLimit();
      
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });

    // Intercepteur pour gérer les erreurs
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expiré, on le renouvelle
          this.accessToken = null;
          this.tokenExpiresAt = 0;
          
          // Retry la requête
          const originalRequest = error.config;
          if (!originalRequest._retry) {
            originalRequest._retry = true;
            await this.ensureValidToken();
            originalRequest.headers.Authorization = `Bearer ${this.accessToken}`;
            return this.client.request(originalRequest);
          }
        }
        
        if (error.response?.status === 429) {
          // Rate limit exceeded
          const retryAfter = parseInt(error.response.headers['retry-after'] || '1');
          console.log(`⏳ Spotify rate limit hit, waiting ${retryAfter}s`);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          
          // Retry la requête
          return this.client.request(error.config);
        }
        
        throw error;
      }
    );
  }

  /**
   * Recherche d'artistes par nom
   */
  async searchArtists(query: string, limit: number = 20): Promise<{
    artists: SpotifyArtist[];
    total: number;
  }> {
    try {
      console.log(`🔍 Searching Spotify for artist: "${query}"`);
      
      const response = await this.client.get<SpotifySearchResponse>('/search', {
        params: {
          q: query,
          type: 'artist',
          limit: Math.min(limit, 50),
          market: 'US'
        }
      });

      const artists = response.data.artists.items.map(this.convertToInternalFormat);
      
      console.log(`✅ Found ${artists.length} artists on Spotify`);
      
      return {
        artists,
        total: response.data.artists.total
      };

    } catch (error) {
      console.error('❌ Spotify search error:', error);
      throw new Error(`Spotify search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère un artiste par son ID Spotify
   */
  async getArtist(artistId: string): Promise<SpotifyArtist> {
    try {
      const response = await this.client.get<SpotifyArtistItem>(`/artists/${artistId}`);
      return this.convertToInternalFormat(response.data);
    } catch (error) {
      console.error(`❌ Error fetching Spotify artist ${artistId}:`, error);
      throw new Error(`Failed to fetch artist: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère les artistes similaires (Related Artists)
   */
  async getRelatedArtists(artistId: string): Promise<SpotifyArtist[]> {
    try {
      console.log(`🔗 Getting related artists for Spotify ID: ${artistId}`);
      
      const response = await this.client.get<SpotifyRelatedArtistsResponse>(`/artists/${artistId}/related-artists`);
      
      const relatedArtists = response.data.artists.map(this.convertToInternalFormat);
      
      console.log(`✅ Found ${relatedArtists.length} related artists`);
      
      return relatedArtists;

    } catch (error) {
      console.error(`❌ Error fetching related artists for ${artistId}:`, error);
      throw new Error(`Failed to fetch related artists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recherche d'artistes similaires par nom (combine search + related)
   */
  async findSimilarArtists(artistName: string, limit: number = 20): Promise<{
    mainArtist: SpotifyArtist | null;
    relatedArtists: SpotifyArtist[];
    searchResults: SpotifyArtist[];
  }> {
    try {
      // 1. Rechercher l'artiste principal
      const searchResult = await this.searchArtists(artistName, 1);
      const mainArtist = searchResult.artists[0] || null;

      let relatedArtists: SpotifyArtist[] = [];
      
      // 2. Si trouvé, récupérer les artistes similaires
      if (mainArtist) {
        try {
          relatedArtists = await this.getRelatedArtists(mainArtist.spotify_id);
        } catch (error) {
          console.warn('⚠️ Could not fetch related artists, using search results only');
        }
      }

      // 3. Recherche élargie pour plus de résultats
      const expandedSearch = await this.searchArtists(artistName, limit);
      const searchResults = expandedSearch.artists.filter(artist => 
        artist.spotify_id !== mainArtist?.spotify_id
      );

      return {
        mainArtist,
        relatedArtists,
        searchResults
      };

    } catch (error) {
      console.error(`❌ Error finding similar artists for "${artistName}":`, error);
      throw new Error(`Failed to find similar artists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Recherche d'artistes par genre
   */
  async searchByGenre(genre: string, limit: number = 20): Promise<SpotifyArtist[]> {
    try {
      const query = `genre:"${genre}"`;
      const result = await this.searchArtists(query, limit);
      return result.artists;
    } catch (error) {
      console.error(`❌ Error searching by genre "${genre}":`, error);
      return [];
    }
  }

  /**
   * Récupère plusieurs artistes par leurs IDs
   */
  async getMultipleArtists(artistIds: string[]): Promise<SpotifyArtist[]> {
    if (artistIds.length === 0) return [];

    try {
      // Spotify permet max 50 artistes par requête
      const chunks = this.chunkArray(artistIds, 50);
      const allArtists: SpotifyArtist[] = [];

      for (const chunk of chunks) {
        const response = await this.client.get<{ artists: SpotifyArtistItem[] }>('/artists', {
          params: {
            ids: chunk.join(',')
          }
        });

        const artists = response.data.artists
          .filter(artist => artist !== null)
          .map(this.convertToInternalFormat);
        
        allArtists.push(...artists);
      }

      return allArtists;

    } catch (error) {
      console.error('❌ Error fetching multiple artists:', error);
      throw new Error(`Failed to fetch artists: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Assure qu'on a un token d'accès valide
   */
  private async ensureValidToken(): Promise<void> {
    const now = Date.now();
    const bufferTime = externalAPIs.spotify.tokenExpiryBuffer * 1000; // 5 minutes en ms

    if (!this.accessToken || now >= (this.tokenExpiresAt - bufferTime)) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Renouvelle le token d'accès via Client Credentials Flow
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      console.log('🔄 Refreshing Spotify access token...');
      
      const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      
      const response = await this.authClient.post<SpotifyTokenResponse>('', 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${credentials}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
      
      console.log('✅ Spotify token refreshed successfully');

    } catch (error) {
      console.error('❌ Failed to refresh Spotify token:', error);
      throw new Error('Spotify authentication failed');
    }
  }

  /**
   * Gère le rate limiting
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Reset counter every minute
    if (timeSinceLastRequest > 60000) {
      this.requestCount = 0;
    }

    // Check if we're approaching the limit
    if (this.requestCount >= externalAPIs.spotify.requestsPerMinute) {
      const waitTime = 60000 - timeSinceLastRequest;
      if (waitTime > 0) {
        console.log(`⏳ Spotify rate limit approaching, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        this.requestCount = 0;
      }
    }

    this.requestCount++;
    this.lastRequestTime = now;
  }

  /**
   * Convertit les données Spotify au format interne
   */
  private convertToInternalFormat(spotifyArtist: SpotifyArtistItem): SpotifyArtist {
    return {
      id: spotifyArtist.id,
      name: spotifyArtist.name,
      genres: spotifyArtist.genres,
      popularity: spotifyArtist.popularity,
      images: spotifyArtist.images.map(img => ({
        url: img.url,
        height: img.height,
        width: img.width
      })),
      external_urls: {
        spotify: spotifyArtist.external_urls.spotify
      },
      followers: {
        total: spotifyArtist.followers.total
      },
      spotify_id: spotifyArtist.id,
      uri: spotifyArtist.uri,
      href: spotifyArtist.href,
      type: 'artist'
    };
  }

  /**
   * Divise un tableau en chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Obtient les statistiques d'utilisation
   */
  getUsageStats(): {
    requestCount: number;
    tokenExpiresAt: number;
    hasValidToken: boolean;
  } {
    return {
      requestCount: this.requestCount,
      tokenExpiresAt: this.tokenExpiresAt,
      hasValidToken: this.accessToken !== null && Date.now() < this.tokenExpiresAt
    };
  }
}

