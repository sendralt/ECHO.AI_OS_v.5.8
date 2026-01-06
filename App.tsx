
import React, { useState, useEffect, useRef } from 'react';
import { MessageRole, ChatMessage, ModelType, VoicePersona, AudioSettings, ChatMode } from './types.ts';
import { gemini } from './services/geminiService.ts';
import { Visualizer } from './components/Visualizer.tsx';

interface StatusIndicatorProps {
  label: string;
  status: 'active' | 'processing' | 'error' | 'inactive';
}

interface Detection {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  targetX: number;
  targetY: number;
  targetW: number;
  targetH: number;
  opacity: number;
  distance: number;
  threat: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ label, status }) => {
  const colors = {
    active: 'text-[#39ff14] border-[#39ff14]',
    processing: 'text-[#0066ff] border-[#0066ff] animate-pulse',
    error: 'text-red-500 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]',
    inactive: 'text-[#00f2ff44] border-[#00f2ff22]',
  };
  const icons = { active: '●', processing: '◌', error: '×', inactive: '○' };
  return (
    <div className={`flex items-center gap-2 px-3 py-1 border rounded-sm transition-all duration-500 ${colors[status]}`}>
      <span className="text-[10px] font-bold leading-none">{icons[status]}</span>
      <span className="text-[8px] font-black tracking-[0.2em] uppercase whitespace-nowrap">{label}</span>
    </div>
  );
};

const DetectionOverlay: React.FC<{ detections: Detection[] }> = ({ detections }) => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {detections.map((d) => (
        <div 
          key={d.id} 
          className="absolute border border-[#00f2ff] transition-opacity duration-300"
          style={{ 
            left: `${d.x}%`, 
            top: `${d.y}%`, 
            width: `${d.w}%`, 
            height: `${d.h}%`,
            opacity: d.opacity,
            boxShadow: `0 0 15px rgba(0, 242, 255, ${d.opacity * 0.3})`,
          }}
        >
          <div className="absolute -top-7 left-0 bg-[#00f2ff] text-black px-2 py-0.5 text-[8px] font-black uppercase tracking-tighter whitespace-nowrap flex items-center gap-2">
            <span className="animate-pulse">TRACKING</span> {d.label}
          </div>
          <div className="absolute top-0 -right-24 w-20 flex flex-col gap-0.5 opacity-70">
            <div className="bg-[#00f2ff22] border-l-2 border-[#00f2ff] px-1 py-0.5 text-[6px] font-bold text-[#00f2ff] uppercase">
              DIST: {d.distance}m
            </div>
            <div className={`border-l-2 px-1 py-0.5 text-[6px] font-bold uppercase ${d.threat === 'HIGH' ? 'bg-red-900/40 border-red-500 text-red-400' : 'bg-[#00f2ff11] border-[#00f2ff] text-[#00f2ff]'}`}>
              THRT: {d.threat}
            </div>
            <div className="bg-[#00f2ff11] border-l-2 border-[#00f2ff] px-1 py-0.5 text-[6px] font-bold text-[#00f2ff] uppercase">
              MEM: {Math.floor(d.w * d.h)}kb
            </div>
          </div>
          <div className="absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 border-[#00f2ff]"></div>
          <div className="absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 border-[#00f2ff]"></div>
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 border-[#00f2ff]"></div>
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 border-[#00f2ff]"></div>
          <div className="absolute top-0 left-0 w-full h-px bg-[#00f2ff44] animate-[scan_1.5s_linear_infinite]"></div>
          <div className="absolute inset-0 bg-[#00f2ff05]"></div>
        </div>
      ))}
    </div>
  );
};

const BootScreen: React.FC<{ onAuthenticated: () => void }> = ({ onAuthenticated }) => {
  const [phase, setPhase] = useState<'IDLE' | 'SCANNING' | 'VERIFYING' | 'GRANTED'>('IDLE');
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error("Boot Camera Error:", err);
      }
    }
    startCamera();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startScan = () => {
    setPhase('SCANNING');
    let p = 0;
    const interval = setInterval(() => {
      p += 2;
      setProgress(p);
      if (p === 60) setPhase('VERIFYING');
      if (p >= 100) {
        clearInterval(interval);
        setPhase('GRANTED');
        setTimeout(onAuthenticated, 1000);
      }
    }, 50);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-10 overflow-hidden">
      <div className="scanline"></div>
      
      {/* Background Grid/HUD decorations */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="w-full h-full" style={{ backgroundImage: 'radial-gradient(var(--neon-teal) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
      </div>

      <div className="relative w-full max-w-2xl aspect-video border-2 border-[#00f2ff44] bg-[#00f2ff05] hud-panel overflow-hidden group">
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover transition-all duration-1000 ${phase === 'IDLE' ? 'grayscale blur-sm' : 'brightness-125 contrast-125'}`} />
        
        {/* Scanning Reticle */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
           <div className={`w-48 h-48 border-2 border-[#00f2ff] rounded-full flex items-center justify-center transition-all duration-500 ${phase === 'SCANNING' ? 'scale-110 opacity-100' : 'opacity-40'}`}>
              <div className={`w-40 h-40 border border-dashed border-[#00f2ff] rounded-full animate-spin-slow ${phase === 'SCANNING' ? 'opacity-100' : 'opacity-20'}`}></div>
              <div className="absolute w-full h-px bg-[#00f2ff] shadow-[0_0_15px_#00f2ff] animate-[scan_2s_linear_infinite]"></div>
           </div>
        </div>

        {/* Telemetry Readouts */}
        <div className="absolute top-6 left-6 flex flex-col gap-1">
          <p className="text-[10px] font-black text-[#00f2ff] tracking-[0.3em]">BIOMETRIC_HANDSHAKE_V.1</p>
          <p className={`text-[8px] font-bold ${phase !== 'IDLE' ? 'text-[#39ff14]' : 'text-[#00f2ff44]'}`}>[ DNA_SEQ: {phase === 'IDLE' ? 'AWAITING' : 'VALIDATED'} ]</p>
          <p className={`text-[8px] font-bold ${phase === 'VERIFYING' ? 'text-[#0066ff] animate-pulse' : 'text-[#00f2ff44]'}`}>[ NEURAL_SYNC: {phase === 'VERIFYING' || phase === 'GRANTED' ? 'STABLE' : 'PENDING'} ]</p>
        </div>

        <div className="absolute bottom-6 right-6 text-right">
           <p className="text-[8px] font-bold text-[#00f2ff44] uppercase tracking-widest">Cognitive_Baseline: {phase === 'IDLE' ? '---' : 'MARGINAL'}</p>
           <p className="text-[12px] font-black text-[#00f2ff] mt-1">{progress}% Complete</p>
        </div>

        {phase === 'IDLE' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-500">
            <button 
              onClick={startScan}
              className="px-10 py-4 border-2 border-[#00f2ff] text-[#00f2ff] hud-font text-lg tracking-[0.5em] hover:bg-[#00f2ff] hover:text-black transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,242,255,0.2)]"
            >
              INITIATE_UPLINK
            </button>
          </div>
        )}

        {phase === 'GRANTED' && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#39ff1411] backdrop-blur-md animate-in fade-in duration-300">
            <div className="text-center">
              <h2 className="text-[#39ff14] text-4xl font-black tracking-[0.4em] mb-2 animate-pulse uppercase">Access_Granted</h2>
              <p className="text-[#39ff14] text-xs font-bold tracking-[0.2em] opacity-60">"Welcome back, Sir. Try not to break anything this time."</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-10 flex gap-8 opacity-20 text-[8px] font-bold tracking-[0.5em] text-[#00f2ff]">
        <span>SECURE_LINK: ACTIVE</span>
        <span>ENCRYPTION: AES-NEURAL-4096</span>
        <span>LOCATION: [REDACTED]</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [hudEnabled, setHudEnabled] = useState(true);
  const [visionPulse, setVisionPulse] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  
  // Persistent Settings
  const [activeModel, setActiveModel] = useState<ModelType>('gemini-3-flash-preview');
  const [activeVoicePersona, setActiveVoicePersona] = useState<VoicePersona>('Zephyr');
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ volume: 0.8, speed: 1.0 });

  const [liveTranscription, setLiveTranscription] = useState<{ text: string, isUser: boolean } | null>(null);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [detections, setDetections] = useState<Detection[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<{ sessionPromise: Promise<any>, stop: () => void, sendImage: (data: string) => void } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const lastFrameRef = useRef<string | null>(null);
  const inactivityTimerRef = useRef<number | null>(null);

  const IDLE_TIMEOUT = 300000; // 5 minutes in ms

  // Biometric Inactivity Monitor
  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
      if (authenticated) {
        inactivityTimerRef.current = window.setTimeout(() => {
          setAuthenticated(false);
          showFeedback("SECURE_LOCKDOWN_INITIATED");
        }, IDLE_TIMEOUT);
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));
    
    // Initial call to start timer
    resetTimer();

    return () => {
      events.forEach(event => document.removeEventListener(event, resetTimer));
      if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    };
  }, [authenticated]);

  // Initialization: Load History & Preferences
  useEffect(() => {
    const savedHistory = localStorage.getItem('echo_history_cache');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        if (Array.isArray(parsed)) setMessages(parsed.slice(-10));
      } catch (e) {}
    }

    const savedSettings = localStorage.getItem('echo_settings_cache');
    if (savedSettings) {
      try {
        const { model, voice, audio } = JSON.parse(savedSettings);
        if (model) setActiveModel(model);
        if (voice) setActiveVoicePersona(voice);
        if (audio) setAudioSettings(audio);
      } catch (e) {}
    }
  }, []);

  // Persistence: Save History
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('echo_history_cache', JSON.stringify(messages.slice(-10)));
    }
  }, [messages]);

  // Persistence: Save Settings
  useEffect(() => {
    localStorage.setItem('echo_settings_cache', JSON.stringify({
      model: activeModel,
      voice: activeVoicePersona,
      audio: audioSettings
    }));
    gemini.setAudioSettings(audioSettings);
  }, [activeModel, activeVoicePersona, audioSettings]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, liveTranscription, isProcessing]);

  useEffect(() => {
    const timer = setInterval(() => {
      setDetections(prev => 
        prev
          .map(d => ({
            ...d,
            x: d.x + (d.targetX - d.x) * 0.15,
            y: d.y + (d.targetY - d.y) * 0.15,
            w: d.w + (d.targetW - d.w) * 0.15,
            h: d.h + (d.targetH - d.h) * 0.15,
            opacity: d.opacity - 0.015
          }))
          .filter(d => d.opacity > 0)
      );
    }, 50); 
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let currentStream: MediaStream | null = null;
    async function startCamera() {
      try {
        currentStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } 
        });
        if (videoRef.current) videoRef.current.srcObject = currentStream;
      } catch (err) {
        setCameraActive(false);
        showFeedback("OPTICAL_HANDSHAKE_FAILED");
      }
    }
    if (cameraActive && authenticated) startCamera();
    else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    return () => { if (currentStream) currentStream.getTracks().forEach(t => t.stop()); };
  }, [cameraActive, authenticated]);

  useEffect(() => {
    if (cameraActive && authenticated) {
      frameIntervalRef.current = window.setInterval(() => {
        if (videoRef.current && canvasRef.current) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          
          if (ctx && video.readyState >= 2 && video.videoWidth > 0) {
            canvas.width = 800; 
            canvas.height = 600;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  if (typeof reader.result === 'string') {
                    const base64 = reader.result.split(',')[1];
                    lastFrameRef.current = base64;
                    if (voiceActive) {
                      liveSessionRef.current?.sendImage(base64);
                    }
                    setVisionPulse(true);
                    setTimeout(() => setVisionPulse(false), 200);
                  }
                };
                reader.readAsDataURL(blob);
              }
            }, 'image/jpeg', 0.95);
          }
        }
      }, 1000); 
    } else {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      lastFrameRef.current = null;
    }
    return () => { if (frameIntervalRef.current) clearInterval(frameIntervalRef.current); };
  }, [cameraActive, voiceActive, authenticated]);

  const showFeedback = (msg: string) => {
    setCommandFeedback(msg);
    setTimeout(() => setCommandFeedback(null), 4000);
  };

  const handlePurgeHistory = () => {
    setMessages([]);
    localStorage.removeItem('echo_history_cache');
    showFeedback("HISTORY_PURGED");
  };

  const handleSubmitInput = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = inputText.trim();
    if (!trimmedInput || isProcessing) return;
    
    gemini.stopAudio();
    const userMessage: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, content: trimmedInput, timestamp: Date.now() };
    
    setMessages(prev => [...prev.slice(-9), userMessage]);
    setInputText('');
    setIsProcessing(true);
    
    try {
      const assistantId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: assistantId, role: MessageRole.ASSISTANT, content: '', timestamp: Date.now() }]);
      
      const stream = gemini.sendChatMessage(userMessage.content, activeModel, messages, lastFrameRef.current || undefined);
      
      for await (const chunk of stream) {
        setIsProcessing(false); 
        setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: m.content + chunk.text } : m));
      }
    } catch (error: any) {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: MessageRole.ASSISTANT, content: `UPLINK_ERROR: ${error.message || "Protocol Failure."}`, timestamp: Date.now() }]);
    } finally { setIsProcessing(false); }
  };

  const toggleCamera = () => {
    setCameraActive(prev => !prev);
    showFeedback(!cameraActive ? "OPTICAL_INIT" : "OPTICAL_OFF");
  };

  const toggleHud = () => {
    setHudEnabled(prev => !prev);
    showFeedback(!hudEnabled ? "HUD_ACTIVE" : "HUD_SUPPRESSED");
  };

  const toggleVoice = async () => {
    if (voiceActive) {
      if (liveSessionRef.current) liveSessionRef.current.stop();
      liveSessionRef.current = null;
      setVoiceActive(false);
      setLiveTranscription(null);
      setDetections([]);
    } else {
      setVoiceActive(true);
      const session = await gemini.connectLive(activeVoicePersona, {
        onTranscription: (text, isUser) => setLiveTranscription({ text, isUser }),
        onTurnComplete: (input, output) => {
          setLiveTranscription(null);
          const now = Date.now();
          setMessages(prev => [
            ...prev.slice(-8), 
            { id: `v-in-${now}`, role: MessageRole.USER, content: input || "[Voice Input]", timestamp: now, isVoice: true },
            { id: `v-out-${now}`, role: MessageRole.ASSISTANT, content: output || "[Neural Output]", timestamp: now + 1, isVoice: true }
          ]);
        },
        onError: (err) => {
          setVoiceActive(false);
          setVoiceError(err.message);
          showFeedback("SYNC_FAILED");
        },
        onToolCall: async (name, args: any) => {
          if (name === 'clear_chat') { handlePurgeHistory(); return "History purged."; }
          if (name === 'set_volume') { 
            const level = Math.max(0, Math.min(100, (args as any).level)) / 100;
            setAudioSettings(prev => ({ ...prev, volume: level }));
            return `Volume set to ${Math.round(level * 100)}%.`;
          }
          if (name === 'draw_detection') {
            setDetections(prev => {
              const existing = prev.find(d => d.label === args.label);
              if (existing) {
                return prev.map(d => d.label === args.label ? {
                  ...d,
                  targetX: args.x, targetY: args.y, targetW: args.w, targetH: args.h,
                  opacity: 1.0, 
                  distance: Math.floor(Math.random() * 5) + 1,
                  threat: Math.random() > 0.8 ? 'HIGH' : 'LOW'
                } : d);
              }
              return [...prev, {
                id: Math.random().toString(36).substr(2, 9),
                label: args.label,
                x: args.x, y: args.y, w: args.w, h: args.h,
                targetX: args.x, targetY: args.y, targetW: args.w, targetH: args.h,
                opacity: 1.0,
                distance: Math.floor(Math.random() * 5) + 1,
                threat: Math.random() > 0.8 ? 'HIGH' : 'LOW'
              }];
            });
            showFeedback(`TARGET_LOCKED: ${args.label.toUpperCase()}`);
            return "Target tracked.";
          }
          return "Tool executed.";
        }
      });
      if (session) {
        liveSessionRef.current = session;
        showFeedback("NEURAL_SYNC_ESTABLISHED");
        if (lastFrameRef.current) {
          session.sendImage(lastFrameRef.current);
        }
      } else {
        setVoiceActive(false);
      }
    }
  };

  if (!authenticated) {
    return <BootScreen onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="flex flex-col h-screen relative border-[12px] border-[#0a0a0a] bg-[#050505] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      <div className="scanline"></div>
      <div className="absolute top-4 left-4 border-t-2 border-l-2 border-[#00f2ff] w-16 h-16 opacity-40 z-0"></div>
      <div className="absolute bottom-4 right-4 border-b-2 border-r-2 border-[#00f2ff] w-16 h-16 opacity-40 z-0"></div>

      {cameraActive && (
        <div className="absolute top-28 right-10 z-40 w-[clamp(400px,60vw,48rem)] border border-[#00f2ff22] bg-[#00f2ff05] hud-panel p-1 shadow-[0_0_60px_rgba(0,242,255,0.25)] transition-all duration-700">
          <div className="relative aspect-video bg-black overflow-hidden border border-[#00f2ff33]">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover brightness-110 contrast-125 opacity-100" />
            {hudEnabled && <DetectionOverlay detections={detections} />}
            <div className="absolute top-4 left-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-black/80 px-3 py-1 rounded-sm border border-[#39ff1433]">
                 <div className={`w-3 h-3 rounded-full transition-all duration-150 ${visionPulse ? 'bg-[#39ff14] scale-125 shadow-[0_0_20px_#39ff14]' : 'bg-red-500 animate-pulse'}`}></div>
                 <span className={`text-[10px] font-black tracking-tighter uppercase ${visionPulse ? 'text-[#39ff14]' : 'text-red-500'}`}>
                   {visionPulse ? 'OPTICAL_HD_UPLINK' : 'OPTICAL_ACQUIRING'}
                 </span>
              </div>
              {!hudEnabled && (
                <div className="bg-black/70 px-2 py-0.5 rounded-sm flex items-center gap-2">
                  <span className="text-[7px] text-[#00f2ff] font-bold uppercase tracking-widest opacity-60">TARGETING_OVERLAY_SUPPRESSED</span>
                </div>
              )}
            </div>
            <div className="absolute bottom-0 left-0 w-full h-px bg-[#00f2ff66] animate-[scan_2.5s_linear_infinite]"></div>
            <div className="absolute inset-0 border-[20px] border-black/10 pointer-events-none"></div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {commandFeedback && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 bg-[#39ff1411] border border-[#39ff1444] px-6 py-2 hud-panel animate-in fade-in slide-in-from-top-4 uppercase text-[#39ff14] text-[10px] font-black tracking-[0.4em] backdrop-blur-md">
          {commandFeedback}
        </div>
      )}

      <header className="px-10 py-6 border-b border-[#00f2ff22] flex flex-wrap justify-between items-center z-30 bg-[#050505]/90 backdrop-blur-md gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full border border-[#00f2ff] flex items-center justify-center bg-[#00f2ff]/5 shadow-[0_0_25px_rgba(0,242,255,0.3)]">
            <div className="w-8 h-8 bg-[#00f2ff] rounded-sm animate-pulse opacity-80" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }}></div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-widest text-[#00f2ff] hud-font uppercase">Echo_OS V.5.7</h1>
            <span className="text-[9px] font-bold text-[#0066ff] tracking-[0.4em] uppercase">SYSTEM_STATE: {voiceActive ? "AUGMENTED_READY" : "IDLE"}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <StatusIndicator label="Cognition" status={isProcessing ? 'processing' : 'active'} />
          <StatusIndicator label="Optical" status={cameraActive ? 'active' : 'inactive'} />
          <StatusIndicator label="Neural" status={voiceActive ? 'active' : voiceError ? 'error' : 'inactive'} />
        </div>
        <div className="flex gap-4 items-center bg-[#00f2ff05] px-6 py-3 border border-[#00f2ff11] hud-panel">
          <button onClick={() => setActiveModel('gemini-3-flash-preview')} className={`px-3 py-1 text-[9px] font-bold transition-all ${activeModel === 'gemini-3-flash-preview' ? 'bg-[#00f2ff] text-black shadow-[0_0_10px_#00f2ff]' : 'text-[#00f2ff33]'}`}>FLASH</button>
          <button onClick={() => setActiveModel('gemini-3-pro-preview')} className={`px-3 py-1 text-[9px] font-bold transition-all ${activeModel === 'gemini-3-pro-preview' ? 'bg-[#0066ff] text-white shadow-[0_0_10px_#0066ff]' : 'text-[#0066ff33]'}`}>PRO</button>
          <div className="w-px h-4 bg-[#00f2ff22] mx-2"></div>
          <button onClick={handlePurgeHistory} className="text-[#ff3333] hover:text-[#ff0000] text-[9px] font-black tracking-widest uppercase transition-colors">[PURGE_MEMORY]</button>
        </div>
      </header>

      <main ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-8 space-y-10 custom-scrollbar relative z-10">
        {messages.length === 0 && !liveTranscription && (
          <div className="h-full flex flex-col items-center justify-center opacity-20">
            <div className="w-32 h-32 border-2 border-[#00f2ff] rounded-full mb-6 animate-spin-slow"></div>
            <p className="hud-font tracking-[1em] text-xs uppercase">Awaiting_Neural_Sync</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === MessageRole.USER ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] px-8 py-5 hud-panel relative ${msg.role === MessageRole.USER ? 'border-[#0066ff] bg-[#0066ff]/5' : 'border-[#00f2ff] bg-[#00f2ff]/5'}`}>
              <div className="flex justify-between items-center mb-4 border-b border-current/10 pb-2">
                <span className="opacity-40 text-[9px] font-bold uppercase tracking-widest">{msg.role === MessageRole.USER ? 'USER' : 'ECHO'}</span>
                {msg.isVoice && <span className="text-[7px] opacity-30 font-bold uppercase tracking-tighter">[VOICE_COMMS]</span>}
              </div>
              <p className="text-[15px] leading-relaxed font-light tracking-wide">{msg.content || <span className="animate-pulse">_</span>}</p>
            </div>
          </div>
        ))}
        {liveTranscription && (
          <div className={`flex ${liveTranscription.isUser ? 'justify-end' : 'justify-start'}`}>
             <div className="hud-panel px-8 py-5 border-[#39ff14] bg-[#39ff1405] max-w-[80%] border-l-4 shadow-[0_0_20px_rgba(57,255,20,0.1)]">
                <span className="text-[9px] text-[#39ff14] font-black tracking-[0.4em] mb-2 block uppercase">
                  {liveTranscription.isUser ? 'UPLINK_DECODE:' : 'DOWNLINK_DECODE:'}
                </span>
                <p className="text-[#39ff14] italic text-[15px]">"{liveTranscription.text}"</p>
             </div>
          </div>
        )}
      </main>

      <footer className="p-10 border-t border-[#00f2ff22] bg-[#050505]/95 backdrop-blur-2xl relative z-20">
        <div className="max-w-6xl mx-auto flex items-center gap-10">
          <div className="flex gap-4">
            <button onClick={toggleCamera} title="Toggle Optical Uplink" className={`w-16 h-16 rounded-full border-2 transition-all duration-500 ${cameraActive ? 'border-[#00f2ff] shadow-[0_0_30px_rgba(0,242,255,0.3)] bg-[#00f2ff11]' : 'border-[#00f2ff44] opacity-50'} flex items-center justify-center hover:scale-105 active:scale-95`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            <button onClick={toggleHud} title="Toggle HUD Targeting" className={`w-16 h-16 rounded-full border-2 transition-all duration-500 ${hudEnabled ? 'border-[#00f2ff] shadow-[0_0_30px_rgba(0,242,255,0.3)] bg-[#00f2ff11]' : 'border-[#00f2ff44] opacity-50'} flex items-center justify-center hover:scale-105 active:scale-95`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" /></svg>
            </button>
            <button onClick={toggleVoice} className={`w-16 h-16 rounded-full border-2 transition-all duration-500 ${voiceActive ? 'border-[#39ff14] shadow-[0_0_30px_rgba(57,255,20,0.3)] bg-[#39ff1411]' : 'border-[#00f2ff44] opacity-50'} flex items-center justify-center hover:scale-105 active:scale-95`}>
              {voiceActive ? <div className="w-3 h-3 bg-[#39ff14] animate-pulse"></div> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>}
            </button>
          </div>
          <form onSubmit={handleSubmitInput} className="flex-1 relative flex items-center">
             <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} disabled={voiceActive || isProcessing} placeholder={voiceActive ? "NEURAL_LINK_ESTABLISHED: Speak now." : "ENTER_QUERY..."} className="w-full bg-[#00f2ff05] border border-[#00f2ff22] rounded-sm px-8 py-5 text-[#00f2ff] outline-none text-sm tracking-widest font-bold uppercase placeholder:opacity-20" />
             <div className="absolute right-5 flex items-center gap-6">
               {voiceActive && <Visualizer isActive={voiceActive} color={liveTranscription?.isUser ? '#39ff14' : '#00f2ff'} />}
               {!voiceActive && <button type="submit" disabled={!inputText.trim() || isProcessing} className="px-6 py-2 border border-[#00f2ff] text-[#00f2ff] text-[10px] font-black tracking-widest hover:bg-[#00f2ff] hover:text-black transition-all uppercase">Process</button>}
             </div>
          </form>
        </div>
      </footer>
    </div>
  );
};
export default App;
