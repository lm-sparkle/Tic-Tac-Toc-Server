# Tic Tac Toe Socket.IO Server

Socket.IO server for real-time multiplayer Tic Tac Toe game.

## Quick Start

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Start the Server

```bash
npm start
```

Or:

```bash
node server.js
```

The server will start on port **3001** by default.

## Configuration

### Change Port

Set the `PORT` environment variable:

```bash
PORT=3002 npm start
```

Or create a `.env` file:

```
PORT=3002
```

## Server Endpoints

### Health Check

```
GET http://localhost:3001/health
```

Returns server status, number of active rooms, and waiting players.

## Socket.IO Events

### Client → Server Events

- `game:join` - Join a random available game
- `game:create-room` - Create a new game room
- `game:move` - Make a move (sends: `{ roomId, index, symbol }`)
- `game:reset` - Reset the current game
- `game:leave` - Leave the current game

### Server → Client Events

- `game:joined` - Confirmation of joining (sends: `{ roomId, symbol, isFirstPlayer }`)
- `game:player-joined` - Second player joined (sends: `{ symbol }`)
- `game:move` - Game state update (sends: `{ board, currentPlayer, winner }`)
- `game:error` - Error occurred (sends: `error message`)
- `game:opponent-left` - Opponent disconnected

## Game Flow

1. **Player 1** connects and calls `game:join` or `game:create-room`
2. Server creates a room and assigns Player 1 as 'X'
3. **Player 2** connects and calls `game:join`
4. Server matches Player 2 with Player 1, assigns 'O'
5. Game starts - players take turns making moves
6. Server validates moves and checks for wins/draws
7. Game ends when there's a winner or draw

## Testing

### Test with Browser Console

1. Start the server
2. Open browser console on your app
3. Connect to server from the app UI
4. Open another browser tab/window
5. Both should be able to play together

### Test Health Endpoint

```bash
curl http://localhost:3001/health
```

Should return:
```json
{
  "status": "ok",
  "rooms": 0,
  "waitingPlayers": 0,
  "timestamp": "2024-11-12T10:00:00.000Z"
}
```

## Troubleshooting

### Port Already in Use

If port 3001 is already in use:

```bash
PORT=3002 npm start
```

Then update your frontend `.env` file:
```
EXPO_PUBLIC_SOCKET_URL=http://localhost:3002
```

### Connection Issues

- Make sure the server is running before connecting from the app
- Check firewall settings
- For Android emulator, use `10.0.2.2:3001` instead of `localhost:3001`
- For physical devices, use your computer's IP address

## Development

### Dependencies

- `socket.io` - Real-time communication
- `express` - HTTP server
- `cors` - Cross-origin resource sharing

### Server Features

- ✅ Automatic player matching
- ✅ Room management
- ✅ Game state validation
- ✅ Win/draw detection
- ✅ Automatic cleanup on disconnect
- ✅ Health check endpoint

## Production Deployment

For production, consider:

1. **Process Manager**: Use PM2 or similar
   ```bash
   npm install -g pm2
   pm2 start server.js
   ```

2. **Environment Variables**: Set PORT and other configs
   ```bash
   PORT=3001 NODE_ENV=production pm2 start server.js
   ```

3. **Reverse Proxy**: Use Nginx or similar for SSL/HTTPS

4. **Monitoring**: Add logging and monitoring tools

## License

ISC

