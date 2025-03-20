import React, { useEffect, useRef, useState } from "react";
import discordSdk, { setupDiscordSdk } from "./Discord";
import LoadingPage from "./Loading";
import useWebSocket from "./Socket";
import * as THREE from "three";

const App = () => {
  const mountRef = useRef(null);
  const fpsRef = useRef(null);
  const [gameStarted, setGameStarted] = useState(false);
  const keysPressed = useRef({});
  const [auth, setAuth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [playerList, setPlayerList] = useState([]);
  const [playerId, setPlayerId] = useState(0);
  const isUpdateBallRef = useRef(false);
  const [socket, addSocket] = useWebSocket();

  const lastFrameTimeRef = useRef(performance.now());

  const gameObjectsRef = useRef({
    playerPaddle: null,
    enemyPaddle: null,
    ball: null,
    ballDirection: null,
    baseSpeed: 3.0,
    fps: 0,
    score: { player1: 0, player2: 0 },
  });

  // Discord SDKの初期化と認証
  useEffect(() => {
    setupDiscordSdk()
      .then((authToken) => {
        setAuth(authToken);
        setIsLoading(false);
        joinGame(authToken);
      })
      .catch((error) => {
        console.error("Discord SDK setup failed:", error);
        setIsLoading(false);
      });
  }, []);

  // ゲームへの参加
  const joinGame = (authToken) => {
    if (!authToken) return;

    const username = authToken.user.username;

    if (username === "sasnews") {
      addSocket({
        player1: { username: username, position: 0, date: Date.now() },
      });
      setPlayerId(1);
    } else if (!socket?.player2?.username) {
      addSocket({
        player2: { username: username, position: 0, date: Date.now() },
      });
      setPlayerId(2);
    } else {
      window.alert("すでに2人以上が参加しています");
    }
  };

  // プレイヤーリストの更新
  useEffect(() => {
    if (!discordSdk || !discordSdk.commands) return;

    const updatePlayerList = async () => {
      try {
        const { participants } =
          await discordSdk.commands.getInstanceConnectedParticipants();

        const extractUsernames = (list) =>
          list.map((player) => player.username);
        const participantUsernames = extractUsernames(participants);
        const playerListUsernames = extractUsernames(playerList);

        if (
          JSON.stringify(participantUsernames) !==
          JSON.stringify(playerListUsernames)
        ) {
          setPlayerList(participants);
        }
      } catch (error) {
        console.error("Failed to update player list:", error);
      }
    };

    const interval = setInterval(updatePlayerList, 5000);
    return () => clearInterval(interval);
  }, [playerList]);

  // ゲーム状態の監視
  useEffect(() => {
    if (socket?.gameStatus !== undefined) {
      setGameStarted(socket.gameStatus);
    }
  }, [socket?.gameStatus]);

  // プレイヤー2の視点判定
  const isPlayer2View = () => playerId === 2;

  // 視点に応じた座標変換
  const transformCoordinateForView = (position) => {
    return isPlayer2View() ? -position : position;
  };

  // ゲームシーンの初期化
  useEffect(() => {
    if (!gameStarted) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    camera.position.set(0, 5, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current?.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const fieldGeometry = new THREE.PlaneGeometry(10, 10);
    const fieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    const midlineGeometry = new THREE.PlaneGeometry(10, 0.1);
    const midlineMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const midline = new THREE.Mesh(midlineGeometry, midlineMaterial);
    midline.rotation.x = -Math.PI / 2;
    midline.position.y = 0.01;
    scene.add(midline);

    const scoreTextElement = document.createElement("div");
    scoreTextElement.id = "scoreText";
    scoreTextElement.style.position = "absolute";
    scoreTextElement.style.top = "10px";
    scoreTextElement.style.width = "100%";
    scoreTextElement.style.textAlign = "center";
    scoreTextElement.style.color = "white";
    scoreTextElement.style.fontSize = "24px";
    scoreTextElement.style.fontWeight = "bold";
    scoreTextElement.innerText = "Score: 0 - 0";
    document.body.appendChild(scoreTextElement);

    const createPaddle = (color, positionZ) => {
      const paddleGeometry = new THREE.BoxGeometry(2, 0.2, 0.5);
      const paddleMaterial = new THREE.MeshStandardMaterial({ color });
      const paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
      paddle.position.y = 0.1;
      paddle.position.z = positionZ;
      paddle.castShadow = true;
      paddle.receiveShadow = true;
      scene.add(paddle);
      return paddle;
    };

    const playerPaddle = createPaddle(0x00ff00, 4.5);
    const enemyPaddle = createPaddle(0xff0000, -4.5);

    const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0.2, 0);
    ball.castShadow = true;
    ball.receiveShadow = true;
    scene.add(ball);

    gameObjectsRef.current = {
      playerPaddle,
      enemyPaddle,
      ball,
      ballDirection: new THREE.Vector2(0, 0).normalize(),
      baseSpeed: 3.0,
      fps: 0,
      score: { player1: 0, player2: 0 },
    };

    const handleKeyDown = (event) => {
      keysPressed.current[event.key] = true;
    };

    const handleKeyUp = (event) => {
      keysPressed.current[event.key] = false;
    };

    let frameCount = 0;
    let fpsUpdateTime = performance.now();

    // アニメーションループ
    const animate = () => {
      requestAnimationFrame(animate);

      const now = performance.now();

      const deltaTime = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      frameCount++;
      const fpsElapsed = now - fpsUpdateTime;
      if (fpsElapsed >= 1000) {
        gameObjectsRef.current.fps = Math.round(
          (frameCount * 1000) / fpsElapsed
        );
        frameCount = 0;
        fpsUpdateTime = now;
        if (fpsRef.current) {
          fpsRef.current.innerText = `FPS: ${gameObjectsRef.current.fps}`;
        }
      }

      const { playerPaddle, enemyPaddle, ball, ballDirection, baseSpeed } =
        gameObjectsRef.current;

      // パドルの速度と境界
      const paddleSpeed = 5.0 * deltaTime;
      const paddleBoundary = 4;

      // ボールの速度
      const ballSpeed = baseSpeed * deltaTime;

      // パドルの移動処理
      if (
        (keysPressed.current["a"] || keysPressed.current["ArrowLeft"]) &&
        playerPaddle.position.x > -paddleBoundary
      ) {
        playerPaddle.position.x -= paddleSpeed;
      }
      if (
        (keysPressed.current["d"] || keysPressed.current["ArrowRight"]) &&
        playerPaddle.position.x < paddleBoundary
      ) {
        playerPaddle.position.x += paddleSpeed;
      }

      // プレイヤー位置の更新（ソケット通信）
      const updatedPlayer = {
        position: playerPaddle.position.x,
        date: Date.now(),
        username: auth?.user.username,
      };

      let updatedPlayerData = {};
      if (playerId === 1) {
        updatedPlayerData = { player1: updatedPlayer };
      } else if (playerId === 2) {
        updatedPlayerData = { player2: updatedPlayer };
      }

      // ボールの動きを更新
      updateBallMovement(ball, ballDirection, baseSpeed, deltaTime);

      // スコア表示の更新
      const score = gameObjectsRef.current.score;
      const scoreTextElement = document.getElementById("scoreText");
      if (scoreTextElement) {
        if (isPlayer2View()) {
          scoreTextElement.innerText = `${score.player2} - ${score.player1}`;
        } else {
          scoreTextElement.innerText = `${score.player1} - ${score.player2}`;
        }
      }

      // ボールデータの更新が必要な場合のみ送信
      if (isUpdateBallRef.current) {
        const rawBallPosition = {
          x: ball.position.x * -(playerId * 2 - 3),
          y: ball.position.z * -(playerId * 2 - 3),
        };

        const rawBallDirection = {
          x: ballDirection.x * -(playerId * 2 - 3),
          y: ballDirection.y * -(playerId * 2 - 3),
        };

        addSocket({
          ...updatedPlayerData,
          ballPosition: rawBallPosition,
          ballDirection: rawBallDirection,
          ballUpdated: playerId,
          score: score,
          baseSpeed: baseSpeed,
        });
        isUpdateBallRef.current = false;
      } else {
        addSocket(updatedPlayerData);
      }

      renderer.render(scene, camera);
    };

    // ボールの動きと衝突判定
    const updateBallMovement = (ball, ballDirection, baseSpeed, deltaTime) => {
      const { playerPaddle, enemyPaddle } = gameObjectsRef.current;
      const score = gameObjectsRef.current.score;

      const ballSpeed = baseSpeed * deltaTime;

      ball.position.x += ballDirection.x * ballSpeed;
      ball.position.z += ballDirection.y * ballSpeed;

      // 壁との衝突判定
      if (ball.position.x >= 4.9 || ball.position.x <= -4.9) {
        ballDirection.x *= -1;
        isUpdateBallRef.current = true;
      }

      // ゴール判定
      const boundaryZ = 4.9;
      if (ball.position.z >= boundaryZ) {
        if (playerId === 1) {
          score.player2 += 1;
        } else {
          score.player1 += 1;
        }
        resetBall();
      } else if (ball.position.z <= -boundaryZ) {
        if (playerId === 1) {
          score.player1 += 1;
        } else {
          score.player2 += 1;
        }
        resetBall();
      }

      // パドルとの衝突判定
      const paddleHalfWidth = 1;
      const paddleHalfDepth = 0.25;

      if (
        ball.position.z >= 4.5 - paddleHalfDepth &&
        ball.position.z <= 4.7 &&
        ball.position.x >= playerPaddle.position.x - paddleHalfWidth &&
        ball.position.x <= playerPaddle.position.x + paddleHalfWidth &&
        ballDirection.y > 0
      ) {
        ballDirection.y *= -1;
        const hitPosition =
          (ball.position.x - playerPaddle.position.x) / paddleHalfWidth;
        ballDirection.x += hitPosition * 0.5;
        ballDirection.normalize();
        gameObjectsRef.current.baseSpeed += 0.1;
        isUpdateBallRef.current = true;
      }

      if (
        ball.position.z <= -4.5 + paddleHalfDepth &&
        ball.position.z >= -4.7 &&
        ball.position.x >= enemyPaddle.position.x - paddleHalfWidth &&
        ball.position.x <= enemyPaddle.position.x + paddleHalfWidth &&
        ballDirection.y < 0
      ) {
        ballDirection.y *= -1;
        const hitPosition =
          (ball.position.x - enemyPaddle.position.x) / paddleHalfWidth;
        ballDirection.x += hitPosition * 0.5;
        ballDirection.normalize();
        gameObjectsRef.current.baseSpeed += 0.1;
        isUpdateBallRef.current = true;
      }
    };

    // ボールのリセット
    const resetBall = () => {
      ball.position.x = 0;
      ball.position.z = 0;
      gameObjectsRef.current.baseSpeed = 3.0;

      const newDirection = new THREE.Vector2(
        Math.random() < 0.5 ? -1 : 1,
        Math.random() < 0.5 ? -1 : 1
      ).normalize();

      gameObjectsRef.current.ballDirection.copy(newDirection);
      isUpdateBallRef.current = true;
    };

    // アニメーションループを開始
    animate();

    // イベントリスナーの登録
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // クリーンアップ関数
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }

      const scoreElement = document.getElementById("scoreText");
      if (scoreElement) {
        document.body.removeChild(scoreElement);
      }

      fieldGeometry.dispose();
      fieldMaterial.dispose();
      ballGeometry.dispose();
      ballMaterial.dispose();
      renderer.dispose();
    };
  }, [gameStarted, isLoading, playerId, auth]);

  // ソケットデータによるゲームオブジェクトの更新
  useEffect(() => {
    if (
      !socket ||
      !gameObjectsRef.current ||
      !gameObjectsRef.current.enemyPaddle
    )
      return;

    const { enemyPaddle, ball, ballDirection } = gameObjectsRef.current;

    if (playerId === 1 && socket.player2) {
      enemyPaddle.position.x = -socket.player2.position;
    } else if (playerId === 2 && socket.player1) {
      enemyPaddle.position.x = -socket.player1.position;
    }

    if (socket.ballUpdated !== playerId && socket.ballUpdated !== 0 && ball) {
      if (socket.ballPosition) {
        ball.position.x = socket.ballPosition.x * -(playerId * 2 - 3);
        ball.position.z = socket.ballPosition.y * -(playerId * 2 - 3);
      }

      if (socket.ballDirection && ballDirection) {
        ballDirection.x = socket.ballDirection.x * -(playerId * 2 - 3);
        ballDirection.y = socket.ballDirection.y * -(playerId * 2 - 3);
      }

      if (socket.baseSpeed) {
        gameObjectsRef.current.baseSpeed = socket.baseSpeed;
      }

      if (socket.score) {
        gameObjectsRef.current.score = socket.score;

        const scoreTextElement = document.getElementById("scoreText");
        if (scoreTextElement) {
          if (isPlayer2View()) {
            scoreTextElement.innerText = `${socket.score.player2} - ${socket.score.player1}`;
          } else {
            scoreTextElement.innerText = `${socket.score.player1} - ${socket.score.player2}`;
          }
        }
      }

      addSocket({ ballUpdated: 0 });
    }
  }, [socket, playerId]);

  // ゲーム開始関数
  const startGame = () => {
    const initialBallDirection = new THREE.Vector2(
      Math.random() < 0.5 ? -1 : 1,
      Math.random() < 0.5 ? -1 : 1
    ).normalize();

    addSocket({
      gameStatus: true,
      ballPosition: { x: 0, y: 0 },
      ballDirection: {
        x: initialBallDirection.x,
        y: initialBallDirection.y,
      },
      ballUpdated: -1,
      score: { player1: 0, player2: 0 },
      baseSpeed: 3.0,
    });
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div className="game-container">
      <div ref={mountRef} className="canvas">
        <div
          ref={fpsRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            color: "white",
            padding: "10px",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
          }}
        >
          FPS: 0
        </div>
      </div>

      <div
        className="gameUI"
        style={{
          position: "absolute",
          bottom: "20px",
          width: "100%",
          textAlign: "center",
        }}
      >
        {!gameStarted && (
          <div
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.7)",
              padding: "20px",
              borderRadius: "10px",
              display: "inline-block",
            }}
          >
            <div style={{ marginBottom: "15px", color: "white" }}>
              <h3>参加プレイヤー:</h3>
              {playerList.length > 0 ? (
                <ul style={{ listStyleType: "none", padding: 0 }}>
                  {playerList.map((player) => (
                    <li key={player.id} style={{ margin: "5px 0" }}>
                      {player.nickname || player.global_name || player.username}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>プレイヤーが参加するのを待っています...</p>
              )}

              <div style={{ marginTop: "10px" }}>
                {socket?.player1 && (
                  <p>プレイヤー1: {socket.player1.username}</p>
                )}
                {socket?.player2 && (
                  <p>プレイヤー2: {socket.player2.username}</p>
                )}
                {playerId > 0 && (
                  <p>
                    <strong>あなたはプレイヤー{playerId}です</strong>
                  </p>
                )}
              </div>
            </div>

            {(playerId === 1 || playerId === 2) && (
              <button
                onClick={startGame}
                className="startBtn"
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#4CAF50",
                  color: "white",
                  border: "none",
                  borderRadius: "5px",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ゲーム開始
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
