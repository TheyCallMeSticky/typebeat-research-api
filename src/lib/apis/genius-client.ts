// Client pour Genius API

import axios, { AxiosInstance } from 'axios';
import { externalAPIs } from '@/lib/config';

export interface GeniusSearchResponse {
  meta: {
    status: number;
  };
  response: {
    hits: Array<{
      highlights: any[];
      index: string;
      type: string;
      result: {
        annotation_count: number;
        api_path: string;
        artist_names: string;
        full_title: string;
        header_image_thumbnail_url: string;
        header_image_url: string;
        id: number;
        lyrics_owner_id: number;
        lyrics_state: string;
        path: string;
        pyongs_count: number;
        relationships_index_url: string;
        release_date_components: {
          year: number;
          month: number;
          day: number;
        };
        release_date_for_display: string;
        song_art_image_thumbnail_url: string;
        song_art_image_url: string;
        stats: {
          unreviewed_annotations: number;
          concurrents: number;
          hot: boolean;
          pageviews: number;
        };
        title: string;
        title_with_featured: string;
        url: string;
        primary_artist: GeniusArtist;
      };
    }>;
  };
}

export interface GeniusArtist {
  api_path: string;
  header_image_url: string;
  id: number;
  image_url: string;
  is_meme_verified: boolean;
  is_verified: boolean;
  name: string;
  url: string;
  iq?: number;
}

export interface GeniusArtistResponse {
  meta: {
    status: number;
  };
  response: {
    artist: {
      alternate_names: string[];
      api_path: string;
      description: {
        dom: {
          tag: string;
          children: any[];
        };
      };
      facebook_name: string;
      followers_count: number;
      header_image_url: string;
      id: number;
      image_url: string;
      instagram_name: string;
      is_meme_verified: boolean;
      is_verified: boolean;
      name: string;
      twitter_name: string;
      url: string;
      current_user_metadata: {
        permissions: string[];
        excluded_permissions: string[];
        interactions: {
          following: boolean;
        };
      };
    };
  };
}

export interface GeniusArtistSongsResponse {
  meta: {
    status: number;
  };
  response: {
    songs: Array<{
      annotation_count: number;
      api_path: string;
      artist_names: string;
      full_title: string;
      header_image_thumbnail_url: string;
      header_image_url: string;
      id: number;
      lyrics_owner_id: number;
      lyrics_state: string;
      path: string;
      pyongs_count: number;
      release_date_components: {
        year: number;
        month: number;
        day: number;
      };
      release_date_for_display: string;
      song_art_image_thumbnail_url: string;
      song_art_image_url: string;
      stats: {
        unreviewed_annotations: number;
        concurrents: number;
        hot: boolean;
        pageviews: number;
      };
      title: string;
      title_with_featured: string;
      url: string;
      primary_artist: GeniusArtist;
    }>;
    next_page: number | null;
  };
}

export interface GeniusArtistData {
  id: number;
  name: string;
  url: string;
  image_url: string;
  header_image_url: string;
  is_verified: boolean;
  followers_count: number;
  alternate_names: string[];
  description: string;
  social_media: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
  };
  song_count: number;
  popular_songs: Array<{
    id: number;
    title: string;
    url: string;
    pageviews: number;
    release_date: string;
  }>;
}

export class GeniusClient {
  private client: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;

    this.client = axios.create({
      baseURL: externalAPIs.genius.baseURL,
      timeout: 15000, // Timeout plus long pour Genius
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TypeBeat-Research-API/1.0'
      }
    });

    // Intercepteur pour ajouter l'authentification
    this.client.interceptors.request.use(async (config) => {
      await this.checkRateLimit();
      
      // Genius utilise Bearer token dans l'header Authorization
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      
      return config;
    });

    // Intercepteur pour gérer les erreurs
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          console.error('❌ Genius API authentication failed');
          throw new Error('Genius API authentication failed');
        }
        
        if (error.response?.status === 429) {
          console.log('⏳ Genius rate limit hit, waiting...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.client.request(error.config);
        }

        // Genius peut être protégé par Cloudflare
        if (error.response?.status === 403 || error.response?.status === 503) {
          console.warn('⚠️ Genius API blocked (possibly Cloudflare protection)');
          throw new Error('Genius API temporarily unavailable');
        }
        
        throw error;
      }
    );
  }

  /**
   * Configure le token d'accès (si disponible)
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Recherche d'artistes et de chansons
   */
  async search(query: string): Promise<{
    artists: GeniusArtist[];
    songs: Array<{
      id: number;
      title: string;
      artist: string;
      url: string;
      pageviews: number;
    }>;
  }> {
    try {
      console.log(`🔍 Searching Genius for: "${query}"`);
      
      const response = await this.client.get<GeniusSearchResponse>('/search', {
        params: {
          q: query
        }
      });

      if (response.data.meta.status !== 200) {
        throw new Error(`Genius API error: ${response.data.meta.status}`);
      }

      const hits = response.data.response.hits;
      
      // Extraire les artistes uniques
      const artistsMap = new Map<number, GeniusArtist>();
      const songs: Array<{
        id: number;
        title: string;
        artist: string;
        url: string;
        pageviews: number;
      }> = [];

      hits.forEach(hit => {
        const result = hit.result;
        const artist = result.primary_artist;
        
        // Ajouter l'artiste s'il n'est pas déjà présent
        if (!artistsMap.has(artist.id)) {
          artistsMap.set(artist.id, artist);
        }
        
        // Ajouter la chanson
        songs.push({
          id: result.id,
          title: result.title,
          artist: artist.name,
          url: result.url,
          pageviews: result.stats.pageviews || 0
        });
      });

      const artists = Array.from(artistsMap.values());
      
      console.log(`✅ Found ${artists.length} artists and ${songs.length} songs on Genius`);
      
      return { artists, songs };

    } catch (error) {
      console.error(`❌ Genius search error for "${query}":`, error);
      
      // Retourner des résultats vides plutôt que de faire échouer
      if (error instanceof Error && error.message.includes('temporarily unavailable')) {
        return { artists: [], songs: [] };
      }
      
      throw new Error(`Genius search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère les détails d'un artiste
   */
  async getArtist(artistId: number): Promise<GeniusArtistData | null> {
    try {
      console.log(`📋 Getting Genius artist details for ID: ${artistId}`);
      
      const [artistResponse, songsResponse] = await Promise.allSettled([
        this.client.get<GeniusArtistResponse>(`/artists/${artistId}`),
        this.client.get<GeniusArtistSongsResponse>(`/artists/${artistId}/songs`, {
          params: {
            sort: 'popularity',
            per_page: 10
          }
        })
      ]);

      if (artistResponse.status === 'rejected') {
        console.error('❌ Failed to fetch artist details:', artistResponse.reason);
        return null;
      }

      const artist = artistResponse.value.data.response.artist;
      const songs = songsResponse.status === 'fulfilled' 
        ? songsResponse.value.data.response.songs 
        : [];

      // Extraire la description textuelle
      const description = this.extractTextFromDescription(artist.description);

      const artistData: GeniusArtistData = {
        id: artist.id,
        name: artist.name,
        url: artist.url,
        image_url: artist.image_url,
        header_image_url: artist.header_image_url,
        is_verified: artist.is_verified,
        followers_count: artist.followers_count || 0,
        alternate_names: artist.alternate_names || [],
        description,
        social_media: {
          facebook: artist.facebook_name || undefined,
          instagram: artist.instagram_name || undefined,
          twitter: artist.twitter_name || undefined
        },
        song_count: songs.length,
        popular_songs: songs.map(song => ({
          id: song.id,
          title: song.title,
          url: song.url,
          pageviews: song.stats.pageviews || 0,
          release_date: song.release_date_for_display || ''
        }))
      };

      console.log(`✅ Retrieved Genius artist data for "${artist.name}"`);
      
      return artistData;

    } catch (error) {
      console.error(`❌ Genius artist details error for ID ${artistId}:`, error);
      return null;
    }
  }

  /**
   * Recherche spécifique d'un artiste par nom
   */
  async findArtist(artistName: string): Promise<GeniusArtistData | null> {
    try {
      const searchResult = await this.search(artistName);
      
      // Chercher l'artiste avec le nom le plus proche
      const exactMatch = searchResult.artists.find(artist => 
        artist.name.toLowerCase() === artistName.toLowerCase()
      );
      
      if (exactMatch) {
        return await this.getArtist(exactMatch.id);
      }
      
      // Si pas de correspondance exacte, prendre le premier résultat
      if (searchResult.artists.length > 0) {
        return await this.getArtist(searchResult.artists[0].id);
      }
      
      return null;

    } catch (error) {
      console.error(`❌ Genius find artist error for "${artistName}":`, error);
      return null;
    }
  }

  /**
   * Analyse la popularité d'un artiste basée sur les vues de ses chansons
   */
  async analyzeArtistPopularity(artistName: string): Promise<{
    artist: string;
    totalPageviews: number;
    averagePageviews: number;
    topSongs: Array<{
      title: string;
      pageviews: number;
      url: string;
    }>;
    popularityScore: number; // 0-100
  } | null> {
    try {
      const artistData = await this.findArtist(artistName);
      
      if (!artistData) {
        return null;
      }

      const totalPageviews = artistData.popular_songs.reduce(
        (sum, song) => sum + song.pageviews, 0
      );
      
      const averagePageviews = artistData.popular_songs.length > 0 
        ? totalPageviews / artistData.popular_songs.length 
        : 0;

      const topSongs = artistData.popular_songs
        .sort((a, b) => b.pageviews - a.pageviews)
        .slice(0, 5)
        .map(song => ({
          title: song.title,
          pageviews: song.pageviews,
          url: song.url
        }));

      // Score de popularité basé sur les vues (logarithmique)
      const popularityScore = Math.min(
        100, 
        Math.log10(Math.max(1, averagePageviews)) * 10
      );

      return {
        artist: artistData.name,
        totalPageviews,
        averagePageviews: Math.round(averagePageviews),
        topSongs,
        popularityScore: Math.round(popularityScore)
      };

    } catch (error) {
      console.error(`❌ Genius popularity analysis error for "${artistName}":`, error);
      return null;
    }
  }

  /**
   * Gère le rate limiting (conservateur pour Genius)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    // Attendre au moins 500ms entre les requêtes
    const minInterval = 500;
    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`⏳ Genius rate limiting, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Extrait le texte de la description Genius (format DOM)
   */
  private extractTextFromDescription(description: any): string {
    try {
      if (!description || !description.dom) {
        return '';
      }
      
      // Fonction récursive pour extraire le texte des nœuds DOM
      const extractText = (node: any): string => {
        if (typeof node === 'string') {
          return node;
        }
        
        if (node.children && Array.isArray(node.children)) {
          return node.children.map(extractText).join(' ');
        }
        
        return '';
      };
      
      return extractText(description.dom).trim();
      
    } catch (error) {
      console.warn('⚠️ Could not extract description text:', error);
      return '';
    }
  }

  /**
   * Vérifie si l'API Genius est disponible
   */
  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.get('/search', {
        params: { q: 'test' },
        timeout: 5000
      });
      return true;
    } catch (error) {
      console.warn('⚠️ Genius API not available:', error);
      return false;
    }
  }

  /**
   * Obtient les statistiques d'utilisation
   */
  getUsageStats(): {
    requestCount: number;
    lastRequestTime: number;
    hasAccessToken: boolean;
  } {
    return {
      requestCount: this.requestCount,
      lastRequestTime: this.lastRequestTime,
      hasAccessToken: this.accessToken !== null
    };
  }
}

