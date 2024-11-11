'use client';

import { useCallback, useState } from 'react';

import {
  usePcmMicrophoneAudio,
  usePlayPcm16Audio,
} from '@/lib/audio-hooks';
import { ErrorBoundary } from 'react-error-boundary';
import { Controls } from './Controls';
import { Status } from './Status';
import { ErrorFallback } from '@/lib/components/ErrorFallback';
import { OutputView } from './OutputView';
import { useFlow, useFlowEventListener } from '@speechmatics/flow-client-react';
import { ConversationConfig, TemplateVariables } from './types';
import { sanitizeTemplateVariables } from './utils';

export default function Component({
  jwt,
  personas,
}: {
  jwt: string;
  personas: Record<string, { name: string; }>;
}) {
  const { startConversation, sendAudio, endConversation } = useFlow();

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
    <section>
      <section className="grid">
        <Controls
          personas={personas}
          loading={loading}
          startSession={startSession}
          stopSession={stopSession}
        />
        <Status isRecording={isRecording} />
      </section>
    </section>
  );
}

const SAMPLE_RATE = 16_000;