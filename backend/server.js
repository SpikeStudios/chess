const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Chess = require("chess.js").Chess;
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3001",
        methods: ["GET", "POST"],
    },
    transports: ["websocket"],
});

const games = {}; // Object to store active games and metadata
const openGames = {}; // Object to store open game details for the lobby

console.log("Server starting...");

io.on("connection", (socket) => {
    console.log(`Client connected with socket ID: ${socket.id}`);

    socket.on("disconnect", (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        // Handle game cleanup if needed
    });

    /**
     * Create a new game
     */
    socket.on("createGame", ({ gameId, role }) => {
        if (!gameId) {
            gameId = uuidv4(); // Generate a unique ID for the game
        }

        const inviteLink = `${process.env.CLIENT_URL || "http://localhost:3001"}/game/${gameId}`;

        if (!games[gameId]) {
            games[gameId] = {
                chess: new Chess(),
                moveHistory: [],
                capturedPieces: { white: [], black: [] },
                players: { white: null, black: null },
                inviteLink,
            };
            console.log(`New game created: ${gameId}`);
        }

        const game = games[gameId];

        // Assign role to the creator
        if (role === "white" || (role === "random" && Math.random() > 0.5)) {
            game.players.white = socket.id;
        } else {
            game.players.black = socket.id;
        }

        openGames[gameId] = {
            id: gameId,
            white: game.players.white,
            black: game.players.black,
            inviteLink,
        };

        socket.join(gameId);
        const currentFEN = game.chess.fen();
        socket.emit("gameDetails", { gameId, players: game.players, inviteLink });
        socket.emit("updateFEN", currentFEN);
        socket.emit("updateCaptures", game.capturedPieces);
        socket.emit("updateHistory", game.moveHistory);

        console.log(`Game ${gameId} created with role: ${role}`);
        io.emit("openGames", Object.values(openGames)); // Notify clients of open games
    });

    /**
     * Join an existing game
     */
    socket.on("joinGame", (gameId) => {
        const game = games[gameId];

        if (!game) {
            socket.emit("debug", "Game not found!");
            return;
        }

        // Assign role to the joining player
        if (!game.players.white) {
            game.players.white = socket.id;
        } else if (!game.players.black) {
            game.players.black = socket.id;
        } else {
            socket.emit("debug", "Game is full!");
            return;
        }

        socket.join(gameId);
        const currentFEN = game.chess.fen();
        socket.emit("gameDetails", { gameId, players: game.players, inviteLink: game.inviteLink });
        socket.emit("updateFEN", currentFEN);
        socket.emit("updateCaptures", game.capturedPieces);
        socket.emit("updateHistory", game.moveHistory);

        console.log(`Player joined game ${gameId}`);
        io.emit("openGames", Object.values(openGames)); // Update open games for clients
    });

    /**
     * Reset a game
     */
    socket.on("resetGame", (gameId) => {
        const game = games[gameId];

        if (!game) {
            socket.emit("debug", "Game not found for reset.");
            return;
        }

        game.chess = new Chess();
        game.moveHistory = [];
        game.capturedPieces = { white: [], black: [] };

        const resetFEN = game.chess.fen();
        io.to(gameId).emit("updateFEN", resetFEN);
        io.to(gameId).emit("updateCaptures", game.capturedPieces);
        io.to(gameId).emit("updateHistory", game.moveHistory);

        console.log(`Game reset: ${gameId}`);
    });

    /**
     * Make a move
     */
    socket.on("makeMove", ({ from, to, gameId }) => {
        const game = games[gameId];

        if (!game) {
            socket.emit("debug", "Game not found!");
            return;
        }

        try {
            const currentPlayer = socket.id;
            const turnColor = game.chess.turn() === "w" ? "white" : "black";

            // Check if the player is allowed to move
            if (game.players[turnColor] !== currentPlayer) {
                socket.emit("debug", "It's not your turn!");
                return;
            }

            const move = game.chess.move({ from, to });
            if (move) {
                const updatedFEN = game.chess.fen();
                game.moveHistory.push(`${from}-${to}`);

                if (move.captured) {
                    const capturedPiece = move.captured.toUpperCase();
                    const capturingSide = move.color === "w" ? "black" : "white";
                    game.capturedPieces[capturingSide].push(capturedPiece);
                    io.to(gameId).emit("updateCaptures", game.capturedPieces);
                }

                io.to(gameId).emit("updateFEN", updatedFEN);
                io.to(gameId).emit("updateHistory", game.moveHistory);

                if (game.chess.isCheckmate()) {
                    console.log(`Checkmate detected in game ${gameId}`);
                    io.to(gameId).emit("gameOver", { reason: "checkmate", winner: game.chess.turn() });
                } else if (game.chess.isCheck()) {
                    console.log(`Check detected in game ${gameId}`);
                    io.to(gameId).emit("inCheck", game.chess.turn());
                }
            } else {
                socket.emit("debug", "Invalid move! Please try again.");
            }
        } catch (error) {
            console.error(`Error processing move for game ${gameId}:`, error.message);
            socket.emit("debug", `Error: ${error.message}`);
        }
    });

    /**
     * Update open games list
     */
    setInterval(() => {
        io.emit("openGames", Object.values(openGames));
    }, 5000);

    socket.on("error", (error) => {
        console.error(`Socket error on ${socket.id}:`, error.message);
    });
});

app.get("/", (req, res) => {
    res.send("Backend server running!");
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});