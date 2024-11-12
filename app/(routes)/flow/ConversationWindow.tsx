'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { AudioVisualizer } from './components/AudioVisualizer';
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
  const [loading, setLoading] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream>();

  const { startRecording, stopRecording, isRecording } = usePcmMicrophoneAudio(
    (audio: Float32Array) => {
      sendAudio(audio.buffer);
    },
  );

  const [currentCharacter, setCurrentCharacter] = useState<string>('');
  const [userAudioLevel, setUserAudioLevel] = useState(0);
  const [agentAudioLevel, setAgentAudioLevel] = useState(0);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);

  // Audio analysis setup
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>();
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const smoothingFactorRef = useRef(0.3);
  const previousLevelRef = useRef(0);

  const getAudioLevel = (analyser: AnalyserNode) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const voiceRangeStart = Math.floor(100 * analyser.frequencyBinCount / (analyser.context.sampleRate / 2));
    const voiceRangeEnd = Math.floor(3000 * analyser.frequencyBinCount / (analyser.context.sampleRate / 2));

    let sum = 0;
    let count = 0;
    for (let i = voiceRangeStart; i < voiceRangeEnd; i++) {
      const value = dataArray[i] / 255.0;
      sum += value * value;
      count++;
    }

    const instantLevel = Math.sqrt(sum / count);
    const smoothedLevel = (smoothingFactorRef.current * instantLevel) +
      ((1 - smoothingFactorRef.current) * previousLevelRef.current);

    previousLevelRef.current = smoothedLevel;
    return smoothedLevel * 0.7;
  };

  const setupUserAudioAnalysis = useCallback(async (audioContext: AudioContext, deviceId?: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.4;
      analyser.minDecibels = -70;
      analyser.maxDecibels = -30;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      analyserRef.current = analyser;
      audioSourceRef.current = source;

      const updateLevel = () => {
        if (analyserRef.current) {
          const level = getAudioLevel(analyserRef.current);
          setUserAudioLevel(level);
          animationFrameRef.current = requestAnimationFrame(updateLevel);
        }
      };

      updateLevel();
    } catch (error) {
      console.error('Error setting up audio analysis:', error);
    }
  }, []);

  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    setUserAudioLevel(0);
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const stopSession = useCallback(async () => {
    cleanup();
    endConversation();
    stopRecording();
    await audioContext?.close();
  }, [endConversation, stopRecording, audioContext, cleanup]);

  const agentSilenceTimerRef = useRef<NodeJS.Timeout>();

  useFlowEventListener('agentAudio', (audio) => {
    setIsAgentSpeaking(true);
    playAudio(audio.data);

    const audioData = new Int16Array(audio.data);
    let sum = 0;
    const frameSize = 128;

    for (let i = 0; i < audioData.length; i += frameSize) {
      let frameSum = 0;
      const frameEnd = Math.min(i + frameSize, audioData.length);

      for (let j = i; j < frameEnd; j++) {
        frameSum += Math.abs(audioData[j]);
      }

      sum += frameSum / frameSize;
    }

    const instantLevel = Math.min((sum / (audioData.length / frameSize)) / 32768, 1);
    const smoothedLevel = (smoothingFactorRef.current * instantLevel) +
      ((1 - smoothingFactorRef.current) * previousLevelRef.current);

    previousLevelRef.current = smoothedLevel;
    setAgentAudioLevel(smoothedLevel * 0.7);

    if (agentSilenceTimerRef.current) {
      clearTimeout(agentSilenceTimerRef.current);
    }

    agentSilenceTimerRef.current = setTimeout(() => {
      setIsAgentSpeaking(false);
      setAgentAudioLevel(0);
    }, 200);
  });

  useEffect(() => {
    return () => {
      if (agentSilenceTimerRef.current) {
        clearTimeout(agentSilenceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      analyserRef.current = null;
    };
  }, []);

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

        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        setAudioContext(audioContext);

        await setupUserAudioAnalysis(audioContext, deviceId);

        const randomCharacter = getRandomCharacter();
        setCurrentCharacter(randomCharacter.characterName);

        const agentAnalyser = audioContext.createAnalyser();
        agentAnalyser.fftSize = 256;

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
    [startConversation, jwt, startRecording, setupUserAudioAnalysis],
  );

  return (
    <div className="flex flex-col w-full h-full">
      <Header
        personas={personas}
        setDeviceId={setDeviceId}
        setPersonaId={setPersonaId}
      />
      <div className="flex flex-col items-center justify-between w-full h-full gap-4 p-4">
        <div className="flex flex-col items-center justify-between w-full gap-4 grow-1 h-full">
          <AudioVisualizer
            isUserSpeaking={isRecording}
            isAgentSpeaking={isAgentSpeaking}
            userAudioLevel={userAudioLevel}
            agentAudioLevel={agentAudioLevel}
          />
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