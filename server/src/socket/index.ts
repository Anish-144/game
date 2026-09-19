// ============================================================
// Socket Handlers — Kadi Teri v3
// The host is seated the moment a room is created, bots are
// seated with them, and the host controls the start.
// ============================================================

import { Server, Socket } from 'socket.io';
import {
  AddBotPayload, BotDifficulty, CastEndVotePayload, CreateRoomPayload, JoinRoomPayload,
  PassBidPayload, PlaceBidPayload, PlayCardPayload, PlayerReadyPayload,
  Player, ProposeEndPayload, ReconnectPayload, RemoveBotPayload, SelectPartnersPayload,
  SelectTrumpPayload, ShareInvitePayload, StartGamePayload,
} from '../types';
import {
  addBot, addPlayer, createRoom, deleteRoom, endGame, getRoom, handSeatToBot,
  humansPresent, isFull, isPersonsSeat, removeBot, removePlayer, Room, startGame,
} from '../rooms/room';
import { generateRoomCode, normalizeCode } from '../utils/roomCode';
import { evaluateBots } from '../engine/bot';
import {
  emitBidPassed, emitBidPlaced, emitBiddingComplete, emitCardPlayed,
  emitEndVote, emitGameStarted, emitGameStopped, emitLobby, emitPartnersSelected,
  emitRoundFinished, emitTrumpSelected, safePlayers, sendDeclarerHand,
} from './broadcast';

/** socket.id -> where that socket is sitting */
const sessions = new Map<string, { roomCode: string; playerId: string }>();

const MODE_LIMITS = {
  classic: { min: 4, max: 6 },
  '500': { min: 4, max: 10 },
} as const;

function clampPlayerCount(mode: 'classic' | '500', requested: number): number {
  const { min, max } = MODE_LIMITS[mode];
  const n = Number.isFinite(requested) ? Math.round(requested) : min;
  return Math.max(min, Math.min(max, n));
}

function fail(socket: Socket, message: string): void {
  socket.emit('error', { message });
}

/**
 * A seat handed to a bot keeps playing itself until the round ends, so
 * the person who came back must not act on it as well.
 */
function seatIsBotControlled(room: Room, playerId: string): boolean {
  const p = room.players.find((x) => x.id === playerId);
  return !!p?.takenOver;
}

const VOTE_WINDOW_MS = 60_000;

/** How many yes votes end the game: more than half of the people present. */
function votesNeeded(room: Room): number {
  return Math.floor(humansPresent(room).length / 2) + 1;
}

function closeVote(io: Server, room: Room): void {
  room.endVote = undefined;
  io.to(room.code).emit('end-vote-closed', {});
}

/** Wind the round up and put everyone back in the lobby. */
function stopGame(io: Server, room: Room, reason: string): void {
  if (!room.engine) return;
  endGame(room);
  emitGameStopped(io, room, reason);
  emitLobby(io, room);
}

/**
 * Close an open vote once the answer is settled either way.
 * Returns true when the vote is finished with.
 */
function resolveVote(io: Server, room: Room): boolean {
  const vote = room.endVote;
  if (!vote) return true;

  const agreed = vote.eligible.filter((id) => vote.votes[id] === true).length;
  const refused = vote.eligible.filter((id) => vote.votes[id] === false).length;

  if (agreed >= vote.needed) {
    stopGame(io, room, 'The table voted to end the game.');
    return true;
  }
  // Once enough people have said no, the yes votes can never get there.
  if (refused > vote.eligible.length - vote.needed) {
    closeVote(io, room);
    return true;
  }
  return false;
}

/**
 * If most of the people who sat down have gone, there is no game left
 * worth playing, so end it rather than letting bots play to nobody.
 */
function checkAbandonment(io: Server, room: Room): void {
  if (!room.engine) return;
  const present = humansPresent(room).length;

  if (present === 0) {
    endGame(room);
    deleteRoom(room.code);
    return;
  }

  const atStart = room.humansAtStart ?? present;
  if (atStart > 1 && present * 2 < atStart) {
    stopGame(io, room, 'Most of the players left, so the game stopped.');
  }
}

export function registerHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    // ── CREATE ROOM ──────────────────────────────────────────
    socket.on('create-room', (p: CreateRoomPayload) => {
      try {
        if (!p?.playerId || !p?.playerName) return fail(socket, 'Missing player details');

        const mode = p.mode === '500' ? '500' : 'classic';
        const playerCount = clampPlayerCount(mode, p.playerCount);
        const difficulty: BotDifficulty = p.botDifficulty ?? 'medium';
        const matchType = p.matchType ?? 'humans';
        const code = generateRoomCode();

        const host: Player = {
          id: p.playerId,
          socketId: socket.id,
          name: p.playerName.slice(0, 16),
          seatIndex: 0,
          isReady: true,
          isConnected: true,
          isBot: false,
          avatar: p.avatar ?? 0,
        };

        const room = createRoom(code, {
          playerCount,
          playerCountMin: MODE_LIMITS[mode].min,
          playerCountMax: MODE_LIMITS[mode].max,
          hostId: p.playerId,
          roomCode: code,
          mode,
          matchType,
          botDifficulty: difficulty,
        }, host);

        // Seat the bots the host asked for, never more than the free seats.
        const wanted = Math.max(0, Math.min(p.botCount ?? 0, playerCount - 1));
        for (let i = 0; i < wanted; i++) addBot(room, difficulty);

        socket.join(code);
        sessions.set(socket.id, { roomCode: code, playerId: host.id });

        socket.emit('room-created', {
          roomCode: code,
          players: safePlayers(room.players),
          config: room.config,
        });
        emitLobby(io, room);
      } catch {
        fail(socket, 'Could not create the room');
      }
    });

    // ── JOIN ROOM ────────────────────────────────────────────
    socket.on('join-room', (p: JoinRoomPayload) => {
      try {
        if (!p?.playerId || !p?.playerName) return fail(socket, 'Missing player details');
        const code = normalizeCode(p.roomCode);
        const room = getRoom(code);
        if (!room) return fail(socket, 'No room with that code');

        // Someone coming back to a seat they already hold.
        const existing = room.players.find((x) => x.id === p.playerId);
        if (existing) {
          existing.socketId = socket.id;
          existing.isConnected = true;
          existing.name = p.playerName.slice(0, 16);
          socket.join(code);
          sessions.set(socket.id, { roomCode: code, playerId: p.playerId });
          socket.emit('room-joined', {
            roomCode: code,
            players: safePlayers(room.players),
            config: room.config,
          });
          if (room.engine) {
            socket.emit('reconnected', { state: room.engine.privateState(p.playerId) });
          }
          emitLobby(io, room);
          return;
        }

        if (room.engine) return fail(socket, 'That game has already started');
        if (isFull(room)) return fail(socket, 'That room is full');

        const player: Player = {
          id: p.playerId,
          socketId: socket.id,
          name: p.playerName.slice(0, 16),
          seatIndex: room.players.length,
          isReady: true,
          isConnected: true,
          isBot: false,
          avatar: p.avatar ?? room.players.length,
        };
        addPlayer(room, player);
        socket.join(code);
        sessions.set(socket.id, { roomCode: code, playerId: p.playerId });

        socket.emit('room-joined', {
          roomCode: code,
          players: safePlayers(room.players),
          config: room.config,
        });
        emitLobby(io, room);
      } catch {
        fail(socket, 'Could not join the room');
      }
    });

    // ── INVITE ───────────────────────────────────────────────
    socket.on('share-invite', (p: ShareInvitePayload) => {
      const code = normalizeCode(p?.roomCode);
      const room = getRoom(code);
      if (!room) return fail(socket, 'No room with that code');
      const origin = (p.origin ?? '').replace(/\/+$/, '');
      socket.emit('invite', {
        roomCode: code,
        link: origin ? `${origin}/join/${code}` : `/join/${code}`,
        mode: room.config.mode,
        playerCount: room.config.playerCount,
        seatsLeft: room.config.playerCount - room.players.length,
      });
    });

    // ── ADD BOT ──────────────────────────────────────────────
    socket.on('add-bot', (p: AddBotPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room) return fail(socket, 'No room with that code');
      if (room.engine) return fail(socket, 'The game has already started');
      if (room.config.hostId !== p.playerId) return fail(socket, 'Only the host can add bots');
      if (isFull(room)) return fail(socket, 'Every seat is taken');

      const bot = addBot(room, p.difficulty ?? room.config.botDifficulty);
      if (!bot) return fail(socket, 'Every seat is taken');
      emitLobby(io, room);
    });

    // ── REMOVE BOT ───────────────────────────────────────────
    socket.on('remove-bot', (p: RemoveBotPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room) return fail(socket, 'No room with that code');
      if (room.engine) return fail(socket, 'The game has already started');
      if (room.config.hostId !== p.playerId) return fail(socket, 'Only the host can remove bots');

      if (!removeBot(room, p.botId)) return fail(socket, 'No bot to remove');
      emitLobby(io, room);
    });

    // ── READY (optional, kept for non-host seats) ────────────
    socket.on('ready', (p: PlayerReadyPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room || room.engine) return;
      const player = room.players.find((x) => x.id === p.playerId);
      if (player) player.isReady = !player.isReady;
      emitLobby(io, room);
    });

    // ── START GAME ───────────────────────────────────────────
    socket.on('start-game', (p: StartGamePayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room) return fail(socket, 'No room with that code');
      if (room.engine) return fail(socket, 'The game has already started');
      if (room.config.hostId !== p.playerId) return fail(socket, 'Only the host can start');
      if (!isFull(room)) {
        const missing = room.config.playerCount - room.players.length;
        return fail(socket, `Waiting on ${missing} more player${missing === 1 ? '' : 's'}`);
      }

      startGame(room);
      emitLobby(io, room);
      emitGameStarted(io, room);
      evaluateBots(io, room);
    });

    // ── PLACE BID ────────────────────────────────────────────
    socket.on('place-bid', (p: PlaceBidPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room?.engine) return fail(socket, 'No game in progress');
      if (seatIsBotControlled(room, p.playerId)) return fail(socket, 'A bot is finishing this round in your seat');

      const result = room.engine.placeBid(p.playerId, p.bid);
      if (!result.valid) return fail(socket, result.error ?? 'That bid is not allowed');

      emitBidPlaced(io, room, p.playerId, p.bid);
      if (result.biddingComplete) {
        emitBiddingComplete(io, room, result.declarerId, result.winningBid);
        sendDeclarerHand(io, room);
      }
      evaluateBots(io, room);
    });

    // ── PASS ─────────────────────────────────────────────────
    socket.on('pass', (p: PassBidPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room?.engine) return fail(socket, 'No game in progress');
      if (seatIsBotControlled(room, p.playerId)) return fail(socket, 'A bot is finishing this round in your seat');

      const result = room.engine.passBid(p.playerId);
      if (!result.valid) return fail(socket, result.error ?? 'You cannot pass right now');

      emitBidPassed(io, room, p.playerId);
      if (result.biddingComplete) {
        emitBiddingComplete(io, room, result.declarerId, result.winningBid);
        sendDeclarerHand(io, room);
      }
      evaluateBots(io, room);
    });

    // ── SELECT TRUMP ─────────────────────────────────────────
    socket.on('select-trump', (p: SelectTrumpPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room?.engine) return fail(socket, 'No game in progress');
      if (seatIsBotControlled(room, p.playerId)) return fail(socket, 'A bot is finishing this round in your seat');

      const result = room.engine.selectTrump(p.playerId, p.trump);
      if (!result.valid) return fail(socket, result.error ?? 'Cannot set trump');

      sendDeclarerHand(io, room);
      emitTrumpSelected(io, room, p.trump);
      evaluateBots(io, room);
    });

    // ── SELECT PARTNERS ──────────────────────────────────────
    socket.on('select-partners', (p: SelectPartnersPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room?.engine) return fail(socket, 'No game in progress');
      if (seatIsBotControlled(room, p.playerId)) return fail(socket, 'A bot is finishing this round in your seat');

      const result = room.engine.selectPartners(p.playerId, p.partnerSpecs);
      if (!result.valid) return fail(socket, result.error ?? 'Those partner cards are not allowed');

      emitPartnersSelected(io, room, p.partnerSpecs.length);
      evaluateBots(io, room);
    });

    // ── PLAY CARD ────────────────────────────────────────────
    socket.on('play-card', (p: PlayCardPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room?.engine) return fail(socket, 'No game in progress');
      if (seatIsBotControlled(room, p.playerId)) return fail(socket, 'A bot is finishing this round in your seat');

      const resolve = () => {
        if (!room.engine) return;
        const result = room.engine.playCard(p.playerId, p.cardId);
        if (!result.valid) return fail(socket, result.error ?? 'You cannot play that card');
        emitCardPlayed(io, room, p.playerId, p.cardId, result);
        evaluateBots(io, room);
      };

      // A fast tap during the trick pause is held, not dropped, so the
      // table stays in step for everyone watching.
      const settle = (room.settleUntil ?? 0) - Date.now();
      if (settle > 0) setTimeout(resolve, settle + 120);
      else resolve();
    });

    // ── PROPOSE ENDING THE GAME ──────────────────────────────
    socket.on('propose-end', (p: ProposeEndPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room) return fail(socket, 'No room with that code');
      if (!room.engine) return fail(socket, 'There is no game running');
      if (room.endVote) return fail(socket, 'A vote is already open');

      const voter = room.players.find((x) => x.id === p.playerId);
      if (!voter || !isPersonsSeat(voter) || !voter.isConnected) {
        return fail(socket, 'You are not playing this game');
      }

      room.endVote = {
        startedBy: p.playerId,
        startedAt: Date.now(),
        votes: { [p.playerId]: true },
        needed: votesNeeded(room),
        eligible: humansPresent(room).map((x) => x.id),
      };

      emitEndVote(io, room);
      if (resolveVote(io, room)) return;

      // Nobody has to answer. An unanswered vote lapses on its own.
      setTimeout(() => {
        const still = getRoom(room.code);
        if (still?.endVote && still.endVote.startedAt === room.endVote?.startedAt) {
          closeVote(io, still);
        }
      }, VOTE_WINDOW_MS);
    });

    // ── VOTE ─────────────────────────────────────────────────
    socket.on('cast-end-vote', (p: CastEndVotePayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room?.endVote) return;
      if (!room.endVote.eligible.includes(p.playerId)) return;

      room.endVote.votes[p.playerId] = !!p.agree;
      emitEndVote(io, room);
      resolveVote(io, room);
    });

    // ── RECONNECT ────────────────────────────────────────────
    socket.on('reconnect-player', (p: ReconnectPayload) => {
      const room = getRoom(normalizeCode(p?.roomCode));
      if (!room) return fail(socket, 'That room has closed');

      const player = room.players.find((x) => x.id === p.playerId);
      if (!player) return fail(socket, 'You are not seated in that room');

      player.socketId = socket.id;
      player.isConnected = true;
      socket.join(room.code);
      sessions.set(socket.id, { roomCode: room.code, playerId: p.playerId });

      if (room.engine) {
        room.engine.updateSocket(p.playerId, socket.id);
        socket.emit('reconnected', {
          state: room.engine.privateState(p.playerId),
          config: room.config,
        });
        if (room.engine.state.phase === 'scoring') emitRoundFinished(io, room);
      } else {
        socket.emit('reconnected', {
          players: safePlayers(room.players),
          config: room.config,
          roomCode: room.code,
        });
      }

      socket.to(room.code).emit('player-reconnected', { playerId: p.playerId });
      emitLobby(io, room);
    });

    // ── LEAVE ────────────────────────────────────────────────
    socket.on('leave-room', () => {
      handleDeparture(io, socket, true);
      sessions.delete(socket.id);
    });

    // ── DISCONNECT ───────────────────────────────────────────
    socket.on('disconnect', () => {
      handleDeparture(io, socket, false);
      sessions.delete(socket.id);
    });
  });
}

/**
 * A socket went away. Before the game starts the seat is freed;
 * afterwards it is only marked offline so the player can return.
 */
function handleDeparture(io: Server, socket: Socket, explicit: boolean): void {
  const session = sessions.get(socket.id);
  if (!session) return;
  const room = getRoom(session.roomCode);
  if (!room) return;

  const player = room.players.find((x) => x.id === session.playerId);
  if (!player || player.socketId !== socket.id) return;

  if (room.engine) {
    player.isConnected = false;
    // A bot finishes the round in their seat so the table is not stuck
    // waiting on someone who has gone.
    handSeatToBot(room, player, room.config.botDifficulty);
    io.to(room.code).emit('player-disconnected', {
      playerId: player.id,
      takenOverByBot: true,
    });
    emitLobby(io, room);

    // They may have been holding an open vote up, or been on turn.
    if (room.endVote) {
      room.endVote.eligible = room.endVote.eligible.filter((id) => id !== player.id);
      delete room.endVote.votes[player.id];
      room.endVote.needed = votesNeeded(room);
      resolveVote(io, room);
    }
    checkAbandonment(io, room);
    evaluateBots(io, room);
    return;
  }

  if (!explicit) {
    // A refresh reconnects within seconds, so hold the seat briefly.
    player.isConnected = false;
    emitLobby(io, room);
    setTimeout(() => {
      const still = getRoom(session.roomCode);
      const p = still?.players.find((x) => x.id === session.playerId);
      if (!still || !p || p.isConnected || still.engine) return;
      dropSeat(io, still.code, session.playerId);
    }, 20000);
    return;
  }

  dropSeat(io, room.code, session.playerId);
}

function dropSeat(io: Server, roomCode: string, playerId: string): void {
  const room = getRoom(roomCode);
  if (!room) return;

  removePlayer(room, playerId);
  const humans = room.players.filter((p) => !p.isBot);

  if (!humans.length) {
    deleteRoom(room.code);
    return;
  }

  if (room.config.hostId === playerId) {
    room.config.hostId = humans[0].id; // pass the crown to the next human
  }
  io.to(room.code).emit('player-left', { playerId });
  emitLobby(io, room);
}
