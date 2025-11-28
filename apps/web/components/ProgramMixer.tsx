"use client";
import React, { useEffect, useRef, useState } from 'react';

type Props = {
  stream?: MediaStream;
  onRecording?: (blob: Blob) => void;
};

export default function ProgramMixer({ stream, onRecording }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [recording, setRecording] = useState(false);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const [chunks, setChunks] = useState<Blob[]>([]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [stream]);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  function start() {
    if (recording) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = canvas.captureStream(30);
    const r = new MediaRecorder(s, { mimeType: 'video/webm;codecs=vp9' });
    setChunks([]);
    r.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) setChunks((c) => [...c, e.data]);
    };
    r.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      if (onRecording) onRecording(blob);
    };
    r.start(1000);
    setRecorder(r);
    setRecording(true);
  }

  function stop() {
    if (!recording || !recorder) return;
    recorder.stop();
    setRecording(false);
    setRecorder(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button onClick={start} className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded" disabled={recording}>Record Program</button>
        <button onClick={stop} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded" disabled={!recording}>Stop</button>
        <span className="text-sm text-gray-400">{recording ? 'Recording...' : 'Idle'}</span>
      </div>
      <canvas ref={canvasRef} width={640} height={360} className="rounded border border-gray-700 bg-black" />
      <video ref={videoRef} className="hidden" muted playsInline />
    </div>
  );
}

