"use client";
import React, { useEffect, useRef, useState } from 'react';
import hark from 'hark';
import { getSocket } from '@/lib/socket';

type Props = {
  camId: string;
  videoDeviceId?: string;
  audioDeviceId?: string;
  isProgram?: boolean;
};

export default function LocalStreamProcessor({ camId, videoDeviceId, audioDeviceId, isProgram }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let speechEvents: any = null;
    
    async function initStream() {
      try {
        const constraints: MediaStreamConstraints = {
          audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
          video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Initialize Hark for VAD
        // threshold: -50dB is a reasonable default for speech
        speechEvents = hark(stream, { threshold: -50, interval: 150 });
        
        speechEvents.on('speaking', () => {
          setIsSpeaking(true);
          const socket = getSocket();
          socket.emit('metadata', { camId, vad: 1, motion: 0 });
        });

        speechEvents.on('stopped_speaking', () => {
          setIsSpeaking(false);
           const socket = getSocket();
           socket.emit('metadata', { camId, vad: 0, motion: 0 });
        });

      } catch (err: any) {
        setError(err.message || 'Failed to access camera/microphone');
        console.error(err);
      }
    }

    initStream();

    return () => {
      if (speechEvents) {
        speechEvents.stop();
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-gray-900 rounded-xl border border-gray-800">
      <div className="flex flex-col items-center gap-2 mb-4">
        <h2 className="text-xl font-bold text-white">Edge AI Processor — {camId}</h2>
        <span className="text-xs text-gray-400 font-mono">Unit Cost: $0.00/hr (Running Locally)</span>
      </div>
      
      <div 
        className={`relative rounded-lg overflow-hidden border-4 transition-all duration-200 ${
          isProgram ? 'border-blue-500' : isSpeaking ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.4)]' : 'border-gray-700'
        }`}
      >
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className="w-[640px] h-[360px] object-cover bg-black"
        />
        
        {/* Overlay Indicators */}
        <div className="absolute top-4 right-4 flex gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-bold ${
            isSpeaking ? 'bg-green-500 text-black' : 'bg-black/60 text-gray-400'
          }`}>
            {isSpeaking ? 'VAD: ACTIVE' : 'VAD: IDLE'}
          </div>
        </div>
        {isProgram && (
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-black">PROGRAM</div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-900/20 border border-red-900 rounded text-red-400">
          Error: {error}
        </div>
      )}
      
      <div className="text-sm text-gray-500 max-w-md text-center mt-2">
        <p>Speak into your microphone. The green border triggers purely via browser-side AudioContext analysis.</p>
      </div>
    </div>
  );
}
