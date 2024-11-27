import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Chessboard } from "react-chessboard";
import { v4 as uuidv4 } from "uuid";

let socket;

function App() {
    const [fen, setFen] = useState("start");
    const [gameId, setGameId] = useState(null);
    const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
    const [moveHistory, setMoveHistory] = useState([]);
    const [role, setRole] = useState("random"); // Player's role: "white", "black", or "random"
    const [orientation, setOrientation] = useState("white"); // Board orientation
    const [checkmate, setCheckmate] = useState(null); // Checkmate state
    const [check, setCheck] = useState(null); // Check state
    const [openGames, setOpenGames] = useState([]); // List of open games
    const [showRolePopup, setShowRolePopup] = useState(false); // Show popup for role selection

    useEffect(() => {
        const connectSocket = () => {
            socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:3000", {
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
            });

            socket.on("connect", () => {
                console.log("Connected to server:", socket.id);
            });

            socket.on("updateFEN", (updatedFEN) => setFen(updatedFEN));
            socket.on("updateCaptures", (captures) => setCapturedPieces(captures));
            socket.on("updateHistory", (history) => setMoveHistory(history));
            socket.on("gameOver", ({ reason, winner }) => handleGameOver(reason, winner));
            socket.on("inCheck", (turn) => handleCheck(turn));
            socket.on("gameDetails", ({ gameId, players }) => {
                setGameId(gameId);
                setOrientation(players.white === socket.id ? "white" : "black");
            });
            socket.on("openGames", (games) => setOpenGames(games));

            return () => socket.disconnect();
        };

        connectSocket();
    }, []);

    const createGame = () => {
        const newGameId = uuidv4();
        setGameId(newGameId);
        setShowRolePopup(true); // Show popup for role selection
    };

    const selectRole = (selectedRole) => {
        setRole(selectedRole);
        setShowRolePopup(false); // Close popup
        const selectedOrientation = selectedRole === "random" ? (Math.random() > 0.5 ? "white" : "black") : selectedRole;
        setOrientation(selectedOrientation);
        socket.emit("createGame", { gameId, role: selectedRole });
    };

    const joinGame = (gameId) => {
        setGameId(gameId);
        socket.emit("joinGame", gameId);
    };

    const resetGame = () => {
        if (gameId) socket.emit("resetGame", gameId);
    };

    const onDrop = (sourceSquare, targetSquare) => {
        socket.emit("makeMove", { from: sourceSquare, to: targetSquare, gameId });
    };

    const handleGameOver = (reason, winner) => {
        const winnerColor = winner === "w" ? "White" : "Black";
        setCheckmate(`${winnerColor} wins by ${reason}!`);
    };

    const handleCheck = (turn) => {
        const checkColor = turn === "w" ? "White" : "Black";
        setCheck(`${checkColor} king is in check!`);
        setTimeout(() => setCheck(null), 3000); // Clear check highlight after 3 seconds
    };

    const closePopup = () => setCheckmate(null);

    return (
        <div style={styles.container}>
            <h1 style={styles.header}>WebSocket Chess Game</h1>

            <div style={styles.controls}>
                <button onClick={createGame} style={styles.button}>
                    Create Game
                </button>
                <button onClick={resetGame} style={styles.button}>
                    Reset Game
                </button>
            </div>

            {showRolePopup && (
                <div style={styles.popup}>
                    <div style={styles.popupContent}>
                        <h2>Select Your Role</h2>
                        <button onClick={() => selectRole("white")} style={styles.popupButton}>
                            Play as White
                        </button>
                        <button onClick={() => selectRole("black")} style={styles.popupButton}>
                            Play as Black
                        </button>
                        <button onClick={() => selectRole("random")} style={styles.popupButton}>
                            Random
                        </button>
                    </div>
                </div>
            )}

            {checkmate && (
                <div style={styles.popup}>
                    <div style={styles.popupContent}>
                        <h2>{checkmate}</h2>
                        <button onClick={resetGame} style={styles.popupButton}>
                            Rematch
                        </button>
                        <button onClick={createGame} style={styles.popupButton}>
                            New Game
                        </button>
                    </div>
                </div>
            )}

            {check && (
                <div style={styles.alert}>
                    <p>{check}</p>
                </div>
            )}

            <div style={styles.gameArea}>
                <div style={styles.captures}>
                    <h2>Captured Pieces</h2>
                    <div>White: {capturedPieces.white.join(", ")}</div>
                    <div>Black: {capturedPieces.black.join(", ")}</div>
                </div>
                <div style={styles.chessboard}>
                    <Chessboard
                        position={fen}
                        onPieceDrop={onDrop}
                        animationDuration={200}
                        boardOrientation={orientation}
                        boardWidth={400}
                    />
                </div>
                <div style={styles.history}>
                    <h2>Move History</h2>
                    {moveHistory.map((move, index) => (
                        <div key={index}>{index + 1}. {move}</div>
                    ))}
                </div>
            </div>

            <h2>Open Games</h2>
            <ul>
                {openGames.map((game) => (
                    <li key={game.id}>
                        Game ID: {game.id}
                        <button onClick={() => joinGame(game.id)} style={styles.joinButton}>
                            Join
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

const styles = {
    container: { padding: "20px", textAlign: "center" },
    header: { fontSize: "24px", fontWeight: "bold", marginBottom: "20px" },
    controls: { marginBottom: "20px" },
    gameArea: { display: "flex", justifyContent: "center", alignItems: "center" },
    captures: { margin: "10px", padding: "10px", border: "1px solid #ccc" },
    chessboard: { margin: "10px" },
    history: { margin: "10px", padding: "10px", border: "1px solid #ccc" },
    button: {
        margin: "0 10px",
        padding: "10px 20px",
        fontSize: "16px",
        border: "none",
        borderRadius: "4px",
        backgroundColor: "#007BFF",
        color: "#FFF",
        cursor: "pointer",
    },
    popup: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.7)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    popupContent: {
        backgroundColor: "#FFF",
        padding: "20px",
        borderRadius: "10px",
        textAlign: "center",
    },
    popupButton: {
        margin: "10px",
        padding: "10px",
        backgroundColor: "#007BFF",
        color: "#FFF",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    joinButton: {
        marginLeft: "10px",
        padding: "5px 10px",
        backgroundColor: "#28a745",
        color: "#FFF",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
    },
    alert: {
        backgroundColor: "yellow",
        padding: "10px",
        borderRadius: "5px",
        marginBottom: "10px",
        fontWeight: "bold",
    },
};

export default App;