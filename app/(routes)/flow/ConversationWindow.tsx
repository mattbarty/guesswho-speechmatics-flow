'use client';

import { useCallback, useState } from 'react';

import {
  usePcmMicrophoneAudio,
  usePlayPcm16Audio,
} from '@/lib/audio-hooks';
import { useFlow, useFlowEventListener } from '@speechmatics/flow-client-react';
import { TemplateVariables } from './types';
import { getRandomCharacter } from './utils';
import { Header } from './components/Header';
import { gameRules } from './gameRules';

const ConversationWindow = ({
  jwt,
  personas,
}: {
  jwt: string;
  personas: Record<string, { name: string; }>;
}) => {
  const { startConversation, sendAudio, endConversation } = useFlow();
  const { socketState, sessionId } = useFlow();
  const connected = socketState === 'open';
  const [personaId, setPersonaId] = useState(Object.keys(personas)[0]);
  const [deviceId, setDeviceId] = useState<string>();
  const [templateVariables, setTemplateVariables] = useState<TemplateVariables>({ persona: '', style: '', context: '' });


  const [audioContext, setAudioContext] = useState<AudioContext>();

  const playAudio = usePlayPcm16Audio(audioContext);

  useFlowEventListener('agentAudio', (audio) => {
    playAudio(audio.data);
  });

  const [loading, setLoading] = useState(false);

  const [mediaStream, setMediaStream] = useState<MediaStream>();

  const { startRecording, stopRecording, isRecording } = usePcmMicrophoneAudio(
    (audio: Float32Array) => {
      sendAudio(audio.buffer);
    },
  );

  const [currentCharacter, setCurrentCharacter] = useState<string>('');

  const startSession = useCallback(
    async ({
      personaId,
      deviceId,
      templateVariables,
    }: {
      personaId: string;
      deviceId?: string;
      templateVariables: TemplateVariables;
    }) => {
      try {
        setLoading(true);

        // Get random character data
        const randomCharacter = getRandomCharacter();
        setCurrentCharacter(randomCharacter.characterName);

        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        setAudioContext(audioContext);

        const config = {
          config: {
            template_id: personaId,
            template_variables: {
              persona: randomCharacter.persona,
              style: randomCharacter.style,
              context: gameRules,
            },
          },
          audioFormat: {
            type: 'raw',
            encoding: 'pcm_f32le',
            sample_rate: SAMPLE_RATE,
          },
        };

        console.log('Final conversation config:', config);

        await startConversation(jwt, {
          config: config.config,
          audioFormat: {
            type: "raw" as const,
            encoding: "pcm_f32le" as const,
            sample_rate: config.audioFormat.sample_rate
          }
        });
        const mediaStream = await startRecording(audioContext, deviceId);
        setMediaStream(mediaStream);
      } catch (error) {
        console.error('Error starting conversation:', error);
      } finally {
        setLoading(false);
      }
    },
    [startConversation, jwt, startRecording],
  );

  const stopSession = useCallback(async () => {
    endConversation();
    stopRecording();
    await audioContext?.close();
    setCurrentCharacter(''); // Reset character when session ends
  }, [endConversation, stopRecording, audioContext]);

  return (
    <div className="flex flex-col w-full h-full">
      <Header
        personas={personas}
        setDeviceId={setDeviceId}
        setPersonaId={setPersonaId}
      />
      <div className="flex flex-col items-center justify-between w-full h-full gap-4 p-4">
        <div className="flex flex-col items-center justify-between w-full gap-4 grow-1 h-full">
          <div>
            <div className="grid">
              <button
                type="button"
                className={connected ? 'secondary' : undefined}
                aria-busy={loading}
                onClick={
                  connected
                    ? stopSession
                    : () => startSession({
                      personaId,
                      deviceId,
                      templateVariables,
                    })
                }
              >
                {connected ? 'Stop conversation' : 'Start conversation'}
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center w-full gap-4 grow-0">
          <div>
            <p>🔌 Socket is</p>
            <div>{socketState ?? '(uninitialized)'}</div>
            <p>💬 Session ID</p>
            <div>{sessionId ?? '(none)'}</div>
            <p>🎤 Microphone is</p>
            <div>{isRecording ? 'recording' : 'not recording'}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

const SAMPLE_RATE = 16_000;

export default ConversationWindow;
