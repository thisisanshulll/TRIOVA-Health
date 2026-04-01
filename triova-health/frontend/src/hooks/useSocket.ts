import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socketInstance: Socket | null = null;

export function useSocket(token?: string) {
  const [socket, setSocket] = useState<Socket | null>(socketInstance);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    if (!socketInstance) {
      // Connect to the gateway socket
      socketInstance = io(import.meta.env.VITE_API_URL || 'http://localhost:3000', {
        auth: { token },
        withCredentials: true,
      });

      socketInstance.on('connect', () => setIsConnected(true));
      socketInstance.on('disconnect', () => setIsConnected(false));
      
      setSocket(socketInstance);
    } else {
       setIsConnected(socketInstance.connected);
       setSocket(socketInstance);
    }
    
    // Cleanup runs on unmount if we wanted, but we usually want a single global socket for the app
    // so we don't disconnect here unless token changes to undefined.
  }, [token]);

  return { socket, isConnected };
}
