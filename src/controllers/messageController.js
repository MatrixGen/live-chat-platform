const { Message, Channel, User, ChannelMember, ReadReceipt } = require('../../models');
const { successResponse, errorResponse } = require('../middleware/responseFormatter');

const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { before, limit = 50 } = req.query;

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      where: { channelId, userId: req.user.id }
    });

    if (!membership) {
      return res.status(403).json(
        errorResponse('You are not a member of this channel', 'FORBIDDEN')
      );
    }

    // Build where clause for pagination
    const where = { channelId };
    if (before) {
      where.createdAt = { [require('sequelize').Op.lt]: new Date(before) };
    }

    const messages = await Message.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'profilePicture', 'status']
        },
        {
          model: Message,
          as: 'parentMessage',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'username']
          }]
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit)
    });

    // Reverse to get chronological order
    const chronologicalMessages = messages.reverse();

    res.json(
      successResponse(
        { messages: chronologicalMessages },
        'Messages retrieved successfully'
      )
    );
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json(
      errorResponse('Failed to retrieve messages', 'MESSAGES_RETRIEVAL_ERROR')
    );
  }
};

const sendMessage = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { content, replyTo } = req.body;

    // Check if user is member of channel
    const membership = await ChannelMember.findOne({
      where: { channelId, userId: req.user.id }
    });

    if (!membership) {
      return res.status(403).json(
        errorResponse('You are not a member of this channel', 'FORBIDDEN')
      );
    }

    // Create message
    const message = await Message.create({
      content,
      channelId,
      userId: req.user.id,
      replyTo: replyTo || null,
      type: 'text'
    });

    // Load message with user data
    const messageWithUser = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'profilePicture', 'status']
        }
      ]
    });

    // Update last read for sender
    await membership.update({ lastReadAt: new Date() });

    res.status(201).json(
      successResponse(
        { message: messageWithUser },
        'Message sent successfully'
      )
    );
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json(
      errorResponse('Failed to send message', 'MESSAGE_SEND_ERROR')
    );
  }
};

const markAsRead = async (req, res) => {
  try {
    const { messageIds } = req.body;
    const { channelId } = req.params;

    // Create read receipts
    const readReceipts = await Promise.all(
      messageIds.map(messageId =>
        ReadReceipt.findOrCreate({
          where: { messageId, userId: req.user.id },
          defaults: { messageId, userId: req.user.id }
        })
      )
    );

    // Update channel membership last read
    await ChannelMember.update(
      { lastReadAt: new Date() },
      { where: { channelId, userId: req.user.id } }
    );

    res.json(
      successResponse(
        { readReceipts: readReceipts.map(([receipt]) => receipt) },
        'Messages marked as read'
      )
    );
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json(
      errorResponse('Failed to mark messages as read', 'MARK_READ_ERROR')
    );
  }
};

module.exports = {
  getChannelMessages,
  sendMessage,
  markAsRead
};