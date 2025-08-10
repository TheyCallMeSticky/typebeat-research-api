import { NextRequest, NextResponse } from 'next/server';
import { APIResponse, ArtistSuggestion, SuggestionsResponse } from '@/types/api';
import { generateMockSuggestions, calculateCompositeScore } from './utils';

export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    
    // Validation des données d'entrée
    if (!body.artist || typeof body.artist !== 'string') {
      return NextResponse.json({
        success: false,
        error: {
          error: "VALIDATION_ERROR",
          code: "MISSING_ARTIST",
          message: "Artist name is required",
          timestamp: new Date().toISOString()
        }
      }, { status: 400 });
    }

    const limit = Math.min(body.limit || 3, 10); // Max 10 suggestions
    const filters = body.filters || {};

    // IMPLÉMENTATION AVEC VRAIES APIs
    try {
      console.log(`🔍 Processing request for artist: ${body.artist}`);
      
      // Utiliser le vrai orchestrateur API
      const { createAPIOrchestrator } = await import('@/lib/apis/api-orchestrator');
      const orchestrator = createAPIOrchestrator();
      
      let suggestions: ArtistSuggestion[] = [];
      let apiCallsUsed = { youtube: 0, spotify: 0, lastfm: 0 };
      let totalCandidates = 0;
      let usedFallback = false;

      try {
        console.log(`🎯 Finding similar artists to: ${body.artist}`);
        
        // 1. Recherche d'artistes similaires avec le vrai orchestrateur
        const similarArtistsResult = await orchestrator.findSimilarArtists(body.artist, { 
          limit: limit * 2, // Plus de candidats pour filtrer
          minSimilarity: 0.3,
          includeMetrics: true,
          sources: ['spotify', 'lastfm']
        });
        
        console.log(`✅ Found ${similarArtistsResult.candidates.length} similar artists`);
        totalCandidates = similarArtistsResult.candidates.length;
        
        // 2. Analyser chaque candidat avec YouTube et calculer les scores
        for (const candidate of similarArtistsResult.candidates.slice(0, limit * 1.5)) {
          try {
            const artistName = candidate.artist.name;
            console.log(`📊 Analyzing ${artistName}...`);
            
            // Calculer les métriques YouTube en parallèle
            const youtubeMetricsPromise = orchestrator.calculateYouTubeMetrics(artistName);
            
            // Timeout de 10 secondes pour YouTube
            const youtubeMetrics = await Promise.race([
              youtubeMetricsPromise,
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('YouTube timeout')), 10000)
              )
            ]) as any;
            
            // Calculer le score composite final
            const finalScore = calculateCompositeScore({
              volume: Math.min(youtubeMetrics.volume / 1000, 10), // Normaliser sur 10
              competition: youtubeMetrics.competition_score * 10,
              trend: youtubeMetrics.trend_score * 10,
              similarity: candidate.similarity.style_compatibility * 10,
              saturation: (1 - youtubeMetrics.saturation_score) * 10 // Inverser
            });

            // Filtrer selon les critères de qualité
            if (finalScore >= 5.0 && youtubeMetrics.volume > 500) {
              suggestions.push({
                artist: artistName,
                score: Math.round(finalScore * 10) / 10,
                metrics: {
                  volume: youtubeMetrics.volume,
                  competition: youtubeMetrics.competition_level,
                  trend: youtubeMetrics.trend_direction,
                  saturation: youtubeMetrics.saturation_score
                },
                details: {
                  genre: candidate.artist.genres[0] || "Hip-hop",
                  bpm: Math.floor(Math.random() * 40) + 120, // TODO: Obtenir le vrai BPM
                  reason: generateReason(candidate, youtubeMetrics),
                  confidence: finalScore >= 7 ? "high" : finalScore >= 5.5 ? "medium" : "low"
                },
                sources: {
                  spotify: candidate.sources.includes('spotify'),
                  lastfm: candidate.sources.includes('lastfm'),
                  youtube: true
                }
              });
              
              apiCallsUsed.youtube++;
            }
          } catch (error) {
            console.warn(`⚠️ Failed to analyze ${candidate.artist.name}:`, error);
            continue;
          }
        }
        
        // Compter les appels API utilisés
        apiCallsUsed.spotify = similarArtistsResult.candidates.filter(c => c.sources.includes('spotify')).length > 0 ? 1 : 0;
        apiCallsUsed.lastfm = similarArtistsResult.candidates.filter(c => c.sources.includes('lastfm')).length > 0 ? 1 : 0;
        
      } catch (apiError) {
        console.log(`⚠️ API failed, using intelligent fallback: ${apiError}`);
        usedFallback = true;
        suggestions = generateMockSuggestions(body.artist, limit);
        totalCandidates = 0;
      }

      // Si aucune suggestion valide, utiliser le fallback intelligent
      if (suggestions.length === 0) {
        console.log(`🔄 No valid suggestions found, using fallback data`);
        suggestions = generateMockSuggestions(body.artist, limit);
        usedFallback = true;
      }

      // Trier par score et limiter les résultats
      suggestions.sort((a, b) => b.score - a.score);
      const finalSuggestions = suggestions.slice(0, limit);

      const response: SuggestionsResponse = {
        suggestions: finalSuggestions,
        query_info: {
          original_artist: body.artist,
          filters_applied: filters,
          total_candidates_analyzed: totalCandidates
        },
        metadata: {
          cached: false,
          processing_time: `${Date.now() - startTime}ms`,
          api_calls_used: apiCallsUsed
        }
      };

      console.log(`✅ Returning ${finalSuggestions.length} suggestions for ${body.artist}`);

      return NextResponse.json({
        success: true,
        data: response,
        metadata: {
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID(),
          processing_time_ms: Date.now() - startTime,
          fallback_used: usedFallback,
          real_apis_used: !usedFallback
        }
      } as APIResponse<SuggestionsResponse>);

    } catch (error) {
      console.error('❌ Complete failure, using emergency fallback:', error);
      
      // Fallback d'urgence
      const emergencyResponse: SuggestionsResponse = {
        suggestions: generateMockSuggestions(body.artist, limit),
        query_info: {
          original_artist: body.artist,
          filters_applied: filters,
          total_candidates_analyzed: 0
        },
        metadata: {
          cached: false,
          processing_time: `${Date.now() - startTime}ms`,
          api_calls_used: { youtube: 0, spotify: 0, lastfm: 0 }
        }
      };

      return NextResponse.json({
        success: true,
        data: emergencyResponse,
        metadata: {
          timestamp: new Date().toISOString(),
          request_id: crypto.randomUUID(),
          processing_time_ms: Date.now() - startTime,
          fallback_used: true,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      } as APIResponse<SuggestionsResponse>);
    }

  } catch (error) {
    console.error('Error in suggestions endpoint:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        error: "INTERNAL_ERROR",
        code: "PROCESSING_FAILED",
        message: "Failed to process request",
        timestamp: new Date().toISOString()
      }
    }, { status: 500 });
  }
}

// Fonction helper pour générer les raisons
function generateReason(candidate: any, youtubeMetrics: any): string {
  const reasons = [];

  if (youtubeMetrics.competition_level === 'low') {
    reasons.push('marché peu saturé');
  }
  
  if (youtubeMetrics.trend_direction === 'rising') {
    reasons.push('tendance croissante');
  }
  
  if (candidate.similarity.style_compatibility > 0.8) {
    reasons.push('style très similaire');
  }
  
  if (youtubeMetrics.volume > 5000) {
    reasons.push('bon volume de recherche');
  }

  if (candidate.sources.length > 1) {
    reasons.push('validé sur plusieurs plateformes');
  }

  if (reasons.length === 0) {
    return 'Opportunité détectée par l\'algorithme';
  }

  return reasons.join(', ').charAt(0).toUpperCase() + reasons.join(', ').slice(1);
}

