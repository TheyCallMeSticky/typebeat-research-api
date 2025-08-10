// Client pour Last.fm API

import axios, { AxiosInstance } from 'axios';
import { LastFmArtist } from '@/types/artist';
import { externalAPIs } from '@/lib/config';

export interface LastFmSimilarArtistsResponse {
  similarartists: {
    artist: LastFmArtistItem[];
    '@attr': {
      artist: string;
    };
  };
}

export interface LastFmArtistItem {
  name: string;
  mbid: string;
  match: string; // Score de similarité en string (ex: "0.85")
  url: string;
  image: Array<{
    '#text': string;
    size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
  }>;
  streamable: string; // "0" ou "1"
}

export interface LastFmArtistInfoResponse {
  artist: {
    name: string;
    mbid: string;
    url: string;
    image: Array<{
      '#text': string;
      size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega';
    }>;
    streamable: string;
    ontour: string;
    stats: {
      listeners: string;
      playcount: string;
    };
    similar: {
      artist: LastFmArtistItem[];
    };
    tags: {
      tag: Array<{
        name: string;
        url: string;
      }>;
    };
    bio: {
      links: {
        link: {
          '#text': string;
          rel: string;
          href: string;
        };
      };
      published: string;
      summary: string;
      content: string;
    };
  };
}

export interface LastFmTopTagsResponse {
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

export class LastFmClient {
  private client: AxiosInstance;
  private apiKey: string;
  private requestCount: number = 0;
  private lastRequestTime: number = 0;
  private requestTimes: number[] = [];

  constructor(apiKey: string) {
    this.apiKey = apiKey;

    this.client = axios.create({
      baseURL: externalAPIs.lastfm.baseURL,
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
        if (error.response?.status === 429) {
          console.log('⏳ Last.fm rate limit hit, waiting...');
          // Last.fm ne fournit pas toujours de header Retry-After
          return new Promise(resolve => {
            setTimeout(() => {
              resolve(this.client.request(error.config));
            }, 1000);
          });
        }
        throw error;
      }
    );
  }

  /**
   * Récupère les artistes similaires avec scores de similarité
   */
  async getSimilarArtists(artistName: string, limit: number = 20): Promise<{
    similarArtists: LastFmArtist[];
    sourceArtist: string;
  }> {
    try {
      console.log(`🔍 Getting Last.fm similar artists for: "${artistName}"`);
      
      const response = await this.client.get<LastFmSimilarArtistsResponse>('', {
        params: {
          method: 'artist.getsimilar',
          artist: artistName,
          api_key: this.apiKey,
          format: 'json',
          limit: Math.min(limit, 100)
        }
      });

      if (!response.data.similarartists?.artist) {
        console.log(`⚠️ No similar artists found for "${artistName}"`);
        return {
          similarArtists: [],
          sourceArtist: artistName
        };
      }

      const similarArtists = response.data.similarartists.artist.map(this.convertToInternalFormat);
      
      console.log(`✅ Found ${similarArtists.length} similar artists on Last.fm`);
      
      return {
        similarArtists,
        sourceArtist: response.data.similarartists['@attr'].artist
      };

    } catch (error) {
      console.error(`❌ Last.fm similar artists error for "${artistName}":`, error);
      throw new Error(`Last.fm similar artists failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Récupère les informations détaillées d'un artiste
   */
  async getArtistInfo(artistName: string): Promise<{
    artist: LastFmArtist;
    tags: string[];
    stats: { listeners: number; playcount: number };
    bio: string;
  } | null> {
    try {
      console.log(`📋 Getting Last.fm artist info for: "${artistName}"`);
      
      const response = await this.client.get<LastFmArtistInfoResponse>('', {
        params: {
          method: 'artist.getinfo',
          artist: artistName,
          api_key: this.apiKey,
          format: 'json'
        }
      });

      if (!response.data.artist) {
        return null;
      }

      const artistData = response.data.artist;
      
      const artist = this.convertToInternalFormat({
        name: artistData.name,
        mbid: artistData.mbid,
        match: '1.0', // Score parfait pour l'artiste lui-même
        url: artistData.url,
        image: artistData.image,
        streamable: artistData.streamable
      });

      const tags = artistData.tags?.tag?.map(tag => tag.name) || [];
      
      const stats = {
        listeners: parseInt(artistData.stats.listeners) || 0,
        playcount: parseInt(artistData.stats.playcount) || 0
      };

      const bio = artistData.bio?.summary || '';

      return {
        artist,
        tags,
        stats,
        bio
      };

    } catch (error) {
      console.error(`❌ Last.fm artist info error for "${artistName}":`, error);
      return null;
    }
  }

  /**
   * Récupère les tags principaux d'un artiste
   */
  async getArtistTags(artistName: string, limit: number = 10): Promise<Array<{
    name: string;
    count: number;
    url: string;
  }>> {
    try {
      const response = await this.client.get<LastFmTopTagsResponse>('', {
        params: {
          method: 'artist.gettoptags',
          artist: artistName,
          api_key: this.apiKey,
          format: 'json'
        }
      });

      if (!response.data.toptags?.tag) {
        return [];
      }

      return response.data.toptags.tag
        .slice(0, limit)
        .map(tag => ({
          name: tag.name,
          count: tag.count,
          url: tag.url
        }));

    } catch (error) {
      console.error(`❌ Last.fm tags error for "${artistName}":`, error);
      return [];
    }
  }

  /**
   * Recherche d'artistes par nom
   */
  async searchArtists(query: string, limit: number = 20): Promise<LastFmArtist[]> {
    try {
      console.log(`🔍 Searching Last.fm for: "${query}"`);
      
      const response = await this.client.get('', {
        params: {
          method: 'artist.search',
          artist: query,
          api_key: this.apiKey,
          format: 'json',
          limit: Math.min(limit, 50)
        }
      });

      const artists = response.data.results?.artistmatches?.artist || [];
      
      if (!Array.isArray(artists)) {
        return [];
      }

      const convertedArtists = artists.map((artist: any) => 
        this.convertToInternalFormat({
          name: artist.name,
          mbid: artist.mbid || '',
          match: '0.5', // Score par défaut pour les résultats de recherche
          url: artist.url,
          image: artist.image || [],
          streamable: artist.streamable || '0'
        })
      );

      console.log(`✅ Found ${convertedArtists.length} artists on Last.fm`);
      
      return convertedArtists;

    } catch (error) {
      console.error(`❌ Last.fm search error for "${query}":`, error);
      return [];
    }
  }

  /**
   * Analyse complète d'un artiste (info + similaires + tags)
   */
  async analyzeArtist(artistName: string): Promise<{
    artistInfo: LastFmArtist | null;
    similarArtists: LastFmArtist[];
    tags: string[];
    stats: { listeners: number; playcount: number } | null;
  }> {
    try {
      // Récupération en parallèle des différentes données
      const [artistInfoResult, similarArtistsResult, tagsResult] = await Promise.allSettled([
        this.getArtistInfo(artistName),
        this.getSimilarArtists(artistName, 20),
        this.getArtistTags(artistName, 15)
      ]);

      const artistInfo = artistInfoResult.status === 'fulfilled' ? artistInfoResult.value : null;
      const similarArtists = similarArtistsResult.status === 'fulfilled' ? similarArtistsResult.value.similarArtists : [];
      const tags = tagsResult.status === 'fulfilled' ? tagsResult.value.map(tag => tag.name) : [];

      return {
        artistInfo: artistInfo?.artist || null,
        similarArtists,
        tags,
        stats: artistInfo?.stats || null
      };

    } catch (error) {
      console.error(`❌ Last.fm analyze artist error for "${artistName}":`, error);
      return {
        artistInfo: null,
        similarArtists: [],
        tags: [],
        stats: null
      };
    }
  }

  /**
   * Gère le rate limiting (5 requêtes par seconde)
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    
    // Nettoyer les requêtes anciennes (plus d'1 seconde)
    this.requestTimes = this.requestTimes.filter(time => now - time < 1000);
    
    // Si on a déjà 5 requêtes dans la dernière seconde, attendre
    if (this.requestTimes.length >= externalAPIs.lastfm.requestsPerSecond) {
      const oldestRequest = Math.min(...this.requestTimes);
      const waitTime = 1000 - (now - oldestRequest);
      
      if (waitTime > 0) {
        console.log(`⏳ Last.fm rate limit, waiting ${waitTime}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Enregistrer cette requête
    this.requestTimes.push(now);
  }

  /**
   * Convertit les données Last.fm au format interne
   */
  private convertToInternalFormat(lastfmArtist: LastFmArtistItem): LastFmArtist {
    return {
      name: lastfmArtist.name,
      mbid: lastfmArtist.mbid || undefined,
      match: parseFloat(lastfmArtist.match) || 0,
      url: lastfmArtist.url,
      image: lastfmArtist.image.map(img => ({
        url: img['#text'],
        size: img.size
      })),
      streamable: lastfmArtist.streamable === '1'
    };
  }

  /**
   * Obtient les statistiques d'utilisation
   */
  getUsageStats(): {
    requestsInLastSecond: number;
    totalRequests: number;
    averageRequestsPerSecond: number;
  } {
    const now = Date.now();
    const recentRequests = this.requestTimes.filter(time => now - time < 1000);
    
    return {
      requestsInLastSecond: recentRequests.length,
      totalRequests: this.requestCount,
      averageRequestsPerSecond: this.requestTimes.length
    };
  }

  /**
   * Calcule le score de similarité moyen pour un groupe d'artistes
   */
  calculateAverageSimilarity(artists: LastFmArtist[]): number {
    if (artists.length === 0) return 0;
    
    const totalMatch = artists.reduce((sum, artist) => sum + artist.match, 0);
    return totalMatch / artists.length;
  }

  /**
   * Filtre les artistes par score de similarité minimum
   */
  filterBySimilarity(artists: LastFmArtist[], minScore: number = 0.3): LastFmArtist[] {
    return artists.filter(artist => artist.match >= minScore);
  }

  /**
   * Trie les artistes par score de similarité décroissant
   */
  sortBySimilarity(artists: LastFmArtist[]): LastFmArtist[] {
    return [...artists].sort((a, b) => b.match - a.match);
  }
}

