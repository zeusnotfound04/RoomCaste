"use client"

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Zap, Shield, Sparkles } from "lucide-react";
import BlurText, { BlurComponent } from "@/components/blur-effect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  const [roomName, setRoomName] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();

  const handleJoinRoom = () => {
    if (!roomName.trim()) return;
    
    setIsAnimating(true);
    
    setTimeout(() => {
      router.push(`/room/${roomName.trim()}`);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinRoom();
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:100px_100px]"></div>
        
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-white/3 rounded-full blur-3xl"></div>
        
        <div className="absolute top-20 left-20 w-2 h-2 bg-white/20 rounded-full animate-pulse"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-white/30 rounded-full animate-ping"></div>
        <div className="absolute bottom-32 left-1/3 w-1.5 h-1.5 bg-white/25 rounded-full animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-lg mx-auto text-center">

        <div className="mb-12">
          <BlurText
            text="RoomCast"
            className="text-7xl font-bold text-white mb-6 tracking-tight"
            animateBy="letters"
            delay={120}
            direction="top"
          />
          
          <BlurText
            text="Premium video calling experience"
            className="text-xl text-gray-400 font-light tracking-wide"
            animateBy="words"
            delay={60}
            direction="bottom"
          />
        </div>

        {/* Main Card */}
        <BlurComponent delay={800} direction="bottom">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
          >
            <Card className="bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl shadow-white/5 w-full">
              <CardHeader className="text-center space-y-3 pb-8">
                <CardTitle className="text-3xl font-bold text-white tracking-tight">
                  Join Room
                </CardTitle>
                <CardDescription className="text-gray-400 text-lg font-light">
                  Enter your destination
                </CardDescription>
              </CardHeader>
              
              <CardContent className="space-y-8">
                <div className="space-y-3">
                  <label 
                    htmlFor="roomName" 
                    className="text-sm font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Room Name
                  </label>
                  <motion.input
                    id="roomName"
                    type="text"
                    placeholder="Enter room name..."
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="w-full px-6 py-4 rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-white/30 transition-all duration-300 text-white placeholder-gray-500 text-lg font-light"
                    whileFocus={{ scale: 1.02, borderColor: "rgba(255,255,255,0.3)" }}
                    disabled={isAnimating}
                  />
                </div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                >
                  <Button
                    onClick={handleJoinRoom}
                    disabled={!roomName.trim() || isAnimating}
                    size="lg"
                    className="w-full bg-white text-black hover:bg-gray-100 font-semibold py-4 text-lg rounded-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none disabled:opacity-30 shadow-lg"
                  >
                    {isAnimating ? (
                      <div className="flex items-center space-x-3">
                        <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                      </div>
                    ) : (
                      <span className="tracking-wide">Enter Room</span>
                    )}
                  </Button>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 1.7, duration: 0.5 }}
                  className="pt-6 border-t border-white/10"
                >
                  <p className="text-sm text-gray-500 text-center mb-4 uppercase tracking-wider font-medium">
                    Quick Access
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {["Meeting", "Demo", "Studio"].map((name, index) => (
                      <motion.div
                        key={name}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 1.9 + index * 0.1, duration: 0.3 }}
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRoomName(name.toLowerCase())}
                          disabled={isAnimating}
                          className="w-full bg-transparent border-white/20 text-gray-300 hover:bg-white/10 hover:text-white hover:border-white/30 transition-all duration-300 py-3 rounded-lg font-medium"
                        >
                          {name}
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </CardContent>
            </Card>
          </motion.div>
        </BlurComponent>

        
      </div>
    </div>
  );
}
