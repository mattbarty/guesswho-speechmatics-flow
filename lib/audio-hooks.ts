import { useRef, useState, useCallback, useEffect } from 'react';

// AudioWorklet processor code as a string
const workletCode = `
class AudioProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
`;

/**
 *
 * Hook for getting PCM (f32) microphone audio in the browser.
 *
 * The Web Audio APIs tend to use f32 over int16, when capturing/playing audio.
 * The Flow service accepts both, so we use f32 here to avoid converting.
 */
export function usePcmMicrophoneAudio(onAudio: (audio: Float32Array) => void) {
	const [isRecording, setIsRecording] = useState(false);
	const mediaStreamRef = useRef<MediaStream>();
	const workletNodeRef = useRef<AudioWorkletNode>();
	const audioContextRef = useRef<AudioContext>();

	// Initialize AudioWorklet
	const initializeAudioWorklet = useCallback(
		async (audioContext: AudioContext) => {
			const blob = new Blob([workletCode], { type: 'application/javascript' });
			const url = URL.createObjectURL(blob);

			try {
				await audioContext.audioWorklet.addModule(url);
			} finally {
				URL.revokeObjectURL(url);
			}
		},
		[]
	);

	const startRecording = useCallback(
		async (audioContext: AudioContext, deviceId?: string) => {
			// If stream is present, it means we're already recording
			if (mediaStreamRef.current) {
				return mediaStreamRef.current;
			}

			try {
				// Initialize audio context and worklet if needed
				audioContextRef.current = audioContext;
				await initializeAudioWorklet(audioContext);

				const mediaStream = await navigator.mediaDevices.getUserMedia({
					audio: {
						deviceId,
						sampleRate: audioContext.sampleRate,
						sampleSize: 16,
						channelCount: 1,
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
					},
				});

				const input = audioContext.createMediaStreamSource(mediaStream);
				const workletNode = new AudioWorkletNode(
					audioContext,
					'audio-processor'
				);

				// Handle audio data from the worklet
				workletNode.port.onmessage = (event) => {
					onAudio(event.data);
				};

				input.connect(workletNode);
				workletNode.connect(audioContext.destination);

				mediaStreamRef.current = mediaStream;
				workletNodeRef.current = workletNode;
				setIsRecording(true);

				return mediaStream;
			} catch (error) {
				console.error('Error starting recording:', error);
				throw error;
			}
		},
		[onAudio, initializeAudioWorklet]
	);

	const stopRecording = useCallback(() => {
		if (workletNodeRef.current) {
			workletNodeRef.current.disconnect();
			workletNodeRef.current = undefined;
		}

		if (mediaStreamRef.current) {
			mediaStreamRef.current.getTracks().forEach((track) => track.stop());
			mediaStreamRef.current = undefined;
		}

		setIsRecording(false);
	}, []);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stopRecording();
			if (audioContextRef.current?.state !== 'closed') {
				audioContextRef.current?.close();
			}
		};
	}, [stopRecording]);

	return { startRecording, stopRecording, isRecording };
}

export function usePlayPcm16Audio(audioContext: AudioContext | undefined) {
	const playbackStartTime = useRef(0);

	useEffect(() => {
		// Reset if audio context is cleared for some reason
		if (!audioContext) {
			playbackStartTime.current = 0;
		}
		// Otherwise reset on context close
		const onStateChange = () => {
			if (audioContext?.state === 'closed') {
				playbackStartTime.current = 0;
			}
		};
		audioContext?.addEventListener('statechange', onStateChange);
		return () =>
			audioContext?.removeEventListener('statechange', onStateChange);
	}, [audioContext]);

	return useCallback(
		(pcmData: Int16Array) => {
			if (!audioContext) {
				console.warn('Audio context not initialized for playback!');
				return;
			}
			if (audioContext.state === 'closed') {
				console.warn('Audio context closed');
				return;
			}

			const float32Array = pcm16ToFloat32(pcmData);
			const audioBuffer = audioContext.createBuffer(
				1,
				float32Array.length,
				audioContext.sampleRate
			);
			audioBuffer.copyToChannel(float32Array, 0);

			const source = audioContext.createBufferSource();
			source.buffer = audioBuffer;

			const currentTime = audioContext.currentTime;
			if (playbackStartTime.current < currentTime) {
				playbackStartTime.current = currentTime;
			}

			source.connect(audioContext.destination);
			source.start(playbackStartTime.current);

			playbackStartTime.current += audioBuffer.duration;
		},
		[audioContext]
	);
}

const pcm16ToFloat32 = (pcm16: Int16Array) => {
	const float32 = new Float32Array(pcm16.length);
	for (let i = 0; i < pcm16.length; i++) {
		float32[i] = pcm16[i] / 32768; // Convert PCM16 to Float32
	}
	return float32;
};
