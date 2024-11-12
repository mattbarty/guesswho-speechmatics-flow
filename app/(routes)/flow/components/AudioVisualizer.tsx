'use client';

import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isUserSpeaking: boolean;
  isAgentSpeaking: boolean;
  userAudioLevel?: number;
  agentAudioLevel?: number;
  userSensitivity?: number; // New prop
  agentSensitivity?: number; // New prop
}

export function AudioVisualizer({
  isUserSpeaking,
  isAgentSpeaking,
  userAudioLevel = 0,
  agentAudioLevel = 0,
  userSensitivity = 5, // Default multiplier - adjust this value to change default sensitivity
  agentSensitivity = 5 // Default multiplier - adjust this value to change default sensitivity
}: AudioVisualizerProps) {
  const numberOfBars = 16;
  const bars = Array.from({ length: numberOfBars / 2 });

  const scaleLevel = (level: number, sensitivity: number) => {
    const scaled = Math.pow(level, 1.5);
    return Math.min(scaled * sensitivity, 1); // Using sensitivity multiplier here
  };

  const amplifiedUserLevel = scaleLevel(userAudioLevel, userSensitivity);
  const amplifiedAgentLevel = scaleLevel(agentAudioLevel, agentSensitivity);

  return (
    <div className="flex justify-center items-center gap-8 w-full max-w-md p-4">
      {/* User Audio Visualizer */}
      <div className="flex-1 flex justify-center items-center h-32">
        <div className="flex gap-[2px]">
          {/* Left side (reversed) */}
          {bars.map((_, i) => {
            const scale = amplifiedUserLevel * (0.4 + 0.6 * Math.sin((i + 1) / (bars.length + 1) * Math.PI));
            return (
              <div
                key={`user-left-${i}`}
                className="w-1.5 bg-red-500 transition-all duration-75"
                style={{
                  height: `${Math.max(4, scale * 100)}px`,
                  opacity: isUserSpeaking ? '1' : '0.5',
                }}
              />
            );
          }).reverse()}
          {/* Right side */}
          {bars.map((_, i) => {
            const scale = amplifiedUserLevel * (0.4 + 0.6 * Math.sin((i + 1) / (bars.length + 1) * Math.PI));
            return (
              <div
                key={`user-right-${i}`}
                className="w-1.5 bg-red-500 transition-all duration-75"
                style={{
                  height: `${Math.max(4, scale * 100)}px`,
                  opacity: isUserSpeaking ? '1' : '0.5',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Agent Audio Visualizer */}
      <div className="flex-1 flex justify-center items-center h-32">
        <div className="flex gap-[2px]">
          {bars.map((_, i) => {
            const scale = amplifiedAgentLevel * (0.4 + 0.6 * Math.sin((i + 1) / (bars.length + 1) * Math.PI));
            return (
              <div
                key={`agent-left-${i}`}
                className="w-1.5 bg-blue-500 transition-all duration-75"
                style={{
                  height: `${Math.max(4, scale * 100)}px`,
                  opacity: isAgentSpeaking ? '1' : '0.5',
                }}
              />
            );
          }).reverse()}
          {bars.map((_, i) => {
            const scale = amplifiedAgentLevel * (0.4 + 0.6 * Math.sin((i + 1) / (bars.length + 1) * Math.PI));
            return (
              <div
                key={`agent-right-${i}`}
                className="w-1.5 bg-blue-500 transition-all duration-75"
                style={{
                  height: `${Math.max(4, scale * 100)}px`,
                  opacity: isAgentSpeaking ? '1' : '0.5',
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}