const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');
const { validate, paramValidations, paginationValidations } = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Obtenir mes notifications
router.get('/',
    validate(paginationValidations),
    notificationController.getMyNotifications
);

// Compter les notifications non lues
router.get('/unread-count', notificationController.getUnreadCount);

// Marquer toutes comme lues
router.post('/mark-all-read', notificationController.markAllAsRead);

// Actions sur une notification spécifique
router.patch('/:notificationId/read',
    validate(paramValidations.notificationId),
    notificationController.markAsRead
);

router.delete('/:notificationId',
    validate(paramValidations.notificationId),
    notificationController.deleteNotification
);

module.exports = router;