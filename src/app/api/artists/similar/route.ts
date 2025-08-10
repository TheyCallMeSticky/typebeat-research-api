// Endpoint pour obtenir les artistes similaires
// GET /api/artists/similar?artist=name&source=spotify&limit=20

import { NextRequest, NextResponse } from 'next/server';
import { SimilarArtistsResponse, APIResponse } from '@/types/api';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const artist = searchParams.get('artist');
    const source = searchParams.get('source') as 'spotify' | 'lastfm' | 'all' || 'all';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (!artist) {
      return NextResponse.json({
        success: false,
        error: {
          error: 'VALIDATION_ERROR',
          code: 'MISSING_ARTIST',
          message: 'Artist parameter is required',
          timestamp: new Date().toISOString(),
        }
      } as APIResponse<null>, { status: 400 });
    }

    // TODO: Implémenter la logique de recherche d'artistes similaires
    // 1. Si source = 'spotify' ou 'all', appeler Spotify API
    // 2. Si source = 'lastfm' ou 'all', appeler Last.fm API
    // 3. Combiner et dédupliquer les résultats
    // 4. Enrichir avec des métadonnées supplémentaires

    // Réponse temporaire pour la structure
    const mockSimilarArtists = [
      {
        name: "Pooh Shiesty",
        similarity_score: 0.85,
        source: "spotify" as const,
        genres: ["memphis rap", "trap", "southern hip hop"],
        popularity: 75
      },
      {
        name: "EST Gee", 
        similarity_score: 0.78,
        source: "spotify" as const,
        genres: ["louisville rap", "trap"],
        popularity: 68
      },
      {
        name: "42 Dugg",
        similarity_score: 0.72,
        source: "lastfm" as const,
        genres: ["detroit rap", "trap"],
        popularity: 70
      },
      {
        name: "Lil Baby",
        similarity_score: 0.68,
        source: "spotify" as const,
        genres: ["atlanta rap", "trap"],
        popularity: 88
      },
      {
        name: "Moneybagg Yo",
        similarity_score: 0.65,
        source: "lastfm" as const,
        genres: ["memphis rap", "trap"],
        popularity: 72
      }
    ];

    // Filtrer par source si spécifié
    let filteredArtists = mockSimilarArtists;
    if (source !== 'all') {
      filteredArtists = mockSimilarArtists.filter(a => a.source === source);
    }

    // Limiter les résultats
    filteredArtists = filteredArtists.slice(0, limit);

    const response: SimilarArtistsResponse = {
      similar_artists: filteredArtists,
      source_artist: artist,
      total_found: filteredArtists.length,
      cached: false
    };

    return NextResponse.json({
      success: true,
      data: response,
      metadata: {
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID(),
        processing_time_ms: Date.now() - startTime,
      }
    } as APIResponse<SimilarArtistsResponse>);

  } catch (error) {
    console.error('Error in similar artists endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        error: 'INTERNAL_ERROR',
        code: 'PROCESSING_FAILED',
        message: 'Failed to fetch similar artists',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID(),
        processing_time_ms: Date.now() - startTime,
      }
    } as APIResponse<null>, { status: 500 });
  }
}

// POST method pour recherche avancée avec filtres
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const body = await request.json();
    const { artist, source = 'all', limit = 20, filters = {} } = body;

    if (!artist) {
      return NextResponse.json({
        success: false,
        error: {
          error: 'VALIDATION_ERROR',
          code: 'MISSING_ARTIST',
          message: 'Artist name is required',
          timestamp: new Date().toISOString(),
        }
      } as APIResponse<null>, { status: 400 });
    }

    // TODO: Implémenter la recherche avancée avec filtres
    // Utiliser les filtres pour affiner les résultats (genre, popularité, etc.)
    // Variables source, limit, filters seront utilisées dans l'implémentation future

    console.log('Search params:', { artist, source, limit, filters });

    // Pour l'instant, retourner la même logique que GET
    const response: SimilarArtistsResponse = {
      similar_artists: [],
      source_artist: artist,
      total_found: 0,
      cached: false
    };

    return NextResponse.json({
      success: true,
      data: response,
      metadata: {
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID(),
        processing_time_ms: Date.now() - startTime,
      }
    } as APIResponse<SimilarArtistsResponse>);

  } catch (error) {
    console.error('Error in similar artists POST endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        error: 'INTERNAL_ERROR',
        code: 'PROCESSING_FAILED',
        message: 'Failed to process similar artists request',
        timestamp: new Date().toISOString(),
      },
      metadata: {
        timestamp: new Date().toISOString(),
        request_id: crypto.randomUUID(),
        processing_time_ms: Date.now() - startTime,
      }
    } as APIResponse<null>, { status: 500 });
  }
}

