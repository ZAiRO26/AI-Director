"use client";
import React, { useEffect, useMemo, useState } from 'react';
import LocalStreamProcessor from '@/components/LocalStreamProcessor';
import { getSocket } from '@/lib/socket';

type MediaDevice = MediaDeviceInfo;

export default function MultiCamConsole() {
  const [videoDevices, setVideoDevices] = useState<MediaDevice[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDevice[]>([]);
  const [selected, setSelected] = useState<Array<{ camId: string; v?: string; a?: string }>>([
    { camId: 'cam_1' },
    { camId: 'cam_2' },
  ]);
  const [activeCam, setActiveCam] = useState<string>('cam_1');

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
        <div className="text-sm text-gray-400">Active Program: <span className="font-mono text-green-400">{activeCam}</span></div>
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
            <LocalStreamProcessor camId={s.camId} videoDeviceId={s.v} audioDeviceId={s.a} isProgram={activeCam === s.camId} />
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-zinc-800/40 rounded text-sm text-gray-300">
        Speak on any mic. The backend will emit automatic cuts using the decision engine with hysteresis and confidence gating.
      </div>
    </div>
  );
}

