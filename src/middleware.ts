// Middleware pour CORS, rate limiting et validation

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiting, security } from '@/lib/config';

// Simple in-memory rate limiter (pour développement)
// En production, utiliser Redis
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function getRateLimitKey(request: NextRequest): string {
  // Utiliser l'IP du client ou un identifiant d'API key
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return ip;
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const limit = rateLimiting.requestsPerMinute;

  const current = rateLimitMap.get(key);
  
  if (!current || now > current.resetTime) {
    // Nouvelle fenêtre ou première requête
    const resetTime = now + windowMs;
    rateLimitMap.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: limit - 1, resetTime };
  }

  if (current.count >= limit) {
    // Limite dépassée
    return { allowed: false, remaining: 0, resetTime: current.resetTime };
  }

  // Incrémenter le compteur
  current.count++;
  rateLimitMap.set(key, current);
  
  return { allowed: true, remaining: limit - current.count, resetTime: current.resetTime };
}

export function middleware(request: NextRequest) {
  // CORS headers
  const response = NextResponse.next();
  
  // Configurer CORS
  response.headers.set('Access-Control-Allow-Origin', security.corsOrigin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  response.headers.set('Access-Control-Max-Age', '86400');

  // Gérer les requêtes OPTIONS (preflight)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: response.headers });
  }

  // Rate limiting pour les routes API
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const rateLimitKey = getRateLimitKey(request);
    const { allowed, remaining, resetTime } = checkRateLimit(rateLimitKey);

    // Ajouter les headers de rate limiting
    response.headers.set('X-RateLimit-Limit', rateLimiting.requestsPerMinute.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', new Date(resetTime).toISOString());

    if (!allowed) {
      return NextResponse.json({
        success: false,
        error: {
          error: 'RATE_LIMIT_EXCEEDED',
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded. Please try again later.',
          timestamp: new Date().toISOString(),
        }
      }, { 
        status: 429,
        headers: response.headers
      });
    }
  }

  // Validation de l'API key si requise
  if (security.apiKeyRequired && request.nextUrl.pathname.startsWith('/api/')) {
    const apiKey = request.headers.get('X-API-Key') || request.nextUrl.searchParams.get('api_key');
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: {
          error: 'AUTHENTICATION_REQUIRED',
          code: 'MISSING_API_KEY',
          message: 'API key is required',
          timestamp: new Date().toISOString(),
        }
      }, { 
        status: 401,
        headers: response.headers
      });
    }

    // TODO: Valider l'API key contre la base de données
    // Pour l'instant, accepter toutes les clés non vides
  }

  // Ajouter des headers de sécurité
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

// Configuration du matcher pour appliquer le middleware
export const config = {
  matcher: [
    // Appliquer à toutes les routes API
    '/api/:path*',
    // Exclure les fichiers statiques
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

