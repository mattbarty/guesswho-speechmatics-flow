'use client';

import { ChangeEvent, useCallback, useState } from 'react';

import {
  usePcmMicrophoneAudio,
  usePlayPcm16Audio,
} from '@/lib/audio-hooks';
import { useFlow, useFlowEventListener } from '@speechmatics/flow-client-react';
import { useAudioDevices } from '@speechmatics/browser-audio-input-react';
import { TemplateVariables } from './types';
import { sanitizeTemplateVariables } from './utils';

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
        console.log('Starting session with:', {
          personaId,
          deviceId,
          rawTemplateVariables: templateVariables
        });

        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        setAudioContext(audioContext);

        // Transform variables to API-compatible format
        const apiTemplateVariables = sanitizeTemplateVariables(templateVariables);
        console.log('Sanitized template variables:', apiTemplateVariables);

        const config = {
          config: {
            template_id: personaId,
            template_variables: {
              persona: apiTemplateVariables.persona,
              style: apiTemplateVariables.style,
              context: apiTemplateVariables.context,
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
  }, [endConversation, stopRecording, audioContext]);

  return (
    <div className="flex flex-col items-center justify-between w-full h-full gap-4 bg-pink-500">
      <div className="flex flex-col items-center justify-between w-full gap-4 bg-blue-500 h-full">
        <div className="flex flex-col items-center justify-between w-full gap-4 bg-red-500 shrink-0">
          <div>
            <div className="grid">
              <MicrophoneSelect setDeviceId={setDeviceId} />
              <label>
                Select persona
                <select
                  onChange={(e) => {
                    setPersonaId(e.target.value);
                  }}
                >
                  {Object.entries(personas).map(([id, { name }]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center justify-between w-full gap-4 bg-green-500 grow-1">
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
        <div className="flex flex-col items-center justify-center w-full gap-4 bg-yellow-500 grow-0 h-full">
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

function MicrophoneSelect({
  setDeviceId,
}: { setDeviceId: (deviceId: string) => void; }) {
  const devices = useAudioDevices();

  switch (devices.permissionState) {
    case 'prompt':
      return (
        <label>
          Enable mic permissions
          <select
            onClick={devices.promptPermissions}
            onKeyDown={devices.promptPermissions}
          />
        </label>
      );
    case 'prompting':
      return (
        <label>
          Enable mic permissions
          <select aria-busy="true" />
        </label>
      );
    case 'granted': {
      const onChange = (e: ChangeEvent<HTMLSelectElement>) => {
        setDeviceId(e.target.value);
      };
      return (
        <label>
          Select audio device
          <select onChange={onChange}>
            {devices.deviceList.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      );
    }
    case 'denied':
      return (
        <label>
          Microphone permission disabled
          <select disabled />
        </label>
      );
    default:
      devices satisfies never;
      return null;
  }
}

const SAMPLE_RATE = 16_000;

export default ConversationWindow;
