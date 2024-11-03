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
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWinner, setGameWinner] = useState("");
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  const [auth, setAuth] = useState<Auth>();
  const [isLoading, setIsLoading] = useState(true);
  const [playerList, setPlayerList] = useState<
    Types.GetActivityInstanceConnectedParticipantsResponse["participants"]
  >([]);
  const [playerId, setPlayerId] = useState(0);
  const [socket, addSocket] = useWebSocket();
  const playerPaddleRef = useRef<THREE.Mesh>();

  useEffect(() => {
    setupDiscordSdk().then((authToken) => {
      console.log("Discord SDK is authenticated", authToken);
      setAuth(authToken);
      setIsLoading(false);
      if (authToken?.user.username === "sasnews") {
        addSocket({
          player1: {
            username: authToken?.user.username || "",
            position: 0,
            refl: false,
            score: 0,
            date: Date.now(),
          },
        });
        setPlayerId(1);
      } else if (
        (socket?.player2?.date &&
          Math.abs(socket?.player2?.date - Date.now()) > 1000) ||
        !socket?.player2?.date
      ) {
        addSocket({
          player2: {
            username: authToken?.user.username || "",
            position: 0,
            refl: false,
            score: 0,
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
    camera.position.set(0, 5, 6); // カメラを上方と奥に配置
    camera.lookAt(0, 0, 2.5); // 中央を見下ろすように設定

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; // 影のレンダリングを有効にする
    mountRef.current?.appendChild(renderer.domElement);

    // フィールドを追加
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true; // 影をキャストする
    scene.add(directionalLight);

    // ゲームフィールドの境界
    const fieldGeometry = new THREE.PlaneGeometry(10, 10);
    const fieldMaterial = new THREE.MeshStandardMaterial({
      color: 0x333333,
      side: THREE.DoubleSide,
    });
    const field = new THREE.Mesh(fieldGeometry, fieldMaterial);
    field.rotation.x = -Math.PI / 2; // フィールドを水平に配置
    field.receiveShadow = true; // 影を受け取る
    scene.add(field);

    // パドル生成関数
    const createPaddle = (color: number, positionZ: number) => {
      const paddleGeometry = new THREE.BoxGeometry(2, 0.2, 0.5);
      const paddleMaterial = new THREE.MeshStandardMaterial({ color });
      const paddle = new THREE.Mesh(paddleGeometry, paddleMaterial);
      paddle.position.y = 0.1; // 少し浮かせる
      paddle.position.z = positionZ; // 指定された位置に配置
      paddle.castShadow = true; // 影をキャストする
      paddle.receiveShadow = true; // 影を受け取る
      scene.add(paddle);
      return paddle;
    };

    // プレイヤーのパドル（上端に配置）
    const playerPaddle = createPaddle(0xffffff, -4.5);
    playerPaddleRef.current = playerPaddle;

    // 敵プレイヤーのパドル（下端に配置）
    const enemyPaddle = createPaddle(0xffffff, 4.5);

    // ボール
    const ballGeometry = new THREE.SphereGeometry(0.2, 32, 32);
    const ballMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const ball = new THREE.Mesh(ballGeometry, ballMaterial);
    ball.position.set(0, 0.2, 0); // 少し浮かせる
    ball.castShadow = true; // 影をキャストする
    ball.receiveShadow = true; // 影を受け取る
    scene.add(ball);

    // ボールの速度と方向をランダムに設定
    let ballDirection = new THREE.Vector2(
      Math.random() < 0.5 ? -1 : 1,
      Math.random() < 0.5 ? -1 : 1
    ).normalize();
    const ballSpeed = 0.05;

    // パドル移動関数
    const handleKeyDown = (event: KeyboardEvent) => {
      keysPressed.current[event.key] = true;
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      keysPressed.current[event.key] = false;
    };

    // ゲームのアニメーションループ
    const animate = () => {
      requestAnimationFrame(animate);

      // パドルの移動
      const paddleSpeed = 0.3;
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
      if (socket) {
        const updatedPlayer = {
          ...socket[`player${playerId}` as keyof typeof socket],
          position: enemyPaddle.position.x,
          date: Date.now(),
        };
        addSocket({ [`player${playerId}`]: updatedPlayer });
      }

      // ボールの移動
      ball.position.x += ballDirection.x * ballSpeed;
      ball.position.z += ballDirection.y * ballSpeed;

      // 壁との衝突処理
      if (ball.position.x >= 4.9 || ball.position.x <= -4.9) {
        ballDirection.x *= -1;
      }
      if (ball.position.z >= 4.9) {
        endGame("敵プレイヤー");
      }
      if (ball.position.z <= -4.9) {
        endGame("プレイヤー");
      }

      // プレイヤーのパドルとの衝突判定
      if (
        ball.position.z >= 4.1 &&
        ball.position.z <= 4.2 &&
        ball.position.x >= enemyPaddle.position.x - 1 &&
        ball.position.x <= enemyPaddle.position.x + 1
      ) {
        ballDirection.y *= -1;
      }

      // 敵プレイヤーのパドルとの衝突判定
      if (
        ball.position.z <= -4.1 &&
        ball.position.z >= -4.2 &&
        ball.position.x >= playerPaddle.position.x - 1 &&
        ball.position.x <= playerPaddle.position.x + 1
      ) {
        ballDirection.y *= -1;
      }

      // 描画
      renderer.render(scene, camera);
    };

    animate();

    // イベントリスナーの追加とクリーンアップ
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [gameStarted, isLoading]);

  useEffect(() => {
    if (playerPaddleRef.current && socket?.player1?.position !== undefined) {
      playerPaddleRef.current.position.x = socket.player1.position;
    }
  }, [socket]);

  const startGame = () => {
    setGameStarted(true);
  };

  const endGame = (winner: string) => {
    setGameWinner(winner);
  };

  if (isLoading) {
    return <LoadingPage />;
  }

  return (
    <div ref={mountRef} className="canvas">
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

            {gameWinner && <p>勝者：{gameWinner}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default App;
