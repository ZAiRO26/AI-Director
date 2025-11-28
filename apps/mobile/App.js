import React, { useEffect, useRef, useState } from 'react'
import { SafeAreaView, Text, View, Button } from 'react-native'

export default function App() {
  const [sessionId, setSessionId] = useState(null)
  const wsRef = useRef(null)

  async function createSession() {
    const res = await fetch('http://127.0.0.1:3000/api/session/create', { method: 'POST' })
    const data = await res.json()
    setSessionId(data.sessionId)
    const url = `ws://127.0.0.1:3000${data.wsEndpoint}`
    wsRef.current = new WebSocket(url)
    wsRef.current.onmessage = (e) => {}
  }

  function sendMetadata() {
    if (!wsRef.current) return
    const payload = {
      type: 'metadata',
      sessionId,
      deviceId: 'dev_sim',
      camId: 1,
      timestamp: Date.now(),
      motion_score: Math.random(),
      sound_score: Math.random(),
      gesture: { id: null, score: 0 },
      gaze: { x: 0, y: 0, score: Math.random() }
    }
    wsRef.current.send(JSON.stringify(payload))
  }

  return (
    <SafeAreaView>
      <View style={{ padding: 16 }}>
        <Text>AI Cam Director Mobile</Text>
        <Button title="Create Session" onPress={createSession} />
        <Button title="Send Metadata" onPress={sendMetadata} />
        <Text>{sessionId || ''}</Text>
      </View>
    </SafeAreaView>
  )
}
