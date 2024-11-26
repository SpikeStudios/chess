const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Chess = require("chess.js").Chess;
const { v4: uuidv4 } = require("uuid"); // Use UUID for unique game IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3001", // Frontend URL
        methods: ["GET", "POST"],
    },
    transports: ["websocket"],
});

const games = {}; // Object to store active games and metadata

console.log("Server starting...");

io.on("connection", (socket) => {
    console.log(`Client connected with socket ID: ${socket.id}`);

    socket.on("disconnect", (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
    });

    socket.on("createGame", (gameId) => {
        if (!gameId || gameId === "default") {
            gameId = uuidv4();
            console.log(`Generated new unique game ID: ${gameId}`);
        }

        if (!games[gameId]) {
            games[gameId] = {
                chess: new Chess(),
                moveHistory: [],
                capturedPieces: { white: [], black: [] },
            };
            console.log(`New game created: ${gameId}`);
        } else {
            console.log(`Game already exists: ${gameId}`);
        }

        socket.join(gameId);
        const currentFEN = games[gameId].chess.fen();
        console.log(`Socket ${socket.id} joined game: ${gameId}, FEN: ${currentFEN}`);
        socket.emit("gameId", gameId); // Notify the client of the current gameId
        socket.emit("updateFEN", currentFEN);
        socket.emit("updateCaptures", games[gameId].capturedPieces);
        socket.emit("updateHistory", games[gameId].moveHistory);
    });

    socket.on("resetGame", (gameId) => {
        if (!games[gameId]) {
            console.log(`Game not found for reset: ${gameId}`);
            socket.emit("debug", "Game not found for reset.");
            return;
        }

        games[gameId].chess = new Chess();
        games[gameId].moveHistory = [];
        games[gameId].capturedPieces = { white: [], black: [] };

        const resetFEN = games[gameId].chess.fen();
        console.log(`Game reset: ${gameId}, FEN: ${resetFEN}`);
        io.to(gameId).emit("updateFEN", resetFEN);
        io.to(gameId).emit("updateCaptures", games[gameId].capturedPieces);
        io.to(gameId).emit("updateHistory", games[gameId].moveHistory);
    });

    socket.on("makeMove", ({ from, to, gameId }) => {
        const game = games[gameId];

        if (!game) {
            console.log(`Game not found: ${gameId}`);
            socket.emit("debug", "Game not found!");
            return;
        }

        const chess = game.chess;

        try {
            const move = chess.move({ from, to });
            if (move) {
                const updatedFEN = chess.fen();
                console.log(`Valid move made. Updated FEN for game ${gameId}: ${updatedFEN}`);
                game.moveHistory.push(`${from}-${to}`);

                if (move.captured) {
                    const capturedPiece = move.captured.toUpperCase();
                    const capturingSide = move.color === "w" ? "black" : "white";
                    game.capturedPieces[capturingSide].push(capturedPiece);
                    io.to(gameId).emit("updateCaptures", game.capturedPieces);
                }

                io.to(gameId).emit("updateFEN", updatedFEN);
                io.to(gameId).emit("updateHistory", game.moveHistory);

                if (chess.in_checkmate()) {
                    console.log(`Checkmate detected in game ${gameId}`);
                    io.to(gameId).emit("debug", "Checkmate!");
                } else if (chess.in_check()) {
                    console.log(`Check detected in game ${gameId}`);
                    io.to(gameId).emit("debug", "Check!");
                }
            } else {
                console.log(`Invalid move: { from: "${from}", to: "${to}" }`);
                socket.emit("debug", "Invalid move! Please try again.");
            }
        } catch (error) {
            console.error(`Error processing move for game ${gameId}:`, error.message);
            socket.emit("debug", `Error: ${error.message}`);
        }
    });

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