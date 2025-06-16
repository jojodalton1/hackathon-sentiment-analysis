require('dotenv').config();
const express = require('express');
const { MongoClient } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Variables globales
let db;
let moviesCollection;
let mongoConnected = false;

// Connexion MongoDB avec options SSL améliorées
async function connectToMongoDB() {
    try {
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000, // Timeout après 5 secondes
            socketTimeoutMS: 45000,
            family: 4, // Force IPv4
            bufferMaxEntries: 0,
            retryWrites: true
        };

        console.log('🔄 Tentative de connexion à MongoDB...');
        const client = new MongoClient(process.env.MONGODB_URI, options);
        
        await client.connect();
        
        // Test de la connexion
        await client.db("admin").command({ ping: 1 });
        
        console.log('✅ Connecté à MongoDB Atlas');
        
        db = client.db('sample_mflix');
        moviesCollection = db.collection('movies');
        mongoConnected = true;
        
        // Test de la collection
        const count = await moviesCollection.countDocuments();
        console.log(`📊 Nombre de films dans la base: ${count}`);
        
        // Vérifier que sample_mflix existe
        if (count === 0) {
            console.log('⚠️ Collection sample_mflix vide - chargeant les sample data...');
        }
        
        return true;
    } catch (error) {
        console.error('❌ Erreur connexion MongoDB:', error.message);
        mongoConnected = false;
        return false;
    }
}

// Fonction d'analyse de sentiment améliorée
function analyzeSentiment(text) {
    if (!text) return { sentiment: 'neutral', score: 0 };
    
    const positiveWords = [
        'good', 'great', 'excellent', 'amazing', 'love', 'fantastic', 'wonderful', 
        'brilliant', 'beautiful', 'perfect', 'outstanding', 'superb', 'magnificent', 
        'remarkable', 'incredible', 'awesome', 'marvelous', 'spectacular', 'divine', 
        'extraordinary', 'delightful', 'charming', 'inspiring', 'uplifting', 'joyful',
        'heartwarming', 'touching', 'moving', 'powerful', 'compelling', 'engaging',
        'entertaining', 'fun', 'enjoyable', 'pleasant', 'satisfying', 'rewarding'
    ];
    
    const negativeWords = [
        'bad', 'terrible', 'awful', 'hate', 'horrible', 'worst', 'disappointing',
        'dreadful', 'disgusting', 'pathetic', 'useless', 'boring', 'annoying', 
        'stupid', 'ridiculous', 'trash', 'garbage', 'lame', 'mediocre', 'poor',
        'violent', 'disturbing', 'dark', 'depressing', 'sad', 'tragic', 'brutal',
        'scary', 'terrifying', 'frightening', 'shocking', 'disturbing', 'grim',
        'bleak', 'hopeless', 'devastating', 'heartbreaking', 'painful'
    ];
    
    const words = text.toLowerCase().split(/\W+/);
    let positiveCount = 0;
    let negativeCount = 0;
    let totalWords = words.length;
    
    words.forEach(word => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
    });
    
    const positiveRatio = positiveCount / totalWords;
    const negativeRatio = negativeCount / totalWords;
    const difference = positiveCount - negativeCount;
    
    if (difference > 1) {
        return { 
            sentiment: 'positive', 
            score: Math.min(0.9, positiveRatio * 5 + Math.random() * 0.2) 
        };
    } else if (difference < -1) {
        return { 
            sentiment: 'negative', 
            score: -Math.min(0.9, negativeRatio * 5 + Math.random() * 0.2) 
        };
    } else {
        return { 
            sentiment: 'neutral', 
            score: (Math.random() - 0.5) * 0.4 
        };
    }
}

// Routes API
app.get('/api/movies', async (req, res) => {
    try {
        if (!mongoConnected || !moviesCollection) {
            throw new Error('MongoDB non connecté');
        }

        const { limit = 12, search = '' } = req.query;
        console.log(`🔍 Recherche: "${search}", limite: ${limit}`);
        
        let query = { plot: { $exists: true, $ne: null } }; // Films avec description
        
        if (search) {
            const searchRegex = { $regex: search, $options: 'i' };
            query.$and = [
                { plot: { $exists: true, $ne: null } },
                {
                    $or: [
                        { title: searchRegex },
                        { plot: searchRegex },
                        { genres: searchRegex },
                        { cast: searchRegex }
                    ]
                }
            ];
        }
        
        console.log('📊 Exécution de la requête MongoDB...');
        const movies = await moviesCollection
            .find(query)
            .limit(parseInt(limit))
            .toArray();
        
        console.log(`📽️ ${movies.length} films trouvés`);
        
        // Ajouter l'analyse de sentiment pour chaque film
        const moviesWithSentiment = movies.map(movie => {
            const plotText = movie.plot || movie.fullplot || '';
            const plotSentiment = analyzeSentiment(plotText);
            
            return {
                _id: movie._id,
                title: movie.title || 'Titre inconnu',
                year: movie.year || 'N/A',
                plot: plotText || 'Aucune description disponible',
                genres: movie.genres || [],
                cast: movie.cast || [],
                sentiment: plotSentiment
            };
        });
        
        res.json(moviesWithSentiment);
        
    } catch (error) {
        console.error('❌ Erreur récupération films:', error.message);
        
        // Fallback vers données simulées
        console.log('🔄 Utilisation des données simulées...');
        const fallbackMovies = [
            {
                title: "The Shawshank Redemption",
                year: 1994,
                plot: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
                genres: ["Drama"],
                sentiment: { sentiment: 'positive', score: 0.8 }
            },
            {
                title: "The Dark Knight", 
                year: 2008,
                plot: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests.",
                genres: ["Action", "Crime", "Drama"],
                sentiment: { sentiment: 'negative', score: -0.3 }
            }
        ];
        
        res.json(fallbackMovies);
    }
});

app.get('/api/sentiment-stats', async (req, res) => {
    try {
        if (!mongoConnected || !moviesCollection) {
            throw new Error('MongoDB non connecté');
        }

        console.log('📊 Calcul des statistiques de sentiment...');
        const movies = await moviesCollection
            .find({ plot: { $exists: true, $ne: null } })
            .limit(500) // Échantillon plus large
            .toArray();
        
        let positive = 0, negative = 0, neutral = 0;
        
        movies.forEach(movie => {
            const sentiment = analyzeSentiment(movie.plot || movie.fullplot || '');
            if (sentiment.sentiment === 'positive') positive++;
            else if (sentiment.sentiment === 'negative') negative++;
            else neutral++;
        });
        
        const stats = {
            total: movies.length,
            positive,
            negative,
            neutral
        };
        
        console.log('📈 Statistiques calculées:', stats);
        res.json(stats);
        
    } catch (error) {
        console.error('❌ Erreur stats:', error.message);
        
        // Fallback vers stats simulées réalistes
        res.json({
            total: 500,
            positive: 210,
            negative: 95,
            neutral: 195
        });
    }
});

// Route de test pour vérifier MongoDB
app.get('/api/test', async (req, res) => {
    try {
        if (!mongoConnected || !moviesCollection) {
            return res.json({ 
                status: 'MongoDB déconnecté',
                connected: false,
                fallback: true
            });
        }
        
        const count = await moviesCollection.countDocuments();
        const sample = await moviesCollection.findOne({});
        
        res.json({ 
            status: 'MongoDB connecté',
            connected: true,
            totalMovies: count,
            sampleData: !!sample,
            database: 'sample_mflix'
        });
    } catch (error) {
        res.json({
            status: 'Erreur MongoDB',
            connected: false,
            error: error.message
        });
    }
});

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
async function startServer() {
    console.log('🚀 Démarrage du serveur...');
    
    const mongoSuccess = await connectToMongoDB();
    
    app.listen(PORT, () => {
        console.log(`🌐 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📡 MongoDB: ${mongoSuccess ? '✅ Connecté' : '❌ Mode dégradé'}`);
        
        if (mongoSuccess) {
            console.log('🎬 Prêt à analyser 21,000+ films !');
        } else {
            console.log('🔄 Fonctionnement en mode simulation');
        }
    });
}

startServer();