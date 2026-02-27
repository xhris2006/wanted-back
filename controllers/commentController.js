const Comment = require('../models/Comment');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Créer un commentaire
exports.createComment = catchAsync(async (req, res, next) => {
    const { content } = req.body;
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) {
        return next(new AppError('Post non trouvé', 404));
    }

    const comment = await Comment.create({
        author: req.user.id,
        post: postId,
        content
    });

    await comment.populate('author', 'name avatar');

    // Ajouter le commentaire au post
    post.comments.push(comment.id);
    await post.save();

    // Créer une notification
    if (post.author.toString() !== req.user.id) {
        await Notification.create({
            recipient: post.author,
            sender: req.user.id,
            type: 'comment',
            post: postId,
            comment: comment.id,
            message: `${req.user.name} a commenté votre publication`
        });
    }

    res.status(201).json({
        status: 'success',
        data: {
            comment
        }
    });
});

// Obtenir les commentaires d'un post
exports.getPostComments = catchAsync(async (req, res, next) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ post: req.params.postId })
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .populate('author', 'name avatar');

    const total = await Comment.countDocuments({ post: req.params.postId });

    res.status(200).json({
        status: 'success',
        results: comments.length,
        data: {
            comments,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        }
    });
});

// Mettre à jour un commentaire
exports.updateComment = catchAsync(async (req, res, next) => {
    const { content } = req.body;

    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
        return next(new AppError('Commentaire non trouvé', 404));
    }

    // Sauvegarder l'historique
    if (!comment.editHistory) {
        comment.editHistory = [];
    }
    
    comment.editHistory.push({
        content: comment.content,
        editedAt: new Date()
    });

    comment.content = content;
    comment.isEdited = true;
    
    await comment.save();

    res.status(200).json({
        status: 'success',
        data: {
            comment
        }
    });
});

// Supprimer un commentaire
exports.deleteComment = catchAsync(async (req, res, next) => {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
        return next(new AppError('Commentaire non trouvé', 404));
    }

    // Retirer le commentaire du post
    await Post.findByIdAndUpdate(comment.post, {
        $pull: { comments: comment.id }
    });

    await comment.remove();

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Liker/Ne plus liker un commentaire
exports.toggleLike = catchAsync(async (req, res, next) => {
    const comment = await Comment.findById(req.params.commentId);

    if (!comment) {
        return next(new AppError('Commentaire non trouvé', 404));
    }

    const isLiked = comment.likes.includes(req.user.id);

    if (isLiked) {
        comment.likes = comment.likes.filter(id => id.toString() !== req.user.id.toString());
    } else {
        comment.likes.push(req.user.id);
    }

    await comment.save();

    res.status(200).json({
        status: 'success',
        data: {
            isLiked: !isLiked,
            likesCount: comment.likes.length
        }
    });
});