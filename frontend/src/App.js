import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Chessboard } from "react-chessboard";
import { v4 as uuidv4 } from "uuid";
import { useNavigate } from "react-router-dom";

let socket;

function App() {
    const [fen, setFen] = useState("start");
    const [gameId, setGameId] = useState(null);
    const [capturedPieces, setCapturedPieces] = useState({ white: [], black: [] });
    const [moveHistory, setMoveHistory] = useState([]);
    const [role, setRole] = useState(null); // "white", "black", or "random"
    const [orientation, setOrientation] = useState("white");
    const [waitingForPlayer, setWaitingForPlayer] = useState(false);
    const [checkmate, setCheckmate] = useState(null);
    const [check, setCheck] = useState(null);
    const [showRolePopup, setShowRolePopup] = useState(false);
    const [openGames, setOpenGames] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const connectSocket = () => {
            socket = io(process.env.REACT_APP_BACKEND_URL || "http://localhost:3000", {
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
            });

            socket.on("connect", () => console.log("Connected to server:", socket.id));
            socket.on("updateFEN", setFen);
            socket.on("updateCaptures", setCapturedPieces);
            socket.on("updateHistory", setMoveHistory);
            socket.on("gameOver", ({ reason, winner }) => handleGameOver(reason, winner));
            socket.on("inCheck", (turn) => handleCheck(turn));
            socket.on("gameDetails", ({ gameId, players }) => {
                setGameId(gameId);
                setOrientation(players.white === socket.id ? "white" : "black");
                setWaitingForPlayer(false); // Close waiting popup
            });
            socket.on("openGames", (games) => setOpenGames(games));
            socket.on("startGame", () => setWaitingForPlayer(false));

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
        const selectedOrientation =
            selectedRole === "random" ? (Math.random() > 0.5 ? "white" : "black") : selectedRole;
        setOrientation(selectedOrientation);
        setWaitingForPlayer(true); // Show waiting popup
        socket.emit("createGame", { gameId, role: selectedRole });
    };

    const cancelInvite = () => {
        setWaitingForPlayer(false);
        setGameId(null);
        socket.emit("cancelGame", gameId); // Notify backend
    };

    const handleInviteLink = () => {
        const inviteLink = `${window.location.origin}/game/${gameId}`;
        navigator.clipboard.writeText(inviteLink);
        alert(`Invite link copied: ${inviteLink}`);
        navigate(`/game/${gameId}`);
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
        setTimeout(() => setCheck(null), 3000);
    };

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
                        <button onClick={handleInviteLink} style={styles.popupButton}>
                            Invite Link
                        </button>
                    </div>
                </div>
            )}

            {waitingForPlayer && (
                <div style={styles.popup}>
                    <div style={styles.popupContent}>
                        <h2>Waiting for another player to join...</h2>
                        <button onClick={cancelInvite} style={styles.popupClose}>
                            Cancel
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
                        <div key={index}>
                            {index + 1}. {move}
                        </div>
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
    header: { fontSize: "24px", marginBottom: "20px" },
    controls: { marginBottom: "20px" },
    button: { padding: "10px 20px", margin: "10px", backgroundColor: "#007BFF", color: "#FFF" },
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
    popupContent: { backgroundColor: "#FFF", padding: "20px", borderRadius: "10px" },
    popupClose: { backgroundColor: "#FF0000", color: "#FFF", marginTop: "10px" },
    popupButton: { margin: "10px", padding: "10px", backgroundColor: "#007BFF", color: "#FFF" },
    joinButton: { marginLeft: "10px", padding: "5px 10px", backgroundColor: "#28a745", color: "#FFF" },
    alert: { backgroundColor: "yellow", padding: "10px", borderRadius: "5px", marginBottom: "10px" },
};

export default App;