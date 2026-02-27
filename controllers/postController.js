const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const fs = require('fs');
const path = require('path');

// Créer un post
exports.createPost = catchAsync(async (req, res, next) => {
    const { content, visibility, location } = req.body;

    const postData = {
        author: req.user.id,
        content,
        visibility: visibility || 'public',
        location: location || null
    };

    if (req.imageUrl) {
        postData.image = req.imageUrl;
    }

    const post = await Post.create(postData);

    await post.populate('author', 'name avatar');

    res.status(201).json({
        status: 'success',
        data: {
            post
        }
    });
});

// Obtenir tous les posts (feed)
exports.getFeed = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Obtenir les posts des utilisateurs suivis + les posts publics
    const user = await User.findById(req.user.id);
    const followingIds = user.following;

    const posts = await Post.find({
        $or: [
            { author: { $in: followingIds } },
            { visibility: 'public' },
            { author: req.user.id }
        ]
    })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('author', 'name avatar')
        .populate({
            path: 'comments',
            options: { limit: 3, sort: '-createdAt' },
            populate: { path: 'author', select: 'name avatar' }
        });

    const total = await Post.countDocuments({
        $or: [
            { author: { $in: followingIds } },
            { visibility: 'public' },
            { author: req.user.id }
        ]
    });

    res.status(200).json({
        status: 'success',
        results: posts.length,
        data: {
            posts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

// Obtenir un post spécifique
exports.getPost = catchAsync(async (req, res, next) => {
    const post = await Post.findById(req.params.postId)
        .populate('author', 'name avatar')
        .populate({
            path: 'comments',
            options: { sort: '-createdAt' },
            populate: { path: 'author', select: 'name avatar' }
        });

    if (!post) {
        return next(new AppError('Post non trouvé', 404));
    }

    // Vérifier les permissions
    if (post.visibility === 'private' && post.author.id !== req.user.id) {
        return next(new AppError('Vous n\'avez pas accès à ce post', 403));
    }

    res.status(200).json({
        status: 'success',
        data: {
            post
        }
    });
});

// Mettre à jour un post
exports.updatePost = catchAsync(async (req, res, next) => {
    const { content } = req.body;

    const post = await Post.findById(req.params.postId);

    if (!post) {
        return next(new AppError('Post non trouvé', 404));
    }

    // Sauvegarder l'historique
    if (!post.editHistory) {
        post.editHistory = [];
    }
    
    post.editHistory.push({
        content: post.content,
        editedAt: new Date()
    });

    post.content = content || post.content;
    post.isEdited = true;

    if (req.imageUrl) {
        // Supprimer l'ancienne image
        if (post.image) {
            const oldPath = path.join(__dirname, '..', post.image);
            if (fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        post.image = req.imageUrl;
    }

    await post.save();

    res.status(200).json({
        status: 'success',
        data: {
            post
        }
    });
});

// Supprimer un post
exports.deletePost = catchAsync(async (req, res, next) => {
    const post = await Post.findById(req.params.postId);

    if (!post) {
        return next(new AppError('Post non trouvé', 404));
    }

    // Supprimer l'image
    if (post.image) {
        const imagePath = path.join(__dirname, '..', post.image);
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }
    }

    // Supprimer les commentaires associés
    await Comment.deleteMany({ post: post.id });

    // Supprimer les notifications associées
    await Notification.deleteMany({ post: post.id });

    await post.remove();

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Liker/Ne plus liker un post
exports.toggleLike = catchAsync(async (req, res, next) => {
    const post = await Post.findById(req.params.postId);

    if (!post) {
        return next(new AppError('Post non trouvé', 404));
    }

    const isLiked = post.likes.includes(req.user.id);

    if (isLiked) {
        post.likes = post.likes.filter(id => id.toString() !== req.user.id.toString());
    } else {
        post.likes.push(req.user.id);
        
        // Créer une notification
        if (post.author.toString() !== req.user.id) {
            await Notification.create({
                recipient: post.author,
                sender: req.user.id,
                type: 'like',
                post: post.id,
                message: `${req.user.name} a aimé votre publication`
            });
        }
    }

    await post.save();

    res.status(200).json({
        status: 'success',
        data: {
            isLiked: !isLiked,
            likesCount: post.likes.length
        }
    });
});

// Obtenir les posts d'un utilisateur
exports.getUserPosts = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(req.params.userId);

    if (!user) {
        return next(new AppError('Utilisateur non trouvé', 404));
    }

    const query = { author: user.id };
    
    // Si ce n'est pas le propriétaire, filtrer par visibilité
    if (req.user.id !== user.id) {
        query.visibility = { $in: ['public'] };
    }

    const posts = await Post.find(query)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('author', 'name avatar');

    const total = await Post.countDocuments(query);

    res.status(200).json({
        status: 'success',
        results: posts.length,
        data: {
            posts,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});