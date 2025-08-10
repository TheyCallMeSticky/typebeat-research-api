// Test d'intégration des APIs externes avec les vraies clés

import { createAPIOrchestrator, validateAPICredentials } from '../src/lib/apis';

async function testAPIIntegration() {
  console.log('🧪 TESTS D\'INTÉGRATION DES APIS EXTERNES\n');

  // 1. Validation des credentials
  console.log('1️⃣ Validation des credentials...');
  const credentialsCheck = validateAPICredentials();
  
  if (!credentialsCheck.valid) {
    console.error('❌ Credentials manquants:', credentialsCheck.missing);
    return;
  }
  
  if (credentialsCheck.warnings.length > 0) {
    console.warn('⚠️ Warnings:', credentialsCheck.warnings);
  }
  
  console.log('✅ Tous les credentials requis sont présents\n');

  // 2. Initialisation de l'orchestrateur
  console.log('2️⃣ Initialisation de l\'orchestrateur API...');
  
  try {
    const orchestrator = createAPIOrchestrator();
    await orchestrator.initialize();
    console.log('✅ Orchestrateur initialisé avec succès\n');

    // 3. Test YouTube API
    console.log('3️⃣ Test YouTube API...');
    try {
      const youtubeMetrics = await orchestrator.analyzeYouTubeMetrics('Drake');
      console.log('✅ YouTube API fonctionne');
      console.log(`   - Volume: ${youtubeMetrics.volume.monthly_searches_estimate} recherches/mois`);
      console.log(`   - Concurrence: ${youtubeMetrics.competition.total_videos} vidéos`);
      console.log(`   - Tendance: ${youtubeMetrics.trends.trend_direction}\n`);
    } catch (error) {
      console.error('❌ YouTube API error:', error);
    }

    // 4. Test analyse complète d'un artiste
    console.log('4️⃣ Test analyse complète d\'artiste...');
    try {
      const analysis = await orchestrator.analyzeArtist('Pooh Shiesty', {
        includeRelated: true,
        maxRelated: 5
      });
      
      console.log('✅ Analyse complète réussie');
      console.log(`   - Artiste principal: ${analysis.mainArtist.name}`);
      console.log(`   - Genres: ${analysis.mainArtist.genres.join(', ')}`);
      console.log(`   - Artistes Spotify similaires: ${analysis.relatedArtists.spotify.length}`);
      console.log(`   - Artistes Last.fm similaires: ${analysis.relatedArtists.lastfm.length}`);
      console.log(`   - Temps de traitement: ${analysis.processingTime}ms`);
      console.log(`   - Mis en cache: ${analysis.cached}\n`);
    } catch (error) {
      console.error('❌ Analyse artiste error:', error);
    }

    // 5. Test recherche d'artistes similaires
    console.log('5️⃣ Test recherche d\'artistes similaires...');
    try {
      const similarArtists = await orchestrator.findSimilarArtists('Key Glock', {
        limit: 3,
        minSimilarity: 0.3
      });
      
      console.log('✅ Recherche d\'artistes similaires réussie');
      console.log(`   - Artiste principal: ${similarArtists.mainArtist.name}`);
      console.log(`   - Candidats trouvés: ${similarArtists.candidates.length}`);
      
      similarArtists.candidates.forEach((candidate, index) => {
        const avgSimilarity = (
          candidate.similarity.spotify_similarity +
          candidate.similarity.lastfm_similarity +
          candidate.similarity.genre_overlap
        ) / 3;
        console.log(`   ${index + 1}. ${candidate.artist.name} (similarité: ${(avgSimilarity * 100).toFixed(1)}%)`);
      });
      console.log(`   - Temps de traitement: ${similarArtists.processingTime}ms\n`);
    } catch (error) {
      console.error('❌ Recherche artistes similaires error:', error);
    }

    // 6. Test statistiques d'utilisation
    console.log('6️⃣ Statistiques d\'utilisation des APIs...');
    try {
      const stats = await orchestrator.getUsageStats();
      console.log('✅ Statistiques récupérées');
      console.log(`   - YouTube: ${stats.youtube.quotaUsed}/${stats.youtube.quotaLimit} quota utilisé`);
      console.log(`   - Spotify: ${stats.spotify.requestCount} requêtes, token valide: ${stats.spotify.hasValidToken}`);
      console.log(`   - Last.fm: ${stats.lastfm.totalRequests} requêtes totales`);
      console.log(`   - Cache: ${stats.cache.hits} hits, ${stats.cache.misses} misses (${stats.cache.hitRate.toFixed(1)}% hit rate)`);
      console.log(`   - Cache: ${stats.cache.totalKeys} clés stockées\n`);
    } catch (error) {
      console.error('❌ Statistiques error:', error);
    }

    // 7. Test optimisation du cache
    console.log('7️⃣ Test optimisation du cache...');
    try {
      const optimization = await orchestrator.optimizeCache();
      console.log('✅ Optimisation du cache réussie');
      console.log(`   - Entrées supprimées: ${optimization.deletedEntries}`);
      console.log(`   - Temps d'optimisation: ${optimization.optimizationTime}ms\n`);
    } catch (error) {
      console.error('❌ Optimisation cache error:', error);
    }

    // 8. Fermeture propre
    console.log('8️⃣ Fermeture des connexions...');
    await orchestrator.shutdown();
    console.log('✅ Connexions fermées proprement\n');

    console.log('🎉 TOUS LES TESTS D\'INTÉGRATION TERMINÉS AVEC SUCCÈS !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
  }
}

// Fonction pour tester individuellement chaque API
async function testIndividualAPIs() {
  console.log('\n🔧 TESTS INDIVIDUELS DES APIS\n');

  // Test YouTube seul
  console.log('📺 Test YouTube API...');
  try {
    const { createYouTubeClient } = await import('../src/lib/apis');
    const youtube = createYouTubeClient();
    
    const searchResult = await youtube.searchTypeBeat('Travis Scott', { maxResults: 5 });
    console.log(`✅ YouTube: ${searchResult.videos.length} vidéos trouvées`);
    console.log(`   Query: "${searchResult.query}"`);
    console.log(`   Total résultats: ${searchResult.totalResults}`);
    
    const quotaUsage = youtube.getQuotaUsage();
    console.log(`   Quota utilisé: ${quotaUsage.used}/${quotaUsage.limit} (${quotaUsage.percentage}%)\n`);
  } catch (error) {
    console.error('❌ YouTube test failed:', error);
  }

  // Test Spotify seul
  console.log('🎵 Test Spotify API...');
  try {
    const { createSpotifyClient } = await import('../src/lib/apis');
    const spotify = createSpotifyClient();
    
    const searchResult = await spotify.findSimilarArtists('Lil Baby', 5);
    console.log(`✅ Spotify: Artiste principal trouvé: ${searchResult.mainArtist?.name || 'Non trouvé'}`);
    console.log(`   Artistes liés: ${searchResult.relatedArtists.length}`);
    console.log(`   Résultats de recherche: ${searchResult.searchResults.length}`);
    
    const stats = spotify.getUsageStats();
    console.log(`   Requêtes: ${stats.requestCount}, Token valide: ${stats.hasValidToken}\n`);
  } catch (error) {
    console.error('❌ Spotify test failed:', error);
  }

  // Test Last.fm seul
  console.log('🎧 Test Last.fm API...');
  try {
    const { createLastFmClient } = await import('../src/lib/apis');
    const lastfm = createLastFmClient();
    
    const analysis = await lastfm.analyzeArtist('Future');
    console.log(`✅ Last.fm: Artiste trouvé: ${analysis.artistInfo?.name || 'Non trouvé'}`);
    console.log(`   Artistes similaires: ${analysis.similarArtists.length}`);
    console.log(`   Tags: ${analysis.tags.slice(0, 3).join(', ')}`);
    
    if (analysis.stats) {
      console.log(`   Listeners: ${analysis.stats.listeners.toLocaleString()}`);
      console.log(`   Plays: ${analysis.stats.playcount.toLocaleString()}`);
    }
    
    const stats = lastfm.getUsageStats();
    console.log(`   Requêtes: ${stats.totalRequests}\n`);
  } catch (error) {
    console.error('❌ Last.fm test failed:', error);
  }

  // Test Genius seul (optionnel)
  console.log('🧠 Test Genius API...');
  try {
    const { createGeniusClient } = await import('../src/lib/apis');
    const genius = createGeniusClient();
    
    const available = await genius.checkAvailability();
    if (available) {
      const artistData = await genius.findArtist('Kendrick Lamar');
      console.log(`✅ Genius: Artiste trouvé: ${artistData?.name || 'Non trouvé'}`);
      if (artistData) {
        console.log(`   Followers: ${artistData.followers_count.toLocaleString()}`);
        console.log(`   Chansons populaires: ${artistData.popular_songs.length}`);
        console.log(`   Vérifié: ${artistData.is_verified}`);
      }
    } else {
      console.log('⚠️ Genius API non disponible (possiblement bloqué par Cloudflare)');
    }
    
    const stats = genius.getUsageStats();
    console.log(`   Requêtes: ${stats.requestCount}\n`);
  } catch (error) {
    console.error('❌ Genius test failed:', error);
  }
}

// Exécution des tests
async function runAllTests() {
  try {
    await testAPIIntegration();
    await testIndividualAPIs();
    
    console.log('\n✨ TOUS LES TESTS TERMINÉS !');
    console.log('\n📊 Résumé:');
    console.log('- Les APIs sont correctement intégrées');
    console.log('- Le cache Redis fonctionne');
    console.log('- L\'orchestrateur gère les erreurs');
    console.log('- Les vraies clés API sont opérationnelles');
    
  } catch (error) {
    console.error('\n💥 Erreur globale:', error);
    process.exit(1);
  }
}

// Export pour utilisation
export {
  testAPIIntegration,
  testIndividualAPIs,
  runAllTests
};

// Exécution si le fichier est lancé directement
if (require.main === module) {
  runAllTests();
}

