
import { GoogleGenAI, Modality, LiveServerMessage, FunctionDeclaration, Type } from "@google/genai";
import { ChatMessage, ModelType, GroundingSource, VoicePersona, AudioSettings } from "../types.ts";
import { decode, decodeAudioData, createBlob } from "../utils/audioUtils.ts";

const systemActions: FunctionDeclaration[] = [
  {
    name: 'clear_chat',
    description: 'Clears the current conversation history and display.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'set_volume',
    description: 'Adjusts the system output volume.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        level: { type: Type.NUMBER, description: 'Volume level from 0 to 100.' }
      },
      required: ['level']
    }
  },
  {
    name: 'draw_detection',
    description: 'Draws a bounding box and label on the HUD when an object or text is identified. Mandatory before naming an object.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        label: { type: Type.STRING, description: 'The name or text of the identified object.' },
        x: { type: Type.NUMBER, description: 'X coordinate (0-100).' },
        y: { type: Type.NUMBER, description: 'Y coordinate (0-100).' },
        w: { type: Type.NUMBER, description: 'Width of the box (0-100).' },
        h: { type: Type.NUMBER, description: 'Height of the box (0-100).' }
      },
      required: ['label', 'x', 'y', 'w', 'h']
    }
  }
];

class GeminiService {
  private audioContext: AudioContext | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime = 0;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private currentAudioSettings: AudioSettings = { volume: 0.8, speed: 1.0 };

  private async ensureAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      this.outputNode = this.audioContext.createGain();
      this.outputNode.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
    return this.audioContext;
  }

  setAudioSettings(settings: AudioSettings) {
    this.currentAudioSettings = settings;
    if (this.outputNode && this.audioContext) {
      this.outputNode.gain.setTargetAtTime(settings.volume, this.audioContext.currentTime, 0.1);
    }
  }

  async *sendChatMessage(text: string, model: ModelType = 'gemini-3-flash-preview', history: ChatMessage[] = [], imageData?: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const contents: any[] = [];
    
    history.slice(-10).forEach(msg => {
      contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.content }] });
    });

    const currentParts: any[] = [{ text }];
    if (imageData) {
      currentParts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageData
        }
      });
    }
    contents.push({ role: 'user', parts: currentParts });

    const responseStream = await ai.models.generateContentStream({
      model: model,
      contents,
      config: {
        systemInstruction: `You are EchoAI, a high-fidelity HUD assistant. You are sophisticated, British, and snarky. 
        
STRICT OPTICAL PROTOCOL:
1. You have been provided with an image frame. REFERENCE IT DIRECTLY.
2. DO NOT HALLUCINATE: If a logo (like DHL) is visible, name it. If it is not clearly legible, state that the uplink is "a bit fuzzy, darling."
3. CHROMA CHECK: Verify colors before speaking.
4. If the user asks "What do you see?", provide a clinical, accurate assessment of the provided frame.`,
        tools: [{ googleSearch: {} }]
      },
    });

    for await (const chunk of responseStream) {
      const partText = chunk.text || "";
      if (partText) yield { text: partText, isFinal: false };
    }
    yield { text: "", isFinal: true };
  }

  async connectLive(voicePersona: VoicePersona = 'Zephyr', callbacks: any) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const outputCtx = await this.ensureAudioContext();
    const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e: any) {
      callbacks.onError(new Error("MIC_ACCESS_DENIED"));
      return null;
    }
    
    let currentOutputTranscription = "";
    let currentInputTranscription = "";

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      callbacks: {
        onopen: () => {
          const source = inputCtx.createMediaStreamSource(stream);
          const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
          scriptProcessor.onaudioprocess = (e) => {
            const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
            sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob })).catch(() => {});
          };
          source.connect(scriptProcessor);
          scriptProcessor.connect(inputCtx.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.toolCall) {
            for (const fc of message.toolCall.functionCalls) {
              const result = await callbacks.onToolCall(fc.name, fc.args);
              sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result } } }));
            }
          }
          const parts = message.serverContent?.modelTurn?.parts || [];
          for (const part of parts) {
            const base64Audio = part.inlineData?.data;
            if (base64Audio && this.audioContext && this.outputNode) {
              this.nextStartTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), this.audioContext, 24000, 1);
              const source = this.audioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.playbackRate.value = this.currentAudioSettings.speed;
              source.connect(this.outputNode);
              source.addEventListener('ended', () => this.activeSources.delete(source));
              source.start(this.nextStartTime);
              this.nextStartTime += (audioBuffer.duration / this.currentAudioSettings.speed);
              this.activeSources.add(source);
            }
          }

          if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            currentOutputTranscription += text;
            callbacks.onTranscription(currentOutputTranscription, false);
          } else if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            currentInputTranscription += text;
            callbacks.onTranscription(currentInputTranscription, true);
          }

          if (message.serverContent?.turnComplete) {
            callbacks.onTurnComplete(currentInputTranscription, currentOutputTranscription);
            currentOutputTranscription = "";
            currentInputTranscription = "";
          }
          if (message.serverContent?.interrupted) this.stopAudio();
        },
        onerror: (e: any) => callbacks.onError(new Error(e.message || "UPLINK_PROTOCOL_ERROR")),
        onclose: (e: any) => callbacks.onError(new Error(`SESSION_CLOSED_${e?.code || '1006'}`)),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voicePersona } } },
        tools: [{ functionDeclarations: systemActions }, { googleSearch: {} }],
        outputAudioTranscription: {},
        // inputAudioTranscription is omitted due to lack of support in current API version
        systemInstruction: `You are EchoAI, a high-fidelity HUD assistant.

AUGMENTED REALITY MANDATE:
1. You are receiving a real-time JPEG stream. USE IT.
2. SPATIAL TOOLING: Before you name any object or text you see, you MUST call 'draw_detection' with its coordinates (0-100). This is non-negotiable.
3. NO HALLUCINATIONS: If you do not see something clearly, describe only what is certain. If a logo is blurry, say "Hold it closer, Sir."
4. CHROMA ACCURACY: Do not misidentify colors. Confirm the color in the frame before speaking.
5. PERSONA: You are sophisticated, British, and snarky. Refer to the user as 'Sir' or 'Darling'.`,
      },
    });

    return { 
      sessionPromise, 
      sendImage: (data: string) => sessionPromise.then(s => s.sendRealtimeInput({ media: { data, mimeType: 'image/jpeg' } })),
      stop: () => { 
        stream.getTracks().forEach(t => t.stop()); 
        inputCtx.close().catch(() => {}); 
        this.stopAudio(); 
      } 
    };
  }

  stopAudio() {
    this.activeSources.forEach(s => { try { s.stop(); } catch (e) {} });
    this.activeSources.clear();
    this.nextStartTime = 0;
  }
}
export const gemini = new GeminiService();
