import { Room, RoomEvent, createLocalVideoTrack, createLocalAudioTrack, connect } from 'livekit-client';

let room: Room | null = null;

export async function joinLiveKit(url: string, token: string) {
  room = await connect(url, token, { audio: true, video: true });
  return room;
}

export async function publishActive(stream?: MediaStream) {
  if (!room || !stream) return;
  const [vTrack] = stream.getVideoTracks();
  const [aTrack] = stream.getAudioTracks();
  if (vTrack) await room.localParticipant.publishTrack(await createLocalVideoTrack({ deviceId: vTrack.getSettings().deviceId } as any));
  if (aTrack) await room.localParticipant.publishTrack(await createLocalAudioTrack({ deviceId: aTrack.getSettings().deviceId } as any));
}

