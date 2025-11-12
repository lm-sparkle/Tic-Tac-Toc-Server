// Socket.IO Server for Tic Tac Toe Game
// Run with: npm start or node server.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Store active rooms and games
// Key: 6-character room ID, Value: { players: [], board: [], currentPlayer: 'X', gameStatus: 'waiting' | 'playing', fullRoomId: string, lastStartingPlayer: 'X' | 'O' }
const rooms = new Map();

// Generate a 6-character room ID
const generateRoomId = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomId = '';
  for (let i = 0; i < 6; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return roomId;
};

// Game logic - check for winner
const checkWinner = (board) => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6], // diagonals
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (board.every((cell) => cell !== null)) {
    return 'draw';
  }

  return null;
};

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('✅ User connected:', socket.id);

  // Create a new room with 6-character ID
  socket.on('game:create-room', () => {
    let shortRoomId = generateRoomId();
    
    // Ensure room ID is unique
    while (rooms.has(shortRoomId)) {
      shortRoomId = generateRoomId();
    }
    
    // Create full room ID for socket.io (for internal use)
    const fullRoomId = `room-${Date.now()}-${shortRoomId.toLowerCase()}`;
    
    // Store room with 6-character ID as key
    rooms.set(shortRoomId, {
      players: [socket.id],
      board: Array(9).fill(null),
      currentPlayer: 'X',
      gameStatus: 'waiting',
      fullRoomId: fullRoomId, // Store full ID for socket operations
      lastStartingPlayer: 'X', // Track who started the last game (for alternating)
    });
    
    // Join socket room using full ID
    socket.join(fullRoomId);
    
    // Send both IDs to client - short for display, full for operations
    socket.emit('game:joined', {
      roomId: fullRoomId, // Full ID for socket operations
      shortRoomId: shortRoomId, // 6-character ID for display
      symbol: 'X',
      isFirstPlayer: true,
    });
    
    console.log(`🏠 Room created: ${shortRoomId} (full: ${fullRoomId}) by ${socket.id}`);
  });

  // Join a room by 6-character room ID
  socket.on('game:join-room', ({ roomId }) => {
    if (!roomId || roomId.trim().length === 0) {
      socket.emit('game:error', 'Invalid room ID. Please enter a room ID.');
      return;
    }

    // Normalize to uppercase for lookup
    const shortRoomId = roomId.trim().toUpperCase();
    
    // Try to find room by 6-character ID
    const room = rooms.get(shortRoomId);
    
    if (!room) {
      socket.emit('game:error', 'Room not found. Please check the room ID.');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('game:error', 'Room is full. Maximum 2 players allowed.');
      return;
    }

    if (room.players.includes(socket.id)) {
      socket.emit('game:error', 'You are already in this room.');
      return;
    }

    // Add second player
    room.players.push(socket.id);
    // Join socket room using full room ID
    socket.join(room.fullRoomId);
    
    const symbol = 'O';
    socket.emit('game:joined', {
      roomId: room.fullRoomId, // Full ID for socket operations
      shortRoomId: shortRoomId, // 6-character ID for display
      symbol,
      isFirstPlayer: false,
    });

    // Initialize lastStartingPlayer if not set (first game)
    if (!room.lastStartingPlayer) {
      room.lastStartingPlayer = 'X';
    }
    
    // Notify first player that second player joined
    io.to(room.fullRoomId).emit('game:player-joined', { symbol: 'X' });
    
    room.gameStatus = 'playing';
    room.currentPlayer = room.lastStartingPlayer; // Use lastStartingPlayer for first game
    
    console.log(`🎮 Game started in room ${shortRoomId} (full: ${room.fullRoomId}) - Player X: ${room.players[0]}, Player O: ${socket.id}, Starting: ${room.currentPlayer}`);
  });

  // Handle game move
  socket.on('game:move', ({ roomId, index, symbol }) => {
    // roomId here is the full room ID from client
    // We need to find the room by fullRoomId
    let room = null;
    let shortRoomId = null;
    
    // Find room by fullRoomId
    for (const [key, value] of rooms.entries()) {
      if (value.fullRoomId === roomId) {
        room = value;
        shortRoomId = key;
        break;
      }
    }
    
    if (!room) {
      socket.emit('game:error', 'Room not found');
      return;
    }

    if (room.gameStatus !== 'playing') {
      socket.emit('game:error', 'Game is not in progress');
      return;
    }

    if (room.currentPlayer !== symbol) {
      socket.emit('game:error', 'Not your turn');
      return;
    }

    if (room.board[index] !== null) {
      socket.emit('game:error', 'Cell already occupied');
      return;
    }

    // Make the move
    room.board[index] = symbol;
    room.currentPlayer = symbol === 'X' ? 'O' : 'X';

    // Check for winner
    const winner = checkWinner(room.board);
    if (winner) {
      room.gameStatus = 'finished';
      console.log(`🏆 Game finished in room ${roomId} - Winner: ${winner}`);
    }

    // Broadcast the move to all players in the room using full room ID
    io.to(roomId).emit('game:move', {
      board: room.board,
      currentPlayer: room.currentPlayer,
      winner,
    });
    
    console.log(`🎯 Move made in room ${shortRoomId || roomId} - Player ${symbol} at index ${index}`);
  });

  // Reset game
  socket.on('game:reset', ({ roomId }) => {
    // Find room by fullRoomId
    let room = null;
    for (const [key, value] of rooms.entries()) {
      if (value.fullRoomId === roomId) {
        room = value;
        break;
      }
    }
    
    if (!room) {
      socket.emit('game:error', 'Room not found');
      return;
    }

    // Alternate the starting player
    room.lastStartingPlayer = room.lastStartingPlayer === 'X' ? 'O' : 'X';
    
    room.board = Array(9).fill(null);
    room.currentPlayer = room.lastStartingPlayer; // Alternate starting player
    room.gameStatus = 'playing';

    io.to(roomId).emit('game:move', {
      board: room.board,
      currentPlayer: room.currentPlayer,
      winner: null,
    });
    
    console.log(`🔄 Game reset in room ${roomId} - New starting player: ${room.currentPlayer}`);
  });

  // Leave game
  socket.on('game:leave', ({ roomId }) => {
    // Find room by fullRoomId
    let room = null;
    let shortRoomId = null;
    
    for (const [key, value] of rooms.entries()) {
      if (value.fullRoomId === roomId) {
        room = value;
        shortRoomId = key;
        break;
      }
    }
    
    if (room) {
      room.players = room.players.filter((id) => id !== socket.id);
      
      // Notify the leaving player that they successfully left
      socket.emit('game:left');
      
      if (room.players.length === 0) {
        rooms.delete(shortRoomId);
        console.log(`🗑️ Room ${shortRoomId} deleted (empty)`);
      } else {
        // Notify remaining player (not the one who left)
        socket.to(roomId).emit('game:opponent-left');
        console.log(`👋 Player ${socket.id} left room ${shortRoomId}`);
      }
    }
    
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
    
    // Clean up rooms
    for (const [shortRoomId, room] of rooms.entries()) {
      if (room.players.includes(socket.id)) {
        room.players = room.players.filter((id) => id !== socket.id);
        
        if (room.players.length === 0) {
          rooms.delete(shortRoomId);
          console.log(`🗑️ Room ${shortRoomId} cleaned up after disconnect`);
        } else {
          // Notify remaining players (not the one who disconnected)
          socket.to(room.fullRoomId).emit('game:opponent-left');
          console.log(`👋 Player ${socket.id} disconnected from room ${shortRoomId}`);
        }
      }
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const waitingRooms = Array.from(rooms.values()).filter(room => room.players.length === 1).length;
  res.json({ 
    status: 'ok', 
    rooms: rooms.size, 
    waitingRooms: waitingRooms,
    activeGames: rooms.size - waitingRooms,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log('🎮 Tic Tac Toe Socket.IO Server');
  console.log('🚀 ========================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`🌐 Connect your app to: http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log('🚀 ========================================');
  console.log('Waiting for connections...\n');
});

