// Client Redis pour le cache intelligent

import Redis from 'ioredis';

export interface CacheConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  defaultTTL: number; // en secondes
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  version: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalKeys: number;
}

export class RedisClient {
  private client: Redis;
  private config: CacheConfig;
  private stats: CacheStats;
  private isConnected: boolean = false;

  // TTL par type de données (en secondes)
  private readonly TTL_PRESETS = {
    // APIs externes
    youtube_search: 3600,        // 1 heure
    youtube_video_details: 7200, // 2 heures
    spotify_artist: 86400,       // 24 heures
    spotify_related: 43200,      // 12 heures
    lastfm_similar: 21600,       // 6 heures
    lastfm_artist_info: 86400,   // 24 heures
    genius_artist: 172800,       // 48 heures
    
    // Calculs et scores
    artist_analysis: 1800,       // 30 minutes
    similarity_metrics: 3600,    // 1 heure
    volume_metrics: 1800,        // 30 minutes
    competition_metrics: 3600,   // 1 heure
    trend_metrics: 900,          // 15 minutes
    
    // Résultats finaux
    suggestions: 600,            // 10 minutes
    artist_suggestions: 1200,    // 20 minutes
    
    // Métadonnées
    api_quotas: 86400,          // 24 heures
    rate_limits: 3600,          // 1 heure
    
    // Données de session
    user_session: 1800,         // 30 minutes
    search_history: 604800      // 7 jours
  };

  constructor(config: CacheConfig) {
    this.config = config;
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalKeys: 0
    };

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      keyPrefix: config.keyPrefix,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000
    });

    this.setupEventHandlers();
  }

  /**
   * Initialise la connexion Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection failed:', error);
      throw new Error('Failed to connect to Redis');
    }
  }

  /**
   * Ferme la connexion Redis
   */
  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      console.log('🔌 Redis disconnected');
    }
  }

  /**
   * Récupère une valeur du cache
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache get');
        this.stats.misses++;
        return null;
      }

      const cached = await this.client.get(key);
      
      if (!cached) {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(cached);
      
      // Vérifier si l'entrée n'a pas expiré
      const now = Date.now();
      if (now > entry.timestamp + (entry.ttl * 1000)) {
        await this.delete(key);
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }

      this.stats.hits++;
      this.updateHitRate();
      return entry.data;

    } catch (error) {
      console.error(`❌ Redis get error for key "${key}":`, error);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }
  }

  /**
   * Stocke une valeur dans le cache
   */
  async set<T = any>(
    key: string, 
    value: T, 
    ttl?: number,
    dataType?: keyof typeof this.TTL_PRESETS
  ): Promise<boolean> {
    try {
      if (!this.isConnected) {
        console.warn('⚠️ Redis not connected, skipping cache set');
        return false;
      }

      // Déterminer le TTL
      const finalTTL = ttl || 
                      (dataType ? this.TTL_PRESETS[dataType] : undefined) || 
                      this.config.defaultTTL;

      const entry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl: finalTTL,
        version: '1.0'
      };

      const serialized = JSON.stringify(entry);
      await this.client.setex(key, finalTTL, serialized);
      
      this.stats.sets++;
      return true;

    } catch (error) {
      console.error(`❌ Redis set error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Alias pour set avec TTL explicite
   */
  async setWithTTL<T = any>(key: string, value: T, ttl: number): Promise<boolean> {
    return this.set(key, value, ttl);
  }

  /**
   * Test de connexion Redis
   */
  async ping(): Promise<string> {
    try {
      return await this.client.ping();
    } catch (error) {
      throw new Error(`Redis ping failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Supprime une clé du cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.del(key);
      
      if (result > 0) {
        this.stats.deletes++;
        return true;
      }
      
      return false;

    } catch (error) {
      console.error(`❌ Redis delete error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Supprime toutes les clés correspondant à un pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(...keys);
      this.stats.deletes += result;
      
      console.log(`🗑️ Deleted ${result} keys matching pattern "${pattern}"`);
      return result;

    } catch (error) {
      console.error(`❌ Redis delete pattern error for "${pattern}":`, error);
      return 0;
    }
  }

  /**
   * Vérifie si une clé existe
   */
  async exists(key: string): Promise<boolean> {
    try {
      if (!this.isConnected) {
        return false;
      }

      const result = await this.client.exists(key);
      return result === 1;

    } catch (error) {
      console.error(`❌ Redis exists error for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Récupère ou calcule une valeur (pattern cache-aside)
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    ttl?: number,
    dataType?: keyof typeof this.TTL_PRESETS
  ): Promise<T> {
    // Essayer de récupérer du cache
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    // Calculer la valeur
    const value = await factory();
    
    // Stocker dans le cache
    await this.set(key, value, ttl, dataType);
    
    return value;
  }

  /**
   * Stockage en lot (batch)
   */
  async setBatch<T = any>(
    entries: Array<{
      key: string;
      value: T;
      ttl?: number;
      dataType?: keyof RedisClient['TTL_PRESETS'];
    }>
  ): Promise<number> {
    if (!this.isConnected || entries.length === 0) {
      return 0;
    }

    try {
      const pipeline = this.client.pipeline();
      
      entries.forEach(({ key, value, ttl, dataType }) => {
        const finalTTL = ttl || 
                        (dataType ? this.TTL_PRESETS[dataType] : undefined) || 
                        this.config.defaultTTL;

        const entry: CacheEntry<T> = {
          data: value,
          timestamp: Date.now(),
          ttl: finalTTL,
          version: '1.0'
        };

        pipeline.setex(key, finalTTL, JSON.stringify(entry));
      });

      const results = await pipeline.exec();
      const successCount = results?.filter(([err]) => !err).length || 0;
      
      this.stats.sets += successCount;
      
      console.log(`📦 Batch set: ${successCount}/${entries.length} successful`);
      return successCount;

    } catch (error) {
      console.error('❌ Redis batch set error:', error);
      return 0;
    }
  }

  /**
   * Récupération en lot (batch)
   */
  async getBatch<T = any>(keys: string[]): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    
    if (!this.isConnected || keys.length === 0) {
      return results;
    }

    try {
      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.get(key));
      
      const responses = await pipeline.exec();
      
      if (!responses) {
        return results;
      }

      responses.forEach(([err, value], index) => {
        if (!err && value) {
          try {
            const entry: CacheEntry<T> = JSON.parse(value as string);
            const now = Date.now();
            
            // Vérifier l'expiration
            if (now <= entry.timestamp + (entry.ttl * 1000)) {
              results.set(keys[index], entry.data);
              this.stats.hits++;
            } else {
              this.stats.misses++;
            }
          } catch (parseError) {
            this.stats.misses++;
          }
        } else {
          this.stats.misses++;
        }
      });

      this.updateHitRate();
      
      console.log(`📦 Batch get: ${results.size}/${keys.length} found`);
      return results;

    } catch (error) {
      console.error('❌ Redis batch get error:', error);
      return results;
    }
  }

  /**
   * Génère une clé de cache standardisée
   */
  generateKey(type: string, ...parts: (string | number)[]): string {
    const cleanParts = parts.map(part => 
      String(part).toLowerCase().replace(/[^a-z0-9]/g, '_')
    );
    return `${type}:${cleanParts.join(':')}`;
  }

  /**
   * Nettoie le cache (supprime les entrées expirées)
   */
  async cleanup(): Promise<number> {
    try {
      if (!this.isConnected) {
        return 0;
      }

      console.log('🧹 Starting cache cleanup...');
      
      const keys = await this.client.keys('*');
      let deletedCount = 0;
      
      // Traiter par batch pour éviter de bloquer Redis
      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize);
        const pipeline = this.client.pipeline();
        
        batch.forEach(key => pipeline.get(key));
        const results = await pipeline.exec();
        
        const keysToDelete: string[] = [];
        
        results?.forEach(([err, value], index) => {
          if (!err && value) {
            try {
              const entry: CacheEntry = JSON.parse(value as string);
              const now = Date.now();
              
              if (now > entry.timestamp + (entry.ttl * 1000)) {
                keysToDelete.push(batch[index]);
              }
            } catch (error) {
              // Entrée corrompue, la supprimer
              keysToDelete.push(batch[index]);
            }
          }
        });
        
        if (keysToDelete.length > 0) {
          await this.client.del(...keysToDelete);
          deletedCount += keysToDelete.length;
        }
      }
      
      console.log(`🧹 Cache cleanup completed: ${deletedCount} expired entries removed`);
      return deletedCount;

    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Obtient les statistiques du cache
   */
  async getStats(): Promise<CacheStats & { memoryUsage: string; totalKeys: number }> {
    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      
      // Extraire l'usage mémoire
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';
      
      // Compter les clés
      const keys = await this.client.dbsize();
      
      return {
        ...this.stats,
        memoryUsage,
        totalKeys: keys
      };

    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return {
        ...this.stats,
        memoryUsage: 'Unknown',
        totalKeys: 0
      };
    }
  }

  /**
   * Remet à zéro les statistiques
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      hitRate: 0,
      totalKeys: 0
    };
  }

  /**
   * Vérifie la santé de la connexion Redis
   */
  async healthCheck(): Promise<{
    connected: boolean;
    latency: number;
    error?: string;
  }> {
    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;
      
      return {
        connected: true,
        latency
      };

    } catch (error) {
      return {
        connected: false,
        latency: -1,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Méthodes privées

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      console.log('🔗 Redis connecting...');
    });

    this.client.on('ready', () => {
      this.isConnected = true;
      console.log('✅ Redis ready');
    });

    this.client.on('error', (error) => {
      console.error('❌ Redis error:', error);
      this.isConnected = false;
    });

    this.client.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      console.log('🔄 Redis reconnecting...');
    });
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Obtient le client Redis natif (pour opérations avancées)
   */
  getClient(): Redis {
    return this.client;
  }

  /**
   * Vérifie si Redis est connecté
   */
  isReady(): boolean {
    return this.isConnected && this.client.status === 'ready';
  }
}

export function createRedisClient(): RedisClient {
  const config: CacheConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: 'typebeat:',
    defaultTTL: 3600 // 1 heure par défaut
  };
  
  return new RedisClient(config);
}

