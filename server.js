const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import des routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const chatRoutes = require('./routes/chatRoutes');
const notificationRoutes = require('./routes/notificationRoutes');

// Import des middlewares
const { errorHandler } = require('./middleware/errorHandler');
const connectDB = require('./config/database');

// Connexion à MongoDB
connectDB();

const app = express();

// ===== MIDDLEWARES DE SÉCURITÉ =====

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX),
    message: 'Trop de requêtes depuis cette IP, réessayez plus tard.'
});

app.use('/api', limiter);

// Helmet pour les headers de sécurité
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    optionsSuccessStatus: 200
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization contre NoSQL injection
app.use(mongoSanitize());

// Data sanitization contre XSS
app.use(xss());

// Compression
app.use(compression());

// Fichiers statiques
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== ROUTES =====
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/notifications', notificationRoutes);

// Route de test
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'Serveur Wanted opérationnel',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// ===== GESTION DES ERREURS =====
app.all('*', (req, res, next) => {
    next(new AppError(`Route ${req.originalUrl} non trouvée`, 404));
});

app.use(errorHandler);

// ===== SERVEUR =====
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`.green.bold);
    console.log(`📝 Environnement: ${process.env.NODE_ENV}`.yellow);
});

// ===== WEBSOCKET POUR LE CHAT EN TEMPS RÉEL =====
const io = require('socket.io')(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true
    }
});

// Gestion des connexions Socket.io
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return next(new Error('Utilisateur non trouvé'));
        }
        
        socket.user = user;
        next();
    } catch (err) {
        next(new Error('Authentification échouée'));
    }
}).on('connection', (socket) => {
    console.log(`🔌 Nouvelle connexion socket: ${socket.user.name}`);

    // Rejoindre une room personnelle
    socket.join(`user:${socket.user.id}`);

    // Gestion des messages
    socket.on('send-message', async (data) => {
        try {
            const { conversationId, content } = data;
            
            const conversation = await Conversation.findById(conversationId);
            if (!conversation) return;

            const message = {
                sender: socket.user.id,
                content,
                delivered: true,
                deliveredAt: new Date()
            };

            conversation.messages.push(message);
            conversation.lastMessage = content;
            conversation.lastMessageAt = new Date();
            
            await conversation.save();

            // Envoyer aux participants
            conversation.participants.forEach(participantId => {
                if (participantId.toString() !== socket.user.id) {
                    socket.to(`user:${participantId}`).emit('new-message', {
                        conversationId,
                        message: message,
                        sender: socket.user.toPublicJSON()
                    });
                }
            });

            // Confirmation à l'expéditeur
            socket.emit('message-sent', message);
        } catch (error) {
            console.error('Erreur lors de l\'envoi du message:', error);
        }
    });

    // Typing indicator
    socket.on('typing', ({ conversationId, isTyping }) => {
        socket.to(`conversation:${conversationId}`).emit('user-typing', {
            userId: socket.user.id,
            isTyping
        });
    });

    // Marquer comme lu
    socket.on('mark-read', async ({ conversationId }) => {
        try {
            const conversation = await Conversation.findById(conversationId);
            if (conversation) {
                await conversation.markAsRead(socket.user.id);
                
                conversation.participants.forEach(participantId => {
                    if (participantId.toString() !== socket.user.id) {
                        socket.to(`user:${participantId}`).emit('messages-read', {
                            conversationId,
                            readerId: socket.user.id
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Erreur lors du marquage des messages:', error);
        }
    });

    // Déconnexion
    socket.on('disconnect', async () => {
        console.log(`🔌 Déconnexion socket: ${socket.user.name}`);
        
        // Mettre à jour le statut en ligne
        await User.findByIdAndUpdate(socket.user.id, {
            isOnline: false,
            lastSeen: new Date()
        });
        
        // Notifier les autres
        socket.broadcast.emit('user-offline', socket.user.id);
    });
});

// ===== GESTION GRACIEUSE DE L'ARRÊT =====
process.on('unhandledRejection', (err) => {
    console.error('❌ UNHANDLED REJECTION!'.red.bold);
    console.error(err.name, err.message);
    server.close(() => {
        process.exit(1);
    });
});

process.on('SIGTERM', () => {
    console.log('👋 SIGTERM RECEIVED. Shutting down gracefully...'.yellow);
    server.close(() => {
        console.log('💤 Process terminated!'.gray);
    });
});

module.exports = app;