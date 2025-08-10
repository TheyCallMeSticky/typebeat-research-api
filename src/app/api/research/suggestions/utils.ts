// Fonctions utilitaires pour l'endpoint suggestions

import { ArtistSuggestion } from '@/types/api';

// Calcul du score composite
export function calculateCompositeScore(metrics: {
  volume: number;
  competition: number;
  trend: number;
  similarity: number;
  saturation: number;
}): number {
  const weights = {
    volume: 0.3,
    competition: 0.25,
    trend: 0.2,
    similarity: 0.15,
    saturation: 0.1
  };

  // Normaliser les scores sur une échelle de 0-10
  const normalizedVolume = Math.min(metrics.volume / 1000, 10);
  const normalizedCompetition = metrics.competition * 10;
  const normalizedTrend = metrics.trend * 10;
  const normalizedSimilarity = metrics.similarity * 10;
  const normalizedSaturation = (1 - metrics.saturation) * 10; // Inverser car moins de saturation = mieux

  const score = 
    normalizedVolume * weights.volume +
    normalizedCompetition * weights.competition +
    normalizedTrend * weights.trend +
    normalizedSimilarity * weights.similarity +
    normalizedSaturation * weights.saturation;

  return Math.max(0, Math.min(10, score));
}

// Génération de raison personnalisée
export function generateReason(similarArtist: any, youtubeMetrics: any): string {
  const reasons = [];

  if (youtubeMetrics.competition_level === 'low') {
    reasons.push('marché peu saturé');
  }
  
  if (youtubeMetrics.trend_direction === 'rising') {
    reasons.push('tendance croissante');
  }
  
  if (similarArtist.similarity_score > 0.8) {
    reasons.push('style très similaire');
  }
  
  if (youtubeMetrics.volume > 5000) {
    reasons.push('bon volume de recherche');
  }

  if (reasons.length === 0) {
    return 'Opportunité détectée par l\'algorithme';
  }

  return reasons.join(', ').charAt(0).toUpperCase() + reasons.join(', ').slice(1);
}

// Génération de suggestions mock basées sur l'artiste
export function generateMockSuggestions(artistName: string, limit: number): ArtistSuggestion[] {
  const mockDatabase: { [key: string]: ArtistSuggestion[] } = {
    'Drake': [
      {
        artist: "Lil Baby",
        score: 8.7,
        metrics: { volume: 15000, competition: "medium", trend: "rising", saturation: 0.35 },
        details: { genre: "Atlanta rap", bpm: 140, reason: "Style mélodique similaire, forte demande", confidence: "high" },
        sources: { spotify: true, lastfm: true, youtube: true }
      },
      {
        artist: "Gunna",
        score: 8.2,
        metrics: { volume: 12000, competition: "medium", trend: "stable", saturation: 0.4 },
        details: { genre: "Melodic trap", bpm: 145, reason: "Même label YSL, audience similaire", confidence: "high" },
        sources: { spotify: true, lastfm: true, youtube: true }
      },
      {
        artist: "Roddy Ricch",
        score: 7.9,
        metrics: { volume: 11000, competition: "high", trend: "stable", saturation: 0.45 },
        details: { genre: "West Coast rap", bpm: 135, reason: "Mélodies accrocheuses, bon potentiel", confidence: "medium" },
        sources: { spotify: true, lastfm: false, youtube: true }
      }
    ],
    'Future': [
      {
        artist: "Young Thug",
        score: 8.5,
        metrics: { volume: 13000, competition: "medium", trend: "rising", saturation: 0.3 },
        details: { genre: "Atlanta trap", bpm: 150, reason: "Même scène Atlanta, style expérimental", confidence: "high" },
        sources: { spotify: true, lastfm: true, youtube: true }
      },
      {
        artist: "Lil Uzi Vert",
        score: 8.1,
        metrics: { volume: 10000, competition: "medium", trend: "stable", saturation: 0.35 },
        details: { genre: "Melodic rap", bpm: 155, reason: "Flows innovants, audience jeune", confidence: "medium" },
        sources: { spotify: true, lastfm: true, youtube: true }
      }
    ],
    'Travis Scott': [
      {
        artist: "Don Toliver",
        score: 8.3,
        metrics: { volume: 9500, competition: "low", trend: "rising", saturation: 0.25 },
        details: { genre: "Houston rap", bpm: 140, reason: "Même label Cactus Jack, style psychédélique", confidence: "high" },
        sources: { spotify: true, lastfm: false, youtube: true }
      },
      {
        artist: "Sheck Wes",
        score: 7.6,
        metrics: { volume: 7000, competition: "low", trend: "stable", saturation: 0.2 },
        details: { genre: "Rage rap", bpm: 160, reason: "Énergie similaire, moins saturé", confidence: "medium" },
        sources: { spotify: true, lastfm: true, youtube: true }
      }
    ]
  };

  // Suggestions par défaut si l'artiste n'est pas dans la base
  const defaultSuggestions: ArtistSuggestion[] = [
    {
      artist: "Emerging Artist 1",
      score: 7.5,
      metrics: { volume: 8000, competition: "low", trend: "rising", saturation: 0.3 },
      details: { genre: "Hip-hop", bpm: 140, reason: "Opportunité émergente détectée", confidence: "medium" },
      sources: { spotify: true, lastfm: false, youtube: true }
    },
    {
      artist: "Emerging Artist 2", 
      score: 7.2,
      metrics: { volume: 6500, competition: "low", trend: "stable", saturation: 0.25 },
      details: { genre: "Trap", bpm: 145, reason: "Marché peu exploité", confidence: "medium" },
      sources: { spotify: false, lastfm: true, youtube: true }
    }
  ];

  const suggestions = mockDatabase[artistName] || defaultSuggestions;
  return suggestions.slice(0, limit);
}

