#!/bin/bash

# Script de test pour l'API TypeBeat Research
# Usage: ./test_artistfinder.sh [BASE_URL]

set -e

# Configuration
BASE_URL=${1:-"http://localhost:3002"}
API_VERSION="v1"
API_BASE="$BASE_URL/api"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction d'affichage
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Fonction pour tester un endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo
    log_info "Testing: $description"
    log_info "Endpoint: $method $endpoint"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$endpoint")
    fi
    
    # Séparer le body et le status code
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
        log_success "HTTP $http_code - Success"
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
    else
        log_error "HTTP $http_code - Failed"
        echo "$body"
        return 1
    fi
}

# Fonction pour vérifier la santé de l'API
check_health() {
    log_info "Checking API health..."
    
    if curl -s "$BASE_URL/api/health" > /dev/null 2>&1; then
        log_success "API is responding"
        return 0
    else
        log_error "API is not responding at $BASE_URL"
        return 1
    fi
}

# Tests principaux
run_tests() {
    echo "🎵 TYPEBEAT RESEARCH API TESTS"
    echo "================================"
    echo "Base URL: $BASE_URL"
    echo "API Base: $API_BASE"
    echo

    # 1. Health Check
    if ! check_health; then
        log_error "API health check failed. Exiting."
        exit 1
    fi

    # 2. Test de suggestions d'artistes
    log_info "🔍 Testing artist suggestions..."
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "Drake", "limit": 5, "include_metrics": true}' \
        "Get artist suggestions for Drake"

    # 3. Test d'artistes similaires
    log_info "🎯 Testing similar artists..."
    test_endpoint "GET" "$API_BASE/artists/similar?artist=Lil%20Baby&limit=3" \
        "" \
        "Get similar artists to Lil Baby"

    # 4. Test avec POST pour artistes similaires
    test_endpoint "POST" "$API_BASE/artists/similar" \
        '{"artist": "Future", "limit": 5, "min_similarity": 0.3}' \
        "Get similar artists to Future with similarity threshold"

    # 5. Test de calcul de métriques
    log_info "📊 Testing metrics calculation..."
    test_endpoint "GET" "$API_BASE/metrics/calculate?artist=Travis%20Scott" \
        "" \
        "Calculate metrics for Travis Scott"

    # 6. Test avec POST pour métriques
    test_endpoint "POST" "$API_BASE/metrics/calculate" \
        '{"artist": "Kendrick Lamar", "include_youtube": true, "include_spotify": true}' \
        "Calculate comprehensive metrics for Kendrick Lamar"

    # 7. Test avec des artistes de différents genres
    log_info "🎸 Testing different genres..."
    
    # Hip-hop
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "Pooh Shiesty", "limit": 3}' \
        "Hip-hop artist suggestions"

    # Trap
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "Key Glock", "limit": 3}' \
        "Trap artist suggestions"

    # Melodic rap
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "Lil Tjay", "limit": 3}' \
        "Melodic rap artist suggestions"

    # 8. Test de gestion d'erreurs
    log_info "❌ Testing error handling..."
    
    # Artiste inexistant
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "NonExistentArtist123456", "limit": 3}' \
        "Non-existent artist handling" || log_warning "Expected error for non-existent artist"

    # Paramètres invalides
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "", "limit": -1}' \
        "Invalid parameters handling" || log_warning "Expected error for invalid parameters"

    # 9. Test de performance avec cache
    log_info "⚡ Testing cache performance..."
    
    start_time=$(date +%s%N)
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "Drake", "limit": 5}' \
        "First request (cache miss)"
    end_time=$(date +%s%N)
    first_duration=$((($end_time - $start_time) / 1000000))
    
    start_time=$(date +%s%N)
    test_endpoint "POST" "$API_BASE/research/suggestions" \
        '{"artist": "Drake", "limit": 5}' \
        "Second request (cache hit)"
    end_time=$(date +%s%N)
    second_duration=$((($end_time - $start_time) / 1000000))
    
    log_info "Performance comparison:"
    echo "  First request:  ${first_duration}ms"
    echo "  Second request: ${second_duration}ms"
    
    if [ $second_duration -lt $first_duration ]; then
        log_success "Cache is working! Second request was faster."
    else
        log_warning "Cache might not be working as expected."
    fi

    # 10. Test des statistiques d'utilisation
    log_info "📈 Testing usage statistics..."
    test_endpoint "GET" "$API_BASE/stats" \
        "" \
        "Get API usage statistics" || log_warning "Stats endpoint might not be implemented"

    echo
    echo "🎉 ALL TESTS COMPLETED!"
    echo "========================"
    log_success "TypeBeat Research API tests finished"
}

# Fonction d'aide
show_help() {
    echo "Usage: $0 [BASE_URL]"
    echo
    echo "Test script for TypeBeat Research API"
    echo
    echo "Arguments:"
    echo "  BASE_URL    Base URL of the API (default: http://localhost:3002)"
    echo
    echo "Examples:"
    echo "  $0                                    # Test local API"
    echo "  $0 http://localhost:3002              # Test specific port"
    echo "  $0 https://api.typeflick.com          # Test production API"
    echo
    echo "Requirements:"
    echo "  - curl"
    echo "  - jq (optional, for JSON formatting)"
}

# Vérification des dépendances
check_dependencies() {
    if ! command -v curl &> /dev/null; then
        log_error "curl is required but not installed."
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        log_warning "jq is not installed. JSON output will not be formatted."
    fi
}

# Point d'entrée principal
main() {
    case "${1:-}" in
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            check_dependencies
            run_tests
            ;;
    esac
}

# Exécution
main "$@"

