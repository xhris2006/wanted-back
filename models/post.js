const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: [true, 'Le contenu est requis'],
        maxlength: [500, 'Le contenu ne peut pas dépasser 500 caractères']
    },
    image: {
        type: String,
        default: null
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    }],
    shares: {
        type: Number,
        default: 0
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editHistory: [{
        content: String,
        editedAt: Date
    }],
    visibility: {
        type: String,
        enum: ['public', 'friends', 'private'],
        default: 'public'
    },
    tags: [String],
    location: {
        type: String,
        default: null
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Index pour la recherche
postSchema.index({ content: 'text', tags: 'text' });

// Virtual pour le nombre de commentaires
postSchema.virtual('commentsCount', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'post',
    count: true
});

// Virtual pour le nombre de likes
postSchema.virtual('likesCount').get(function() {
    return this.likes.length;
});

// Middleware pour supprimer les commentaires associés
postSchema.pre('remove', async function(next) {
    await mongoose.model('Comment').deleteMany({ post: this._id });
    next();
});

// Méthode pour vérifier si un utilisateur a liké
postSchema.methods.isLikedBy = function(userId) {
    return this.likes.includes(userId.toString());
};

module.exports = mongoose.model('Post', postSchema);