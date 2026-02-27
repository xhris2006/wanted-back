const express = require('express');
const router = express.Router({ mergeParams: true });
const commentController = require('../controllers/commentController');
const { protect, checkOwnership } = require('../middleware/auth');
const { validate, commentValidations, paramValidations, paginationValidations } = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Créer un commentaire sur un post
router.post('/',
    validate(commentValidations.create),
    commentController.createComment
);

// Obtenir les commentaires d'un post
router.get('/',
    validate(paginationValidations),
    commentController.getPostComments
);

// Routes pour un commentaire spécifique
router.get('/:commentId',
    validate(paramValidations.commentId),
    commentController.getComment
);

router.patch('/:commentId',
    validate([...paramValidations.commentId, ...commentValidations.update]),
    checkOwnership(Comment, 'commentId'),
    commentController.updateComment
);

router.delete('/:commentId',
    validate(paramValidations.commentId),
    checkOwnership(Comment, 'commentId'),
    commentController.deleteComment
);

// Likes sur les commentaires
router.post('/:commentId/like',
    validate(paramValidations.commentId),
    commentController.toggleLike
);

module.exports = router;