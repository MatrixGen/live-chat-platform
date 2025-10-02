const { verifyAccessToken } = require('../utils/tokens');
const { User, Channel, ChannelMember, Message } = require('../../models');

const setupSocket = (io) => {
  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.token;
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = verifyAccessToken(token);
      const user = await User.findByPk(decoded.userId);
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user.id;
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.username} connected`);

    // Update user status to online
    User.update(
      { status: 'online', isOnline: true },
      { where: { id: socket.userId } }
    );

    // Join user to their channels
    socket.on('join_channels', async () => {
      try {
        const memberships = await ChannelMember.findAll({
          where: { userId: socket.userId },
          include: [{ model: Channel, as: 'channel' }]
        });

        memberships.forEach(membership => {
          socket.join(`channel:${membership.channelId}`);
          console.log(`User ${socket.user.username} joined channel ${membership.channelId}`);
        });

        // Broadcast user online status
        socket.broadcast.emit('user_online', {
          userId: socket.userId,
          username: socket.user.username,
          status: 'online'
        });
      } catch (error) {
        console.error('Error joining channels:', error);
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { channelId, content, replyTo } = data;

        // Verify user is member of channel
        const membership = await ChannelMember.findOne({
          where: { channelId, userId: socket.userId }
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this channel' });
          return;
        }

        // Create message
        const message = await Message.create({
          content,
          channelId,
          userId: socket.userId,
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

        // Broadcast to channel
        io.to(`channel:${channelId}`).emit('new_message', {
          message: messageWithUser
        });

        // Update last read for sender
        await membership.update({ lastReadAt: new Date() });

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { channelId } = data;
      socket.to(`channel:${channelId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { channelId } = data;
      socket.to(`channel:${channelId}`).emit('user_typing', {
        userId: socket.userId,
        username: socket.user.username,
        channelId,
        isTyping: false
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`User ${socket.user.username} disconnected`);

      // Update user status to offline
      await User.update(
        { status: 'offline', isOnline: false, lastSeen: new Date() },
        { where: { id: socket.userId } }
      );

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        username: socket.user.username,
        status: 'offline',
        lastSeen: new Date()
      });
    });
  });
};

module.exports = { setupSocket };