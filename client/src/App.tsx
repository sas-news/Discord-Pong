import React, { useEffect, useRef, useState } from "react";
import { Types } from "@discord/embedded-app-sdk";
import discordSdk, { setupDiscordSdk } from "./Discord";
import LoadingPage from "./Loading";
import useWebSocket from "./Socket";
import * as THREE from "three";

type Auth = {
  access_token: string;
  user: {
    username: string;
    discriminator: string;
    id: string;
    public_flags: number;
    avatar?: string | null | undefined;
    global_name?: string | null | undefined;
  };
  scopes: any[];
  expires: string;
  application: {
    id: string;
    description: string;
    name: string;
    icon?: string | null | undefined;
    rpc_origins?: string[] | undefined;
  };
};

const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const fpsRef = useRef<HTMLDivElement>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const [auth, setAuth] = useState<Auth>();
  const [isLoading, setIsLoading] = useState(true);
  const [playerList, setPlayerList] = useState<
    Types.GetActivityInstanceConnectedParticipantsResponse["participants"]
  >([]);
  const [playerId, setPlayerId] = useState(0);
  const [socket, addSocket] = useWebSocket();
  const playerPaddleRef = useRef<THREE.Mesh>();
  const enemyPaddleRef = useRef<THREE.Mesh>();
  const ballRef = useRef<THREE.Mesh>();

  useEffect(() => {
    setupDiscordSdk().then((authToken) => {
      console.log("Discord SDK is authenticated", authToken);
      setAuth(authToken);
      setIsLoading(false);
      if (!socket?.gameStatus && authToken?.user.username === "sasnews") {
        addSocket({
          player1: {
            username: authToken?.user.username || "",
            position: 0,
            date: Date.now(),
          },
        });
        setPlayerId(1);
      } else if (
        (!socket?.gameStatus &&
          socket?.player2?.date &&
          Math.abs(socket?.player2?.date - Date.now()) > 1000) ||
        !socket?.player2?.date
      ) {
        addSocket({
          player2: {
            username: authToken?.user.username || "",
            position: 0,
            date: Date.now(),
          },
        });
        setPlayerId(2);
      } else {
        console.log("すでに2人以上が参加しています");
        window.alert("すでに2人以上が参加しています");
      }
    });
  }, []);

  const appendPlayer = async (
    participants: Types.GetActivityInstanceConnectedParticipantsResponse["participants"]
  ) => {
    setPlayerList(participants);
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      const { participants } =
        await discordSdk.commands.getInstanceConnectedParticipants();

      const extractUsernames = (
        list: Types.GetActivityInstanceConnectedParticipantsResponse["participants"]
      ) => list.map((player) => player.username);

      const participantUsernames = extractUsernames(participants);
      const playerListUsernames = extractUsernames(playerList);

      if (
        JSON.stringify(participantUsernames) !==
        JSON.stringify(playerListUsernames)
      ) {
        console.log("プレイヤー更新");
        appendPlayer(participants);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [playerList]);

  useEffect(() => {
    if (!gameStarted) return;

    // Three.jsのシーン設定
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );

    // カメラの位置と角度を設定
    camera.position.set(0, 5, 6);
    camera.lookAt(0, 0, 2.5);

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current?.appendChild(renderer.domElement);

    // フィールドを追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // ゲームフィールドの境界
    const fieldGeometry = new THREE.PlaneGeometry(10, 10);
    const fieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2;
    field.receiveShadow = true;
    scene.add(field);

    // パドル生成
    const createPaddle = (color: number, positionZ: number) => {
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

    // プレイヤーのパドル
    const playerPaddle = createPaddle(0xffffff, -4.5);
    playerPaddleRef.current = playerPaddle;

    // 敵プレイヤーのパドル
    const enemyPaddle = createPaddle(0xffffff, 4.5);
    enemyPaddleRef.current = enemyPaddle;

    // ボール
    const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0.2, 0);
    ball.castShadow = true;
    ball.receiveShadow = true;
    scene.add(ball);
    ballRef.current = ball;

    // ボールの速度と方向をランダムに設定
    let ballDirection = new THREE.Vector2(
      Math.random() < 0.5 ? -1 : 1,
      Math.random() < 0.5 ? -1 : 1
    ).normalize();
    let ballSpeed = 0.05;

    // パドル移動関数
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.key] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.key] = false;
    };

    // FPS計算用
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fps = 0;

    // ゲームのアニメーションループ
    const animate = () => {
      requestAnimationFrame(animate);

      // FPS計算
      const now = performance.now();
      frameCount++;
      const delta = now - lastFrameTime;
      if (delta >= 1000) {
        fps = frameCount;
        frameCount = 0;
        lastFrameTime = now;
        if (fpsRef.current) {
          fpsRef.current.innerText = `FPS: ${fps}`;
        }
      }

      // パドルの移動
      const paddleSpeed = fps ? 18 / fps : 0;
      const paddleBoundary = 5 - 1;
      if (
        (keysPressed.current["a"] || keysPressed.current["ArrowLeft"]) &&
        enemyPaddle.position.x > -paddleBoundary
      ) {
        enemyPaddle.position.x -= paddleSpeed;
      }
      if (
        (keysPressed.current["d"] || keysPressed.current["ArrowRight"]) &&
        enemyPaddle.position.x < paddleBoundary
      ) {
        enemyPaddle.position.x += paddleSpeed;
      }

      const updatedPlayer = {
        position: enemyPaddle.position.x,
        date: Date.now(),
        username: auth?.user.username || "",
      };
      if (playerId === 1) {
        // ボールの移動
        ball.position.x += ballDirection.x * ballSpeed;
        ball.position.z += ballDirection.y * ballSpeed;
        const updatedBall = {
          x: ball.position.x,
          y: ball.position.z,
        };

        // 壁との衝突処理
        if (ball.position.x >= 4.9 || ball.position.x <= -4.9) {
          ballDirection.x *= -1;
        }
        if (ball.position.z >= 4.9 || ball.position.z <= -4.9) {
          ball.position.x = 0;
          ball.position.z = 0;
          ballSpeed = fps ? 3 / fps : 0;
          ballDirection = new THREE.Vector2(
            Math.random() < 0.5 ? -1 : 1,
            Math.random() < 0.5 ? -1 : 1
          ).normalize();
        }

        // プレイヤーのパドルとの衝突判定
        if (
          ball.position.z >= 4.1 &&
          ball.position.x >= enemyPaddle.position.x - 1 &&
          ball.position.x <= enemyPaddle.position.x + 1 &&
          ballDirection.y > 0
        ) {
          ballDirection.y *= -1;
          ballSpeed += fps ? 1.5 / fps : 0;
        }

        // 敵プレイヤーのパドルとの衝突判定
        if (
          ball.position.z <= -4.1 &&
          ball.position.x >= playerPaddle.position.x - 1 &&
          ball.position.x <= playerPaddle.position.x + 1 &&
          ballDirection.y < 0
        ) {
          ballDirection.y *= -1;
          ballSpeed += fps ? 1.5 / fps : 0;
        }

        addSocket({ player1: updatedPlayer, ballPosition: updatedBall });
      } else if (playerId === 2) {
        addSocket({ player2: updatedPlayer });
      }

      renderer.render(scene, camera);
    };

    animate();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [gameStarted, isLoading]);

  useEffect(() => {
    if (playerId === 1) {
      if (playerPaddleRef.current && socket?.player2) {
        playerPaddleRef.current.position.x = socket.player2.position * -1;
      }
    } else if (playerId === 2) {
      if (playerPaddleRef.current && socket?.player1) {
        playerPaddleRef.current.position.x = socket.player1.position * -1;
      }
      if (ballRef.current && socket?.ballPosition) {
        ballRef.current.position.x = socket.ballPosition.x * -1;
        ballRef.current.position.z = socket.ballPosition.y * -1;
      }
    } else {
      if (playerPaddleRef.current && socket?.player1) {
        playerPaddleRef.current.position.x = socket.player1.position;
      }
      if (enemyPaddleRef.current && socket?.player2) {
        enemyPaddleRef.current.position.x = socket.player2.position;
      }
      if (ballRef.current && socket?.ballPosition) {
        ballRef.current.position.x = socket.ballPosition.x;
        ballRef.current.position.z = socket.ballPosition.y;
      }
    }
    if (socket?.gameStatus && socket?.gameStatus !== gameStarted) {
      setGameStarted(socket?.gameStatus);
    }
  }, [socket]);

  const startGame = () => {
    addSocket({ gameStatus: true });
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
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
      <div className="gameUI">
        {!gameStarted && (
          <>
            <div>
              {playerList.map((player) => (
                <span key={player.id}>
                  {player.nickname ? player.nickname : player.global_name}
                </span>
              ))}
            </div>

            <button onClick={startGame} className="startBtn">
              スタート
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default App;
