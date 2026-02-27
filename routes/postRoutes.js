const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const commentRoutes = require('./commentRoutes');
const { protect, checkOwnership } = require('../middleware/auth');
const { validate, postValidations, paramValidations, paginationValidations } = require('../middleware/validation');
const { uploadPostImage } = require('../middleware/upload');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes principales
router.get('/feed', 
    validate(paginationValidations),
    postController.getFeed
);

router.post('/',
    uploadPostImage,
    validate(postValidations.create),
    postController.createPost
);

router.get('/:postId',
    validate(paramValidations.postId),
    postController.getPost
);

router.patch('/:postId',
    validate(paramValidations.postId),
    checkOwnership(Post, 'postId'),
    uploadPostImage,
    validate(postValidations.update),
    postController.updatePost
);

router.delete('/:postId',
    validate(paramValidations.postId),
    checkOwnership(Post, 'postId'),
    postController.deletePost
);

// Likes
router.post('/:postId/like',
    validate(paramValidations.postId),
    postController.toggleLike
);

// Rediriger vers les routes des commentaires
router.use('/:postId/comments', commentRoutes);

// Posts par utilisateur
router.get('/user/:userId',
    validate([...paramValidations.userId, ...paginationValidations]),
    postController.getUserPosts
);

module.exports = router;