const User = require('../models/User');
const Post = require('../models/Post');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const fs = require('fs');
const path = require('path');

// Obtenir mon profil
exports.getMe = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id)
        .populate('followers', 'name avatar')
        .populate('following', 'name avatar');

    res.status(200).json({
        status: 'success',
        data: {
            user: user.toPublicJSON()
        }
    });
});

// Mettre à jour mon profil
exports.updateMe = catchAsync(async (req, res, next) => {
    const { name, bio } = req.body;
    
    const updates = {};
    if (name) updates.name = name;
    if (bio !== undefined) updates.bio = bio;

    const user = await User.findByIdAndUpdate(
        req.user.id,
        updates,
        { new: true, runValidators: true }
    );

    res.status(200).json({
        status: 'success',
        data: {
            user: user.toPublicJSON()
        }
    });
});

// Mettre à jour l'avatar
exports.updateAvatar = catchAsync(async (req, res, next) => {
    if (!req.imageUrl) {
        return next(new AppError('Veuillez fournir une image', 400));
    }

    const user = await User.findById(req.user.id);
    
    // Supprimer l'ancien avatar si existe
    if (user.avatar) {
        const oldPath = path.join(__dirname, '..', user.avatar);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }

    user.avatar = req.imageUrl;
    await user.save();

    res.status(200).json({
        status: 'success',
        data: {
            avatar: user.avatar
        }
    });
});

// Mettre à jour la couverture
exports.updateCover = catchAsync(async (req, res, next) => {
    if (!req.imageUrl) {
        return next(new AppError('Veuillez fournir une image', 400));
    }

    const user = await User.findById(req.user.id);
    
    // Supprimer l'ancienne couverture si existe
    if (user.coverImage) {
        const oldPath = path.join(__dirname, '..', user.coverImage);
        if (fs.existsSync(oldPath)) {
            fs.unlinkSync(oldPath);
        }
    }

    user.coverImage = req.imageUrl;
    await user.save();

    res.status(200).json({
        status: 'success',
        data: {
            coverImage: user.coverImage
        }
    });
});

// Supprimer mon compte
exports.deleteMe = catchAsync(async (req, res, next) => {
    await User.findByIdAndUpdate(req.user.id, { isActive: false });
    
    // Supprimer toutes les photos
    const user = await User.findById(req.user.id);
    if (user.avatar) {
        const avatarPath = path.join(__dirname, '..', user.avatar);
        if (fs.existsSync(avatarPath)) fs.unlinkSync(avatarPath);
    }
    if (user.coverImage) {
        const coverPath = path.join(__dirname, '..', user.coverImage);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Obtenir un profil public
exports.getUser = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.userId)
        .populate('followers', 'name avatar')
        .populate('following', 'name avatar');

    if (!user || !user.isActive) {
        return next(new AppError('Utilisateur non trouvé', 404));
    }

    // Obtenir les posts de l'utilisateur
    const posts = await Post.find({ author: user._id })
        .sort('-createdAt')
        .limit(20)
        .populate('author', 'name avatar');

    res.status(200).json({
        status: 'success',
        data: {
            user: user.toPublicJSON(),
            posts
        }
    });
});

// Suivre/Ne plus suivre un utilisateur
exports.toggleFollow = catchAsync(async (req, res, next) => {
    const targetUser = await User.findById(req.params.userId);
    
    if (!targetUser || !targetUser.isActive) {
        return next(new AppError('Utilisateur non trouvé', 404));
    }

    if (targetUser.id === req.user.id) {
        return next(new AppError('Vous ne pouvez pas vous suivre vous-même', 400));
    }

    const currentUser = await User.findById(req.user.id);
    
    const isFollowing = currentUser.following.includes(targetUser.id);

    if (isFollowing) {
        // Ne plus suivre
        currentUser.following = currentUser.following.filter(
            id => id.toString() !== targetUser.id.toString()
        );
        targetUser.followers = targetUser.followers.filter(
            id => id.toString() !== currentUser.id.toString()
        );
    } else {
        // Suivre
        currentUser.following.push(targetUser.id);
        targetUser.followers.push(currentUser.id);
        
        // Créer une notification
        await Notification.create({
            recipient: targetUser.id,
            sender: currentUser.id,
            type: 'follow',
            message: `${currentUser.name} a commencé à vous suivre`
        });
    }

    await currentUser.save();
    await targetUser.save();

    res.status(200).json({
        status: 'success',
        data: {
            isFollowing: !isFollowing
        }
    });
});

// Obtenir les followers
exports.getFollowers = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.userId)
        .populate({
            path: 'followers',
            select: 'name avatar bio',
            options: { limit: 20 }
        });

    res.status(200).json({
        status: 'success',
        results: user.followers.length,
        data: {
            followers: user.followers
        }
    });
});

// Obtenir les abonnements
exports.getFollowing = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.params.userId)
        .populate({
            path: 'following',
            select: 'name avatar bio',
            options: { limit: 20 }
        });

    res.status(200).json({
        status: 'success',
        results: user.following.length,
        data: {
            following: user.following
        }
    });
});

// Rechercher des utilisateurs
exports.searchUsers = catchAsync(async (req, res, next) => {
    const { q } = req.query;
    
    if (!q) {
        return next(new AppError('Veuillez fournir un terme de recherche', 400));
    }

    const users = await User.find({
        $text: { $search: q },
        isActive: true,
        _id: { $ne: req.user.id }
    })
        .select('name avatar bio')
        .limit(20);

    res.status(200).json({
        status: 'success',
        results: users.length,
        data: {
            users
        }
    });
});

// Sauvegarder/Retirer un post
exports.toggleSavePost = catchAsync(async (req, res, next) => {
    const post = await Post.findById(req.params.postId);
    
    if (!post) {
        return next(new AppError('Post non trouvé', 404));
    }

    const user = await User.findById(req.user.id);
    
    const isSaved = user.savedPosts.includes(post.id);

    if (isSaved) {
        user.savedPosts = user.savedPosts.filter(
            id => id.toString() !== post.id.toString()
        );
    } else {
        user.savedPosts.push(post.id);
    }

    await user.save();

    res.status(200).json({
        status: 'success',
        data: {
            isSaved: !isSaved
        }
    });
});

// Obtenir les posts sauvegardés
exports.getSavedPosts = catchAsync(async (req, res, next) => {
    const user = await User.findById(req.user.id)
        .populate({
            path: 'savedPosts',
            populate: {
                path: 'author',
                select: 'name avatar'
            },
            options: {
                sort: '-createdAt'
            }
        });

    res.status(200).json({
        status: 'success',
        results: user.savedPosts.length,
        data: {
            posts: user.savedPosts
        }
    });
});