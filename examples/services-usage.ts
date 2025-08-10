// Exemple d'utilisation des services de calcul et scoring

import { 
  createScoringService, 
  createArtistAnalyzer,
  YouTubeAnalyzer,
  SimilarityCalculator,
  MathUtils,
  DEFAULT_SCORING_CONFIG 
} from '../src/lib/services';

import { Artist } from '../src/types/artist';
import { VolumeMetrics, CompetitionMetrics, TrendMetrics, SaturationMetrics, SimilarityMetrics } from '../src/types/scoring';

// Exemple d'utilisation du service de scoring
async function exampleScoringService() {
  console.log('=== Exemple Service de Scoring ===');
  
  const scoringService = createScoringService();

  // Données d'exemple pour un artiste
  const volumeMetrics: VolumeMetrics = {
    total_results: 8500,
    monthly_searches_estimate: 12000,
    recent_uploads_30d: 25,
    avg_views_top_20: 75000,
    search_query: "Pooh Shiesty type beat",
    calculated_at: new Date()
  };

  const competitionMetrics: CompetitionMetrics = {
    total_videos: 8500,
    avg_views: 75000,
    median_views: 45000,
    top_creator_dominance: 0.35,
    upload_frequency: 8.5,
    quality_score: 7.2,
    barrier_to_entry: 'medium'
  };

  const trendMetrics: TrendMetrics = {
    trend_direction: 'rising',
    trend_factor: 1.25,
    growth_rate_3m: 18.5,
    seasonality_factor: 1.1,
    momentum_score: 82
  };

  const saturationMetrics: SaturationMetrics = {
    market_saturation: 0.42,
    new_creators_ratio: 0.38,
    content_diversity: 0.65,
    niche_opportunity: 0.75
  };

  const similarityMetrics: SimilarityMetrics = {
    spotify_similarity: 0.85,
    lastfm_similarity: 0.78,
    genre_overlap: 0.92,
    style_compatibility: 0.88,
    audience_overlap: 0.72
  };

  // Calcul du score complet
  const scoreBreakdown = scoringService.calculateCompleteScore(
    volumeMetrics,
    competitionMetrics,
    trendMetrics,
    saturationMetrics,
    similarityMetrics,
    "Pooh Shiesty"
  );

  console.log('Score final:', scoreBreakdown.final_score);
  console.log('Score de volume:', scoringService.calculateVolumeScore(volumeMetrics));
  console.log('Score de concurrence:', scoringService.calculateCompetitionScore(competitionMetrics));
  console.log('Score de tendance:', scoringService.calculateTrendScore(trendMetrics));
  console.log('Score de saturation:', scoringService.calculateSaturationScore(saturationMetrics));
  console.log('Score de similarité:', scoringService.calculateSimilarityScore(similarityMetrics));
}

// Exemple d'utilisation du calculateur de similarité
function exampleSimilarityCalculator() {
  console.log('\n=== Exemple Calculateur de Similarité ===');

  const mainArtist: Artist = {
    id: "key-glock",
    name: "Key Glock",
    genres: ["memphis rap", "trap", "southern hip hop"],
    popularity: 75
  };

  const candidateArtist: Artist = {
    id: "pooh-shiesty",
    name: "Pooh Shiesty",
    genres: ["memphis rap", "trap", "gangsta rap"],
    popularity: 68
  };

  // Calcul de la similarité des genres
  const genreOverlap = SimilarityCalculator.calculateGenreOverlap(
    mainArtist.genres,
    candidateArtist.genres
  );
  console.log('Chevauchement de genres:', genreOverlap);

  // Calcul de la compatibilité de style
  const styleCompatibility = SimilarityCalculator.calculateStyleCompatibility(
    mainArtist.genres,
    candidateArtist.genres
  );
  console.log('Compatibilité de style:', styleCompatibility);

  // Calcul du chevauchement d'audience
  const audienceOverlap = SimilarityCalculator.calculateAudienceOverlap(
    mainArtist,
    candidateArtist
  );
  console.log('Chevauchement d\'audience:', audienceOverlap);
}

// Exemple d'utilisation des utilitaires mathématiques
function exampleMathUtils() {
  console.log('\n=== Exemple Utilitaires Mathématiques ===');

  // Données d'exemple : vues de vidéos
  const viewCounts = [12000, 45000, 8500, 125000, 32000, 67000, 15000, 89000, 23000, 156000];

  console.log('Données:', viewCounts);
  console.log('Moyenne:', MathUtils.mean(viewCounts));
  console.log('Médiane:', MathUtils.median(viewCounts));
  console.log('Écart-type:', MathUtils.round(MathUtils.standardDeviation(viewCounts)));
  console.log('75e percentile:', MathUtils.percentile(viewCounts, 75));

  // Détection d'outliers
  const outlierAnalysis = MathUtils.detectOutliers(viewCounts);
  console.log('Outliers détectés:', outlierAnalysis.outliers);

  // Calcul de l'indice de Gini (inégalité)
  const giniIndex = MathUtils.giniCoefficient(viewCounts);
  console.log('Indice de Gini (inégalité):', MathUtils.round(giniIndex, 3));

  // Analyse de tendance
  const trendData = [100, 120, 115, 140, 155, 148, 170, 185, 175, 200];
  const trend = MathUtils.linearTrend(trendData);
  console.log('Tendance linéaire - Pente:', MathUtils.round(trend.slope, 3));
  console.log('Tendance linéaire - R²:', MathUtils.round(trend.r2, 3));
}

// Exemple d'utilisation de l'analyseur YouTube
function exampleYouTubeAnalyzer() {
  console.log('\n=== Exemple Analyseur YouTube ===');

  // Données simulées de recherche YouTube
  const mockSearchResults = {
    videos: [
      {
        id: "video1",
        title: "Pooh Shiesty Type Beat - Memphis Trap Instrumental",
        channelTitle: "BeatMaker1",
        publishedAt: "2024-01-15T10:00:00Z",
        viewCount: 85000,
        likeCount: 1200,
        commentCount: 150,
        duration: "PT3M45S",
        thumbnails: {
          default: { url: "thumb1.jpg" },
          medium: { url: "thumb1_med.jpg" },
          high: { url: "thumb1_high.jpg" }
        }
      },
      {
        id: "video2",
        title: "Pooh Shiesty x Key Glock Type Beat 2024",
        channelTitle: "TrapBeats",
        publishedAt: "2024-01-10T15:30:00Z",
        viewCount: 45000,
        likeCount: 800,
        commentCount: 95,
        duration: "PT2M58S",
        thumbnails: {
          default: { url: "thumb2.jpg" },
          medium: { url: "thumb2_med.jpg" },
          high: { url: "thumb2_high.jpg" }
        }
      }
    ],
    totalResults: 8500,
    nextPageToken: undefined
  };

  const query = "Pooh Shiesty type beat";
  
  // Analyse complète
  const analysis = YouTubeAnalyzer.analyzeComplete(mockSearchResults, query);
  
  console.log('Métriques de volume:');
  console.log('- Résultats totaux:', analysis.volumeMetrics.total_results);
  console.log('- Recherches mensuelles estimées:', analysis.volumeMetrics.monthly_searches_estimate);
  console.log('- Uploads récents (30j):', analysis.volumeMetrics.recent_uploads_30d);

  console.log('\nMétriques de concurrence:');
  console.log('- Vues moyennes:', analysis.competitionMetrics.avg_views);
  console.log('- Dominance top créateur:', analysis.competitionMetrics.top_creator_dominance);
  console.log('- Barrière d\'entrée:', analysis.competitionMetrics.barrier_to_entry);

  console.log('\nMétriques de tendance:');
  console.log('- Direction:', analysis.trendMetrics.trend_direction);
  console.log('- Facteur de tendance:', analysis.trendMetrics.trend_factor);
  console.log('- Score de momentum:', analysis.trendMetrics.momentum_score);
}

// Exemple d'utilisation de l'analyseur d'artistes complet
async function exampleArtistAnalyzer() {
  console.log('\n=== Exemple Analyseur d\'Artistes Complet ===');

  const analyzer = createArtistAnalyzer(DEFAULT_SCORING_CONFIG);

  const mainArtist: Artist = {
    id: "key-glock",
    name: "Key Glock",
    genres: ["memphis rap", "trap", "southern hip hop"],
    popularity: 75
  };

  const candidates: Artist[] = [
    {
      id: "pooh-shiesty",
      name: "Pooh Shiesty",
      genres: ["memphis rap", "trap", "gangsta rap"],
      popularity: 68
    },
    {
      id: "est-gee",
      name: "EST Gee",
      genres: ["louisville rap", "trap"],
      popularity: 65
    },
    {
      id: "42-dugg",
      name: "42 Dugg",
      genres: ["detroit rap", "trap"],
      popularity: 70
    }
  ];

  // Filtrage des candidats
  const validCandidates = candidates.filter(candidate => 
    analyzer.validateCandidate(candidate, mainArtist)
  );

  console.log('Candidats valides:', validCandidates.length);

  // Optimisation de l'ordre d'analyse
  const optimizedCandidates = analyzer.optimizeCandidateOrder(validCandidates, mainArtist);
  
  console.log('Ordre optimisé:');
  optimizedCandidates.forEach((candidate, index) => {
    const similarity = SimilarityCalculator.calculateGenreOverlap(
      mainArtist.genres,
      candidate.genres
    );
    console.log(`${index + 1}. ${candidate.name} (similarité: ${MathUtils.round(similarity, 2)})`);
  });

  // Simulation du traitement (sans appels API réels)
  console.log('\nSimulation du traitement des candidats...');
  console.log('(En production, ceci ferait des appels aux APIs YouTube, Spotify, etc.)');
}

// Fonction principale pour exécuter tous les exemples
async function runAllExamples() {
  console.log('🎵 EXEMPLES D\'UTILISATION DES SERVICES TYPE BEAT RESEARCH API 🎵\n');
  
  try {
    await exampleScoringService();
    exampleSimilarityCalculator();
    exampleMathUtils();
    exampleYouTubeAnalyzer();
    await exampleArtistAnalyzer();
    
    console.log('\n✅ Tous les exemples ont été exécutés avec succès !');
    console.log('\n📝 Notes:');
    console.log('- Ces exemples utilisent des données simulées');
    console.log('- En production, les services feraient des appels aux APIs réelles');
    console.log('- Les calculs de scoring sont basés sur des algorithmes optimisés');
    console.log('- Le cache Redis améliorerait les performances en production');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des exemples:', error);
  }
}

// Export pour utilisation
export {
  exampleScoringService,
  exampleSimilarityCalculator,
  exampleMathUtils,
  exampleYouTubeAnalyzer,
  exampleArtistAnalyzer,
  runAllExamples
};

// Exécution si le fichier est lancé directement
if (require.main === module) {
  runAllExamples();
}

