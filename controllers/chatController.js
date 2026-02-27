const Conversation = require('../models/Conversation');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Obtenir toutes les conversations
exports.getConversations = catchAsync(async (req, res, next) => {
    const conversations = await Conversation.find({
        participants: req.user.id
    })
        .sort('-lastMessageAt')
        .populate('participants', 'name avatar isOnline lastSeen');

    // Ajouter le nombre de messages non lus
    const conversationsWithUnread = conversations.map(conv => {
        const convObj = conv.toObject();
        convObj.unreadCount = conv.getUnreadCount(req.user.id);
        return convObj;
    });

    res.status(200).json({
        status: 'success',
        results: conversations.length,
        data: {
            conversations: conversationsWithUnread
        }
    });
});

// Créer une nouvelle conversation
exports.createConversation = catchAsync(async (req, res, next) => {
    const { recipientId, isGroup, groupName } = req.body;

    if (!isGroup) {
        // Conversation privée
        const existingConversation = await Conversation.findOne({
            participants: { $all: [req.user.id, recipientId] },
            isGroup: false
        });

        if (existingConversation) {
            return res.status(200).json({
                status: 'success',
                data: {
                    conversation: existingConversation
                }
            });
        }

        const conversation = await Conversation.create({
            participants: [req.user.id, recipientId],
            isGroup: false,
            messages: []
        });

        await conversation.populate('participants', 'name avatar isOnline');

        res.status(201).json({
            status: 'success',
            data: {
                conversation
            }
        });
    } else {
        // Groupe
        const participants = [req.user.id, ...recipientId];
        
        const conversation = await Conversation.create({
            participants,
            isGroup: true,
            groupName,
            createdBy: req.user.id,
            messages: []
        });

        await conversation.populate('participants', 'name avatar');

        res.status(201).json({
            status: 'success',
            data: {
                conversation
            }
        });
    }
});

// Obtenir une conversation spécifique
exports.getConversation = catchAsync(async (req, res, next) => {
    const conversation = await Conversation.findById(req.params.conversationId)
        .populate('participants', 'name avatar isOnline lastSeen')
        .populate('messages.sender', 'name avatar');

    if (!conversation) {
        return next(new AppError('Conversation non trouvée', 404));
    }

    // Vérifier que l'utilisateur est participant
    if (!conversation.participants.some(p => p.id === req.user.id)) {
        return next(new AppError('Vous n\'êtes pas autorisé à voir cette conversation', 403));
    }

    // Marquer les messages comme lus
    await conversation.markAsRead(req.user.id);

    res.status(200).json({
        status: 'success',
        data: {
            conversation
        }
    });
});

// Envoyer un message
exports.sendMessage = catchAsync(async (req, res, next) => {
    const { content, conversationId, recipientId } = req.body;

    let conversation;

    if (conversationId) {
        // Message dans une conversation existante
        conversation = await Conversation.findById(conversationId);
        
        if (!conversation) {
            return next(new AppError('Conversation non trouvée', 404));
        }

        // Vérifier que l'utilisateur est participant
        if (!conversation.participants.includes(req.user.id)) {
            return next(new AppError('Vous n\'êtes pas autorisé', 403));
        }
    } else if (recipientId) {
        // Nouvelle conversation
        conversation = await Conversation.findOne({
            participants: { $all: [req.user.id, recipientId] },
            isGroup: false
        });

        if (!conversation) {
            conversation = await Conversation.create({
                participants: [req.user.id, recipientId],
                isGroup: false,
                messages: []
            });
        }
    } else {
        return next(new AppError('ID de conversation ou destinataire requis', 400));
    }

    const message = {
        sender: req.user.id,
        content,
        delivered: true,
        deliveredAt: new Date()
    };

    conversation.messages.push(message);
    conversation.lastMessage = content;
    conversation.lastMessageAt = new Date();
    
    await conversation.save();

    await conversation.populate('messages.sender', 'name avatar');

    res.status(201).json({
        status: 'success',
        data: {
            message: conversation.messages[conversation.messages.length - 1],
            conversationId: conversation.id
        }
    });
});

// Marquer les messages comme lus
exports.markAsRead = catchAsync(async (req, res, next) => {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
        return next(new AppError('Conversation non trouvée', 404));
    }

    await conversation.markAsRead(req.user.id);

    res.status(200).json({
        status: 'success',
        data: null
    });
});

// Supprimer une conversation
exports.deleteConversation = catchAsync(async (req, res, next) => {
    const conversation = await Conversation.findById(req.params.conversationId);

    if (!conversation) {
        return next(new AppError('Conversation non trouvée', 404));
    }

    // Seul le créateur ou les admins peuvent supprimer
    if (conversation.createdBy && conversation.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new AppError('Vous n\'êtes pas autorisé à supprimer cette conversation', 403));
    }

    await conversation.remove();

    res.status(204).json({
        status: 'success',
        data: null
    });
});