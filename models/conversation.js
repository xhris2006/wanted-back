const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        maxlength: [1000, 'Le message ne peut pas dépasser 1000 caractères']
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date,
        default: null
    },
    delivered: {
        type: Boolean,
        default: false
    },
    deliveredAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    messages: [messageSchema],
    lastMessage: {
        type: String,
        default: null
    },
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    isGroup: {
        type: Boolean,
        default: false
    },
    groupName: {
        type: String,
        default: null
    },
    groupAvatar: {
        type: String,
        default: null
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index pour optimiser les requêtes
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

// Méthode pour marquer un message comme lu
conversationSchema.methods.markAsRead = async function(userId) {
    const unreadMessages = this.messages.filter(
        msg => !msg.read && msg.sender.toString() !== userId.toString()
    );
    
    unreadMessages.forEach(msg => {
        msg.read = true;
        msg.readAt = new Date();
    });
    
    return this.save();
};

// Méthode pour obtenir le nombre de messages non lus
conversationSchema.methods.getUnreadCount = function(userId) {
    return this.messages.filter(
        msg => !msg.read && msg.sender.toString() !== userId.toString()
    ).length;
};

module.exports = mongoose.model('Conversation', conversationSchema);