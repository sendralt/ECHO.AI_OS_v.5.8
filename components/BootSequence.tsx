import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  playInitSound,
  playDiagnosticBeep,
  playNeuralPulse,
  playCalibrationTick,
  playSuccessChime,
  closeAudioContext
} from '../utils/bootAudio.ts';

interface BootSequenceProps {
  onComplete: () => void;
}

type BootPhase = 'INIT' | 'DIAGNOSTICS' | 'NEURAL_SYNC' | 'CALIBRATION' | 'READY';

interface DiagnosticItem {
  label: string;
  value: string;
  status: 'pending' | 'running' | 'complete' | 'warning';
  delay: number;
}

const DIAGNOSTICS: DiagnosticItem[] = [
  { label: 'QUANTUM CORE', value: 'ONLINE', status: 'pending', delay: 0 },
  { label: 'NEURAL MATRIX', value: '2.4 TB LOADED', status: 'pending', delay: 400 },
  { label: 'COGNITIVE ENGINE', value: 'SYNCHRONIZED', status: 'pending', delay: 800 },
  { label: 'MEMORY ALLOCATION', value: '99.7% OPTIMAL', status: 'pending', delay: 1200 },
  { label: 'AUDIO SUBSYSTEM', value: 'CALIBRATED', status: 'pending', delay: 1600 },
  { label: 'OPTICAL ARRAY', value: 'STANDBY', status: 'pending', delay: 2000 },
  { label: 'UPLINK PROTOCOL', value: 'ESTABLISHING', status: 'pending', delay: 2400 },
  { label: 'GEMINI INTERFACE', value: 'CONNECTED', status: 'pending', delay: 2800 },
];

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<BootPhase>('INIT');
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>(DIAGNOSTICS);
  const [neuralProgress, setNeuralProgress] = useState(0);
  const [initText, setInitText] = useState('');
  const [showSkip, setShowSkip] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const skipRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const INIT_MESSAGE = 'INITIALIZING ECHO_OS v5.8...';

  // Skip handler
  const handleSkip = useCallback(() => {
    if (skipRef.current) return;
    skipRef.current = true;
    setIsExiting(true);
    setTimeout(onComplete, 800);
  }, [onComplete]);

  // Keyboard skip
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ') handleSkip();
    };
    window.addEventListener('keydown', handler);
    setTimeout(() => setShowSkip(true), 1500);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSkip]);

  // Phase 1: Init typewriter
  useEffect(() => {
    if (phase !== 'INIT') return;
    playInitSound(); // Play startup sound
    let i = 0;
    const interval = setInterval(() => {
      if (i <= INIT_MESSAGE.length) {
        setInitText(INIT_MESSAGE.slice(0, i));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(() => setPhase('DIAGNOSTICS'), 500);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 2: Diagnostics cascade
  useEffect(() => {
    if (phase !== 'DIAGNOSTICS') return;
    DIAGNOSTICS.forEach((item, index) => {
      setTimeout(() => {
        setDiagnostics(prev => prev.map((d, i) =>
          i === index ? { ...d, status: 'running' } : d
        ));
        setTimeout(() => {
          const isWarning = index === 6;
          playDiagnosticBeep(isWarning); // Beep for each check
          setDiagnostics(prev => prev.map((d, i) =>
            i === index ? { ...d, status: isWarning ? 'warning' : 'complete' } : d
          ));
        }, 300);
      }, item.delay);
    });
    setTimeout(() => setPhase('NEURAL_SYNC'), 3500);
  }, [phase]);

  // Phase 3: Neural sync progress
  useEffect(() => {
    if (phase !== 'NEURAL_SYNC') return;
    playNeuralPulse(); // Play neural sync sound
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 8 + 2;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => setPhase('CALIBRATION'), 500);
      }
      setNeuralProgress(Math.min(100, Math.floor(progress)));
    }, 100);
    return () => clearInterval(interval);
  }, [phase]);

  // Phase 4: Calibration -> Ready
  useEffect(() => {
    if (phase !== 'CALIBRATION') return;
    // Play calibration ticks
    [0, 400, 800].forEach(delay => {
      setTimeout(() => playCalibrationTick(), delay);
    });
    setTimeout(() => setPhase('READY'), 1500);
  }, [phase]);

  // Phase 5: Ready -> Complete
  useEffect(() => {
    if (phase !== 'READY') return;
    playSuccessChime(); // Play success chime
    setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        closeAudioContext(); // Cleanup audio
        onComplete();
      }, 800);
    }, 2000);
  }, [phase, onComplete]);

  // Neural network canvas animation
  useEffect(() => {
    if (phase !== 'NEURAL_SYNC') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
    for (let i = 0; i < 30; i++) {
      nodes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
      });
    }

    let animId: number;
    const render = () => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      nodes.forEach((node, i) => {
        node.x += node.vx;
        node.y += node.vy;
        if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
        if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

        ctx.beginPath();
        ctx.arc(node.x, node.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#00f2ff';
        ctx.fill();

        nodes.slice(i + 1).forEach(other => {
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(0, 242, 255, ${1 - dist / 100})`;
            ctx.stroke();
          }
        });
      });
      animId = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(animId);
  }, [phase]);

  const getStatusIcon = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'complete': return '[OK]';
      case 'warning': return '[~~]';
      case 'running': return '[..]';
      default: return '[  ]';
    }
  };

  const getStatusColor = (status: DiagnosticItem['status']) => {
    switch (status) {
      case 'complete': return 'text-[#39ff14]';
      case 'warning': return 'text-[#ffaa00]';
      case 'running': return 'text-[#00f2ff] animate-pulse';
      default: return 'text-[#00f2ff22]';
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden transition-opacity duration-700 ${isExiting ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleSkip}
    >
      {/* Scanline effect */}
      <div className="scanline pointer-events-none"></div>

      {/* Background grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div className="w-full h-full" style={{
          backgroundImage: 'linear-gradient(#00f2ff 1px, transparent 1px), linear-gradient(90deg, #00f2ff 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Corner decorations */}
      <div className="absolute top-8 left-8 border-t-2 border-l-2 border-[#00f2ff] w-20 h-20 opacity-30"></div>
      <div className="absolute top-8 right-8 border-t-2 border-r-2 border-[#00f2ff] w-20 h-20 opacity-30"></div>
      <div className="absolute bottom-8 left-8 border-b-2 border-l-2 border-[#00f2ff] w-20 h-20 opacity-30"></div>
      <div className="absolute bottom-8 right-8 border-b-2 border-r-2 border-[#00f2ff] w-20 h-20 opacity-30"></div>

      {/* Main content container */}
      <div className="relative z-10 w-full max-w-3xl px-8">

        {/* Logo and title */}
        <div className="text-center mb-12">
          <div className="inline-block relative">
            <div className={`w-24 h-24 mx-auto mb-6 rounded-full border-2 border-[#00f2ff] flex items-center justify-center transition-all duration-1000 ${phase !== 'INIT' ? 'shadow-[0_0_40px_rgba(0,242,255,0.5)]' : ''}`}>
              <div className={`w-12 h-12 bg-[#00f2ff] transition-all duration-500 ${phase === 'READY' ? 'opacity-100' : 'opacity-60'}`}
                   style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}></div>
              {/* Rotating ring */}
              <div className={`absolute inset-0 border-2 border-dashed border-[#00f2ff] rounded-full ${phase !== 'READY' ? 'animate-spin' : ''}`}
                   style={{ animationDuration: '3s' }}></div>
            </div>
            <h1 className="text-3xl font-black tracking-[0.5em] text-[#00f2ff] hud-font">ECHO_OS</h1>
            <p className="text-[10px] tracking-[0.4em] text-[#00f2ff66] mt-2">ADVANCED NEURAL INTERFACE v5.8</p>
          </div>
        </div>

        {/* Phase 1: Init */}
        {phase === 'INIT' && (
          <div className="text-center animate-in fade-in duration-500">
            <p className="font-mono text-[#00f2ff] text-sm tracking-widest">
              {initText}<span className="animate-pulse">_</span>
            </p>
          </div>
        )}

        {/* Phase 2: Diagnostics */}
        {phase === 'DIAGNOSTICS' && (
          <div className="font-mono text-xs space-y-1 animate-in fade-in duration-300">
            {diagnostics.map((item, i) => (
              <div key={i} className={`flex justify-between ${getStatusColor(item.status)} transition-all duration-300`}>
                <span>{getStatusIcon(item.status)} {item.label}</span>
                <span className="tracking-widest">{'.'?.repeat(20)} {item.status !== 'pending' ? item.value : ''}</span>
              </div>
            ))}
          </div>
        )}

        {/* Phase 3: Neural Sync */}
        {phase === 'NEURAL_SYNC' && (
          <div className="animate-in fade-in duration-300">
            <div className="relative h-48 mb-6 rounded border border-[#00f2ff22] overflow-hidden">
              <canvas ref={canvasRef} width={600} height={192} className="w-full h-full" />
            </div>
            <div className="text-center">
              <p className="font-mono text-[#00f2ff] text-sm tracking-widest mb-4">
                ESTABLISHING NEURAL PATHWAYS...
              </p>
              <div className="relative h-2 bg-[#00f2ff11] rounded overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[#00f2ff] shadow-[0_0_20px_#00f2ff] transition-all duration-100"
                  style={{ width: `${neuralProgress}%` }}
                />
              </div>
              <p className="font-mono text-[#00f2ff] text-2xl mt-4 tracking-widest">
                {neuralProgress}%
              </p>
            </div>
          </div>
        )}

        {/* Phase 4: Calibration */}
        {phase === 'CALIBRATION' && (
          <div className="text-center animate-in fade-in duration-300">
            <div className="flex justify-center gap-8 mb-8">
              {['MIC', 'CAM', 'NET'].map((sensor, i) => (
                <div key={sensor} className="text-center">
                  <div className={`w-16 h-16 rounded-full border-2 border-[#00f2ff] flex items-center justify-center mb-2 animate-pulse`}
                       style={{ animationDelay: `${i * 200}ms` }}>
                    <div className="w-3 h-3 bg-[#39ff14] rounded-full shadow-[0_0_10px_#39ff14]"></div>
                  </div>
                  <p className="font-mono text-[10px] text-[#00f2ff66] tracking-widest">{sensor}</p>
                </div>
              ))}
            </div>
            <p className="font-mono text-[#00f2ff] text-sm tracking-widest animate-pulse">
              CALIBRATING SENSORY INPUTS...
            </p>
          </div>
        )}

        {/* Phase 5: Ready */}
        {phase === 'READY' && (
          <div className="text-center animate-in fade-in zoom-in duration-500">
            <div className="inline-block px-12 py-6 border-2 border-[#39ff14] bg-[#39ff1411]">
              <h2 className="text-[#39ff14] text-3xl font-black tracking-[0.4em] mb-2">
                SYSTEM READY
              </h2>
              <p className="text-[#39ff14] text-xs tracking-[0.2em] opacity-70">
                "All systems nominal. Welcome back, Sir."
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Skip hint */}
      {showSkip && !isExiting && phase !== 'READY' && (
        <div className="absolute bottom-8 right-8 animate-in fade-in duration-500">
          <p className="font-mono text-[10px] text-[#00f2ff44] tracking-widest">
            PRESS [ESC] OR CLICK TO SKIP
          </p>
        </div>
      )}

      {/* Status bar */}
      <div className="absolute bottom-8 left-8 font-mono text-[8px] text-[#00f2ff33] tracking-widest space-y-1">
        <p>SECURE_LINK: ACTIVE</p>
        <p>ENCRYPTION: AES-NEURAL-4096</p>
        <p>BUILD: 2026.01.06</p>
      </div>
    </div>
  );
};

