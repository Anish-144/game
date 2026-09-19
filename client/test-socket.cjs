const { io } = require('socket.io-client');

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let room2Code = null;

async function runTest() {
  const socket = io('http://localhost:3001', {
    transports: ['websocket'],
  });

  const playerId = 'tester-' + Math.random();
  let firstRoom = true;

  socket.on('connect', async () => {
    console.log('Connected');
    socket.emit('create-room', {
      playerId,
      playerName: 'Tester',
      avatar: 0,
      mode: 'classic',
      playerCount: 4,
      matchType: 'bots',
      botCount: 3,
      botDifficulty: 'medium'
    });
  });

  socket.on('room-created', async (d) => {
    console.log('Room created:', d.roomCode);
    if (!firstRoom) room2Code = d.roomCode;
    await wait(500);
    socket.emit('start-game', { roomCode: d.roomCode, playerId });
  });

  let gameStartedCount = 0;
  socket.on('game-started', async (d) => {
    gameStartedCount++;
    console.log('Game started! Count:', gameStartedCount);
    
    if (gameStartedCount === 1) {
      await wait(500);
      console.log('Leaving room 1...');
      socket.emit('leave-room');
      
      await wait(500);
      firstRoom = false;
      console.log('Creating room 2...');
      socket.emit('create-room', {
        playerId,
        playerName: 'Tester',
        avatar: 0,
        mode: 'classic',
        playerCount: 4,
        matchType: 'bots',
        botCount: 3,
        botDifficulty: 'medium'
      });
    } else if (gameStartedCount === 2) {
      console.log('SUCCESS! Second game started properly.');
      process.exit(0);
    }
  });

  socket.on('error', (e) => {
    console.error('Socket error:', e);
  });
}

runTest();
