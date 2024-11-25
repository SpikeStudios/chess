const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const Chess = require("chess.js").Chess;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3001", // Frontend URL
        methods: ["GET", "POST"],
    },
    transports: ["websocket"], // Use WebSocket for transport
});

const games = {}; // Object to store active games

console.log("Server starting...");

io.on("connection", (socket) => {
    console.log(`Client connected with socket ID: ${socket.id}`);

    // Handle client disconnection
    socket.on("disconnect", (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
    });

    // Handle game creation or joining
    socket.on("createGame", (gameId) => {
        if (!games[gameId]) {
            games[gameId] = new Chess(); // Create a new chess game
            console.log(`New game created: ${gameId}`);
        } else {
            console.log(`Game already exists: ${gameId}`);
        }

        socket.join(gameId);
        const currentFEN = games[gameId].fen();
        console.log(`Socket ${socket.id} joined game: ${gameId}, FEN: ${currentFEN}`);
        socket.emit("updateFEN", currentFEN); // Send the current FEN to the client
    });

    // Handle game reset
    socket.on("resetGame", (gameId) => {
        if (!games[gameId]) {
            console.log(`Game not found for reset: ${gameId}`);
            socket.emit("debug", "Game not found for reset.");
            return;
        }

        games[gameId] = new Chess(); // Reset the game
        const resetFEN = games[gameId].fen();
        console.log(`Game reset: ${gameId}, FEN: ${resetFEN}`);
        io.to(gameId).emit("updateFEN", resetFEN); // Notify all clients in the game room
    });

    // Handle moves
    socket.on("makeMove", ({ from, to, gameId }) => {
        const chess = games[gameId];

        if (!chess) {
            console.log(`Game not found: ${gameId}`);
            socket.emit("debug", "Game not found!");
            return;
        }

        console.log(`Move received: Game ID - ${gameId}, Move - { from: "${from}", to: "${to}" }`);

        try {
            const move = chess.move({ from, to }); // Attempt to make the move
            if (move) {
                const updatedFEN = chess.fen();
                console.log(`Valid move made. Updated FEN for game ${gameId}: ${updatedFEN}`);
                io.to(gameId).emit("updateFEN", updatedFEN); // Broadcast the updated FEN
            } else {
                // Handle invalid move gracefully
                console.log(`Invalid move attempted: { from: "${from}", to: "${to}" }`);
                socket.emit("debug", "Invalid move! Please try again.");
            }
        } catch (error) {
            // Handle unexpected errors thrown by chess.js
            console.error(`Error processing move for game ${gameId}:`, error.message);
            socket.emit("debug", `Invalid move detected. Error: ${error.message}`);
        }
    });

    // Graceful error handling for unexpected errors in any socket event
    socket.on("error", (error) => {
        console.error(`Error on socket ${socket.id}:`, error.message);
        socket.emit("debug", "An unexpected error occurred. Please try again.");
    });
});

// Test route to verify the server is running
app.get("/", (req, res) => {
    res.send("Backend server running!");
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
