import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [playerPosition, setPlayerPosition] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameWinner, setGameWinner] = useState("");
  const keysPressed = useRef<{ [key: string]: boolean }>({});

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
    camera.position.set(0, 10, 10); // カメラを上方と奥に配置
    camera.lookAt(0, 0, 0); // 中央を見下ろすように設定

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
      setPlayerPosition(enemyPaddle.position.x);

      // 敵プレイヤーのパドルの移動
      playerPaddle.position.x = ball.position.x;

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
  }, [gameStarted]);

  const startGame = () => {
    setGameStarted(true);
  };

  const endGame = (winner: string) => {
    setGameStarted(false);
    setGameWinner(winner);
  };

  return (
    <div ref={mountRef} className="canvas">
      <div className="gameUI">
        {!gameStarted && (
          <button onClick={startGame} className="startBtn">
            スタート
          </button>
        )}
        {gameWinner && <p>前回の勝者：{gameWinner}</p>}
      </div>
    </div>
  );
};

export default App;
