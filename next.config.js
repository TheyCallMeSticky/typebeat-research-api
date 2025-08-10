/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuration du port via variable d'environnement
  env: {
    PORT: process.env.PORT || '3002',
  },
  
  // Configuration pour Docker
  output: 'standalone',
  
  // Configuration CORS pour les APIs
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  
  // Désactiver la télémétrie
  telemetry: {
    disabled: true,
  },
  
  // Configuration pour le développement
  experimental: {
    // Optimisations pour Docker
    outputFileTracingRoot: undefined,
  },
};

module.exports = nextConfig;

