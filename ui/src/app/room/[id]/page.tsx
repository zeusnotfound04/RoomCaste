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
    const [remoteStreamRef, setRemoteStreamRef] = useState<MediaStream | null>(null)
    const [notification, setNotification] = useState<string | null>(null)

    // Fix hydration issues
    useEffect(() => {
        setIsClient(true)
    }, [])

    // Show notification function
    const showNotification = (message: string) => {
        setNotification(message)
        setTimeout(() => setNotification(null), 3000)
    }

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
                    showNotification("Someone joined the room!")
                    if (!isOfferingRef.current) {
                        isOfferingRef.current = true;
                        createOffer();
                    }
                    break;

                case "peer_left":
                    showNotification("Someone left the room")
                    setIsRemoteVideoVisible(false)
                    setRemoteStreamRef(null)
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = null
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
                                isRemoteDescSet = true;
                                await processPendingCandidates();
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
                        await addCandidate(message.payload.candidate);
                    }
                    break;
            }
        });

        const pc = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' }
            ],
            iceCandidatePoolSize: 10
        });
        pcRef.current = pc;

        pc.onconnectionstatechange = () => {
            console.log("Connection state:", pc.connectionState);
            if (pc.connectionState === 'connected') {
                console.log("🎉 Peer connection established successfully!");
                showNotification("Connected to peer!");
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                console.log("❌ Peer connection failed or disconnected");
                setIsRemoteVideoVisible(false);
                setRemoteStreamRef(null);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("ICE connection state:", pc.iceConnectionState);
            if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
                console.log("🧊 ICE connection successful!");
            } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
                console.log("❌ ICE connection failed");
                setIsRemoteVideoVisible(false);
                setRemoteStreamRef(null);
                showNotification("Connection lost");
            }
        };

        pc.onsignalingstatechange = () => {
            console.log("Signaling state:", pc.signalingState);
        };

        pc.onnegotiationneeded = () => {
            console.log("Negotiation needed - creating offer");
            createOffer();
        };

        
        pc.ontrack = (event) => {
            console.log("=== Received remote track ===");
            console.log("Track kind:", event.track.kind);
            console.log("Track enabled:", event.track.enabled);
            console.log("Track ready state:", event.track.readyState);
            console.log("Number of streams:", event.streams.length);
            
            if (event.streams[0]) {
                const stream = event.streams[0];
                console.log("Remote stream ID:", stream.id);
                console.log("Stream active:", stream.active);
                console.log("Audio tracks:", stream.getAudioTracks().length);
                console.log("Video tracks:", stream.getVideoTracks().length);
                console.log("Local stream ID:", localStreamRef.current?.id);
                
                // Store the remote stream immediately when we get any track
                setRemoteStreamRef(stream);
                setIsRemoteVideoVisible(true);
                
                // Only set video element once we have the video track
                if (event.track.kind === 'video' && remoteVideoRef.current) {
                    const video = remoteVideoRef.current;
                    
                    console.log("Setting video element srcObject");
                    console.log("Video element current src:", video.srcObject);
                    video.srcObject = stream;
                    showNotification("Remote video connected!");
                    
                    const playVideo = () => {
                        console.log("Attempting to play video...");
                        video.play().then(() => {
                            console.log("Video playing successfully");
                        }).catch(e => {
                            console.error("Failed to play remote video:", e);
                        });
                    };
                    
                    // Use a more reliable way to wait for video
                    video.onloadedmetadata = () => {
                        console.log("Video metadata loaded, video dimensions:", video.videoWidth, "x", video.videoHeight);
                        playVideo();
                    };
                    
                    // Fallback - try to play after a delay
                    setTimeout(() => {
                        if (video.paused) {
                            console.log("Fallback play attempt - video still paused");
                            playVideo();
                        }
                    }, 1000);
                    
                    // Add more debugging
                    video.onplay = () => console.log("Video play event fired");
                    video.onplaying = () => console.log("Video playing event fired");
                    video.onerror = (e) => console.error("Video error:", e);
                }
            } else {
                console.error("No streams received with track");
            }
        };

        // Queue candidates that come before remote description
        const pendingCandidates: RTCIceCandidate[] = [];
        let isRemoteDescSet = false;
        
        const addCandidate = async (candidate: RTCIceCandidate) => {
            try {
                if (isRemoteDescSet) {
                    await pc.addIceCandidate(candidate);
                    console.log("Added ICE candidate immediately");
                } else {
                    console.log("Queueing ICE candidate for later");
                    pendingCandidates.push(candidate);
                }
            } catch (error) {
                console.error("Failed to add ICE candidate:", error);
            }
        };
        
        const processPendingCandidates = async () => {
            console.log(`Processing ${pendingCandidates.length} pending candidates`);
            for (const candidate of pendingCandidates) {
                try {
                    await pc.addIceCandidate(candidate);
                    console.log("Added queued ICE candidate");
                } catch (error) {
                    console.error("Failed to add queued ICE candidate:", error);
                }
            }
            pendingCandidates.length = 0;
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
                console.log("Got local stream:", stream.id);
                localStreamRef.current = stream;
                
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
                
                console.log("=== Adding local tracks to peer connection ===");
                console.log("Local stream tracks:", stream.getTracks().length);
                stream.getTracks().forEach((track) => {
                    console.log(`Adding ${track.kind} track:`, track.id, "enabled:", track.enabled);
                    pc.addTrack(track, stream);
                });
                console.log("All tracks added to peer connection");

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
                isRemoteDescSet = true;
                await processPendingCandidates();
                
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
        <div className="min-h-screen bg-black text-white p-6 relative">
            {/* Notification */}
            {notification && (
                <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-pulse">
                    <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5" />
                        <span className="font-medium">{notification}</span>
                    </div>
                </div>
            )}

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
                        {remoteStreamRef && (
                            <div className="flex items-center space-x-2">
                                <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                                <span className="text-sm font-medium">Remote peer connected</span>
                            </div>
                        )}
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
                            
                            {!isRemoteVideoVisible || !remoteStreamRef && (
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