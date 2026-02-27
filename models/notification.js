const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['like', 'comment', 'follow', 'share', 'mention', 'message'],
        required: true
    },
    post: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },
    comment: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    message: {
        type: String,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Index pour optimiser les requêtes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, read: 1 });

// Méthode pour marquer comme lu
notificationSchema.methods.markAsRead = async function() {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

// Méthode statique pour marquer toutes les notifications comme lues
notificationSchema.statics.markAllAsRead = async function(userId) {
    return this.updateMany(
        { recipient: userId, read: false },
        { read: true, readAt: new Date() }
    );
};

module.exports = mongoose.model('Notification', notificationSchema);