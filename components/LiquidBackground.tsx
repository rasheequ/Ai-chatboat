import React, { useEffect, useRef, createContext, useContext } from 'react';
import * as THREE from 'three';

interface LiquidContextType {
  addRipple: (x: number, y: number, strength?: number) => void;
  setAudioAmp: (amp: number) => void;
  triggerFlash: (intensity?: number) => void;
}

export const LiquidContext = createContext<LiquidContextType>({
  addRipple: () => {},
  setAudioAmp: () => {},
  triggerFlash: () => {},
});

export const useLiquid = () => useContext(LiquidContext);

export const LiquidBackground: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef<any>(null);
  const rippleHead = useRef(0);
  const MAX_RIPPLES = 12;

  // -----------------------
  // SHADERS
  // -----------------------
  
  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `;

  // Cosmic Starfield & Nebula Shader
  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_audioAmp;
    uniform float u_flash; // New uniform for brightness flash
    
    // Ripple Uniforms
    const int MAX_RIPPLES = 12;
    uniform vec2 u_ripplePos[MAX_RIPPLES];
    uniform float u_rippleStart[MAX_RIPPLES];
    uniform float u_rippleStrength[MAX_RIPPLES];

    // Random / Hash
    float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
    }

    // Rotational Matrix
    mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
    }

    // Star Glow Function
    float star(vec2 uv, float flare) {
        float d = length(uv);
        // Core glow
        float m = 0.02 / d;
        
        // Lens flares / rays
        float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 3000.0));
        m += rays * flare;
        
        uv *= rot(0.785398); // 45 degrees
        rays = max(0.0, 1.0 - abs(uv.x * uv.y * 3000.0));
        m += rays * 0.3 * flare;
        
        m *= smoothstep(0.5, 0.0, d); // Limit radius
        return m;
    }

    void main() {
      // Normalize coords -1 to 1, corrected for aspect ratio
      vec2 uv = vUv;
      float aspect = u_resolution.x / u_resolution.y;
      vec2 p = uv * 2.0 - 1.0;
      p.x *= aspect;

      // -----------------------
      // Ripple / Gravity Wave Logic
      // -----------------------
      vec2 distort = vec2(0.0);
      for(int i=0; i<MAX_RIPPLES; i++){
         float t = u_time - u_rippleStart[i];
         // Shockwave effect
         if(t > 0.0 && t < 2.0){
            vec2 rPos = u_ripplePos[i];
            rPos.x *= aspect; // Adjust uniform to aspect
            
            float d = distance(p, rPos);
            float waveRadius = t * 1.5;
            float falloff = smoothstep(0.5, 0.0, abs(d - waveRadius));
            float decay = exp(-t * 2.0);
            
            vec2 dir = normalize(p - rPos);
            distort += dir * sin((d - waveRadius) * 20.0) * 0.03 * falloff * u_rippleStrength[i] * decay;
         }
      }
      
      // Apply distortion to coordinate space for stars
      vec2 st = p + distort;
      
      // Subtle rotation of the whole sky
      st *= rot(u_time * 0.02);

      // -----------------------
      // Background & Nebula
      // -----------------------
      // Deep gradient
      vec3 color = vec3(0.0, 0.02, 0.04); 
      
      // Emerald Center glow with Flash Boost
      float centerGlow = 1.0 - length(p * 0.5);
      color += vec3(0.0, 0.15, 0.1) * centerGlow * (1.0 + u_flash * 2.0);

      // -----------------------
      // Star Layers
      // -----------------------
      float t = u_time * 0.1;
      
      for (float i = 0.0; i < 4.0; i++) {
          // Layer depth
          float z = fract(i * 0.25 - t * 0.2); 
          float fade = smoothstep(0.0, 0.2, z) * smoothstep(1.0, 0.8, z);
          
          // UV scale based on depth
          float scale = 3.0 + i * 2.0; 
          vec2 gridUV = st * scale * (0.5 / z); // Perspective divide
          
          vec2 id = floor(gridUV);
          vec2 subUV = fract(gridUV) - 0.5;
          
          float h = hash(id + i * 53.0); // Random per cell
          
          // Draw Star
          if (h > 0.85) { 
              float size = h * 0.8;
              float brightness = star(subUV, size * 0.8);
              
              // Twinkle calculation
              float twinkle = 0.5 + 0.5 * sin(u_time * 5.0 + h * 100.0);
              
              // Color variation
              vec3 starCol = mix(vec3(0.7, 0.9, 1.0), vec3(1.0, 0.9, 0.6), h);
              
              // Audio Reactive Boost + Flash Boost
              float audioBoost = 1.0 + u_audioAmp * 4.0 * step(0.95, h); 
              float flashBoost = 1.0 + u_flash * 1.5;

              color += starCol * brightness * fade * twinkle * audioBoost * flashBoost;
          }
      }

      // -----------------------
      // Shooting Star (Procedural)
      // -----------------------
      float shootTime = u_time + 45.0; 
      float shootRnd = hash(vec2(floor(shootTime * 0.5), 99.0)); 
      if (shootRnd > 0.7) {
          float tLocal = fract(shootTime * 0.5) * 2.0; 
          vec2 startPos = vec2((hash(vec2(shootRnd, 1.0))-0.5)*3.0, (hash(vec2(shootRnd, 2.0))-0.5)*3.0);
          vec2 endPos = startPos + vec2(1.5, -1.0); 
          
          vec2 currentPos = mix(startPos, endPos, tLocal);
          float dLine = distance(st, currentPos);
          vec2 dir = normalize(endPos - startPos);
          float proj = dot(st - startPos, dir);
          float distToLine = distance(st, startPos + dir * clamp(proj, 0.0, length(endPos-startPos)*tLocal));
          
          if(proj < length(endPos-startPos)*tLocal && proj > length(endPos-startPos)*(tLocal - 0.2)) {
             color += vec3(0.8, 1.0, 0.9) * (0.002 / max(0.001, distToLine)) * smoothstep(2.0, 0.0, tLocal);
          }
      }

      // Vignette
      color *= 1.0 - smoothstep(0.5, 1.8, length(p));
      
      gl_FragColor = vec4(color, 1.0);
    }
  `;

  useEffect(() => {
    if (!containerRef.current) return;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    containerRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const geometry = new THREE.PlaneGeometry(2, 2);

    const ripplePos = new Array(MAX_RIPPLES).fill(0).map(() => new THREE.Vector2(-10, -10));
    const rippleStart = new Float32Array(MAX_RIPPLES).fill(-9999);
    const rippleStrength = new Float32Array(MAX_RIPPLES).fill(0.0);

    const u = {
      u_time: { value: 0.0 },
      u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      u_audioAmp: { value: 0.0 },
      u_flash: { value: 0.0 },
      u_ripplePos: { value: ripplePos },
      u_rippleStart: { value: rippleStart },
      u_rippleStrength: { value: rippleStrength },
    };
    uniformsRef.current = u;

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: u,
      depthWrite: false,
      depthTest: false
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const clock = new THREE.Clock();

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      u.u_resolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', onResize);

    let rAF: number;
    const animate = () => {
      u.u_time.value = clock.getElapsedTime();
      
      // Decay flash
      if (u.u_flash.value > 0.001) {
          u.u_flash.value *= 0.92; // Rapid decay
      } else {
          u.u_flash.value = 0;
      }

      renderer.render(scene, camera);
      rAF = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(rAF);
      renderer.dispose();
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  const addRipple = (x: number, y: number, strength: number = 1.0) => {
    if (!uniformsRef.current) return;

    let ndcX = x;
    let ndcY = y;

    // Ensure we are working with NDC (-1 to 1) for the shader interaction
    if (Math.abs(x) > 1 || Math.abs(y) > 1) {
       ndcX = (x / window.innerWidth) * 2 - 1;
       ndcY = -(y / window.innerHeight) * 2 + 1;
    }

    const idx = rippleHead.current;
    uniformsRef.current.u_ripplePos.value[idx].x = ndcX;
    uniformsRef.current.u_ripplePos.value[idx].y = ndcY;
    uniformsRef.current.u_rippleStart.value[idx] = uniformsRef.current.u_time.value;
    uniformsRef.current.u_rippleStrength.value[idx] = strength;

    rippleHead.current = (rippleHead.current + 1) % MAX_RIPPLES;
  };

  const setAudioAmp = (amp: number) => {
    if (uniformsRef.current) {
      uniformsRef.current.u_audioAmp.value = amp;
    }
  };

  const triggerFlash = (intensity: number = 0.5) => {
    if (uniformsRef.current) {
        uniformsRef.current.u_flash.value = intensity;
    }
  };

  return (
    <LiquidContext.Provider value={{ addRipple, setAudioAmp, triggerFlash }}>
      {/* Base Canvas */}
      <div 
        ref={containerRef} 
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: '#00080f' }} 
      />
      
      {/* Floating Particles (Space Dust) - CSS Overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none overflow-hidden mix-blend-screen">
        <div className="absolute w-1 h-1 bg-emerald-200 rounded-full opacity-40 animate-float-slow top-1/4 left-1/4 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
        <div className="absolute w-0.5 h-0.5 bg-white rounded-full opacity-60 animate-float-medium top-3/4 left-1/3"></div>
        <div className="absolute w-1 h-1 bg-cyan-300 rounded-full opacity-30 animate-float-fast top-1/2 right-1/4"></div>
      </div>

      <div className="relative z-10 w-full h-full pointer-events-auto">
        {children}
      </div>
    </LiquidContext.Provider>
  );
};