"use client"
import { useEffect, useRef, useState, useCallback } from "react";

export default function useSocket(roomId: string) {
    const wsRef = useRef<WebSocket | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const messageHandlerRef = useRef<((data: any) => void) | null>(null)

    useEffect(() => {
        const peerId = Math.random().toString(36).substring(2, 15)
        console.log(` Connecting as peer: ${peerId} to room: ${roomId}`)
        

        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8888/ws'
        
        const ws = new WebSocket(`${wsUrl}?room=${roomId}&peer=${peerId}`)
        wsRef.current = ws;

        ws.onopen = () => {
            setIsConnected(true)
        }
        
        ws.onmessage = (msg) => {
            try {
                const data = JSON.parse(msg.data)
                if (messageHandlerRef.current) {
                    messageHandlerRef.current(data)
                }
            } catch (error) {
                console.error(" Failed to parse message:", error)
            }
        }
        
        ws.onclose = () => {
            console.log(" WebSocket disconnected")
            setIsConnected(false)
        }
        ws.onerror = (error) => console.error(" WebSocket error:", error)

        return () => {
            ws.close()
            setIsConnected(false)
        }
    }, [roomId])

    const send = useCallback((data: any) => {
        if (wsRef.current && isConnected && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data))
        } else {
            console.warn("Cannot send message - WebSocket not ready")
        }
    }, [isConnected])

    const onMessage = useCallback((handler: (data: any) => void) => {
        messageHandlerRef.current = handler
    }, [])

    return { send, onMessage, isConnected }
}