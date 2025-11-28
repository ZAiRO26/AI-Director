"use client";
import React, { useEffect, useState } from 'react';

type FileItem = { name: string; url: string };

export default function DeliveryPanel({ sessionId }: { sessionId: string }) {
  const [files, setFiles] = useState<FileItem[]>([]);
  useEffect(() => {
    async function load() {
      const r = await fetch(`http://localhost:4000/assets/${sessionId}`);
      const j = await r.json();
      if (j?.ok) setFiles(j.files || []);
    }
    load();
  }, [sessionId]);
  return (
    <div className="p-4 bg-zinc-800/40 rounded border border-gray-700">
      <div className="text-white font-bold mb-2">Assets</div>
      <ul className="space-y-1">
        {files.map((f) => (
          <li key={f.name} className="flex items-center justify-between">
            <span className="text-gray-300">{f.name}</span>
            <a href={f.url} target="_blank" className="text-blue-400 underline">Download</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

