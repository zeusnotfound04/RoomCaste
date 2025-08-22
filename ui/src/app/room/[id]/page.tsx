"use client"

import useSocket from "@/hook/useSocket";
import { useEffect, useRef, useState } from "react";
import { 
    Mic, 
    MicOff, 
    Video, 
    VideoOff, 
    Monitor, 
    Phone, 
    PhoneOff, 
    User, 
    Copy,
    Users 
} from "lucide-react";

export default function RoomPage({params}: {params: {id: string}}) {
    const {id} = params;

    const localVideoRef = useRef<HTMLVideoElement>(null)
    const remoteVideoRef = useRef<HTMLVideoElement>(null)
    const pcRef = useRef<RTCPeerConnection | null>(null)
    const isOfferingRef = useRef(false)
    const localStreamRef = useRef<MediaStream | null>(null)

    const {send, onMessage, isConnected} = useSocket(id)
    
    // Media control states
    const [isMicEnabled, setIsMicEnabled] = useState(true)
    const [isCameraEnabled, setIsCameraEnabled] = useState(true)
    const [isRemoteVideoVisible, setIsRemoteVideoVisible] = useState(false)
    const [isClient, setIsClient] = useState(false)

    // Fix hydration issues
    useEffect(() => {
        setIsClient(true)
    }, [])

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
                        try {
                            // Check if we're in the correct state to set remote description
                            if (pcRef.current.signalingState === "have-local-offer") {
                                await pcRef.current.setRemoteDescription(message.payload.answer);
                                console.log("Remote answer set successfully");
                            } else {
                                console.warn("Cannot set remote answer in state:", pcRef.current.signalingState);
                            }
                        } catch (error) {
                            console.error("Error setting remote description:", error);
                        }
                    }
                    break;

                case "candidate":
                    if (message.payload?.candidate && pcRef.current) {
                        try {
                            // Only add ICE candidates if we have a remote description
                            if (pcRef.current.remoteDescription) {
                                await pcRef.current.addIceCandidate(message.payload.candidate);
                                console.log("ICE candidate added successfully");
                            } else {
                                console.warn("Cannot add ICE candidate without remote description");
                            }
                        } catch (error) {
                            console.error("Error adding ICE candidate:", error);
                        }
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
            console.log("Received remote track:", event.track.kind);
            
            if (remoteVideoRef.current && event.streams[0]) {
                const video = remoteVideoRef.current;
                const stream = event.streams[0];
                
                if (video.srcObject !== stream) {
                    video.srcObject = stream;
                    setIsRemoteVideoVisible(true);
                    
                    const playVideo = () => {
                        video.play().catch(e => {
                            console.error("Failed to play remote video:", e);
                            setTimeout(() => {
                                video.play().catch(err => console.log("Retry play failed:", err));
                            }, 500);
                        });
                    };
                    
                    if (video.readyState >= 2) {
                        playVideo();
                    } else {
                        // Wait for loadeddata event
                        video.addEventListener('loadeddata', playVideo, { once: true });
                    }
                }
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
                localStreamRef.current = stream;
                
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
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
            }
            if (pcRef.current) {
                pcRef.current.close();
                pcRef.current = null;
            }
        };

    }, [id, send, onMessage, isConnected]);

    const toggleMicrophone = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMicEnabled(audioTrack.enabled);
            }
        }
    };

    // Toggle camera
    const toggleCamera = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsCameraEnabled(videoTrack.enabled);
            }
        }
    };

    // End call
    const endCall = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }
        if (pcRef.current) {
            pcRef.current.close();
        }
        window.location.href = '/';
    };

    return (
        <div className="min-h-screen bg-black text-white p-6">
            {/* Header */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Room {id}</h1>
                        <p className="text-gray-400 mt-1">Premium video calling experience</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
                            <span className="text-sm font-medium">
                                {isConnected ? "Connected" : "Disconnected"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Video Grid */}
            <div className="max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Local Video */}
                    <div className="relative group">
                        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-medium flex items-center space-x-2">
                            <span>You</span>
                            {!isMicEnabled && <MicOff className="w-4 h-4 text-red-400" />}
                            {!isCameraEnabled && <VideoOff className="w-4 h-4 text-red-400" />}
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gray-900/50 backdrop-blur-sm">
                            <video 
                                ref={localVideoRef} 
                                autoPlay 
                                playsInline 
                                muted 
                                className={`w-full h-[400px] object-cover ${!isCameraEnabled ? 'opacity-0' : ''}`}
                            />
                            
                            {!isCameraEnabled && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                                            <User className="w-10 h-10 text-gray-400" />
                                        </div>
                                        <p className="text-white font-medium">Camera is off</p>
                                    </div>
                                </div>
                            )}
                            
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none"></div>
                        </div>
                    </div>

                    {/* Remote Video */}
                    <div className="relative group">
                        <div className="absolute top-4 left-4 z-10 bg-black/50 backdrop-blur-sm px-3 py-1 rounded-lg text-sm font-medium">
                            Remote
                        </div>
                        <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gray-900/50 backdrop-blur-sm">
                            <video 
                                ref={remoteVideoRef} 
                                autoPlay 
                                playsInline 
                                className="w-full h-[400px] object-cover" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none"></div>
                            
                            {!isRemoteVideoVisible && (
                                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                    <div className="text-center">
                                        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4 mx-auto">
                                            <Users className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-sm font-medium">Waiting for remote participant...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls Bar */}
                <div className="mt-8 flex justify-center">
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20 px-6 py-4">
                        <div className="flex items-center space-x-6">
                            {/* Microphone Toggle */}
                            <button 
                                onClick={toggleMicrophone}
                                className={`w-12 h-12 ${isMicEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'} rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105`}
                                title={isMicEnabled ? "Mute microphone" : "Unmute microphone"}
                            >
                                {isMicEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                            </button>
                            
                            <button 
                                onClick={toggleCamera}
                                className={`w-12 h-12 ${isCameraEnabled ? 'bg-white/10 hover:bg-white/20' : 'bg-red-500 hover:bg-red-600'} rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105`}
                                title={isCameraEnabled ? "Turn off camera" : "Turn on camera"}
                            >
                                {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                            </button>
                            
                            <button 
                                className="w-12 h-12 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                                title="Share screen (coming soon)"
                            >
                                <Monitor className="w-5 h-5" />
                            </button>
                            
                            <button 
                                onClick={endCall}
                                className="w-12 h-12 bg-red-500 hover:bg-red-600 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
                                title="End call"
                            >
                                <PhoneOff className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Room Info */}
                <div className="mt-8 text-center">
                    <div className="inline-flex items-center space-x-2 bg-white/5 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                        <span className="text-sm text-gray-400">Share this room:</span>
                        <code className="text-sm font-mono text-white bg-white/10 px-2 py-1 rounded select-all cursor-pointer" 
                              onClick={() => isClient && navigator.clipboard?.writeText(window.location.href)}
                              title="Click to copy">
                            {isClient ? window.location.href : `Room ${id}`}
                        </code>
                    </div>
                    
                    <div className="mt-4 flex justify-center space-x-4 text-sm text-gray-400">
                        <div className="flex items-center space-x-2">
                            {isMicEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                            <span>{isMicEnabled ? "Mic On" : "Mic Off"}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            {isCameraEnabled ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                            <span>{isCameraEnabled ? "Camera On" : "Camera Off"}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}