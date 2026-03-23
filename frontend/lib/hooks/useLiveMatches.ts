import { useEffect } from "react";
import { useMatchmakingStore } from "../store";

export function useLiveMatches() {
  const { addMatch } = useMatchmakingStore();

  useEffect(() => {
    const socket = new WebSocket("ws://127.0.0.1:8000/rpc");
    
    socket.onopen = () => {
      socket.send(JSON.stringify({
        method: "live",
        params: ["matched_to"]
      }));
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.result?.action === "CREATE") {
        addMatch(data.result.data);
      }
    };

    return () => socket.close();
  }, [addMatch]);
}
