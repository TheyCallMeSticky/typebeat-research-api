// Health check endpoint avec tests des APIs externes
// GET /api/health

import { NextResponse } from 'next/server';

export async function GET() {
  const startTime = Date.now();

  try {
    console.log('🏥 Starting comprehensive health check...');

    // Utiliser le vrai orchestrateur pour le health check
    const { createAPIOrchestrator } = await import('@/lib/apis/api-orchestrator-real');
    const orchestrator = createAPIOrchestrator();

    // Effectuer le health check complet
    const healthResult = await orchestrator.healthCheck();

    const responseTime = Date.now() - startTime;

    // Déterminer le code de statut HTTP
    const httpStatus = healthResult.status === 'healthy' ? 200 : 
                      healthResult.status === 'degraded' ? 200 : 503;

    const response = {
      status: healthResult.status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "0.1.0",
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3002',
      services: healthResult.services,
      details: {
        ...healthResult.details,
        response_time_ms: responseTime
      }
    };

    console.log(`✅ Health check completed in ${responseTime}ms - Status: ${healthResult.status}`);

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

// Endpoint pour un health check rapide (sans tests des APIs externes)
export async function HEAD() {
  return new Response(null, { status: 200 });
}

