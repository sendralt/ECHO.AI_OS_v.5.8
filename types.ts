
export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
  SYSTEM = 'system'
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  isVoice?: boolean;
  sources?: GroundingSource[];
  imageUrl?: string; // Add this for image responses
}

export type ModelType = 'gemini-3-pro-preview' | 'gemini-3-flash-preview';
export type VoicePersona = 'Zephyr' | 'Puck' | 'Kore' | 'Charon' | 'Fenrir';
export type ImageSize = '1K' | '2K' | '4K';
export type ChatMode = 'text' | 'image';

export interface AudioSettings {
  volume: number;
  speed: number;
}

export interface AppState {
  messages: ChatMessage[];
  isListening: boolean;
  isProcessing: boolean;
  activeModel: ModelType;
  activeVoicePersona: VoicePersona;
  voiceActive: boolean;
  audioSettings: AudioSettings;
}
