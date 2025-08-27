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

export default function({ roomId} : any){

    const {send, onMessage, isConnected} = useSocket(roomId);
    
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    
    const [isMicEnabled, setIsMicEnabled] = useState(true);
    const [isCameraEnabled, setIsCameraEnabled] = useState(true);
    const [isRemoteConnected, setIsRemoteConnected] = useState(false);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<string>("connecting");

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
                
                // Create peer connection with STUN and TURN servers
                const pc = new RTCPeerConnection({
                    iceServers: [
                        // STUN servers for NAT discovery
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        
                        // TURN servers for relay when direct connection fails
                        {
                            urls: 'turn:openrelay.metered.ca:80',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        },
                        {
                            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                            username: 'openrelayproject',
                            credential: 'openrelayproject'
                        }
                    ]
                });
                
                pcRef.current = pc;
                console.log("Created the peer connection")
                
                // Add tracks to peer connection
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                    console.log("Added track to peer:", track.kind);
                });
                
                // Handle incoming tracks
                pc.ontrack = (event) => {
                    console.log("🎥 TRACK RECEIVED:", event.track.kind);
                    console.log("Remote streams count:", event.streams.length);
                    console.log("Remote stream:", event.streams[0]);
                    console.log("Remote video ref:", remoteVideoRef.current);
                    
                    if (event.streams[0]) {
                        console.log("✅ Storing remote stream");
                        setRemoteStream(event.streams[0]);
                        setIsRemoteConnected(true);
                        
                        // Try to set the video source immediately
                        if (remoteVideoRef.current) {
                            console.log("✅ Setting remote video source immediately");
                            remoteVideoRef.current.srcObject = event.streams[0];
                        } else {
                            console.log("⏳ Remote video ref not ready, will retry...");
                        }
                    } else {
                        console.log("❌ No remote stream in track event");
                    }
                };
                
                // Handle ICE candidates with detailed logging
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log("🧊 ICE candidate type:", event.candidate.type);
                        console.log("🧊 ICE candidate:", event.candidate.candidate);
                        console.log("Sending ICE candidate");
                        send({
                            type: "candidate",
                            payload: JSON.stringify(event.candidate)
                        });
                    } else {
                        console.log("🧊 ICE gathering complete");
                    }
                };
                
                // Handle connection state
                pc.onconnectionstatechange = () => {
                    console.log("🔗 Connection state:", pc.connectionState);
                    console.log("🔗 ICE connection state:", pc.iceConnectionState);
                    console.log("🔗 ICE gathering state:", pc.iceGatheringState);
                };

                // Add additional event listeners for debugging
                pc.oniceconnectionstatechange = () => {
                    console.log("🧊 ICE connection state changed:", pc.iceConnectionState);
                    
                    if (pc.iceConnectionState === 'failed') {
                        console.error("❌ ICE connection failed - NAT/firewall issue detected");
                        console.log("🔧 TURN servers should help with cross-network connectivity");
                        setConnectionStatus("failed");
                    } else if (pc.iceConnectionState === 'connected') {
                        console.log("✅ ICE connection successful!");
                        setConnectionStatus("connected");
                    } else if (pc.iceConnectionState === 'disconnected') {
                        console.warn("⚠️ ICE connection disconnected - attempting reconnection");
                        setConnectionStatus("disconnected");
                    } else if (pc.iceConnectionState === 'checking') {
                        setConnectionStatus("connecting");
                    }
                };

                pc.onicegatheringstatechange = () => {
                    console.log("🧊 ICE gathering state changed:", pc.iceGatheringState);
                };

                pc.onsignalingstatechange = () => {
                    console.log("📡 Signaling state changed:", pc.signalingState);
                };

                // Send join message to notify server we're ready
                console.log("📢 Sending join message to server");
                send({
                    type: "join"
                });
                
            } catch (error) {
                console.error("Error initializing media:", error);
            }
        };

        const handleMessage = async (message: any) => {
            const pc = pcRef.current;
            if (!pc) return;

            try {
                console.log("Received message:", message.type);
                
                switch (message.type) {
                    case "peer_joined":
                        // Someone joined, create offer
                        console.log("🔄 Peer joined, creating offer");
                        console.log("Peer info:", message);
                        const offer = await pc.createOffer();
                        await pc.setLocalDescription(offer);
                        console.log("✅ Created and set local description (offer)");
                        send({
                            type: "offer",
                            to: message.from,
                            payload: JSON.stringify(offer)
                        });
                        console.log("📤 Sent offer to:", message.from);
                        break;

                    case "offer":
                        // Received offer, create answer
                        console.log("📥 Received offer from:", message.from);
                        console.log("Offer data:", message.payload);
                        if (!message.payload) {
                            console.error("❌ No payload in offer message");
                            break;
                        }
                        const offerData = JSON.parse(message.payload);
                        await pc.setRemoteDescription(offerData);
                        console.log("✅ Set remote description (offer)");
                        const answer = await pc.createAnswer();
                        await pc.setLocalDescription(answer);
                        console.log("✅ Created and set local description (answer)");
                        send({
                            type: "answer",
                            to: message.from,
                            payload: JSON.stringify(answer)
                        });
                        console.log("📤 Sent answer to:", message.from);
                        break;

                    case "answer":
                        // Received answer
                        console.log("📥 Received answer from:", message.from);
                        console.log("Answer data:", message.payload);
                        if (!message.payload) {
                            console.error("❌ No payload in answer message");
                            break;
                        }
                        const answerData = JSON.parse(message.payload);
                        await pc.setRemoteDescription(answerData);
                        console.log("✅ Set remote description (answer)");
                        break;

                    case "candidate":
                        // Received ICE candidate
                        console.log("🧊 Received ICE candidate from:", message.from);
                        console.log("Candidate data:", message.payload);
                        if (!message.payload) {
                            console.error("❌ No payload in candidate message");
                            break;
                        }
                        const candidateData = JSON.parse(message.payload);
                        await pc.addIceCandidate(candidateData);
                        console.log("✅ Added ICE candidate");
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

    // Effect to set remote stream when video ref becomes available
    useEffect(() => {
        if (remoteStream && remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
            console.log("🔄 Setting remote video source from stored stream");
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, isRemoteConnected]);

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
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        style={{ display: isRemoteConnected ? 'block' : 'none' }}
                    />
                    {!isRemoteConnected && (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <div className="text-center">
                                <div className="text-xl mb-2">Waiting for someone to join...</div>
                                <div className="text-sm">Room ID: {roomId}</div>
                                {connectionStatus === "failed" && (
                                    <div className="text-red-500 text-sm mt-2">
                                        ❌ Connection failed - Network/firewall issue
                                    </div>
                                )}
                                {connectionStatus === "connecting" && (
                                    <div className="text-yellow-500 text-sm mt-2">
                                        🔄 Connecting...
                                    </div>
                                )}
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
    )
}