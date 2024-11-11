import { useFlow } from '@speechmatics/flow-client-react';

export function Status({ isRecording }: { isRecording: boolean; }) {
  const { socketState, sessionId } = useFlow();

  return (
    <div>
      <p>🔌 Socket is</p>
      <div>{socketState ?? '(uninitialized)'}</div>
      <p>💬 Session ID</p>
      <div>{sessionId ?? '(none)'}</div>
      <p>🎤 Microphone is</p>
      <div>{isRecording ? 'recording' : 'not recording'}</div>
    </div>
  );
}