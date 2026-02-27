const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { protect } = require('../middleware/auth');
const { validate, messageValidations, paramValidations } = require('../middleware/validation');

// Toutes les routes nécessitent une authentification
router.use(protect);

// Conversations
router.get('/conversations', chatController.getConversations);
router.post('/conversations', chatController.createConversation);

router.get('/conversations/:conversationId',
    validate(paramValidations.conversationId),
    chatController.getConversation
);

router.delete('/conversations/:conversationId',
    validate(paramValidations.conversationId),
    chatController.deleteConversation
);

// Messages
router.post('/messages',
    validate(messageValidations.send),
    chatController.sendMessage
);

router.post('/conversations/:conversationId/read',
    validate(paramValidations.conversationId),
    chatController.markAsRead
);

module.exports = router;
