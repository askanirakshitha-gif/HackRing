/**
 * Local Ollama Open-Source AI Service
 * Supports direct localhost execution (http://localhost:11434) and FastAPI gateway proxy
 * Models: Llama 3.2, Llama 3.1, Qwen 2.5, Mistral, Gemma 2, Phi 3, DeepSeek R1
 */

import { VoiceCommandIntent, CalendarEvent } from '../types';
import { sharedState } from './sharedStateManager';

export interface OllamaParsedIntent {
  action: 'schedule_class' | 'schedule_intervention' | 'edit_marks' | 'generate_lesson' | 'replan_duration' | 'replan_lesson' | 'socratic_qa' | 'general_qa' | 'navigate';
  topic: string;
  module?: string;
  durationMinutes: number;
  scheduledOffsetMinutes: number;
  specificTimeStr?: string;
  studentName?: string;
  marks?: { score: number; maxScore: number };
  confidence: number;
  voiceResponse: string;
  targetTab?: 'lesson' | 'curriculum' | 'calendar' | 'sources' | 'students' | 'graph';
}

export interface OllamaModelTag {
  name: string;
  modified_at?: string;
  size?: number;
  digest?: string;
}

const DEFAULT_HOST = 'http://localhost:11434';
const DEFAULT_MODEL = 'gpt-oss:120b-cloud';
const BACKEND_PROXY_URL = 'http://127.0.0.1:8000/api/ollama';

class OllamaService {
  private hostUrl: string;
  private selectedModel: string;
  private isOnline: boolean = false;
  private installedModels: string[] = ['llama3.2', 'qwen2.5', 'mistral', 'gemma2', 'phi3'];

  constructor() {
    this.hostUrl = (typeof window !== 'undefined' ? localStorage.getItem('mm_ollama_host') : null) || DEFAULT_HOST;
    this.selectedModel = (typeof window !== 'undefined' ? localStorage.getItem('mm_ollama_model') : null) || DEFAULT_MODEL;
  }

  public getHostUrl(): string {
    return this.hostUrl;
  }

  public setHostUrl(url: string) {
    if (url && url.trim()) {
      this.hostUrl = url.trim().replace(/\/+$/, '');
      localStorage.setItem('mm_ollama_host', this.hostUrl);
    }
  }

  public getSelectedModel(): string {
    return this.selectedModel;
  }

  public setSelectedModel(model: string) {
    if (model && model.trim()) {
      this.selectedModel = model.trim();
      localStorage.setItem('mm_ollama_model', this.selectedModel);
    }
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Health Check: tests direct localhost:11434 connection or backend /api/ollama/status
   */
  public async checkStatus(): Promise<{
    status: 'ONLINE' | 'OFFLINE';
    host: string;
    version?: string;
    activeModel: string;
    models: string[];
    source: 'direct' | 'proxy' | 'none';
  }> {
    // 1. Try FastAPI Backend Gateway Proxy first (supports Ollama Cloud & local)
    for (const endpoint of ['/api/ollama/status', `${BACKEND_PROXY_URL}/status`]) {
      try {
        const proxyController = new AbortController();
        const proxyTimeout = setTimeout(() => proxyController.abort(), 2500);

        const proxyResp = await fetch(endpoint, {
          method: 'GET',
          signal: proxyController.signal
        });
        clearTimeout(proxyTimeout);

        if (proxyResp.ok) {
          const proxyData = await proxyResp.json();
          this.isOnline = proxyData.status === 'ONLINE';
          if (proxyData.active_model) this.selectedModel = proxyData.active_model;
          const modelNames = proxyData.installed_models?.map((m: any) => typeof m === 'string' ? m : m.name?.split(':')[0]) || this.installedModels;
          if (modelNames.length > 0) this.installedModels = modelNames;

          return {
            status: proxyData.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE',
            host: proxyData.host || this.hostUrl,
            version: proxyData.version || undefined,
            activeModel: this.selectedModel,
            models: this.installedModels,
            source: 'proxy'
          };
        }
      } catch {
        // try next
      }
    }

    // 2. Try Direct Localhost Fetch as fallback
    try {
      const directController = new AbortController();
      const directTimeout = setTimeout(() => directController.abort(), 1200);

      const resp = await fetch(`${this.hostUrl}/api/version`, {
        method: 'GET',
        signal: directController.signal
      });
      clearTimeout(directTimeout);

      if (resp.ok) {
        const data = await resp.json();
        this.isOnline = true;
        const models = await this.getAvailableModels();
        return {
          status: 'ONLINE',
          host: this.hostUrl,
          version: data.version || 'v0.5.0+',
          activeModel: this.selectedModel,
          models,
          source: 'direct'
        };
      }
    } catch {
      // Direct localhost offline
    }

    this.isOnline = false;
    return {
      status: 'OFFLINE',
      host: this.hostUrl,
      activeModel: this.selectedModel,
      models: this.installedModels,
      source: 'none'
    };
  }

  /**
   * Fetch list of locally downloaded models
   */
  public async getAvailableModels(): Promise<string[]> {
    // Try direct tags
    try {
      const resp = await fetch(`${this.hostUrl}/api/tags`, { method: 'GET' });
      if (resp.ok) {
        const data = await resp.json();
        const models = (data.models || []).map((m: OllamaModelTag) => m.name.split(':')[0]);
        if (models.length > 0) {
          this.installedModels = Array.from(new Set([...models, ...this.installedModels]));
          return this.installedModels;
        }
      }
    } catch {
      // Direct tags error
    }

    // Try backend proxy
    try {
      const proxyResp = await fetch(`${BACKEND_PROXY_URL}/models`);
      if (proxyResp.ok) {
        const proxyData = await proxyResp.json();
        if (proxyData.model_names?.length) {
          this.installedModels = proxyData.model_names;
          return this.installedModels;
        }
      }
    } catch {
      // Proxy tags error
    }

    return this.installedModels;
  }

  /**
   * Voice Command Intent Parsing and Calendar Synchronization via Ollama
   */
  public async parseVoiceCommandAndSchedule(spokenText: string, modelOverride?: string): Promise<VoiceCommandIntent | null> {
    const text = spokenText.trim();
    if (!text) return null;

    const modelToUse = modelOverride || this.selectedModel;
    const sysPrompt = `You are MINDMESH-NEXUS Local Voice Intent Parser.
Analyze the voice command and output ONLY valid JSON matching this schema:
{
  "action": "schedule_class" | "schedule_intervention" | "edit_marks" | "generate_lesson" | "replan_lesson" | "socratic_qa" | "general_qa" | "navigate",
  "topic": "The exact topic or concept mentioned",
  "module": "Academic module name",
  "durationMinutes": 20,
  "scheduledOffsetMinutes": 10,
  "studentName": "Student name if mentioned",
  "marks": { "score": 9, "maxScore": 10 },
  "confidence": 0.95,
  "voiceResponse": "Professional spoken response."
}`;

    // 1. Direct fetch to local Ollama
    try {
      const resp = await fetch(`${this.hostUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: text }
          ],
          stream: false,
          format: 'json',
          options: { temperature: 0.1, num_predict: 350 }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const content = data.message?.content?.trim();
        if (content) {
          const parsed = JSON.parse(content.replace(/```json/g, '').replace(/```/g, '').trim()) as OllamaParsedIntent;
          return this.convertParsedToIntent(parsed, text, `Local Ollama (${modelToUse})`);
        }
      }
    } catch {
      // Direct call failed, fall back to backend route
    }

    // 2. Fallback to FastAPI backend proxy
    try {
      const proxyResp = await fetch(`${BACKEND_PROXY_URL}/parse-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ utterance: text, model: modelToUse })
      });

      if (proxyResp.ok) {
        const proxyData = await proxyResp.json();
        if (proxyData.parsed) {
          return this.convertParsedToIntent(proxyData.parsed, text, proxyData.provider || `Ollama Proxy (${modelToUse})`);
        }
      }
    } catch {
      // Fallback failed
    }

    return null;
  }

  /**
   * Fast Local LLM Chat Query
   */
  public async chat(prompt: string, modelOverride?: string, systemPrompt?: string): Promise<string> {
    const modelToUse = modelOverride || this.selectedModel;
    const sysPrompt = systemPrompt || 'You are MINDMESH-NEXUS, an expert AI Teaching and Learning Co-Pilot in Engineering & Science. Provide a clear, technically precise explanation.';

    // 1. Try FastAPI Backend Gateway Proxy first (Ollama Cloud / Local)
    for (const url of ['/api/ollama/chat', `${BACKEND_PROXY_URL}/chat`, '/api/copilot/chat']) {
      try {
        const proxyResp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, message: prompt, system_prompt: sysPrompt, model: modelToUse })
        });
        if (proxyResp.ok) {
          const data = await proxyResp.json();
          const reply = data.response || data.reply || '';
          if (reply && reply.trim()) {
            return reply.trim();
          }
        }
      } catch {
        // try next
      }
    }

    // 2. Try direct local Ollama if running
    try {
      const resp = await fetch(`${this.hostUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: [
            { role: 'system', content: sysPrompt },
            { role: 'user', content: prompt }
          ],
          stream: false,
          options: { temperature: 0.2, num_predict: 350 }
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        return data.message?.content?.trim() || '';
      }
    } catch {
      // Local daemon failed
    }

    return '';
  }

  private convertParsedToIntent(
    parsed: OllamaParsedIntent,
    rawText: string,
    providerName: string
  ): VoiceCommandIntent {
    const duration = parsed.durationMinutes || 20;
    const offset = parsed.scheduledOffsetMinutes || 10;
    const topic = parsed.topic || 'Computer Networks TCP Flow Control';
    const moduleName = parsed.module || (topic.toLowerCase().includes('tcp') || topic.toLowerCase().includes('network')
      ? 'Module 3: Transport Layer & TCP Flow'
      : topic.toLowerCase().includes('tree') || topic.toLowerCase().includes('bst')
      ? 'Module 2: Trees & Hierarchical Graphs'
      : 'NCERT Grade 7 Science');

    if (parsed.action === 'schedule_class') {
      const now = new Date();
      const startTime = new Date(now.getTime() + offset * 60 * 1000);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);
      const timeStr = parsed.specificTimeStr || `${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const dateStr = new Date().toISOString().split('T')[0];

      const calendarEvent: CalendarEvent = {
        id: `evt-ollama-${Date.now()}`,
        title: topic,
        topicId: `topic-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        module: moduleName,
        date: dateStr,
        time: timeStr,
        type: 'lesson',
        status: 'scheduled',
        objectives: [
          `Master core mechanics of ${topic}`,
          `Interactive formative diagnostic (${duration}m)`
        ],
        prerequisites: ['Foundational Concepts'],
        prerequisiteCompleted: true,
        resources: [
          {
            title: `${topic} Local Ollama Summary`,
            type: 'notes',
            url: '#'
          }
        ]
      };

      return {
        rawText,
        action: 'schedule_class',
        topic,
        subject: moduleName,
        durationMinutes: duration,
        actionOutcome: {
          type: 'schedule_class',
          payload: calendarEvent,
          targetTab: 'calendar',
          voiceResponse: parsed.voiceResponse || `Scheduled a ${duration}-minute class on "${topic}" in ${offset} minutes via ${providerName}.`
        }
      };
    }

    if (parsed.action === 'schedule_intervention') {
      const studentName = parsed.studentName || 'Rahul Sharma';
      const studentId = studentName.toLowerCase().includes('aarav') ? 'std-1' : 'std-0';
      const concept = topic.includes('TCP') ? 'Slow Start (Exponential Doubling)' : topic;

      return {
        rawText,
        action: 'schedule_intervention',
        topic: moduleName,
        actionOutcome: {
          type: 'schedule_intervention',
          payload: {
            studentId,
            studentName,
            topic: moduleName,
            concept,
            notes: `Targeted intervention generated via ${providerName}.`
          },
          targetTab: 'students',
          voiceResponse: parsed.voiceResponse || `Intervention staged for ${studentName} on ${concept}.`
        }
      };
    }

    if (parsed.action === 'edit_marks' && parsed.marks) {
      const studentName = parsed.studentName || 'Aarav Sharma';
      const studentId = studentName.toLowerCase().includes('rahul') ? 'std-0' : 'std-1';

      return {
        rawText,
        action: 'edit_marks',
        actionOutcome: {
          type: 'edit_marks',
          payload: {
            studentId,
            studentName,
            concept: topic,
            score: parsed.marks.score,
            maxScore: parsed.marks.maxScore
          },
          targetTab: 'students',
          voiceResponse: parsed.voiceResponse || `Updated marks for ${studentName} to ${parsed.marks.score}/${parsed.marks.maxScore}.`
        }
      };
    }

    if (parsed.action === 'general_qa' || parsed.action === 'socratic_qa') {
      return {
        rawText,
        action: 'general_qa',
        actionOutcome: {
          type: 'general_qa',
          voiceResponse: parsed.voiceResponse || `Answered query on ${topic} using ${providerName}.`
        }
      };
    }

    let finalAction: VoiceCommandIntent['action'] = 'generate_lesson';
    if (parsed.action === 'replan_lesson' || parsed.action === 'replan_duration') {
      finalAction = 'replan_duration';
    } else if (parsed.action === 'navigate') {
      finalAction = 'navigate';
    }

    return {
      rawText,
      topic,
      grade: 7,
      subject: moduleName,
      durationMinutes: duration,
      languages: ['English'],
      action: finalAction
    };
  }
}

export const ollamaService = new OllamaService();
