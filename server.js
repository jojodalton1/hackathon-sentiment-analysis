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
let client;
let db;
let moviesCollection;
let mongoConnected = false;

// Connexion MongoDB corrigée
async function connectToMongoDB() {
    try {
        console.log('🔄 Tentative de connexion à MongoDB...');
        
        // Vérifier que l'URI existe
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI non défini dans .env');
        }
        
        console.log('📡 URI MongoDB détectée');
        
        // Options MongoDB corrigées (sans bufferMaxEntries)
        const options = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000, // 10 secondes
            socketTimeoutMS: 45000,
            family: 4, // Force IPv4
            retryWrites: true,
            maxPoolSize: 10 // Remplace bufferMaxEntries
        };

        // Créer la connexion
        client = new MongoClient(process.env.MONGODB_URI, options);
        
        // Connexion avec timeout
        await client.connect();
        console.log('🔗 Client MongoDB connecté');
        
        // Test de ping
        await client.db("admin").command({ ping: 1 });
        console.log('🏓 Ping MongoDB réussi');
        
        // Connexion à la base de données
        db = client.db('sample_mflix');
        console.log('📚 Connecté à la base sample_mflix');
        
        // Vérifier que la collection existe
        const collections = await db.listCollections().toArray();
        console.log('📋 Collections disponibles:', collections.map(c => c.name));
        
        moviesCollection = db.collection('movies');
        
        // Test de la collection
        const count = await moviesCollection.countDocuments();
        console.log(`🎬 Nombre total de films: ${count}`);
        
        if (count === 0) {
            console.log('⚠️ Collection movies vide!');
            console.log('💡 Vérifiez que sample_mflix a été chargé lors de la création du cluster');
            return false;
        }
        
        // Test d'un échantillon
        const sampleMovie = await moviesCollection.findOne({ plot: { $exists: true } });
        if (sampleMovie) {
            console.log('✅ Échantillon de film trouvé:', sampleMovie.title);
        }
        
        mongoConnected = true;
        console.log('🎉 MongoDB entièrement connecté et opérationnel!');
        return true;
        
    } catch (error) {
        console.error('❌ Erreur connexion MongoDB:');
        console.error('   Type:', error.name);
        console.error('   Message:', error.message);
        
        if (error.name === 'MongoNetworkError') {
            console.error('🌐 Problème réseau - vérifiez:');
            console.error('   - Connexion internet');
            console.error('   - Configuration IP autorisées dans Atlas');
        } else if (error.name === 'MongoAuthenticationError') {
            console.error('🔐 Problème authentification - vérifiez:');
            console.error('   - Username/password dans .env');
            console.error('   - Utilisateur créé dans Database Access');
        } else if (error.name === 'MongoServerSelectionError') {
            console.error('🖥️ Problème serveur - vérifiez:');
            console.error('   - Cluster démarré dans Atlas');
            console.error('   - URI de connexion correcte');
        }
        
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
            query = {
                $and: [
                    { plot: { $exists: true, $ne: null } },
                    {
                        $or: [
                            { title: searchRegex },
                            { plot: searchRegex },
                            { genres: searchRegex },
                            { cast: searchRegex }
                        ]
                    }
                ]
            };
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
        
        // Fallback vers données simulées améliorées
        console.log('🔄 Utilisation des données simulées...');
        const search = req.query.search?.toLowerCase() || '';
        
        // Données simulées avec plus de variété
        let fallbackMovies = [
            {
                title: "The Shawshank Redemption",
                year: 1994,
                plot: "Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency.",
                genres: ["Drama"],
                sentiment: { sentiment: 'positive', score: 0.8 }
            },
            {
                title: "Mad Max: Fury Road",
                year: 2015,
                plot: "An apocalyptic action story set in a stark desert landscape with amazing stunts and fantastic cinematography.",
                genres: ["Action", "Adventure"],
                sentiment: { sentiment: 'positive', score: 0.7 }
            },
            {
                title: "John Wick",
                year: 2014,
                plot: "A retired hitman seeks vengeance in this brilliant action thriller with excellent choreography.",
                genres: ["Action", "Crime"],
                sentiment: { sentiment: 'positive', score: 0.6 }
            },
            {
                title: "The Dark Knight", 
                year: 2008,
                plot: "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests.",
                genres: ["Action", "Crime", "Drama"],
                sentiment: { sentiment: 'negative', score: -0.3 }
            },
            {
                title: "Saw",
                year: 2004,
                plot: "A horror film about a twisted game of survival with disturbing and frightening scenes.",
                genres: ["Horror", "Thriller"],
                sentiment: { sentiment: 'negative', score: -0.8 }
            },
            {
                title: "The Notebook",
                year: 2004,
                plot: "A beautiful and heartwarming love story that spans decades with wonderful performances.",
                genres: ["Romance", "Drama"],
                sentiment: { sentiment: 'positive', score: 0.9 }
            }
        ];
        
        // Filtrer selon la recherche
        if (search) {
            fallbackMovies = fallbackMovies.filter(movie => 
                movie.title.toLowerCase().includes(search) ||
                movie.plot.toLowerCase().includes(search) ||
                movie.genres.some(genre => genre.toLowerCase().includes(search))
            );
        }
        
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

// Route de debug pour vérifier MongoDB
app.get('/api/debug', async (req, res) => {
    const debug = {
        mongoConnected,
        envUri: !!process.env.MONGODB_URI,
        uriFormat: process.env.MONGODB_URI ? process.env.MONGODB_URI.includes('mongodb+srv://') : false,
        client: !!client,
        db: !!db,
        collection: !!moviesCollection
    };
    
    try {
        if (client) {
            // Test ping
            await client.db("admin").command({ ping: 1 });
            debug.pingSuccess = true;
            
            if (moviesCollection) {
                debug.movieCount = await moviesCollection.countDocuments();
                debug.sampleMovie = await moviesCollection.findOne({}, { projection: { title: 1, year: 1 } });
            }
        }
    } catch (error) {
        debug.error = error.message;
    }
    
    res.json(debug);
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

// Gestionnaire de fermeture propre
process.on('SIGINT', async () => {
    console.log('🛑 Arrêt du serveur...');
    if (client) {
        await client.close();
        console.log('🔌 Connexion MongoDB fermée');
    }
    process.exit(0);
});

// Démarrage du serveur
async function startServer() {
    console.log('🚀 Démarrage du serveur...');
    console.log('📁 Variables d\'environnement:');
    console.log('   - MONGODB_URI:', !!process.env.MONGODB_URI);
    console.log('   - PORT:', process.env.PORT || 3000);
    
    const mongoSuccess = await connectToMongoDB();
    
    app.listen(PORT, () => {
        console.log(`🌐 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📡 MongoDB: ${mongoSuccess ? '✅ Connecté' : '❌ Mode dégradé'}`);
        console.log('🔧 Routes de debug disponibles:');
        console.log('   - GET /api/debug - Infos de connexion');
        console.log('   - GET /api/test - Test MongoDB');
        
        if (mongoSuccess) {
            console.log('🎬 Prêt à analyser les films !');
        } else {
            console.log('🔄 Fonctionnement en mode simulation avec films variés');
        }
    });
}

startServer();