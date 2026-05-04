// src/components/WakeWordAnimation.jsx - UPDATED VERSION
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const WakeWordAnimation = ({ 
  isListening, 
  isSpeaking, 
  isWakeWordDetected, // NEW
  isWaitingForCommand, // NEW
  voiceLevel = 0, 
  responseLevel = 0 
}) => {
  const frequencyBarsRef = useRef([]);
  const rotationGroupRef = useRef();

  const colors = {
    blue: '#4285f4',
    green: '#34a853',  
    red: '#ea4335',
    yellow: '#fbbc05',
    cyan: '#00ffff',
    purple: '#8a2be2',
    orange: '#FF6B35' // NEW: For wake word detection
  };

  const frequencyData = useMemo(() => 
    Array.from({ length: 48 }, (_, i) => {
      const pattern1 = Math.sin(i * 0.3) * 0.3 + 0.5;
      const pattern2 = Math.cos(i * 0.7) * 0.2 + 0.5;
      return (pattern1 + pattern2) / 2;
    }), 
  []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (rotationGroupRef.current) {
      rotationGroupRef.current.rotation.y = time * 0.15;
    }

    frequencyBarsRef.current.forEach((bar, index) => {
      if (!bar) return;

      let height, color, opacity;
      
      // 🚀 WAKE WORD DETECTED - Special effect
      if (isWakeWordDetected) {
        const wakeOscillation = Math.sin(time * (15 + index * 0.5)) * 0.4;
        height = 0.1 + (0.8) + wakeOscillation;
        color = colors.orange;
        opacity = 0.9 + (height * 0.3);
        
      } 
      // 🎯 WAITING FOR COMMAND - Pulsing effect
      else if (isWaitingForCommand) {
        const pulse = Math.sin(time * 8) * 0.3 + 0.7;
        height = 0.05 + (pulse * 0.8);
        color = colors.cyan;
        opacity = 0.8 + (pulse * 0.2);
        
      }
      // 💬 USER SPEAKING
      else if (isListening) {
        const userOscillation = Math.sin(time * (12 + index * 0.4)) * 0.3;
        height = 0.05 + (voiceLevel * 0.9) + userOscillation;
        
        if (height < 0.3) color = colors.blue;
        else if (height < 0.6) color = colors.cyan;
        else if (height < 0.8) color = colors.yellow;
        else color = colors.red;
        
        opacity = 0.8 + (height * 0.2);
        
      } 
      // 🔊 SHREE RESPONDING
      else if (isSpeaking) {
        const responseOscillation = Math.cos(time * (8 + index * 0.3)) * 0.2;
        height = 0.05 + (responseLevel * 0.9) + responseOscillation;
        
        if (height < 0.3) color = colors.green;
        else if (height < 0.5) color = colors.cyan;
        else if (height < 0.7) color = colors.yellow;
        else color = colors.purple;
        
        opacity = 0.8 + (height * 0.2);
      } 
      // 🔇 IDLE state
      else {
        const idleOscillation = Math.sin(time * (4 + index * 0.1)) * 0.05;
        height = 0.05 + idleOscillation;
        color = colors.blue;
        opacity = 0.3;
      }

      bar.scale.y = Math.max(0.05, Math.min(1.5, height));
      bar.position.y = (bar.scale.y / 2) - 0.3;
      bar.material.color.set(color);
      bar.material.opacity = opacity;
      bar.material.needsUpdate = true;
    });
  });

  const frequencyBars = useMemo(() => {
    const bars = [];
    const barCount = 48;
    
    for (let i = 0; i < barCount; i++) {
      const angle = (i / barCount) * Math.PI * 2;
      const radius = 1.6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      
      bars.push(
        <mesh
          key={i}
          ref={ref => frequencyBarsRef.current[i] = ref}
          position={[x, -0.3, z]}
          rotation={[0, -angle, 0]}
        >
          <boxGeometry args={[0.03, 0.05, 0.03]} />
          <meshBasicMaterial 
            color={colors.blue}
            transparent={true}
            opacity={0.3}
          />
        </mesh>
      );
    }
    return bars;
  }, []);

  return (
    <group>
      <group ref={rotationGroupRef}>
        {frequencyBars}
      </group>
    </group>
  );
};

export default WakeWordAnimation;