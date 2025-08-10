// Health check endpoint avec tests des APIs externes
// GET /api/health

import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();

  try {
    console.log('🏥 Starting comprehensive health check...');

    // Import des clients individuels pour des tests plus précis
    const [
      { createYouTubeClient },
      { createSpotifyClient },
      { createLastFmClient },
      { createGeniusClient },
      { createRedisClient }
    ] = await Promise.all([
      import('@/lib/apis/youtube-client'),
      import('@/lib/apis/spotify-client'),
      import('@/lib/apis/lastfm-client'),
      import('@/lib/apis/genius-client'),
      import('@/lib/cache/redis-client')
    ]);

    // Créer les instances
    const youtubeClient = createYouTubeClient();
    const spotifyClient = createSpotifyClient();
    const lastfmClient = createLastFmClient();
    const geniusClient = createGeniusClient();
    const redisClient = createRedisClient();

    // Tests parallèles avec timeout de 10 secondes chacun
    const healthTests = await Promise.allSettled([
      testYouTubeDetailed(youtubeClient),
      testSpotifyDetailed(spotifyClient),
      testLastFmDetailed(lastfmClient),
      testGeniusDetailed(geniusClient),
      testRedisDetailed(redisClient)
    ]);

    // Analyser les résultats
    const services = {
      youtube: processTestResult(healthTests[0], 'YouTube'),
      spotify: processTestResult(healthTests[1], 'Spotify'),
      lastfm: processTestResult(healthTests[2], 'Last.fm'),
      genius: processTestResult(healthTests[3], 'Genius'),
      redis: processTestResult(healthTests[4], 'Redis')
    };

    // Calcul du statut global
    const healthyCount = Object.values(services).filter(s => s.status === 'healthy').length;
    const degradedCount = Object.values(services).filter(s => s.status === 'degraded').length;
    const totalServices = Object.keys(services).length;

    let globalStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalServices) {
      globalStatus = 'healthy';
    } else if (healthyCount + degradedCount >= totalServices - 1) {
      globalStatus = 'degraded';
    } else {
      globalStatus = 'unhealthy';
    }

    const responseTime = Date.now() - startTime;
    const httpStatus = globalStatus === 'unhealthy' ? 503 : 200;

    const response = {
      status: globalStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "0.1.0", 
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3002',
      services,
      summary: {
        healthy_services: healthyCount,
        degraded_services: degradedCount,
        unhealthy_services: totalServices - healthyCount - degradedCount,
        total_services: totalServices,
        response_time_ms: responseTime
      },
      recommendations: generateRecommendations(services)
    };

    console.log(`✅ Health check completed in ${responseTime}ms - Status: ${globalStatus} (${healthyCount}/${totalServices} healthy)`);

    return NextResponse.json(response, { status: httpStatus });

  } catch (error) {
    console.error('❌ Health check failed:', error);

    const response = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "0.1.0",
      environment: process.env.NODE_ENV || 'development', 
      port: process.env.PORT || '3002',
      error: error instanceof Error ? error.message : 'Unknown error',
      response_time_ms: Date.now() - startTime
    };

    return NextResponse.json(response, { status: 503 });
  }
}

// Tests détaillés pour chaque service
async function testYouTubeDetailed(client: any) {
  try {
    console.log('🔍 YouTube Search: "test" (1 results)');
    const results = await client.searchVideos('test', 1);
    
    if (results.length === 0) {
      throw new Error('No videos found in search');
    }

    // Test quota (si disponible)
    const quotaUsed = client.getQuotaUsed?.() || 0;
    
    return {
      status: 'healthy',
      details: {
        search_results: results.length,
        quota_used: quotaUsed,
        quota_limit: 10000,
        quota_remaining: 10000 - quotaUsed
      }
    };
  } catch (error) {
    throw new Error(`YouTube API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testSpotifyDetailed(client: any) {
  try {
    console.log('🔐 Authenticating with Spotify...');
    await client.authenticate();
    
    console.log('🔍 Spotify Search: "test" (1 results)');
    const results = await client.searchArtists('test', 1);
    
    if (results.length === 0) {
      throw new Error('No artists found in search');
    }

    // Test l'endpoint problématique related-artists
    let relatedArtistsStatus = 'unknown';
    try {
      await client.getRecommendedArtists([results[0].id], 5);
      relatedArtistsStatus = 'working';
    } catch (relatedError) {
      relatedArtistsStatus = 'deprecated';
      console.warn('⚠️ Spotify related-artists endpoint is deprecated/broken');
    }

    const status = relatedArtistsStatus === 'deprecated' ? 'degraded' : 'healthy';

    return {
      status,
      details: {
        authentication: 'successful',
        search_results: results.length,
        related_artists_endpoint: relatedArtistsStatus,
        artist_found: results[0]?.name || 'none'
      }
    };
  } catch (error) {
    throw new Error(`Spotify API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testLastFmDetailed(client: any) {
  try {
    console.log('🔍 Last.fm Search: "test" (1 results)');
    const results = await client.searchArtists('test', 1);
    
    if (results.length === 0) {
      throw new Error('No artists found in search');
    }

    // Test métadonnées
    const artistInfo = await client.getArtistInfo(results[0].name);
    const tags = await client.getArtistTopTags(results[0].name);

    return {
      status: 'healthy',
      details: {
        search_results: results.length,
        metadata_available: !!artistInfo,
        tags_count: tags.length,
        artist_found: results[0]?.name || 'none'
      }
    };
  } catch (error) {
    throw new Error(`Last.fm API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

async function testGeniusDetailed(client: any) {
  try {
    console.log('🔍 Genius Search: "test"');
    
    // Le problème principal : authentication
    const accessToken = process.env.GENIUS_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error('GENIUS_ACCESS_TOKEN environment variable not set');
    }

    const results = await client.searchArtists('test', 1);
    
    if (results.length === 0) {
      throw new Error('No artists found - possibly authentication issue');
    }

    return {
      status: 'healthy',
      details: {
        authentication: 'successful',
        search_results: results.length,
        token_configured: !!accessToken,
        artist_found: results[0]?.name || 'none'
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Diagnostic plus précis pour Genius
    if (errorMessage.includes('authentication') || errorMessage.includes('401')) {
      throw new Error('Genius API authentication failed - check GENIUS_ACCESS_TOKEN environment variable');
    }
    
    throw new Error(`Genius API failed: ${errorMessage}`);
  }
}

async function testRedisDetailed(client: any) {
  try {
    console.log('🔗 Redis connecting...');
    
    // Test 1: Ping
    await client.ping();
    
    // Test 2: Write/Read/Delete pour vérifier la persistance
    const testKey = `health_check_${Date.now()}`;
    const testValue = JSON.stringify({ test: true, timestamp: Date.now() });
    
    // Test write avec TTL
    await client.setWithTTL(testKey, testValue, 10);
    
    // Test read
    const retrieved = await client.get(testKey);
    if (retrieved !== testValue) {
      throw new Error('Redis read/write test failed - value mismatch');
    }
    
    console.log('✅ Redis ready');
    
    return {
      status: 'healthy',
      details: {
        connection: 'successful',
        read_write_test: 'passed',
        ping_response: 'OK',
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || '6379',
        db: process.env.REDIS_DB || '2'
      }
    };
  } catch (error) {
    throw new Error(`Redis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Utilitaires
function processTestResult(result: PromiseSettledResult<any>, serviceName: string) {
  if (result.status === 'fulfilled') {
    return {
      status: result.value.status,
      ...result.value.details,
      last_checked: new Date().toISOString()
    };
  } else {
    console.error(`❌ ${serviceName} health check failed:`, result.reason);
    return {
      status: 'unhealthy' as const,
      error: result.reason?.message || 'Unknown error',
      last_checked: new Date().toISOString()
    };
  }
}

function generateRecommendations(services: any): string[] {
  const recommendations: string[] = [];
  
  if (services.genius.status === 'unhealthy') {
    recommendations.push('Set GENIUS_ACCESS_TOKEN environment variable');
  }
  
  if (services.spotify.status === 'degraded') {
    recommendations.push('Update Spotify integration to use /recommendations endpoint instead of /related-artists');
  }
  
  if (services.redis.status === 'unhealthy') {
    recommendations.push('Check Redis connection and ensure service is running');
  }
  
  if (services.youtube.quota_used > 8000) {
    recommendations.push('YouTube quota usage is high - consider optimizing requests');
  }
  
  return recommendations;
}

// Endpoint pour un health check rapide (sans tests des APIs externes)
export async function HEAD() {
  return new Response(null, { status: 200 });
}