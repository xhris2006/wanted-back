const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect, checkOwnership } = require('../middleware/auth');
const { validate, userValidations, paramValidations, paginationValidations } = require('../middleware/validation');
const { uploadAvatar, uploadCover } = require('../middleware/upload');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Routes pour l'utilisateur connecté
router.get('/me', userController.getMe);
router.patch('/me', 
    validate(userValidations.updateProfile),
    userController.updateMe
);
router.delete('/me', userController.deleteMe);

// Upload d'images
router.post('/me/avatar', 
    uploadAvatar,
    userController.updateAvatar
);

router.post('/me/cover', 
    uploadCover,
    userController.updateCover
);

// Posts sauvegardés
router.get('/me/saved', userController.getSavedPosts);
router.post('/me/saved/:postId', 
    validate(paramValidations.postId),
    userController.toggleSavePost
);

// Recherche
router.get('/search', userController.searchUsers);

// Routes pour les autres utilisateurs
router.get('/:userId', 
    validate(paramValidations.userId),
    userController.getUser
);

router.get('/:userId/followers',
    validate([...paramValidations.userId, ...paginationValidations]),
    userController.getFollowers
);

router.get('/:userId/following',
    validate([...paramValidations.userId, ...paginationValidations]),
    userController.getFollowing
);

router.post('/:userId/follow',
    validate(paramValidations.userId),
    userController.toggleFollow
);

module.exports = router;