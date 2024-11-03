import useWebSocket from "./Socket";

const Quizmaster = () => {
  const [socket, addSocket] = useWebSocket();

  return (
    <div>
      <h2>管理者ボタン</h2>
      <button onClick={() => addSocket({ btn: "wait" })} className="admin">
        待機
      </button>
      <button onClick={() => addSocket({ btn: "ready" })} className="admin">
        スタート
      </button>
      <p>{socket?.btn}</p>
      <button onClick={() => addSocket({ quizmaster: null })}>
        出題者から降りる
      </button>
    </div>
  );
};
export default Quizmaster;
