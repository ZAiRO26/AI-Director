"use client";
import React, { useEffect, useMemo, useState } from 'react';
import LocalStreamProcessor from '@/components/LocalStreamProcessor';
import { getSocket } from '@/lib/socket';
import ProgramMixer from '@/components/ProgramMixer';
import { joinLiveKit, publishActive } from '@/lib/livekit';

type MediaDevice = MediaDeviceInfo;

export default function MultiCamConsole() {
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selected, setSelected] = useState<Array<{ camId: string; v?: string; a?: string }>>([
    { camId: 'cam_1' },
    { camId: 'cam_2' },
  ]);
  const [activeCam, setActiveCam] = useState<string>('cam_1');
  const [streams, setStreams] = useState<Record<string, MediaStream | undefined>>({});
  const [recording, setRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const recorders = React.useRef<Record<string, MediaRecorder | undefined>>({});
  const chunks = React.useRef<Record<string, Blob[]>>({});

  useEffect(() => {
    async function enumerate() {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {});
      const devices = await navigator.mediaDevices.enumerateDevices();
      setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
    }
    enumerate();

    const socket = getSocket();
    socket.on('switch', (p: any) => {
      setActiveCam(p.active);
      if (sessionId) socket.emit('event', { sessionId, type: 'switch', to: p.active });
    });
    return () => {
      socket.off('switch');
    };
  }, []);

  const deviceOptions = useMemo(() => ({
    video: videoDevices.map((d) => ({ id: d.deviceId, label: d.label || d.deviceId })),
    audio: audioDevices.map((d) => ({ id: d.deviceId, label: d.label || d.deviceId })),
  }), [videoDevices, audioDevices]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Control Room</h1>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400">Active Program: <span className="font-mono text-green-400">{activeCam}</span></div>
          <button
            className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white rounded"
            onClick={async () => {
              const roomId = 'default';
              const t = await fetch(`http://localhost:4000/live/token?roomId=${roomId}&identity=director`);
              const { url, token } = await t.json();
              if (url && token) { await joinLiveKit(url, token); await publishActive(streams[activeCam]); }
            }}
          >
            Go Live (SFU)
          </button>
          <button
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded"
            onClick={async () => {
              if (!recording) {
                const r = await fetch('http://localhost:4000/session/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: 'default' }) });
                const data = await r.json();
                setSessionId(data.sessionId);
                const socket = getSocket();
                socket.emit('event', { sessionId: data.sessionId, type: 'record_start' });
                setRecording(true);
                Object.entries(streams).forEach(([camId, st]) => {
                  if (!st) return;
                  chunks.current[camId] = [];
                  const mr = new MediaRecorder(st, { mimeType: 'video/webm;codecs=vp9' });
                  recorders.current[camId] = mr;
                  mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.current[camId]?.push(e.data); };
                  mr.start(1000);
                });
              } else {
                const sid = sessionId;
                setRecording(false);
                Object.entries(recorders.current).forEach(([camId, mr]) => { try { mr?.stop(); } catch {} });
                await new Promise((res) => setTimeout(res, 500));
                if (sid) {
                  for (const [camId, list] of Object.entries(chunks.current)) {
                    const blob = new Blob(list, { type: 'video/webm' });
                    const fd = new FormData();
                    fd.append('file', blob, `${camId}_iso.webm`);
                    fd.append('sessionId', sid);
                    fd.append('name', `${camId}_iso.webm`);
                    await fetch('http://localhost:4000/upload', { method: 'POST', body: fd });
                  }
                  const socket = getSocket();
                  socket.emit('event', { sessionId: sid, type: 'record_stop' });
                  await fetch('http://localhost:4000/session/stop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: 'default' }) });
                }
                setSessionId(null);
              }
            }}
          >
            {recording ? 'Stop Session' : 'Start Session'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {selected.map((s, idx) => (
          <div key={s.camId}>
            <div className="flex gap-2 mb-2">
              <select
                value={s.v || ''}
                onChange={(e) => {
                  const next = [...selected];
                  next[idx] = { ...s, v: e.target.value };
                  setSelected(next);
                }}
                className="bg-black text-white border border-gray-700 rounded px-2 py-1"
              >
                <option value="">Default Camera</option>
                {deviceOptions.video.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              <select
                value={s.a || ''}
                onChange={(e) => {
                  const next = [...selected];
                  next[idx] = { ...s, a: e.target.value };
                  setSelected(next);
                }}
                className="bg-black text-white border border-gray-700 rounded px-2 py-1"
              >
                <option value="">Default Mic</option>
                {deviceOptions.audio.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              <button
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded"
                onClick={() => setActiveCam(s.camId)}
              >
                Cut to {s.camId}
              </button>
            </div>
            <LocalStreamProcessor camId={s.camId} videoDeviceId={s.v} audioDeviceId={s.a} isProgram={activeCam === s.camId} onStream={(st) => setStreams((m) => ({ ...m, [s.camId]: st }))} />
          </div>
        ))}
      </div>

      <div className="mt-6">
        <ProgramMixer
          stream={streams[activeCam]}
          onRecording={async (blob) => {
            if (!sessionId) return;
            const fd = new FormData();
            fd.append('file', blob, 'program.webm');
            fd.append('sessionId', sessionId);
            fd.append('name', 'program.webm');
            await fetch('http://localhost:4000/upload', { method: 'POST', body: fd });
          }}
        />
      </div>

      <div className="mt-4 p-3 bg-zinc-800/40 rounded text-sm text-gray-300">
        Speak on any mic. The backend will emit automatic cuts using the decision engine with hysteresis and confidence gating.
      </div>
    </div>
  );
}

