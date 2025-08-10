// Service de calcul de similarité entre artistes

import { SimilarityMetrics } from '@/types/scoring';
import { Artist, SpotifyArtist, LastFmArtist } from '@/types/artist';

export interface ArtistSimilarityData {
  mainArtist: Artist;
  candidateArtist: Artist;
  spotifyData?: {
    mainArtist: SpotifyArtist;
    candidateArtist: SpotifyArtist;
    isRelated: boolean;
  };
  lastfmData?: {
    similarityScore: number;
    sharedTags: string[];
  };
}

export class SimilarityCalculator {
  /**
   * Calcule la similarité Spotify basée sur les genres et la popularité
   */
  static calculateSpotifySimilarity(
    mainArtist: SpotifyArtist,
    candidateArtist: SpotifyArtist,
    isRelated: boolean = false
  ): number {
    let similarity = 0;

    // Bonus si l'artiste est dans les "related artists" de Spotify
    if (isRelated) {
      similarity += 0.4; // 40% de base pour les artistes liés
    }

    // Similarité des genres (Jaccard similarity)
    const genreSimilarity = this.calculateGenreSimilarity(
      mainArtist.genres,
      candidateArtist.genres
    );
    similarity += genreSimilarity * 0.4; // 40% pour les genres

    // Similarité de popularité (inversée : moins populaire = mieux pour type beats)
    const popularitySimilarity = this.calculatePopularitySimilarity(
      mainArtist.popularity || 0,
      candidateArtist.popularity || 0
    );
    similarity += popularitySimilarity * 0.2; // 20% pour la popularité

    return Math.min(similarity, 1.0);
  }

  /**
   * Calcule la similarité Last.fm (score direct de l'API)
   */
  static calculateLastfmSimilarity(lastfmScore: number): number {
    // Le score Last.fm est déjà normalisé 0-1
    return Math.max(0, Math.min(1, lastfmScore));
  }

  /**
   * Calcule le chevauchement de genres
   */
  static calculateGenreOverlap(genres1: string[], genres2: string[]): number {
    if (genres1.length === 0 || genres2.length === 0) {
      return 0;
    }

    // Normalisation des genres (lowercase, suppression des espaces)
    const normalizedGenres1 = genres1.map(g => g.toLowerCase().trim());
    const normalizedGenres2 = genres2.map(g => g.toLowerCase().trim());

    // Calcul de l'intersection
    const intersection = normalizedGenres1.filter(genre => 
      normalizedGenres2.includes(genre)
    );

    // Jaccard similarity: intersection / union
    const union = new Set([...normalizedGenres1, ...normalizedGenres2]);
    return intersection.length / union.size;
  }

  /**
   * Calcule la compatibilité de style basée sur les sous-genres
   */
  static calculateStyleCompatibility(genres1: string[], genres2: string[]): number {
    // Mapping des genres vers des styles plus larges
    const styleMapping = this.getStyleMapping();
    
    const styles1 = this.extractStyles(genres1, styleMapping);
    const styles2 = this.extractStyles(genres2, styleMapping);

    if (styles1.length === 0 || styles2.length === 0) {
      return 0;
    }

    // Calcul de la compatibilité des styles
    const commonStyles = styles1.filter(style => styles2.includes(style));
    const totalStyles = new Set([...styles1, ...styles2]).size;

    return commonStyles.length / totalStyles;
  }

  /**
   * Estime le chevauchement d'audience basé sur la popularité et les genres
   */
  static calculateAudienceOverlap(
    mainArtist: Artist,
    candidateArtist: Artist
  ): number {
    let overlap = 0;

    // Chevauchement basé sur les genres
    const genreOverlap = this.calculateGenreOverlap(
      mainArtist.genres,
      candidateArtist.genres
    );
    overlap += genreOverlap * 0.6; // 60% basé sur les genres

    // Chevauchement basé sur la popularité (artistes de popularité similaire = audience similaire)
    if (mainArtist.popularity && candidateArtist.popularity) {
      const popularityDiff = Math.abs(mainArtist.popularity - candidateArtist.popularity);
      const popularitySimilarity = Math.max(0, 1 - popularityDiff / 100);
      overlap += popularitySimilarity * 0.4; // 40% basé sur la popularité
    }

    return Math.min(overlap, 1.0);
  }

  /**
   * Calcule les métriques de similarité complètes
   */
  static calculateSimilarityMetrics(data: ArtistSimilarityData): SimilarityMetrics {
    const { mainArtist, candidateArtist, spotifyData, lastfmData } = data;

    // Similarité Spotify
    let spotifySimilarity = 0;
    if (spotifyData) {
      spotifySimilarity = this.calculateSpotifySimilarity(
        spotifyData.mainArtist,
        spotifyData.candidateArtist,
        spotifyData.isRelated
      );
    }

    // Similarité Last.fm
    let lastfmSimilarity = 0;
    if (lastfmData) {
      lastfmSimilarity = this.calculateLastfmSimilarity(lastfmData.similarityScore);
    }

    // Chevauchement de genres
    const genreOverlap = this.calculateGenreOverlap(
      mainArtist.genres,
      candidateArtist.genres
    );

    // Compatibilité de style
    const styleCompatibility = this.calculateStyleCompatibility(
      mainArtist.genres,
      candidateArtist.genres
    );

    // Chevauchement d'audience
    const audienceOverlap = this.calculateAudienceOverlap(
      mainArtist,
      candidateArtist
    );

    return {
      spotify_similarity: Math.round(spotifySimilarity * 100) / 100,
      lastfm_similarity: Math.round(lastfmSimilarity * 100) / 100,
      genre_overlap: Math.round(genreOverlap * 100) / 100,
      style_compatibility: Math.round(styleCompatibility * 100) / 100,
      audience_overlap: Math.round(audienceOverlap * 100) / 100
    };
  }

  /**
   * Filtre les artistes candidats par seuil de similarité minimum
   */
  static filterBySimilarity(
    candidates: Array<{ artist: Artist; similarity: SimilarityMetrics }>,
    minThreshold: number = 0.3
  ): Array<{ artist: Artist; similarity: SimilarityMetrics }> {
    return candidates.filter(candidate => {
      const avgSimilarity = (
        candidate.similarity.spotify_similarity +
        candidate.similarity.lastfm_similarity +
        candidate.similarity.genre_overlap +
        candidate.similarity.style_compatibility +
        candidate.similarity.audience_overlap
      ) / 5;

      return avgSimilarity >= minThreshold;
    });
  }

  /**
   * Trie les artistes par score de similarité global
   */
  static sortBySimilarity(
    candidates: Array<{ artist: Artist; similarity: SimilarityMetrics }>,
    weights: {
      spotify: number;
      lastfm: number;
      genre: number;
      style: number;
      audience: number;
    } = { spotify: 0.3, lastfm: 0.25, genre: 0.2, style: 0.15, audience: 0.1 }
  ): Array<{ artist: Artist; similarity: SimilarityMetrics; score: number }> {
    return candidates
      .map(candidate => {
        const score = (
          candidate.similarity.spotify_similarity * weights.spotify +
          candidate.similarity.lastfm_similarity * weights.lastfm +
          candidate.similarity.genre_overlap * weights.genre +
          candidate.similarity.style_compatibility * weights.style +
          candidate.similarity.audience_overlap * weights.audience
        );

        return {
          ...candidate,
          score: Math.round(score * 100) / 100
        };
      })
      .sort((a, b) => b.score - a.score);
  }

  // Méthodes utilitaires privées

  private static calculateGenreSimilarity(genres1: string[], genres2: string[]): number {
    return this.calculateGenreOverlap(genres1, genres2);
  }

  private static calculatePopularitySimilarity(popularity1: number, popularity2: number): number {
    // Pour les type beats, on préfère les artistes moins populaires
    // Donc on inverse la logique : plus l'artiste candidat est moins populaire, mieux c'est
    if (popularity1 === 0 || popularity2 === 0) {
      return 0.5; // Score neutre si pas de données
    }

    const popularityRatio = popularity2 / popularity1;
    
    // Score optimal quand l'artiste candidat a 60-80% de la popularité de l'artiste principal
    if (popularityRatio >= 0.6 && popularityRatio <= 0.8) {
      return 1.0;
    } else if (popularityRatio >= 0.4 && popularityRatio <= 0.9) {
      return 0.8;
    } else if (popularityRatio >= 0.2 && popularityRatio <= 1.0) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  private static getStyleMapping(): Map<string, string[]> {
    return new Map([
      ['trap', ['trap', 'atlanta trap', 'memphis trap', 'drill']],
      ['rap', ['rap', 'hip hop', 'hip-hop', 'gangsta rap', 'conscious rap']],
      ['southern', ['southern rap', 'memphis rap', 'houston rap', 'atlanta rap']],
      ['east_coast', ['east coast rap', 'new york rap', 'boom bap']],
      ['west_coast', ['west coast rap', 'california rap', 'g-funk']],
      ['midwest', ['midwest rap', 'chicago rap', 'detroit rap']],
      ['melodic', ['melodic rap', 'emo rap', 'alternative rap']],
      ['hardcore', ['hardcore rap', 'gangsta rap', 'drill']],
      ['experimental', ['experimental rap', 'abstract rap', 'alternative rap']],
      ['commercial', ['pop rap', 'mainstream rap', 'radio rap']]
    ]);
  }

  private static extractStyles(genres: string[], styleMapping: Map<string, string[]>): string[] {
    const styles: string[] = [];
    
    for (const [style, keywords] of styleMapping) {
      const hasStyle = genres.some(genre => 
        keywords.some(keyword => 
          genre.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      if (hasStyle) {
        styles.push(style);
      }
    }

    return styles;
  }

  /**
   * Calcule un score de compatibilité BPM (si disponible)
   */
  static calculateBPMCompatibility(bpm1?: number, bpm2?: number): number {
    if (!bpm1 || !bpm2) {
      return 0.5; // Score neutre si pas de données BPM
    }

    const bpmDiff = Math.abs(bpm1 - bpm2);
    
    // Compatibilité parfaite si différence < 5 BPM
    if (bpmDiff <= 5) return 1.0;
    // Bonne compatibilité si différence < 15 BPM
    if (bpmDiff <= 15) return 0.8;
    // Compatibilité acceptable si différence < 30 BPM
    if (bpmDiff <= 30) return 0.6;
    // Faible compatibilité au-delà
    return 0.3;
  }

  /**
   * Analyse la compatibilité régionale
   */
  static calculateRegionalCompatibility(region1?: string, region2?: string): number {
    if (!region1 || !region2) {
      return 0.5; // Score neutre si pas de données
    }

    // Même région = compatibilité parfaite
    if (region1.toLowerCase() === region2.toLowerCase()) {
      return 1.0;
    }

    // Régions voisines ou culturellement proches
    const regionalGroups = [
      ['us', 'canada'],
      ['uk', 'ireland'],
      ['france', 'belgium', 'switzerland'],
      ['germany', 'austria', 'switzerland']
    ];

    for (const group of regionalGroups) {
      if (group.includes(region1.toLowerCase()) && group.includes(region2.toLowerCase())) {
        return 0.8;
      }
    }

    // Même continent
    const continents = {
      'north_america': ['us', 'canada', 'mexico'],
      'europe': ['uk', 'france', 'germany', 'spain', 'italy'],
      'asia': ['japan', 'korea', 'china', 'india']
    };

    for (const [continent, countries] of Object.entries(continents)) {
      if (countries.includes(region1.toLowerCase()) && countries.includes(region2.toLowerCase())) {
        return 0.6;
      }
    }

    // Régions différentes
    return 0.3;
  }
}

