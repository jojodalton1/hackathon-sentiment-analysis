// Variables globales
let sentimentChart;

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', function() {
    loadStats();
    loadRandomMovies();
    setupEventListeners();
});

// Configuration des événements
function setupEventListeners() {
    const searchBtn = document.getElementById('searchBtn');
    const loadRandomBtn = document.getElementById('loadRandomBtn');
    const searchInput = document.getElementById('searchInput');

    searchBtn.addEventListener('click', searchMovies);
    loadRandomBtn.addEventListener('click', loadRandomMovies);
    
    // Recherche en appuyant sur Entrée
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchMovies();
        }
    });
}

// Charger les statistiques depuis l'API
async function loadStats() {
    try {
        console.log('📊 Chargement des statistiques...');
        const response = await fetch('/api/sentiment-stats');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const stats = await response.json();
        console.log('📈 Statistiques reçues:', stats);
        
        updateStatsDisplay(stats);
        createSentimentChart(stats);
        
    } catch (error) {
        console.error('❌ Erreur chargement stats:', error);
        
        // Fallback vers stats par défaut
        const fallbackStats = {
            total: 500,
            positive: 210,
            negative: 95,
            neutral: 195
        };
        
        updateStatsDisplay(fallbackStats);
        createSentimentChart(fallbackStats);
    }
}

// Mettre à jour l'affichage des statistiques
function updateStatsDisplay(stats) {
    document.getElementById('totalMovies').textContent = stats.total;
    document.getElementById('positiveCount').textContent = stats.positive;
    document.getElementById('negativeCount').textContent = stats.negative;
    document.getElementById('neutralCount').textContent = stats.neutral;
}

// Créer le graphique de sentiments
function createSentimentChart(stats) {
    const ctx = document.getElementById('sentimentChart').getContext('2d');
    
    if (sentimentChart) {
        sentimentChart.destroy();
    }
    
    sentimentChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Positif', 'Négatif', 'Neutre'],
            datasets: [{
                data: [stats.positive, stats.negative, stats.neutral],
                backgroundColor: [
                    '#48bb78',
                    '#f56565',
                    '#ed8936'
                ],
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        font: {
                            size: 14,
                            weight: 'bold'
                        }
                    }
                }
            }
        }
    });
}

// Rechercher des films
async function searchMovies() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    console.log(`🔍 Recherche: "${searchTerm}"`);
    await loadMovies(searchTerm);
}

// Charger des films aléatoires
async function loadRandomMovies() {
    console.log('🎲 Chargement de films aléatoires...');
    await loadMovies('');
}

// Charger les films depuis l'API
async function loadMovies(search = '') {
    const loadingSpinner = document.getElementById('loadingSpinner');
    const moviesGrid = document.getElementById('moviesGrid');
    
    // Afficher le spinner
    loadingSpinner.style.display = 'block';
    moviesGrid.innerHTML = '';
    
    try {
        console.log(`📡 Appel API: /api/movies?search=${search}&limit=12`);
        
        const url = search 
            ? `/api/movies?search=${encodeURIComponent(search)}&limit=12`
            : '/api/movies?limit=12';
            
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const movies = await response.json();
        console.log(`🎬 ${movies.length} films reçus`);
        
        // Masquer le spinner
        loadingSpinner.style.display = 'none';
        
        if (movies.length === 0) {
            moviesGrid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 2rem;">
                    <h3>Aucun film trouvé ${search ? `pour "${search}"` : ''} 😕</h3>
                    <p>Essayez un autre terme de recherche</p>
                </div>
            `;
            return;
        }
        
        // Afficher les films
        displayMovies(movies);
        
    } catch (error) {
        console.error('❌ Erreur chargement films:', error);
        loadingSpinner.style.display = 'none';
        
        moviesGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: red;">
                <h3>Erreur de connexion 😞</h3>
                <p>Impossible de charger les films depuis MongoDB</p>
                <p>Vérifiez la connexion à la base de données</p>
            </div>
        `;
    }
}

// Afficher les films dans la grille
function displayMovies(movies) {
    const moviesGrid = document.getElementById('moviesGrid');
    
    moviesGrid.innerHTML = movies.map(movie => {
        const sentiment = movie.sentiment;
        const sentimentClass = sentiment.sentiment;
        const sentimentEmoji = getSentimentEmoji(sentiment.sentiment);
        const year = movie.year || 'N/A';
        const plot = movie.plot || 'Aucune description disponible';
        const genres = movie.genres ? movie.genres.join(', ') : 'Genre inconnu';
        
        return `
            <div class="movie-card ${sentimentClass}">
                <div class="movie-title">${movie.title || 'Titre inconnu'}</div>
                <div class="movie-year">📅 ${year} | 🎭 ${genres}</div>
                <div class="movie-plot">${truncateText(plot, 200)}</div>
                <div class="sentiment-info">
                    <span class="sentiment-badge ${sentimentClass}">
                        ${sentimentEmoji} ${sentiment.sentiment.toUpperCase()}
                        <span class="sentiment-score">(${sentiment.score.toFixed(2)})</span>
                    </span>
                </div>
            </div>
        `;
    }).join('');
    
    // Ajouter l'animation
    setTimeout(animateCards, 100);
}

// Obtenir l'emoji selon le sentiment
function getSentimentEmoji(sentiment) {
    switch(sentiment) {
        case 'positive': return '😊';
        case 'negative': return '😞';
        case 'neutral': return '😐';
        default: return '🤔';
    }
}

// Tronquer le texte
function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

// Animation d'entrée pour les cartes
function animateCards() {
    const cards = document.querySelectorAll('.movie-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Test de connexion MongoDB (pour debug)
async function testMongoConnection() {
    try {
        const response = await fetch('/api/test');
        const result = await response.json();
        console.log('🔧 Test MongoDB:', result);
        return result.connected;
    } catch (error) {
        console.error('❌ Test connexion échoué:', error);
        return false;
    }
}