import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Chessboard } from "react-chessboard";
import { v4 as uuidv4 } from "uuid";

let socket;

function App() {
    const [fen, setFen] = useState("start");
    const [gameId, setGameId] = useState("default");
    const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
    const [moveHistory, setMoveHistory] = useState([]);

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
                createOrJoinGame();
            });

            socket.on("updateFEN", setFen);
            socket.on("updateCaptures", setCapturedPieces);
            socket.on("updateHistory", setMoveHistory);

            socket.on("debug", console.log);

            return () => socket.disconnect();
        };

        connectSocket();
    }, []);

    const createOrJoinGame = () => {
        socket.emit("createGame", gameId);
    };

    const createNewGame = () => {
        const newGameId = uuidv4();
        setGameId(newGameId);
        socket.emit("createGame", newGameId);
    };

    const resetCurrentGame = () => {
        socket.emit("resetGame", gameId);
    };

    const onDrop = (sourceSquare, targetSquare) => {
        socket.emit("makeMove", { from: sourceSquare, to: targetSquare, gameId });
    };

    return (
        <div style={styles.container}>
            <h1 style={styles.header}>WebSocket Chess Game</h1>
            <div style={styles.controls}>
                <button onClick={createNewGame} style={styles.button}>
                    New Game
                </button>
                <button onClick={resetCurrentGame} style={styles.button}>
                    Reset Board
                </button>
            </div>
            <div style={styles.gameArea}>
                <div style={styles.captures}>
                    <h2>Captured Pieces</h2>
                    <div>White: {capturedPieces.white.join(", ")}</div>
                    <div>Black: {capturedPieces.black.join(", ")}</div>
                </div>
                <div style={styles.chessboard}>
                    <Chessboard position={fen} onPieceDrop={onDrop} animationDuration={200} boardWidth={400} />
                </div>
                <div style={styles.history}>
                    <h2>Move History</h2>
                    {moveHistory.map((move, index) => (
                        <div key={index}>{index + 1}. {move}</div>
                    ))}
                </div>
            </div>
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
};

export default App;