"use client"

import useSocket from "@/hook/useSocket";
import { useEffect, useRef, useState } from "react";
import { 
    Mic, 
    MicOff, 
    Video, 
    VideoOff, 
    PhoneOff
} from "lucide-react";

export default function RoomPage({params}: {params: {id: string}}) {
    const {id} = params;
    const {send, onMessage, isConnected} = useSocket(id);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isRemoteConnected, setIsRemoteConnected] = useState(false);

    useEffect(() => {
        if (!isConnected) return;

        const initializeMedia = async () => {
            try {
                // Get user media
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    video: true, 
                    audio: true 
                });
                
                localStreamRef.current = stream;
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                
                console.log("Local media initialized");
                
                // Create peer connection
                const pc = new RTCPeerConnection({
                    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
                });
                
                pcRef.current = pc;
                
                // Add tracks to peer connection
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });
                
                // Handle incoming tracks
                pc.ontrack = (event) => {
                    console.log("Received remote track");
                    if (remoteVideoRef.current && event.streams[0]) {
                        remoteVideoRef.current.srcObject = event.streams[0];
                        setIsRemoteConnected(true);
                    }
                };
                
                // Handle ICE candidates
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        send({
                            type: "ice-candidate",
                            candidate: event.candidate
                        });
                    }
                };
                
                // Handle connection state
                pc.onconnectionstatechange = () => {
                    console.log("Connection state:", pc.connectionState);
                };
                
            } catch (error) {
                console.error("Error initializing media:", error);
            }
        };

        const handleMessage = async (message: any) => {
            const pc = pcRef.current;
            if (!pc) return;

            try {
                switch (message.type) {
                    case "user-joined":
                        // Someone joined, create offer
                        console.log("User joined, creating offer");
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        send({
                            type: "offer",
                            offer: offer
                        });
                        break;

                    case "offer":
                        // Received offer, create answer
                        console.log("Received offer");
                        await pc.setRemoteDescription(message.offer);
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        send({
                            type: "answer",
                            answer: answer
                        });
                        break;

                    case "answer":
                        // Received answer
                        console.log("Received answer");
                        await pc.setRemoteDescription(message.answer);
                        break;

                    case "ice-candidate":
                        // Received ICE candidate
                        console.log("Received ICE candidate");
                        await pc.addIceCandidate(message.candidate);
                        break;

                    case "user-left":
                        setIsRemoteConnected(false);
                        if (remoteVideoRef.current) {
                            remoteVideoRef.current.srcObject = null;
                        }
                        break;
                }
            } catch (error) {
                console.error("Error handling message:", error);
            }
        };

        initializeMedia();
        onMessage(handleMessage);

        // Cleanup
        return () => {
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (pcRef.current) {
                pcRef.current.close();
            }
        };
    }, [isConnected, send, onMessage]);

    const toggleMic = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicEnabled(audioTrack.enabled);
            }
        }
    };

    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraEnabled(videoTrack.enabled);
            }
        }
    };

    const leaveRoom = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
        }
        window.location.href = '/';
    };

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-xl">Connecting to room...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Video Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 h-[calc(100vh-100px)]">
                {/* Local Video */}
                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded text-sm">
                        You
                    </div>
                </div>

                {/* Remote Video */}
                <div className="relative bg-gray-900 rounded-lg overflow-hidden">
                    {isRemoteConnected ? (
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <div className="text-xl mb-2">Waiting for someone to join...</div>
                                <div className="text-sm">Room ID: {id}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Controls */}
            <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                <button
                    onClick={toggleMic}
                    className={`p-4 rounded-full transition-colors ${
                        isMicEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                    {isMicEnabled ? <Mic size={24} /> : <MicOff size={24} />}
                </button>

                <button
                    onClick={toggleCamera}
                    className={`p-4 rounded-full transition-colors ${
                        isCameraEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                    }`}
                >
                    {isCameraEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                </button>

                <button
                    onClick={leaveRoom}
                    className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                >
                    <PhoneOff size={24} />
                </button>
            </div>
        </div>
    );
}
