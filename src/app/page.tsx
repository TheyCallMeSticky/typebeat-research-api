// Page d'accueil avec documentation de l'API

import { app } from '@/lib/config';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            Type Beat Research API
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Découvrez les artistes type beat avec le meilleur ratio volume/concurrence. 
            Analysez les tendances, calculez les scores et trouvez les opportunités cachées.
          </p>
        </header>

        {/* API Status */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-6 mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white mb-2">API Status</h2>
              <p className="text-gray-300">Service opérationnel</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-medium">Online</span>
            </div>
          </div>
        </div>

        {/* Endpoints */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* Suggestions Endpoint */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <div className="flex items-center mb-4">
              <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-medium mr-3">
                POST
              </span>
              <h3 className="text-lg font-semibold text-white">Suggestions</h3>
            </div>
            <p className="text-gray-300 mb-4">
              Obtenez 3 suggestions d&apos;artistes similaires avec scores optimisés
            </p>
            <code className="text-sm text-blue-300 bg-black/30 p-2 rounded block">
              /api/research/suggestions
            </code>
          </div>

          {/* Similar Artists Endpoint */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <div className="flex items-center mb-4">
              <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm font-medium mr-3">
                GET
              </span>
              <h3 className="text-lg font-semibold text-white">Artistes Similaires</h3>
            </div>
            <p className="text-gray-300 mb-4">
              Trouvez des artistes similaires via Spotify et Last.fm
            </p>
            <code className="text-sm text-blue-300 bg-black/30 p-2 rounded block">
              /api/artists/similar
            </code>
          </div>

          {/* Metrics Endpoint */}
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <div className="flex items-center mb-4">
              <span className="bg-purple-500 text-white px-2 py-1 rounded text-sm font-medium mr-3">
                POST
              </span>
              <h3 className="text-lg font-semibold text-white">Métriques</h3>
            </div>
            <p className="text-gray-300 mb-4">
              Calculez les métriques détaillées d&apos;un artiste
            </p>
            <code className="text-sm text-blue-300 bg-black/30 p-2 rounded block">
              /api/metrics/calculate
            </code>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-white/10 backdrop-blur-md rounded-lg p-8 mb-8">
          <h2 className="text-3xl font-bold text-white mb-6">Quick Start</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-3">1. Obtenir des suggestions</h3>
              <div className="bg-black/30 rounded-lg p-4">
                <pre className="text-green-400 text-sm overflow-x-auto">
{`curl -X POST ${app.baseURL}/api/research/suggestions \\
  -H "Content-Type: application/json" \\
  -d '{
    "artist": "Key Glock",
    "limit": 3,
    "filters": {
      "genre": "Memphis rap",
      "bpm_range": [140, 160]
    }
  }'`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-3">2. Rechercher des artistes similaires</h3>
              <div className="bg-black/30 rounded-lg p-4">
                <pre className="text-blue-400 text-sm overflow-x-auto">
{`curl "${app.baseURL}/api/artists/similar?artist=Key%20Glock&limit=10"`}
                </pre>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-3">3. Calculer les métriques</h3>
              <div className="bg-black/30 rounded-lg p-4">
                <pre className="text-purple-400 text-sm overflow-x-auto">
{`curl -X POST ${app.baseURL}/api/metrics/calculate \\
  -H "Content-Type: application/json" \\
  -d '{
    "artist_name": "Pooh Shiesty",
    "force_refresh": false
  }'`}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h3 className="text-2xl font-bold text-white mb-4">🎯 Algorithme de Scoring</h3>
            <ul className="text-gray-300 space-y-2">
              <li>• Volume de recherche YouTube</li>
              <li>• Analyse de la concurrence</li>
              <li>• Détection des tendances</li>
              <li>• Score de similarité</li>
              <li>• Saturation du marché</li>
            </ul>
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <h3 className="text-2xl font-bold text-white mb-4">🔗 Sources de Données</h3>
            <ul className="text-gray-300 space-y-2">
              <li>• YouTube Data API v3</li>
              <li>• Spotify Web API</li>
              <li>• Last.fm API</li>
              <li>• Cache Redis intelligent</li>
              <li>• Base de données PostgreSQL</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-400">
          <p>Type Beat Research API v1.0 - Optimisé pour les producteurs et créateurs</p>
          <p className="mt-2">
            Développé avec Next.js 15, TypeScript, et les meilleures APIs musicales
          </p>
        </footer>
      </div>
    </div>
  );
}

