"use client"

import useSocket from "@/hook/useSocket";
import { useEffect, useRef, } from "react";

export default function RoomPage({params}: {params: {id: string}}) {
    const {id} = params;

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const isOfferingRef = useRef(false)

    const {send, onMessage, isConnected} = useSocket(id)

    useEffect(() => {
        if (!isConnected) return;
        if (pcRef.current) return;

        onMessage(async (message) => {
            
            switch (message.type) {
                case "join":
                    const peers = message.payload?.peers || [];
                    if (peers.length > 1 && !isOfferingRef.current) {
                        isOfferingRef.current = true;
                        createOffer();
                    }
                    break;

                case "peer_joined":
                    if (!isOfferingRef.current) {
                        isOfferingRef.current = true;
                        createOffer();
                    }
                    break;

                case "offer":
                    if (message.payload?.offer) {
                        await handleOffer(message.payload.offer, message.from);
                    }
                    break;

                case "answer":
                    if (message.payload?.answer && pcRef.current) {
                        await pcRef.current.setRemoteDescription(message.payload.answer);
                        
                    }
                    break;

                case "candidate":
                    if (message.payload?.candidate && pcRef.current) {
                        await pcRef.current.addIceCandidate(message.payload.candidate);
                    }
                    break;
            }
        });

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
            console.log(" Connection state:", pc.connectionState);
        };

        pc.oniceconnectionstatechange = () => {
            console.log(" ICE connection state:", pc.iceConnectionState);
        };

        
        pc.ontrack = (event) => {
            
            if (remoteVideoRef.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                
                
                remoteVideoRef.current.play().catch(e => {
                    console.error(" Failed to play remote video:", e);
                });
            } else {
                console.error("No remote video ref or no streams");
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                send({
                    type: "candidate",
                    roomId: id,
                    payload: {candidate: event.candidate}
                });
            }
        };
        navigator.mediaDevices.getUserMedia({video: true, audio: true})
            .then((stream) => {
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                
                stream.getTracks().forEach((track) => {
                    pc.addTrack(track, stream);
                });

                send({type: "join", roomId: id});
            })
            .catch(err => console.error("❌ Error accessing media:", err));

        async function createOffer() {
            if (!pcRef.current) {
                return;
            }
            
            
            try {
                const offer = await pcRef.current.createOffer();
                await pcRef.current.setLocalDescription(offer);
                send({
                    type: "offer",
                    roomId: id,
                    payload: {offer}
                });
            } catch (error) {
                console.error(" Error creating offer:", error);
            }
        }

        async function handleOffer(offer: RTCSessionDescriptionInit, fromPeer: string) {
            if (!pcRef.current) {
                return;
            }
            
            try {
                await pcRef.current.setRemoteDescription(offer);
                
                const answer = await pcRef.current.createAnswer();
                await pcRef.current.setLocalDescription(answer);
                
                send({
                    type: "answer",
                    roomId: id,
                    to: fromPeer,
                    payload: {answer}
                });
            } catch (error) {
                console.error(" Error handling offer:", error);
            }
        }

        return () => {
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        };

    }, [id, send, onMessage, isConnected]);

    return (
        <div className="flex flex-col items-center gap-4 p-6">
            <h1 className="text-xl font-bold">Room {id}</h1>
            <div className="flex gap-4">
                <div className="flex flex-col items-center">
                    <h3 className="text-sm font-medium mb-2">Your Video</h3>
                    <video 
                        ref={localVideoRef} 
                        autoPlay 
                        playsInline 
                        muted 
                        className="border w-64 h-48"
                    />
                </div>
                <div className="flex flex-col items-center">
                    <h3 className="text-sm font-medium mb-2">Remote Video</h3>
                    <video 
                        ref={remoteVideoRef} 
                        autoPlay 
                        playsInline 
                        className="border w-64 h-48" 
                    />
                </div>
            </div>
            <div className="text-sm text-gray-600">
                Status: {isConnected ? "Connected" : "Disconnected"}
            </div>
        </div>
    )
}