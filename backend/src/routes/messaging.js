const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getOrCreateConversation,
  getConversations,
  getConversation,
  sendMessage,
  pollMessages,
  markAsRead,
  flagMessage,
  getUnreadCount,
} = require('../controllers/messagingController');

// Conversations
router.post('/conversations', authenticate, getOrCreateConversation);
router.get('/conversations', authenticate, getConversations);
router.get('/conversations/:id', authenticate, getConversation);
router.post('/conversations/:id/messages', authenticate, sendMessage);
router.get('/conversations/:id/poll', authenticate, pollMessages);
router.put('/conversations/:id/read', authenticate, markAsRead);

// Messages
router.post('/messages/:id/flag', authenticate, flagMessage);

// Badge non-lus
router.get('/unread-count', authenticate, getUnreadCount);

module.exports = router;