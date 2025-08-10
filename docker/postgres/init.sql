-- Script d'initialisation PostgreSQL pour Type Beat Research API

-- Création de la base de données (si elle n'existe pas déjà)
-- CREATE DATABASE typebeat_research_dev;

-- Connexion à la base de données
\c typebeat_research_dev;

-- Extension pour UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table pour l'historique des recherches
CREATE TABLE IF NOT EXISTS search_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_query VARCHAR(255) NOT NULL,
    suggestions JSONB,
    filters_applied JSONB,
    processing_time_ms INTEGER,
    api_calls_used JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_ip INET,
    user_agent TEXT
);

-- Index pour les recherches fréquentes
CREATE INDEX IF NOT EXISTS idx_search_history_artist ON search_history(artist_query);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON search_history(created_at);

-- Table pour le cache des artistes
CREATE TABLE IF NOT EXISTS artist_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) UNIQUE NOT NULL,
    spotify_id VARCHAR(255),
    lastfm_mbid VARCHAR(255),
    genre VARCHAR(100),
    popularity INTEGER,
    metadata JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les recherches d'artistes
CREATE INDEX IF NOT EXISTS idx_artist_cache_name ON artist_cache(name);
CREATE INDEX IF NOT EXISTS idx_artist_cache_spotify_id ON artist_cache(spotify_id);
CREATE INDEX IF NOT EXISTS idx_artist_cache_genre ON artist_cache(genre);

-- Table pour les métriques calculées
CREATE TABLE IF NOT EXISTS artist_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    artist_name VARCHAR(255) NOT NULL,
    volume_metrics JSONB,
    competition_metrics JSONB,
    trend_metrics JSONB,
    saturation_metrics JSONB,
    similarity_metrics JSONB,
    final_score JSONB,
    confidence_level VARCHAR(20),
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les métriques
CREATE INDEX IF NOT EXISTS idx_artist_metrics_name ON artist_metrics(artist_name);
CREATE INDEX IF NOT EXISTS idx_artist_metrics_calculated_at ON artist_metrics(calculated_at);
CREATE INDEX IF NOT EXISTS idx_artist_metrics_expires_at ON artist_metrics(expires_at);

-- Table pour les artistes similaires (cache)
CREATE TABLE IF NOT EXISTS similar_artists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_artist VARCHAR(255) NOT NULL,
    similar_artist VARCHAR(255) NOT NULL,
    similarity_score DECIMAL(3,2),
    source_api VARCHAR(50) NOT NULL, -- 'spotify', 'lastfm', etc.
    metadata JSONB,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(source_artist, similar_artist, source_api)
);

-- Index pour les artistes similaires
CREATE INDEX IF NOT EXISTS idx_similar_artists_source ON similar_artists(source_artist);
CREATE INDEX IF NOT EXISTS idx_similar_artists_similar ON similar_artists(similar_artist);
CREATE INDEX IF NOT EXISTS idx_similar_artists_api ON similar_artists(source_api);

-- Table pour les statistiques d'usage de l'API
CREATE TABLE IF NOT EXISTS api_usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    user_ip INET,
    user_agent TEXT,
    api_key_used VARCHAR(255),
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les statistiques
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage_stats(endpoint);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_stats(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_status ON api_usage_stats(status_code);

-- Table pour les clés API (si authentification activée)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rate_limit_per_minute INTEGER DEFAULT 100,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les clés API
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

-- Vue pour les statistiques rapides
CREATE OR REPLACE VIEW api_stats_summary AS
SELECT 
    DATE(created_at) as date,
    endpoint,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE status_code < 400) as successful_requests,
    COUNT(*) FILTER (WHERE status_code >= 400) as failed_requests,
    AVG(response_time_ms) as avg_response_time,
    MAX(response_time_ms) as max_response_time
FROM api_usage_stats 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), endpoint
ORDER BY date DESC, endpoint;

-- Fonction pour nettoyer les anciennes données
CREATE OR REPLACE FUNCTION cleanup_old_data() RETURNS void AS $$
BEGIN
    -- Supprimer les métriques expirées
    DELETE FROM artist_metrics WHERE expires_at < NOW();
    
    -- Supprimer les statistiques de plus de 90 jours
    DELETE FROM api_usage_stats WHERE created_at < NOW() - INTERVAL '90 days';
    
    -- Supprimer l'historique de recherche de plus de 30 jours
    DELETE FROM search_history WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Mettre à jour les statistiques
    ANALYZE;
END;
$$ LANGUAGE plpgsql;

-- Données de test (optionnel)
INSERT INTO artist_cache (name, genre, popularity, metadata) VALUES
('Key Glock', 'Memphis rap', 75, '{"label": "Paper Route Empire", "region": "US"}'),
('Pooh Shiesty', 'Memphis rap', 78, '{"label": "1017 Records", "region": "US"}'),
('EST Gee', 'Louisville rap', 68, '{"label": "Yo Gotti", "region": "US"}')
ON CONFLICT (name) DO NOTHING;

-- Message de confirmation
SELECT 'Base de données initialisée avec succès!' as status;

