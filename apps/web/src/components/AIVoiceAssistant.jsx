import React, { useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import WakeWordAnimation from './WakeWordAnimation';

// Custom Shader for Strands: Fresnel Glow + Gradient
const StrandShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    colorStart: { value: new THREE.Color(0xFFD700) },
    colorEnd: { value: new THREE.Color(0xF8F8FF) },
    glowIntensity: { value: 1.0 },
    rotationSpeed: { value: 1.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform float time;
    uniform float rotationSpeed;
    
    void main() {
      vNormal = normal;
      float angle = time * rotationSpeed;
      float cosA = cos(angle);
      float sinA = sin(angle);
      vec3 rotatedPos = position;
      rotatedPos.x = position.x * cosA - position.z * sinA;
      rotatedPos.z = position.x * sinA + position.z * cosA;
      
      vec4 mvPosition = modelViewMatrix * vec4(rotatedPos, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 colorStart;
    uniform vec3 colorEnd;
    uniform float glowIntensity;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);
      float fresnel = pow(1.0 - dot(normal, viewDir), 2.0);
      vec3 glowColor = mix(colorStart, colorEnd, fresnel);
      float alpha = fresnel * glowIntensity * 0.8 + 0.2;
      gl_FragColor = vec4(glowColor, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending
};

// Blackhole Core Shader
const BlackholeShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    energyGlow: { value: 1.0 },
  },
  vertexShader: `
    varying vec3 vPosition;
    void main() {
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform float energyGlow;
    varying vec3 vPosition;
    
    void main() {
      float dist = length(vPosition);
      if (dist < 0.95) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }
      
      float glow = 0.0;
      if (dist > 0.95 && dist < 1.05) {
        glow = sin(dist * 20.0 - time * 3.0) * 0.2 + 0.2;
        glow *= (1.05 - dist) * 10.0;
      }
      
      vec3 energyColor = vec3(0.0, 0.8, 1.0);
      vec3 finalColor = energyColor * glow * energyGlow;
      gl_FragColor = vec4(finalColor, glow * 0.5);
    }
  `,
  transparent: true
};

// Particle Shader - Stars
const ParticleShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    blackholePosition: { value: new THREE.Vector3(0, 0, 0) },
    suctionStrength: { value: 1.0 },
  },
  vertexShader: `
    uniform float time;
    uniform vec3 blackholePosition;
    uniform float suctionStrength;
    attribute float particleSpeed;
    attribute float particleSize;
    attribute float twinkleSpeed;
    
    varying float vDistance;
    varying float vTwinkle;
    
    void main() {
      vec3 pos = position;
      vec3 toBlackhole = blackholePosition - pos;
      float dist = length(toBlackhole);
      vDistance = dist;
      
      vTwinkle = sin(time * twinkleSpeed) * 0.5 + 0.5;
      
      float suctionTime = mod(time, 8.0);
      if (suctionTime > 4.0 && suctionTime < 6.0 && dist > 0.5) {
        vec3 direction = normalize(toBlackhole);
        float suctionForce = suctionStrength * particleSpeed / (dist * dist + 0.1);
        pos += direction * suctionForce * 0.05;
      } else {
        pos.x += sin(time * 0.1 + particleSpeed * 4.0) * 0.001;
        pos.y += cos(time * 0.15 + particleSpeed * 3.0) * 0.001;
        pos.z += sin(time * 0.12 + particleSpeed * 2.0) * 0.001;
      }
      
      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      gl_PointSize = particleSize * (85.0 / -mvPosition.z) * vTwinkle;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying float vDistance;
    varying float vTwinkle;
    
    void main() {
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      float angle = atan(coord.y, coord.x);
      float star = abs(cos(angle * 6.0)) * 0.15 + 0.85;
      
      if (dist > 0.45 * star) discard;
      
      vec3 starColor = vec3(1.0, 0.95, 0.8);
      float colorVariation = sin(vDistance * 2.0) * 0.1;
      starColor = vec3(1.0, 0.9 + colorVariation, 0.7 + colorVariation * 0.5);
      
      float brightness = vTwinkle;
      float innerCore = 1.0 - smoothstep(0.0, 0.2, dist);
      brightness *= (innerCore * 0.7 + 0.3);
      float outerGlow = 1.0 - smoothstep(0.3, 0.45, dist);
      brightness *= outerGlow;
      
      gl_FragColor = vec4(starColor * brightness, brightness * 0.9);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending
};

// Background Glow Shader
const BackgroundGlowShaderMaterial = {
  uniforms: {
    time: { value: 0 },
    energyGlow: { value: 1.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform float energyGlow;
    varying vec2 vUv;
    
    void main() {
      vec2 center = vec2(0.5, 0.5);
      float dist = distance(vUv, center);
      float glow = 0.0;
      
      if (dist < 0.4) {
        glow = (0.4 - dist) / 0.4;
        glow *= 0.6 + sin(time * 1.5) * 0.2;
        glow = pow(glow, 0.7);
      }
      
      vec3 glowColor = vec3(0.1, 0.6, 0.9) * glow * energyGlow * 1.5;
      gl_FragColor = vec4(glowColor, glow * 0.6);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending
};

// Extend Three.js with custom materials
class CustomStrandMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: THREE.UniformsUtils.clone(StrandShaderMaterial.uniforms),
      vertexShader: StrandShaderMaterial.vertexShader,
      fragmentShader: StrandShaderMaterial.fragmentShader,
      transparent: StrandShaderMaterial.transparent,
      blending: StrandShaderMaterial.blending
    });
  }
}

class CustomBlackholeMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: THREE.UniformsUtils.clone(BlackholeShaderMaterial.uniforms),
      vertexShader: BlackholeShaderMaterial.vertexShader,
      fragmentShader: BlackholeShaderMaterial.fragmentShader,
      transparent: BlackholeShaderMaterial.transparent
    });
  }
}

class CustomParticleMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: THREE.UniformsUtils.clone(ParticleShaderMaterial.uniforms),
      vertexShader: ParticleShaderMaterial.vertexShader,
      fragmentShader: ParticleShaderMaterial.fragmentShader,
      transparent: ParticleShaderMaterial.transparent,
      blending: ParticleShaderMaterial.blending
    });
  }
}

class CustomBackgroundGlowMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: THREE.UniformsUtils.clone(BackgroundGlowShaderMaterial.uniforms),
      vertexShader: BackgroundGlowShaderMaterial.vertexShader,
      fragmentShader: BackgroundGlowShaderMaterial.fragmentShader,
      transparent: BackgroundGlowShaderMaterial.transparent,
      blending: BackgroundGlowShaderMaterial.blending,
      side: THREE.BackSide
    });
  }
}

extend({ 
  CustomStrandMaterial, 
  CustomBlackholeMaterial, 
  CustomParticleMaterial,
  CustomBackgroundGlowMaterial 
});

// Particle System Component
function ParticleSystem({ count = 800, blackholePosition }) {
  const particlesRef = useRef();
  const geometryRef = useRef();

  useEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;

    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const sizes = new Float32Array(count);
    const twinkleSpeeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const radius = 4 + Math.random() * 20;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);
      
      speeds[i] = 0.05 + Math.random() * 0.08;
      sizes[i] = 0.6 + Math.random() * 0.9;
      twinkleSpeeds[i] = 0.3 + Math.random() * 1.5;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('particleSpeed', new THREE.BufferAttribute(speeds, 1));
    geometry.setAttribute('particleSize', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('twinkleSpeed', new THREE.BufferAttribute(twinkleSpeeds, 1));
  }, [count]);

  useFrame((state) => {
    if (particlesRef.current?.material?.uniforms) {
      particlesRef.current.material.uniforms.time.value = state.clock.elapsedTime;
      particlesRef.current.material.uniforms.blackholePosition.value.copy(blackholePosition);
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry ref={geometryRef} />
      <customParticleMaterial />
    </points>
  );
}

// Background Glow Component
function BackgroundGlow({ mode }) {
  const glowRef = useRef();

  useFrame((state) => {
    if (glowRef.current?.material?.uniforms) {
      let energyGlow = 1.0;
      if (mode === 'listening' || mode === 'wake-word-detected') energyGlow = 1.2;
      else if (mode === 'speaking') energyGlow = 1.6;
      
      glowRef.current.material.uniforms.energyGlow.value = energyGlow;
      glowRef.current.material.uniforms.time.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh ref={glowRef} position={[0, 0, -0.5]}>
      <sphereGeometry args={[1.3, 32, 32]} />
      <customBackgroundGlowMaterial />
    </mesh>
  );
}

// Pre-created Orbital Rings
const createOrbitalRings = () => {
  const rings = [];
  const ringCount = 5;
  const baseRadius = 1.0;
  
  for (let i = 0; i < ringCount; i++) {
    const radius = baseRadius + i * 0.3;
    const points = [];
    const segments = 64;
    
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * (i % 2 === 0 ? 1 : 0.8),
        0
      ));
    }
    
    const curve = new THREE.CatmullRomCurve3(points, true);
    const tubeGeometry = new THREE.TubeGeometry(curve, 64, 0.02, 12, true);
    rings.push({ geometry: tubeGeometry, radius });
  }
  
  return rings;
};

const precreatedRings = createOrbitalRings();

// Orbital Ring Component
function OrbitalRing({ mode }) {
  const ringsGroupRef = useRef();
  const blackholeRef = useRef();
  const blackholePosition = new THREE.Vector3(0, 0, 0);

  const [materials] = useState(() => 
    Array(5).fill().map(() => {
      const material = new CustomStrandMaterial();
      material.uniforms.time = { value: 0 };
      return material;
    })
  );

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    if (ringsGroupRef.current) {
      ringsGroupRef.current.children.forEach((ring, index) => {
        if (ring.material?.uniforms) {
          ring.material.uniforms.time.value = time;
          const speeds = [0.5, -0.7, 0.9, -0.6, 0.8];
          ring.material.uniforms.rotationSpeed.value = speeds[index] || 0.5;
          
          let intensity = 1.0;
          if (mode === 'listening' || mode === 'wake-word-detected') intensity = 1.3;
          else if (mode === 'speaking') intensity = 1.6;
          ring.material.uniforms.glowIntensity.value = intensity;
        }
      });
    }

    if (blackholeRef.current?.material?.uniforms) {
      let energyGlow = 1.0;
      if (mode === 'listening' || mode === 'wake-word-detected') energyGlow = 1.3;
      else if (mode === 'speaking') energyGlow = 1.6;
      
      blackholeRef.current.material.uniforms.energyGlow.value = energyGlow;
      blackholeRef.current.material.uniforms.time.value = time;
    }
  });

  return (
    <group scale={0.8}>
      <BackgroundGlow mode={mode} />
      <group ref={ringsGroupRef}>
        {precreatedRings.map((ring, i) => (
          <mesh key={i} geometry={ring.geometry}>
            <primitive object={materials[i]} attach="material" />
          </mesh>
        ))}
      </group>
      <mesh ref={blackholeRef}>
        <sphereGeometry args={[0.95, 64, 64]} />
        <customBlackholeMaterial />
      </mesh>
      <ParticleSystem count={800} blackholePosition={blackholePosition} />
      <ambientLight intensity={0.15} color="#001144" />
      <pointLight position={[5, 5, 5]} intensity={0.3} color="#00aaff" />
      <pointLight position={[-5, -5, 5]} intensity={0.2} color="#ff00aa" />
    </group>
  );
}

// Main AIVoiceAssistant Component - UPDATED WITH NEW PROPS
function AIVoiceAssistant({ 
  isListening = false, 
  voiceLevel = 0, 
  isSpeaking = false,
  isWakeWordDetected = false,
  isWaitingForCommand = false
}) {
  const [mode, setMode] = useState('idle');
  const [simulatedVoiceLevel, setSimulatedVoiceLevel] = useState(0);
  const [simulatedResponseLevel, setSimulatedResponseLevel] = useState(0);

  // ✅ FIXED: Enhanced mode detection with new states
  useEffect(() => {
    console.log('🎯 AIVoiceAssistant Mode Update:', {
      isListening,
      isSpeaking,
      isWakeWordDetected,
      isWaitingForCommand,
      voiceLevel
    });

    if (isWakeWordDetected) {
      setMode('wake-word-detected');
    } else if (isWaitingForCommand) {
      setMode('listening');
    } else if (isSpeaking) {
      setMode('speaking');
    } else if (isListening) {
      setMode('listening');
    } else {
      setMode('idle');
    }
  }, [isListening, isSpeaking, isWakeWordDetected, isWaitingForCommand]);

  // Voice level simulation for listening
  useEffect(() => {
    let interval;
    
    if (isListening || isWaitingForCommand) {
      setMode('listening');
      
      interval = setInterval(() => {
        const randomLevel = Math.random() * 0.8 + 0.2;
        setSimulatedVoiceLevel(randomLevel);
      }, 200);
      
    } else {
      setSimulatedVoiceLevel(0);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isListening, isWaitingForCommand]);

  // Response level simulation for speaking
  useEffect(() => {
    let interval;
    
    if (isSpeaking) {
      setMode('speaking');
      
      interval = setInterval(() => {
        const randomLevel = Math.random() * 0.7 + 0.3;
        setSimulatedResponseLevel(randomLevel);
      }, 300);
      
    } else {
      setSimulatedResponseLevel(0);
      if (!isListening && !isWaitingForCommand) setMode('idle');
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSpeaking, isListening, isWaitingForCommand]);

  // Use actual levels if provided, otherwise use simulated
  const currentVoiceLevel = voiceLevel > 0 ? voiceLevel : simulatedVoiceLevel;
  const currentResponseLevel = simulatedResponseLevel;

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      background: 'linear-gradient(135deg, #000011 0%, #000022 50%, #000033 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <Canvas 
        camera={{ position: [0, 0, 8], fov: 60 }} 
        style={{ display: 'block' }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: "high-performance"
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#000011']} />
        
        {/* COSMIC BACKGROUND */}
        <OrbitalRing mode={mode} />
        
        {/* WAKE WORD ANIMATION */}
        <WakeWordAnimation 
          isListening={isListening || isWaitingForCommand}
          isSpeaking={isSpeaking}
          isWakeWordDetected={isWakeWordDetected}
          isWaitingForCommand={isWaitingForCommand}
          voiceLevel={currentVoiceLevel}
          responseLevel={currentResponseLevel}
        />
        
        <OrbitControls 
          enableZoom={true} 
          enablePan={false} 
          enableRotate={true}
          minDistance={5}
          maxDistance={12}
          autoRotate={mode === 'idle'}
          autoRotateSpeed={0.2}
        />
      </Canvas>
    </div>
  );
}

export default AIVoiceAssistant;