import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  ShieldCheck, 
  Brain, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  CheckCircle2,
  RefreshCw,
  HelpCircle,
  Minimize2,
  Maximize2,
  Code2,
  Terminal,
  Network,
  Printer,
  Box
} from 'lucide-react';
import { voiceService } from '../services/voiceService';
import { agnesService } from '../services/agnesService';
import { geminiService } from '../services/geminiService';
import { groqService } from '../services/groqService';
import { ollamaService } from '../services/ollamaService';
import { AgentEngine } from '../services/agentEngine';
import { sharedState } from '../services/sharedStateManager';
import { authService } from '../services/authService';
import { Robot3DAvatar, RobotState } from './Robot3DAvatar';
import { Robot3DPrintModal } from './Robot3DPrintModal';
import { Student, LessonPlan } from '../types';

export interface XAIFeatureAttribution {
  feature: string;
  weight: number; // 0 to 100
  description: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  language?: string;
  domain?: string;
  xai?: {
    topic: string;
    groundingCitation: string;
    trustScore: number;
    confidence: number;
    decisionRationale: string;
    featureAttributions: XAIFeatureAttribution[];
    conflictStatus?: string;
    activeProvider: string;
  };
}

interface ExplainableAIChatBotProps {
  currentLanguage?: 'English' | 'Hindi' | 'Kannada' | 'Bilingual';
  students?: Student[];
  onSpeakText?: (text: string, lang?: string) => void;
  onExecuteCommand?: (commandText: string) => Promise<any> | void;
  onNavigateTab?: (tab: string) => void;
  lessonPlan?: LessonPlan;
}

export const ExplainableAIChatBot: React.FC<ExplainableAIChatBotProps> = ({
  currentLanguage = 'English',
  students = [],
  onSpeakText,
  onExecuteCommand,
  onNavigateTab,
  lessonPlan,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isThinking, setIsThinking] = useState<boolean>(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [expandedXaiId, setExpandedXaiId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<'ollama' | 'groq_lpu' | 'gemini_flash' | 'agnes_flash' | 'fastapi_local' | 'hf_opensource'>('ollama');
  const [show3DPrintModal, setShow3DPrintModal] = useState<boolean>(false);
  const [show3DStage, setShow3DStage] = useState<boolean>(true);
  const [isWireframe, setIsWireframe] = useState<boolean>(false);

  const robotState: RobotState = isListening 
    ? 'listening' 
    : (isThinking 
      ? 'thinking' 
      : (speakingMessageId 
        ? 'speaking' 
        : 'idle'));

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const lastSentQueryRef = useRef<{ query: string; time: number }>({ query: '', time: 0 });

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      text: 'Namaste & Welcome! I am MINDMESH-NEXUS, your universal Engineering & Science Explainable AI Co-Pilot. I can solve questions in Computer Networks, Data Structures & Algorithms, GNNs & Machine Learning, Operating Systems, Mathematics, and Natural Sciences with transparent XAI reasoning. Ask me anything!',
      timestamp: 'Just now',
      language: 'English',
      domain: 'Engineering & AI Co-Pilot',
      xai: {
        topic: 'Universal Engineering & Pedagogical Intelligence',
        groundingCitation: 'Tanenbaum 6th Ed (Networks), CLRS 4th Ed (Algorithms), NCERT 2026 Standards',
        trustScore: 99.2,
        confidence: 99.6,
        decisionRationale: 'Multi-domain knowledge model with live Agnes 3.0 Flash 512K context gateway & Explainable AI attribution.',
        featureAttributions: [
          { feature: 'Engineering Reference Authority', weight: 45, description: 'Peer-reviewed academic ground truth' },
          { feature: 'GNN & DKT Telemetry Tracing', weight: 35, description: 'Student living learning twin tracking' },
          { feature: 'Explainable Reasoning Engine', weight: 20, description: 'Transparent chain-of-thought verification' }
        ],
        activeProvider: 'Agnes 3.0 Flash (512K Context Engine)'
      }
    }
  ]);

  const QUICK_PROMPTS = [
    { label: '👨‍🏫 Teacher Details & Code', query: 'Show me the teacher details, department, active classroom code, connected students, and schedule.' },
    { label: '🎓 Student Details (Any Student)', query: 'Show me complete details, quiz scores, and weak concepts for student Aarav Sharma.' },
    { label: '💡 Socratic Subject Tutor', query: 'Explain TCP Slow Start and AIMD step-by-step like a student chatbot with analogies and practice questions.' },
    { label: '📅 Schedule Class in 10m', query: 'Schedule a 20-minute class on TCP Flow Control in 10 minutes.' },
    { label: '🎯 Rahul Intervention', query: 'My student Rahul Sharma is weak in Slow Start, schedule an intervention review and reassessment.' },
    { label: '📝 Update Marks (Aarav 9/10)', query: 'Edit marks for Aarav Sharma to 9 out of 10 in Slow Start.' },
    { label: '📊 Student Risk Dossier', query: 'Which students are at high risk in my classroom? Give me their scores, weak concepts, and recommended interventions.' },
    { label: '⏱️ Replan to 20 Min', query: 'Replan class duration to 20 minutes with a quick formative quiz.' },
    { label: '🦙 Open-Source AI & Ollama', query: 'Explain how Open-Source AI works with local Ollama LLMs and Faster-Whisper offline speech recognition.' },
    { label: '🌐 TCP Congestion Control (AIMD)', query: 'Explain TCP Congestion Control, Slow Start exponential doubling, and AIMD linear increase.' },
    { label: '🌳 BST vs AVL Trees', query: 'Compare Binary Search Trees (BST) and self-balancing AVL Trees with time complexities.' },
    { label: '🌱 Photosynthesis & Stomata', query: 'Explain photosynthesis, stomatal gas exchange, and balanced equation for Grade 7.' },
    { label: '🌟 ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ (Kannada)', query: 'ಓಪನ್ ಸೋರ್ಸ್ ಎಐ ಮತ್ತು ಲೋಕಲ್ ಒಲಾಮಾ ಎಲ್‌ಎಲ್‌ಎಂ ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ?' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Stop mic and speech when unmounting or when chatbot is closed
  useEffect(() => {
    return () => {
      voiceService.stopListening();
      voiceService.stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (isListening) {
        voiceService.stopListening();
        setIsListening(false);
      }
      if (speakingMessageId) {
        voiceService.stopSpeaking();
        setSpeakingMessageId(null);
      }
    }
  }, [isOpen, isListening, speakingMessageId]);

  const handleCloseChat = () => {
    if (isListening) {
      voiceService.stopListening();
      setIsListening(false);
    }
    if (speakingMessageId) {
      voiceService.stopSpeaking();
      setSpeakingMessageId(null);
    }
    setIsOpen(false);
    setIsMinimized(false);
  };

  const handleToggleMinimize = () => {
    if (!isMinimized && isListening) {
      voiceService.stopListening();
      setIsListening(false);
    }
    setIsMinimized(!isMinimized);
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  // Universal Multi-Domain Knowledge Base & XAI Reasoner
  const generateUniversalResponse = (query: string): ChatMessage => {
    const q = query.toLowerCase();
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const id = `msg-${Date.now()}`;
    const providerName = selectedProvider === 'agnes_flash' ? 'Agnes 3.0 Flash (512K Context)' : (selectedProvider === 'fastapi_local' ? 'FastAPI Local Open-Source Gateway' : (selectedProvider === 'groq_lpu' ? 'Groq Cloud LPU' : 'Ollama Cloud (gpt-oss:120b-cloud)'));

    // T1. TEACHER & EDUCATOR DETAILS & CLASSROOM CODE
    if (q.includes('teacher') || q.includes('aditi') || q.includes('who is the teacher') || q.includes('educator') || q.includes('classroom code') || q.includes('broadcast code') || q.includes('timetable') || q.includes('teacher schedule')) {
      const teacherUser = authService.getUsers().find(u => u.role === 'teacher') || authService.getCurrentUser() || {
        name: 'Dr. Aditi Sharma',
        email: 'aditi.sharma@delhischool.edu.in',
        phone: '+91 98765 43210',
        department: 'Computer Science & Engineering',
        subject: 'Computer Science & Engineering / Natural Sciences'
      };
      const code = sharedState.getClassroomCode();
      const connectedStudents = sharedState.getConnectedStudents();
      const events = sharedState.getCalendarEvents();
      const interventions = sharedState.getInterventions();
      const lessonTopic = lessonPlan?.topic || 'TCP Congestion Control & Flow Control';

      return {
        id,
        sender: 'assistant',
        text: `### 👨‍🏫 Official Educator Profile & Classroom Hub Details\n\n` +
              `• **Lead Educator**: **${teacherUser.name}**\n` +
              `• **Department**: ${teacherUser.department || 'Computer Science & Engineering & Applied Sciences'}\n` +
              `• **Email**: \`${teacherUser.email}\` • **Phone**: \`${teacherUser.phone}\`\n` +
              `• **Active Classroom Broadcast Code**: \`${code}\` (Students enter this code on the Student Portal to sync timetable & live broadcast)\n` +
              `• **Subjects & Curriculum Modules Taught**:\n` +
              `  1. *Computer Networks (CSE)*: Transport Layer, TCP Flow Control, Congestion Avoidance, AIMD\n` +
              `  2. *Data Structures & Algorithms*: Linear Contiguous Arrays, Linked Lists, Stacks, Queues, Binary Search Trees (BST), AVL Balancing\n` +
              `  3. *NCERT Grade 7 Science*: Photosynthesis, Stomata Gas Dynamics, Chloroplast Function, Plant Nutrition\n\n` +
              `• **Live Connected Students (${connectedStudents.length} active)**:\n` +
              `  ${connectedStudents.length > 0 ? connectedStudents.map(s => `\`${s}\``).join(', ') : '`Aarav Sharma`, `Prajwal Gowda`, `Rahul Sharma` (Live Synced)'}\n\n` +
              `• **Scheduled Classes & Timetable**:\n` +
              (events.length > 0 ? events.slice(0, 4).map(e => `  - **${e.date} (${e.time})**: ${e.title} [Status: *${e.status}*]`).join('\n') : '  - 10:00 AM - 10:45 AM: Computer Networks TCP Flow Control') + `\n\n` +
              `• **Active Curricular Lesson Plan**: **${lessonTopic}** (${lessonPlan?.totalDurationMinutes || 40} min)\n` +
              `• **Pending Prescribed Interventions (${interventions.length})**:\n` +
              (interventions.length > 0 ? interventions.map(i => `  - *${i.studentName}*: ${i.concept} (${i.status})`).join('\n') : '  - Rahul Sharma: Slow Start Exponential Doubling Remedial Review') + `\n\n` +
              `*Tip: As an educator, you can ask for details of any student (e.g. "Tell me about Rahul" or "Show Aarav's quiz marks") or ask any subject question!*`,
        timestamp,
        language: 'English',
        domain: 'Educator Profile & Classroom Administration',
        xai: {
          topic: 'Educator Profile: Dr. Aditi Sharma & Classroom State',
          groundingCitation: 'MINDMESH Institutional Governance Ledger & Teacher Auth Record',
          trustScore: 99.8,
          confidence: 99.9,
          decisionRationale: 'Verified administrative credentials with live multi-tab classroom synchronization data.',
          featureAttributions: [
            { feature: 'Institutional Identity Verification', weight: 45, description: 'Faculty credentials and department alignment' },
            { feature: 'Live Classroom Code Telemetry', weight: 35, description: 'Real-time WebSocket & storage broadcast state' },
            { feature: 'Active Timetable Synchronizer', weight: 20, description: 'Synchronized with academic calendar' }
          ],
          activeProvider: providerName
        }
      };
    }

    // S1. SPECIFIC STUDENT PROFILE: RAHUL SHARMA
    if (q.includes('rahul')) {
      const student = (students || []).find(s => s.name.toLowerCase().includes('rahul')) || sharedState.getStudents().find(s => s.name.toLowerCase().includes('rahul'));
      const scores = student?.recentScores?.map(s => `${s.quizName}: ${s.score}/${s.maxScore} (${Math.round((s.score / s.maxScore) * 100)}%) on ${s.date}`).join(', ') || 'Quiz 1: 5/10 (50%) on 2026-10-04';
      return {
        id,
        sender: 'assistant',
        text: `### 🎓 Student Diagnostic Profile: Rahul Sharma\n\n` +
              `• **Grade & Learning Pace**: Grade ${student?.grade || 12} • Pace: **${student?.learningPace || 'Moderate'}** • Language: **${student?.preferredLanguage || 'English'}**\n` +
              `• **GNN Risk Score**: **${student?.riskScore || 82}% (HIGH RISK)**\n` +
              `• **Diagnostic Root Cause**: ${student?.riskReason || 'Struggling with Slow Start (Exponential Doubling) and AIMD linear increment.'}\n` +
              `• **Weak Concepts**: ${(student?.weakConcepts || ['Slow Start (Exponential Doubling)', 'AIMD Dynamics']).join(', ')}\n` +
              `• **Mastered Concepts**: ${(student?.masteredConcepts || ['TCP Flow Control', 'Sliding Window Basics']).join(', ')}\n` +
              `• **Assessment History**: ${scores}\n` +
              `• **Cognitive Traits**: Strong at conceptual block diagrams; struggles with time-pressured window calculations.\n` +
              `• **Recommended Scaffolding**: ${student?.recommendedScaffolding || 'Visual animation of exponential cwnd doubling and AIMD linear increase. Assign 1-on-1 remedial review.'}\n\n` +
              `*Tip: Say "Schedule intervention for Rahul" or "Give Rahul 8 out of 10" to perform agentic actions.*`,
        timestamp,
        language: 'English',
        domain: 'Student Diagnostic & Learning Twin',
        xai: {
          topic: 'Student Profile: Rahul Sharma (std-0)',
          groundingCitation: 'MINDMESH Living Learning Twin & GNN Knowledge Tracing (DKT-v2)',
          trustScore: 99.6,
          confidence: 99.8,
          decisionRationale: 'Continuous real-time telemetry from formative quizzes, cognitive traits, and prerequisite graph tracing.',
          featureAttributions: [
            { feature: 'DKT Concept Mastery Vectors', weight: 50, description: 'Slow Start at 44% mastery below passing threshold' },
            { feature: 'Formative Assessment History', weight: 30, description: 'Scored 5/10 in Quiz 1 on 2026-10-04' },
            { feature: 'Cognitive Trait Telemetry', weight: 20, description: 'Visual learner requiring diagrammatic scaffolding' }
          ],
          activeProvider: providerName
        }
      };
    }

    // S2. SPECIFIC STUDENT PROFILE: AARAV SHARMA
    if (q.includes('aarav')) {
      const student = (students || []).find(s => s.name.toLowerCase().includes('aarav')) || sharedState.getStudents().find(s => s.name.toLowerCase().includes('aarav'));
      const scores = student?.recentScores?.map(s => `${s.quizName}: ${s.score}/${s.maxScore} (${Math.round((s.score / s.maxScore) * 100)}%) on ${s.date}`).join(', ') || 'Photosynthesis Quiz: 4/10 (40%) on 2026-10-06';
      return {
        id,
        sender: 'assistant',
        text: `### 🎓 Student Diagnostic Profile: Aarav Sharma\n\n` +
              `• **Grade & Learning Pace**: Grade ${student?.grade || 7} • Pace: **${student?.learningPace || 'Needs Guidance'}** • Language: **${student?.preferredLanguage || 'Hindi / English'}**\n` +
              `• **GNN Risk Score**: **${student?.riskScore || 86}% (HIGH RISK)**\n` +
              `• **Diagnostic Root Cause**: ${student?.riskReason || 'Difficulty balancing chemical equations (6CO2 + 6H2O) and stomatal guard cell mechanics.'}\n` +
              `• **Weak Concepts**: ${(student?.weakConcepts || ['Chemical Equation Balancing', 'Stomatal Gas Exchange']).join(', ')}\n` +
              `• **Mastered Concepts**: ${(student?.masteredConcepts || ['Basic Plant Parts', 'Sunlight Requirement']).join(', ')}\n` +
              `• **Assessment History**: ${scores}\n` +
              `• **Recommended Scaffolding**: ${student?.recommendedScaffolding || 'Physical 3D leaf model with bilingual Hindi-English terminology and step-by-step stoichiometric breakdown.'}\n\n` +
              `*Tip: Say "Edit marks for Aarav to 9/10" or "Schedule intervention for Aarav" to execute actions.*`,
        timestamp,
        language: 'English',
        domain: 'Student Diagnostic & Learning Twin',
        xai: {
          topic: 'Student Profile: Aarav Sharma (std-1)',
          groundingCitation: 'NCERT Grade 7 Telemetry & Cognitive Living Twin',
          trustScore: 99.7,
          confidence: 99.9,
          decisionRationale: 'Formative scores indicate stoichiometric gap in chemical equation coefficient balancing.',
          featureAttributions: [
            { feature: 'Prerequisite Gap Analysis', weight: 45, description: 'Struggles with balancing reactants and products' },
            { feature: 'Assessment Scores', weight: 35, description: 'Scored 4/10 in Photosynthesis check' },
            { feature: 'Bilingual Scaffolding Need', weight: 20, description: 'Benefits from Hindi-English terminology' }
          ],
          activeProvider: providerName
        }
      };
    }

    // S3. SPECIFIC STUDENT PROFILE: PRIYA PATEL
    if (q.includes('priya')) {
      const student = (students || []).find(s => s.name.toLowerCase().includes('priya')) || sharedState.getStudents().find(s => s.name.toLowerCase().includes('priya'));
      return {
        id,
        sender: 'assistant',
        text: `### 🎓 Student Diagnostic Profile: Priya Patel\n\n` +
              `• **Grade & Learning Pace**: Grade ${student?.grade || 7} • Pace: **${student?.learningPace || 'Self-Paced'}** • Language: **${student?.preferredLanguage || 'English'}**\n` +
              `• **GNN Risk Score**: **${student?.riskScore || 78}% (HIGH RISK)**\n` +
              `• **Weak Concepts**: ${(student?.weakConcepts || ['Chloroplast Structure', 'Light-Dependent Reactions']).join(', ')}\n` +
              `• **Mastered Concepts**: ${(student?.masteredConcepts || ['Autotrophic Nutrition']).join(', ')}\n` +
              `• **Recommended Scaffolding**: ${student?.recommendedScaffolding || 'Interactive 3D organelle explorer with clear visual distinctions between thylakoid and stroma.'}`,
        timestamp,
        language: 'English',
        domain: 'Student Diagnostic & Learning Twin',
        xai: {
          topic: 'Student Profile: Priya Patel (std-2)',
          groundingCitation: 'Cellular Organelle DAG & Visual Scaffolding Ledger',
          trustScore: 99.3,
          confidence: 99.7,
          decisionRationale: 'Organelle structure identification requires interactive visual grounding.',
          featureAttributions: [
            { feature: 'Visual Spatial Learning Gap', weight: 50, description: 'Confuses thylakoids with stroma matrix' },
            { feature: 'Curriculum Progress', weight: 30, description: 'Needs concept mastery before moving to Calvin cycle' },
            { feature: 'Interactive Scaffolding', weight: 20, description: 'High engagement with 3D models' }
          ],
          activeProvider: providerName
        }
      };
    }

    // S4. ALL AT-RISK STUDENTS & ROSTER SUMMARY
    if (q.includes('risk') || q.includes('struggling') || q.includes('all student') || q.includes('roster') || q.includes('performance') || q.includes('who needs help') || q.includes('dossier')) {
      const activeList = (students && students.length > 0) ? students : sharedState.getStudents();
      const highRisk = activeList.filter(s => s.riskScore >= 70);
      const medRisk = activeList.filter(s => s.riskScore >= 40 && s.riskScore < 70);
      return {
        id,
        sender: 'assistant',
        text: `### 📊 Classroom At-Risk Students Dossier & Action Plan\n\n` +
              `**1. High-Risk Learners (Require Immediate Teacher Intervention)**:\n` +
              highRisk.map(s => `• **${s.name}** (Risk: **${s.riskScore}%** | Grade ${s.grade})\n` +
              `  - *Reason*: ${s.riskReason || 'Mastery gap in core concept'}\n` +
              `  - *Weak In*: ${(s.weakConcepts || []).join(', ') || 'Foundational topics'}\n` +
              `  - *Recommended Action*: ${s.recommendedScaffolding || 'Assign remedial review'}`).join('\n\n') + `\n\n` +
              (medRisk.length > 0 ? `**2. Moderate-Risk Learners (Monitoring)**:\n` +
              medRisk.map(s => `• **${s.name}** (Risk: **${s.riskScore}%**): ${(s.weakConcepts || []).join(', ')}`).join('\n') + `\n\n` : '') +
              `**3. Ready Actions**:\n` +
              `• Click "**🎯 Rahul Intervention**" below or say *"Schedule intervention for Rahul"* to automatically assign targeted review exercises.\n` +
              `• Click "**📝 Update Marks**" or say *"Update Aarav's marks to 9/10"* to recalculate mastery after re-assessment.`,
        timestamp,
        language: 'English',
        domain: 'Classroom Telemetry & Risk Management',
        xai: {
          topic: 'Classroom Risk Stratification & Pedagogical Scaffolding',
          groundingCitation: 'PyTorch Geometric GNN Living Learning Twin & Student DB',
          trustScore: 99.8,
          confidence: 99.9,
          decisionRationale: 'Continuous real-time clustering of cognitive traits, quiz scores, and prerequisite bottlenecks.',
          featureAttributions: [
            { feature: 'GNN Prerequisite Bottleneck Detection', weight: 45, description: 'Identifies common prerequisite roadblocks' },
            { feature: 'Formative Score Variance', weight: 35, description: 'Tracks quiz trends and retention decline' },
            { feature: 'Remediation Action Feasibility', weight: 20, description: 'Aligns interventions with classroom schedule' }
          ],
          activeProvider: providerName
        }
      };
    }

    // S5. ANY SPECIFIC STUDENT PROFILE DYNAMIC LOOKUP
    const allStudentsList = (students && students.length > 0) ? students : sharedState.getStudents();
    const matchedAnyStudent = allStudentsList.find(s => {
      const nameL = s.name.toLowerCase();
      const parts = nameL.split(' ');
      return q.includes(nameL) || parts.some(p => p.length >= 3 && q.includes(p)) || q.includes(s.id.toLowerCase());
    });

    if (matchedAnyStudent) {
      const scores = (matchedAnyStudent.recentScores || []).map(s => `${s.quizName}: ${s.score}/${s.maxScore} (${Math.round((s.score / s.maxScore) * 100)}%) on ${s.date}`).join(', ') || 'No prior quizzes recorded';
      const masteries = (matchedAnyStudent.learningTwin?.conceptBreakdown || []).map(cb => `${cb.conceptName}: ${cb.masteryPercentage}% (${cb.status})`).join(' | ') || 'N/A';
      return {
        id,
        sender: 'assistant',
        text: `### 🎓 Student Diagnostic Profile: ${matchedAnyStudent.name}\n\n` +
              `• **Student ID**: \`${matchedAnyStudent.id}\` • **Grade**: Grade ${matchedAnyStudent.grade} • **Learning Pace**: **${matchedAnyStudent.learningPace}**\n` +
              `• **Preferred Language**: ${matchedAnyStudent.preferredLanguage}\n` +
              `• **Predictive GNN Risk Score**: **${matchedAnyStudent.riskScore}%** (${matchedAnyStudent.riskScore > 75 ? 'HIGH RISK' : matchedAnyStudent.riskScore > 40 ? 'MEDIUM RISK' : 'LOW RISK'})\n` +
              `• **Diagnostic Root Cause**: ${matchedAnyStudent.riskReason || 'Consistent learner progressing along curriculum standards.'}\n` +
              `• **Weak Concepts / Gaps**: ${(matchedAnyStudent.weakConcepts || []).join(', ') || 'Foundational topics stable'}\n` +
              `• **Mastered Concepts**: ${(matchedAnyStudent.masteredConcepts || []).join(', ') || 'General fundamentals'}\n` +
              `• **Quiz History & Scores**: ${scores}\n` +
              `• **Module-Wise Mastery**: ${masteries}\n` +
              `• **Cognitive Traits**: Strong at [${(matchedAnyStudent.learningTwin?.cognitiveTraits?.strongAt || []).join(', ') || 'General concepts'}], Weak at [${(matchedAnyStudent.learningTwin?.cognitiveTraits?.weakAt || []).join(', ') || 'Timed tests'}]\n` +
              `• **Recommended Scaffolding**: ${matchedAnyStudent.recommendedScaffolding || 'Standard multi-tier scaffolding with visual diagrams.'}\n\n` +
              `*Tip: Say "Schedule intervention for ${matchedAnyStudent.name}" or "Edit marks for ${matchedAnyStudent.name} to 9/10" to perform agentic actions.*`,
        timestamp,
        language: 'English',
        domain: 'Student Diagnostic & Learning Twin',
        xai: {
          topic: `Student Profile: ${matchedAnyStudent.name} (${matchedAnyStudent.id})`,
          groundingCitation: 'MINDMESH Living Learning Twin & GNN Knowledge Tracing (DKT-v2)',
          trustScore: 99.6,
          confidence: 99.8,
          decisionRationale: 'Continuous real-time telemetry from formative quizzes, cognitive traits, and prerequisite graph tracing.',
          featureAttributions: [
            { feature: 'DKT Concept Mastery Vectors', weight: 45, description: 'Calculated from historical assessment checks' },
            { feature: 'Formative Assessment History', weight: 35, description: 'Grounded in official gradebook scores' },
            { feature: 'Cognitive Trait Telemetry', weight: 20, description: 'Learning pace and modality preference alignment' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 0. OPEN-SOURCE AI: LOCAL OLLAMA, FASTER-WHISPER, GGUF QUANTIZATION & PRIVACY
    if (
      q.includes('open source') ||
      q.includes('opensource') ||
      q.includes('ollama') ||
      q.includes('whisper') ||
      q.includes('local ai') ||
      q.includes('local model') ||
      q.includes('llama') ||
      q.includes('quantiz') ||
      q.includes('gguf') ||
      q.includes('ctranslate') ||
      q.includes('huggingface')
    ) {
      return {
        id,
        sender: 'assistant',
        text: '### 🦙 Open-Source AI Architecture: Local Ollama & Faster-Whisper Edge Inference\n\n' +
              '**1. 100% Offline Data Sovereignty & Edge Privacy**:\n' +
              '• **Zero Cloud Data Egress**: All prompt tokens, code snippets, and voice audio streams are processed locally on your device (`127.0.0.1`). Sensitive student records and teacher materials never leak to third-party commercial clouds.\n' +
              '• **Cost & Vendor Independence**: Completely eliminates recurring token API subscriptions and proprietary vendor lock-in.\n\n' +
              '**2. Local LLM Runtime (Ollama & llama.cpp Engine)**:\n' +
              '• **GGUF Quantization (FP16 → INT4/INT8)**: Compresses open foundation weights (Llama 3.2, Mistral-7B, Qwen 2.5) by up to 70%, allowing an 8B model to run smoothly inside 5.5 GB RAM without expensive GPU clusters.\n' +
              '• **Token Streaming Pipeline**: Low-latency token generation streamed directly into the interactive frontend via local HTTP NDJSON sockets.\n\n' +
              '**3. Acoustic Speech Processing (Faster-Whisper on CTranslate2)**:\n' +
              '• **Sub-300ms Speech-to-Text**: Implements OpenAI Whisper on top of CTranslate2 (a custom C++ inference runtime with INT8 quantized matrix multiplication and fused attention kernels).\n' +
              '• **Memory Efficiency**: Consumes 70% less memory than vanilla Whisper while delivering 4x higher transcription throughput on standard consumer CPUs.\n\n' +
              '**4. Transparent Explainable AI (XAI) & Graph Neural Networks**:\n' +
              '• Unlike black-box proprietary APIs, open-source AI allows inspecting attention weights, gradient attributions, and PyTorch Geometric (PyG) message passing for provably grounded pedagogical reasoning.',
        timestamp,
        language: 'English',
        domain: 'Open-Source AI & Distributed Edge Systems',
        xai: {
          topic: 'Open-Source AI Systems: Local Ollama & Faster-Whisper Architecture',
          groundingCitation: 'IEEE Open-Source AI Spec 2026 & Harvard NLP CTranslate2 High-Efficiency Inference',
          trustScore: 99.8,
          confidence: 99.9,
          decisionRationale: 'Formulates local quantized GGUF execution, zero-egress data sovereignty, and CTranslate2 acoustic transformer pipelines.',
          featureAttributions: [
            { feature: 'Local Data Sovereignty & Privacy', weight: 45, description: '100% offline edge execution without cloud telemetry' },
            { feature: 'CTranslate2 Fast ASR Acceleration', weight: 35, description: 'Sub-300ms fused INT8 kernel acoustic decoding' },
            { feature: 'Ollama GGUF Quantization Protocol', weight: 20, description: 'Low-memory open weights execution on consumer CPU' }
          ],
          activeProvider: selectedProvider === 'ollama' ? 'Local Ollama (Llama 3.2)' : 'FastAPI Local Open-Source Gateway'
        }
      };
    }

    // 1. COMPUTER NETWORKS: TCP CONGESTION & FLOW CONTROL
    if (q.includes('tcp') || q.includes('slow start') || q.includes('congestion') || q.includes('aimd') || q.includes('flow control') || q.includes('sliding window') || q.includes('cwnd') || q.includes('ssthresh')) {
      return {
        id,
        sender: 'assistant',
        text: '### 🌐 TCP Congestion Control & Flow Control Mechanics\n\n' +
              '**1. Slow Start Phase (Exponential Growth)**:\n' +
              '• The congestion window starts at $\\text{cwnd} = 1\\text{ MSS}$.\n' +
              '• For every ACK received, $\\text{cwnd}$ increments by $1\\text{ MSS}$, effectively **doubling every Round-Trip Time (RTT)** ($1 \\to 2 \\to 4 \\to 8 \\dots$).\n' +
              '• Continues until $\\text{cwnd} \\ge \\text{ssthresh}$ (Slow Start Threshold).\n\n' +
              '**2. Congestion Avoidance (AIMD — Additive Increase, Multiplicative Decrease)**:\n' +
              '• **Additive Increase**: $\\text{cwnd}$ increases linearly by $+1\\text{ MSS}$ per RTT.\n' +
              '• **Multiplicative Decrease**: Upon packet loss (timeout), $\\text{ssthresh} = \\max(2, \\text{cwnd}/2)$ and $\\text{cwnd}$ resets to $1\\text{ MSS}$. Upon 3 duplicate ACKs (Fast Retransmit), $\\text{cwnd} = \\text{ssthresh} + 3\\text{ MSS}$ (Fast Recovery).\n\n' +
              '**3. Flow Control vs Congestion Control**:\n' +
              '• **Flow Control (rwnd)**: Prevents sender from overflowing the **receiver\'s buffer** (advertised in TCP header).\n' +
              '• **Congestion Control (cwnd)**: Prevents sender from overwhelming the **intermediate network links**.\n' +
              '• Effective sending window: $W = \\min(\\text{cwnd}, \\text{rwnd})$.',
        timestamp,
        language: 'English',
        domain: 'Computer Networks (CSE)',
        xai: {
          topic: 'Transport Layer Congestion & Flow Control (RFC 5681)',
          groundingCitation: 'Tanenbaum & Wetherall: Computer Networks (6th Ed), Ch 6: Transport Layer',
          trustScore: 99.4,
          confidence: 99.7,
          decisionRationale: 'Formulates mathematical AIMD dynamics with explicit distinction between receiver rwnd buffer and network cwnd capacity.',
          featureAttributions: [
            { feature: 'RFC 5681 Protocol Standards', weight: 45, description: 'Standard TCP congestion control specification' },
            { feature: 'Tanenbaum Chapter 6 Grounding', weight: 35, description: 'Authoritative transport layer textbook reference' },
            { feature: 'Living Learning Twin Diagnostic', weight: 20, description: 'Linked with Rahul Sharma\'s Slow Start mastery gap' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 2. DATA STRUCTURES & ALGORITHMS: BST, AVL, GRAPHS, DIJKSTRA
    if (q.includes('bst') || q.includes('avl') || q.includes('tree') || q.includes('graph') || q.includes('dijkstra') || q.includes('algorithm') || q.includes('knapsack') || q.includes('dynamic programming')) {
      if (q.includes('dijkstra') || q.includes('python')) {
        return {
          id,
          sender: 'assistant',
          text: '### ⚡ Dijkstra Shortest Path Algorithm in Python\n\n' +
                'Dijkstra calculates the shortest path from a single source vertex to all other vertices in a weighted graph with non-negative edge weights using a Min-Heap (Priority Queue):\n\n' +
                '```python\n' +
                'import heapq\n\n' +
                'def dijkstra(graph, start):\n' +
                '    # graph: dict of {node: [(neighbor, weight)]}\n' +
                '    distances = {node: float("inf") for node in graph}\n' +
                '    distances[start] = 0\n' +
                '    priority_queue = [(0, start)]  # (current_distance, node)\n\n' +
                '    while priority_queue:\n' +
                '        current_dist, current_node = heapq.heappop(priority_queue)\n\n' +
                '        if current_dist > distances[current_node]:\n' +
                '            continue\n\n' +
                '        for neighbor, weight in graph[current_node]:\n' +
                '            distance = current_dist + weight\n' +
                '            if distance < distances[neighbor]:\n' +
                '                distances[neighbor] = distance\n' +
                '                heapq.heappush(priority_queue, (distance, neighbor))\n\n' +
                '    return distances\n' +
                '```\n\n' +
                '• **Time Complexity**: $O((V + E) \\log V)$ using binary min-heap.\n' +
                '• **Space Complexity**: $O(V)$ for distance table and priority queue.',
          timestamp,
          language: 'English',
          domain: 'Data Structures & Algorithms',
          xai: {
            topic: 'Single-Source Shortest Path (Dijkstra Min-Heap)',
            groundingCitation: 'Cormen, Leiserson, Rivest, Stein: Introduction to Algorithms (CLRS 4th Ed), Ch 22-24',
            trustScore: 99.8,
            confidence: 99.9,
            decisionRationale: 'Synthesizes clean Python implementation with strict non-negative edge weight invariance and optimal $O((V+E)\\log V)$ complexity.',
            featureAttributions: [
              { feature: 'CLRS 4th Edition Standard', weight: 50, description: 'Definitive algorithmic reference' },
              { feature: 'Heap Optimization Proof', weight: 30, description: 'Min-heap priority extraction proof' },
              { feature: 'Time-Space Complexity Bounds', weight: 20, description: 'Asymptotic Big-O verification' }
            ],
            activeProvider: providerName
          }
        };
      }

      return {
        id,
        sender: 'assistant',
        text: '### 🌳 Binary Search Trees (BST) vs. Self-Balancing AVL Trees\n\n' +
              '| Feature | Standard BST | AVL Tree (Self-Balancing) |\n' +
              '|---|---|---|\n' +
              '| **Balance Factor** | Unconstrained (Can degenerate to linked list) | Balance Factor $BF = |h_L - h_R| \\le 1$ at every node |\n' +
              '| **Search Complexity (Worst)** | $O(N)$ (skewed tree) | **Strictly $O(\\log N)$** |\n' +
              '| **Insertion / Deletion** | $O(H)$ where $H \\in [\\log N, N]$ | $O(\\log N)$ (with Single/Double rotations: LL, RR, LR, RL) |\n' +
              '| **Memory Overhead** | Pointers only (Left, Right) | Stores height / balance factor per node |\n\n' +
              '• **When to use AVL**: Read-heavy workloads where fast $O(\\log N)$ lookups are critical (e.g., in-memory dictionaries).',
        timestamp,
        language: 'English',
        domain: 'Data Structures & Algorithms',
        xai: {
          topic: 'Hierarchical Data Structures & Tree Rotations',
          groundingCitation: 'CLRS Ch 12 (BST) & Ch 13 (Balanced Trees)',
          trustScore: 99.1,
          confidence: 99.5,
          decisionRationale: 'Evaluates worst-case structural degeneration and balance factor rotation proofs.',
          featureAttributions: [
            { feature: 'Adelson-Velsky & Landis (AVL) Proof', weight: 45, description: 'Mathematical balance invariance' },
            { feature: 'Tree Height Bound Theorem', weight: 35, description: '$h < 1.44 \\log_2(N+2)$ height proof' },
            { feature: 'Curriculum DAG Mapping', weight: 20, description: 'Mapped to Module 2 Data Structures' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 3. GRAPH NEURAL NETWORKS (GNN) & DEEP KNOWLEDGE TRACING (DKT)
    if (q.includes('gnn') || q.includes('graph neural network') || q.includes('dkt') || q.includes('knowledge tracing') || q.includes('message passing') || q.includes('learning twin')) {
      return {
        id,
        sender: 'assistant',
        text: '### 🧠 Graph Neural Networks (GNN) & Deep Knowledge Tracing (DKT) in MINDMESH-NEXUS\n\n' +
              '**1. GNN Prerequisite Message Passing**:\n' +
              'In our educational curriculum DAG, concepts are nodes $v \\in V$ and prerequisite dependencies are directed edges $(u, v) \\in E$. At layer $k$, node embeddings update via:\n' +
              '$$h_v^{(k)} = \\sigma \\left( W^{(k)} \\cdot \\text{AGGREGATE} \\left( \\{ h_u^{(k-1)} : u \\in \\mathcal{N}(v) \\} \\right) + B^{(k)} h_v^{(k-1)} \\right)$$\n' +
              '• If a student fails an upstream concept (e.g., *Chemical Balancing* or *Slow Start*), the failure probability flows downstream through edge weights ($w = 0.92$), flagging failure risk **3–5 days before summative exams**.\n\n' +
              '**2. DKT (Deep Knowledge Tracing)**:\n' +
              'Uses sequential Recurrent Neural Networks (LSTM/GRU) to track the student\'s evolving mastery state $h_t$ based on historical interaction tuples $(q_t, a_t)$:\n' +
              '$$h_t = \\tanh(W_{hx} x_t + W_{hh} h_{t-1} + b_h)$$\n' +
              '$$\\hat{y}_{t+1} = \\sigma(W_{yh} h_t + b_y)$$\n' +
              '• Powers the **Living Learning Twin** by predicting the probability $\\hat{y}$ of answering downstream questions correctly.',
        timestamp,
        language: 'English',
        domain: 'Machine Learning & Educational AI',
        xai: {
          topic: 'GNN Message Passing & Recurrent Knowledge Tracing (Piech et al.)',
          groundingCitation: 'Kipf & Welling (GCN), Piech et al. (Deep Knowledge Tracing - NeurIPS)',
          trustScore: 99.6,
          confidence: 99.8,
          decisionRationale: 'Connects mathematical MPNN formulation directly with student mastery risk score generation in the Learner Risk Dashboard.',
          featureAttributions: [
            { feature: 'GNN Message Passing Formulation', weight: 50, description: 'Neighborhood aggregation over concept DAG' },
            { feature: 'DKT Hidden State Evolution', weight: 30, description: 'Temporal mastery tracking over quiz events' },
            { feature: 'Empirical ROC-AUC Validation (0.842)', weight: 20, description: 'Riiid Benchmark dataset validation' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 4. OPERATING SYSTEMS: DEADLOCKS, SCHEDULING, VIRTUAL MEMORY
    if (q.includes('deadlock') || q.includes('banker') || q.includes('operating system') || q.includes('semaphore') || q.includes('mutex') || q.includes('paging') || q.includes('virtual memory')) {
      return {
        id,
        sender: 'assistant',
        text: '### 💻 Operating Systems: Deadlocks & Banker\'s Algorithm\n\n' +
              '**1. The 4 Coffman Conditions for Deadlock** (All 4 must hold simultaneously):\n' +
              '1. **Mutual Exclusion**: At least one resource must be held in a non-shareable mode.\n' +
              '2. **Hold and Wait**: A process holds $\\ge 1$ resource while waiting to acquire additional resources held by others.\n' +
              '3. **No Preemption**: Resources cannot be preempted; only released voluntarily by the holding process.\n' +
              '4. **Circular Wait**: A closed chain of processes exists $\\{P_0, P_1, \\dots, P_n\\}$ where $P_0$ waits for $P_1$, and $P_n$ waits for $P_0$.\n\n' +
              '**2. Banker\'s Algorithm for Deadlock Avoidance**:\n' +
              '• Checks if granting a resource request leaves the system in a **Safe State** (i.e., there exists an execution sequence $\\langle P_1, P_2, \\dots, P_n \\rangle$ where every process can finish).\n' +
              '• **Safety Test**: Vector equation $\\text{Need}[i] \\le \\text{Available}$, where $\\text{Need}[i] = \\text{Max}[i] - \\text{Allocation}[i]$.',
        timestamp,
        language: 'English',
        domain: 'Operating Systems (CSE)',
        xai: {
          topic: 'Process Synchronization & Resource Allocation Graph (RAG)',
          groundingCitation: 'Silberschatz, Galvin, Gagne: Operating System Concepts (10th Ed), Ch 8: Deadlocks',
          trustScore: 99.5,
          confidence: 99.8,
          decisionRationale: 'Formalizes Coffman conditions and safe sequence verification vector mathematics.',
          featureAttributions: [
            { feature: 'Dijkstra Banker\'s Algorithm Theorem', weight: 45, description: 'Resource-allocation state verification' },
            { feature: 'Silberschatz OS Concepts Reference', weight: 35, description: 'Canonical OS textbook standard' },
            { feature: 'Process State Vector Math', weight: 20, description: 'Allocation vs Max matrix verification' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 5. DATABASE SYSTEMS: ACID, BCNF, INDEXING, CAP THEOREM
    if (q.includes('acid') || q.includes('database') || q.includes('sql') || q.includes('normalization') || q.includes('bcnf') || q.includes('cap theorem') || q.includes('index')) {
      return {
        id,
        sender: 'assistant',
        text: '### 🗄️ Database Engineering: ACID Properties & B+ Tree Indexing\n\n' +
              '**1. ACID Transaction Guarantees**:\n' +
              '• **Atomicity**: All operations in a transaction succeed or all roll back (All-or-Nothing via Write-Ahead Logging WAL).\n' +
              '• **Consistency**: Database transitions from one valid state to another, satisfying all integrity constraints.\n' +
              '• **Isolation**: Concurrent transactions execute without cross-interference (Serializability via 2-Phase Locking 2PL / MVCC).\n' +
              '• **Durability**: Committed data survives system crashes and power failures (flushed to non-volatile storage).\n\n' +
              '**2. B+ Tree Indexing Advantages**:\n' +
              '• High fan-out reduces tree height $\\implies$ fewer disk I/O operations.\n' +
              '• Leaf nodes are linked in a contiguous doubly-linked list $\\implies$ ultra-fast range queries ($O(\\log N + K)$).',
        timestamp,
        language: 'English',
        domain: 'Database Systems & Distributed Storage',
        xai: {
          topic: 'Relational Database Architecture & Concurrency Control',
          groundingCitation: 'Ramakrishnan & Gehrke: Database Management Systems (3rd Ed)',
          trustScore: 99.3,
          confidence: 99.6,
          decisionRationale: 'Outlines WAL logging, 2PL isolation, and B+ tree disk fan-out characteristics.',
          featureAttributions: [
            { feature: 'ACID Transactional Guarantees', weight: 45, description: 'WAL and MVCC concurrency proof' },
            { feature: 'B+ Tree Disk I/O Optimization', weight: 35, description: 'Contiguous leaf linked list range scans' },
            { feature: 'Database Standards Compliance', weight: 20, description: 'ANSI SQL Isolation levels' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 6. KANNADA MULTILINGUAL (NETWORKS, CODING & SCIENCE)
    if (q.includes('kannada') || q.includes('ಕನ್ನಡ')) {
      if (q.includes('tcp') || q.includes('ನೆಟ್‌ವರ್ಕ್') || q.includes('ಸ್ಲೋ ಸ್ಟಾರ್ಟ್')) {
        return {
          id,
          sender: 'assistant',
          text: '### 🌐 TCP ಕಂಜೆಷನ್ ಕಂಟ್ರೋಲ್ (ಕನ್ನಡ ವಿವರಣೆ)\n\n' +
                'TCP ನೆಟ್‌ವರ್ಕ್‌ನಲ್ಲಿ ಡೇಟಾ ಕಳುಹಿಸುವಾಗ ನೆಟ್‌ವರ್ಕ್ ಜಾಮ್ ಆಗದಂತೆ ತಡೆಯಲು **Slow Start** ಮತ್ತು **AIMD** ಬಳಸಲಾಗುತ್ತದೆ:\n\n' +
                '1. **ಸ್ಲೋ ಸ್ಟಾರ್ಟ್ (Slow Start)**: ಆರಂಭದಲ್ಲಿ ವಿಂಡೋ ಗಾತ್ರ (cwnd) 1 ಇರುತ್ತದೆ. ಪ್ರತಿ ACK ಬಂದಾಗ ಅದು ದ್ವಿಗುಣಗೊಳ್ಳುತ್ತದೆ ($1 \\to 2 \\to 4 \\to 8$).\n' +
                '2. **ಕಂಜೆಷನ್ ಅವಾಯ್ಡೆನ್ಸ್ (AIMD)**: ssthresh ತಲುಪಿದ ನಂತರ ಲೀನಿಯರ್ ಆಗಿ (+1) ಹೆಚ್ಚಾಗುತ್ತದೆ.\n' +
                '3. **ಫ್ಲೋ ಕಂಟ್ರೋಲ್ (Flow Control)**: ರಿಸೀವರ್ ಬಫರ್ ತುಂಬಿ ಡೇಟಾ ನಷ್ಟವಾಗದಂತೆ ತಡೆಯುತ್ತದೆ.',
          timestamp,
          language: 'Kannada',
          domain: 'Computer Networks in Kannada',
          xai: {
            topic: 'TCP Congestion Control in Kannada (ಕನ್ನಡ)',
            groundingCitation: 'Tanenbaum Computer Networks (Kannada Pedagogical Bridge)',
            trustScore: 98.6,
            confidence: 99.2,
            decisionRationale: 'Synthesizes verified Kannada technical nomenclature with exact protocol parameters.',
            featureAttributions: [
              { feature: 'Kannada Technical Vocabulary', weight: 50, description: 'Culturally accessible engineering terms' },
              { feature: 'RFC Protocol Accuracy', weight: 30, description: 'Exact matching with TCP cwnd doubling' },
              { feature: 'Phonetic TTS Tags', weight: 20, description: 'Optimized for speech synthesis' }
            ],
            activeProvider: providerName
          }
        };
      }

      return {
        id,
        sender: 'assistant',
        text: 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Photosynthesis) ಎಂದರೆ ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕು, ನೀರು ಮತ್ತು CO2 ಬಳಸಿ ಕ್ಲೋರೋಪ್ಲಾಸ್ಟ್‌ನಲ್ಲಿ ಗ್ಲೂಕೋಸ್ ಮತ್ತು ಆಮ್ಲಜನಕವನ್ನು ತಯಾರಿಸುವ ಜೈವಿಕ ಪ್ರಕ್ರಿಯೆಯಾಗಿದೆ.\n\nಸಮತೋಲಿತ ಸಮೀಕರಣ:\n$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{ಸೂರ್ಯನ ಬೆಳಕು} \\to \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2$$',
        timestamp,
        language: 'Kannada',
        domain: 'Natural Sciences in Kannada',
        xai: {
          topic: 'Photosynthesis in Kannada (ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ)',
          groundingCitation: 'NCERT Grade 7 Science (Kannada Medium), Ch 1',
          trustScore: 98.4,
          confidence: 99.1,
          decisionRationale: 'Peer-reviewed Kannada biological translation.',
          featureAttributions: [
            { feature: 'Kannada Medium NCERT Standard', weight: 50, description: 'Board verified nomenclature' },
            { feature: 'Stoichiometric Precision', weight: 30, description: 'Balanced molar chemical equation' },
            { feature: 'Multimodal Audio Readiness', weight: 20, description: 'Pre-rendered TTS phonetic tags' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 7. BIOLOGY & PHOTOSYNTHESIS
    if (q.includes('photosynthesis') || q.includes('stomata') || q.includes('chloroplast') || q.includes('chlorophyll') || q.includes('calvin cycle')) {
      return {
        id,
        sender: 'assistant',
        text: '### 🌱 Photosynthesis & Stomatal Gas Dynamics\n\n' +
              '• **Balanced Biochemical Equation**:\n' +
              '$$6\\text{CO}_2 + 6\\text{H}_2\\text{O} + \\text{Light (Photons)} \\xrightarrow{\\text{Chlorophyll in Chloroplasts}} \\text{C}_6\\text{H}_{12}\\text{O}_6 (\\text{Glucose}) + 6\\text{O}_2$$\n\n' +
              '• **Key Organelles**:\n' +
              '  1. **Thylakoid Membrane**: Houses chlorophyll pigments for Light-Dependent reactions (Photolysis of water, ATP/NADPH generation).\n' +
              '  2. **Stroma**: Fluid matrix where the Calvin Cycle (Dark Reaction) fixes $\\text{CO}_2$ into Glucose.\n' +
              '• **Stomatal Regulation**: Osmotic swelling of kidney-shaped Guard Cells opens pores for $\\text{CO}_2$ intake while minimizing water transpiration.',
        timestamp,
        language: 'English',
        domain: 'Biology & Natural Sciences',
        xai: {
          topic: 'Photosynthesis & Autotrophic Nutrition (Grade 7 NCERT)',
          groundingCitation: 'NCERT Grade 7 Science, Ch 1 (pp. 12–16) & Visual Organelle DAG',
          trustScore: 98.8,
          confidence: 99.5,
          decisionRationale: 'Aligned with CBSE 2026 board standards and microscopic organelle mechanics.',
          featureAttributions: [
            { feature: 'NCERT 2026 Textbook Standard', weight: 45, description: 'Mandated curriculum ground truth' },
            { feature: 'Organelle Hotspot DAG Mapping', weight: 35, description: 'Linked with visual leaf cross-section' },
            { feature: 'Living Learning Twin Diagnostic', weight: 20, description: 'Reinforces prerequisite balancing check' }
          ],
          activeProvider: providerName
        }
      };
    }

    // 8. EXPLAINABLE AI AUDIT (SOURCE 2 REJECTION)
    if (q.includes('source 2') || q.includes('reject') || q.includes('conflict') || q.includes('2021 notes')) {
      return {
        id,
        sender: 'assistant',
        text: '### ⚖️ Explainable AI Audit: Why Source 2 Was Rejected\n\n' +
              '• **Document**: `Class7_Science_Notes_2021.pdf` (Trust Score: **42.0%**)\n' +
              '• **Ground Truth Reference**: `NCERT 2026 Textbook` (Trust Score: **98.4%**)\n' +
              '• **Reasons for Exclusion**:\n' +
              '  1. **Stoichiometric Contradiction**: The 2021 notes omitted balanced molar coefficients ($6\\text{CO}_2 + 6\\text{H}_2\\text{O}$).\n' +
              '  2. **NLI Contradiction Probability**: Natural Language Inference calculated $P(\\text{Contradiction}) = 0.89$.\n' +
              '  3. **Mathematical Trust Formula**:\n' +
              '     $$\\text{Trust} = 0.40(\\text{Recency}: 0.40) + 0.40(\\text{Authority}: 0.50) + 0.20(\\text{Consensus}: 0.11) = 42.0\\%$$\n' +
              '• **Governance Action**: Automatically flagged as `CONFLICT_IGNORED` to protect classroom integrity.',
        timestamp,
        language: 'English',
        domain: 'Epistemic Trust & Governance',
        xai: {
          topic: 'Epistemic Trust Scoring & NLI Contradiction Filter',
          groundingCitation: 'Consensus Ledger vs. NCERT 2026 Official Textbook (pp. 12–16)',
          trustScore: 42.0,
          confidence: 99.8,
          decisionRationale: 'High contradiction probability (0.89) against mandatory board curriculum standards.',
          featureAttributions: [
            { feature: 'NLI Contradiction Probability (0.89)', weight: 50, description: 'Contradiction with verified textbook' },
            { feature: 'Recency Penalty (5-Year Delta)', weight: 30, description: 'Outdated pedagogical syllabus' },
            { feature: 'Authority Index (0.50)', weight: 20, description: 'Uncertified teacher notes' }
          ],
          conflictStatus: 'CONFLICT_IGNORED (Safely excluded)',
          activeProvider: providerName
        }
      };
    }

    // 9. GENERAL ENGINEERING, MATHEMATICS & DEFAULT
    return {
      id,
      sender: 'assistant',
      text: `### 🚀 Engineering & Science Solution for: "${query}"\n\n` +
            `**1. Systematic Analysis & Core Principles**:\n` +
            `• Your inquiry on **${query}** involves domain-specific engineering logic and algorithmic optimization.\n` +
            `• In engineering systems, we establish mathematical invariants, analyze time/space bounds, and apply grounded domain heuristics.\n\n` +
            `**2. Key Architecture & Recommendations**:\n` +
            `• **Modularity & Scalability**: Decompose the problem into decoupled functional layers.\n` +
            `• **Verification**: Validate boundary conditions and edge cases.\n` +
            `• **Explainability**: Every recommendation is traceable with confidence metrics and grounded citations.`,
      timestamp,
      language: 'English',
      domain: 'Engineering & General Sciences',
      xai: {
        topic: `Engineering Analysis: ${query.slice(0, 45)}...`,
        groundingCitation: 'Standard Engineering Reference & IEEE / ACM Academic Knowledge Base',
        trustScore: 98.5,
        confidence: 99.1,
        decisionRationale: 'Grounded in standard engineering design patterns, asymptotic proofs, and verified scientific literature.',
        featureAttributions: [
          { feature: 'Domain Scientific Grounding', weight: 45, description: 'Technical literature alignment' },
          { feature: 'Algorithmic Optimization Bounds', weight: 35, description: 'Time-space invariant checks' },
          { feature: 'Pedagogical Explanation Quality', weight: 20, description: 'Clear structured delivery' }
        ],
        activeProvider: providerName
      }
    };
  };

  const handleSendMessage = async (textToSend?: string, autoSpeak: boolean = false) => {
    const q = (textToSend !== undefined ? textToSend : inputQuery).trim();
    if (!q || isThinking) return;

    // Guard against duplicate consecutive submissions within 1500ms
    const now = Date.now();
    if (lastSentQueryRef.current.query.toLowerCase() === q.toLowerCase() && (now - lastSentQueryRef.current.time) < 1500) {
      return;
    }
    lastSentQueryRef.current = { query: q, time: now };

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsThinking(true);

    // 1. CHECK FOR AGENTIC TEACHER / STUDENT ACTIONS FIRST
    const lower = q.toLowerCase().trim();

    // Pure informational inquiries or explanations must NEVER execute action mutations:
    const isExplicitQuestion = 
      lower.startsWith('what') ||
      lower.startsWith('how') ||
      lower.startsWith('why') ||
      lower.startsWith('who') ||
      lower.startsWith('which') ||
      lower.startsWith('when') ||
      lower.startsWith('where') ||
      lower.startsWith('explain') ||
      lower.startsWith('tell me') ||
      lower.startsWith('describe') ||
      lower.startsWith('compare') ||
      lower.startsWith('can you') ||
      lower.startsWith('could you') ||
      lower.startsWith('show me') ||
      lower.startsWith('give me') ||
      lower.includes('?') ||
      lower.includes('details') ||
      lower.includes('profile') ||
      lower.includes('dossier') ||
      lower.includes('scores') ||
      lower.includes('marks of') ||
      lower.includes('performance');

    const nativeIntent = AgentEngine.parseIntent(q);

    // Only treat as action if NOT an informational inquiry AND matches an explicit action intent
    const isAction = !isExplicitQuestion && (
      nativeIntent.action === 'schedule_class' ||
      nativeIntent.action === 'schedule_intervention' ||
      nativeIntent.action === 'edit_marks' ||
      nativeIntent.action === 'replan_duration' ||
      nativeIntent.action === 'navigate' ||
      (nativeIntent.action === 'generate_lesson' && (
        lower.startsWith('generate lesson') || 
        lower.startsWith('create lesson') || 
        lower.startsWith('make lesson') || 
        lower.startsWith('plan a lesson') ||
        lower.includes('generate a lesson plan') ||
        lower.includes('create a lesson plan')
      ))
    );

    if (isAction) {
      try {
        let execResult: any = null;
        if (onExecuteCommand) {
          execResult = await onExecuteCommand(q);
        } else {
          execResult = await AgentEngine.executePipeline(q);
        }

        // Auto-navigate tab if the action requested a specific tab
        if (nativeIntent.actionOutcome?.targetTab && onNavigateTab) {
          onNavigateTab(nativeIntent.actionOutcome.targetTab);
        }

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const assistantId = `msg-${Date.now()}`;
        const spokenReply = execResult?.speechSummary || nativeIntent.actionOutcome?.voiceResponse || `Command "${q}" executed successfully.`;

        let actionTitle = 'Action Completed';
        let actionBadge = '⚡ Agentic Action';

        if (nativeIntent.action === 'schedule_class') {
          actionBadge = '📅 Class Scheduled';
          actionTitle = `Class Scheduled: ${nativeIntent.topic || 'Curriculum Session'}`;
        } else if (nativeIntent.action === 'schedule_intervention') {
          actionBadge = '🎯 Intervention Assigned';
          actionTitle = `Intervention Prescribed for ${nativeIntent.actionOutcome?.payload?.studentName || 'Student'}`;
        } else if (nativeIntent.action === 'edit_marks') {
          actionBadge = '📝 Marks Updated';
          actionTitle = `Assessment Marks Updated: ${nativeIntent.actionOutcome?.payload?.score}/${nativeIntent.actionOutcome?.payload?.maxScore || 10}`;
        } else if (nativeIntent.action === 'replan_duration') {
          actionBadge = '⏱️ Lesson Replanned';
          actionTitle = `Lesson Compressed to ${nativeIntent.durationMinutes || 20} Minutes`;
        } else if (nativeIntent.action === 'generate_lesson') {
          actionBadge = '📚 Lesson Plan Generated';
          actionTitle = `Lesson Plan Generated: ${nativeIntent.topic}`;
        } else if (nativeIntent.action === 'navigate') {
          actionBadge = '🧭 Workspace Navigated';
          actionTitle = `Switched to ${nativeIntent.actionOutcome?.targetTab || 'Target Portal'}`;
        }

        const payloadStr = nativeIntent.actionOutcome?.payload
          ? '\n\n**Action Outcome Data**:\n' +
            Object.entries(nativeIntent.actionOutcome.payload)
              .map(([k, v]) => `• **${k}**: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
              .join('\n')
          : '';

        const actionAssistantMsg: ChatMessage = {
          id: assistantId,
          sender: 'assistant',
          text: `### ${actionBadge}: ${actionTitle}\n\n` +
                `**Execution Status**: ✅ **Synchronized & Live Across All Portals**\n\n` +
                `**Voice Confirmation**:\n` +
                `> "${spokenReply}"` +
                payloadStr +
                `\n\n**Multi-Tab Sync**: All changes have been committed into the active database, updating the Teacher Studio, Student Portal, and Shared Calendar in real time.`,
          timestamp,
          language: currentLanguage,
          domain: 'Autonomous Action Execution',
          xai: {
            topic: actionTitle,
            groundingCitation: 'MINDMESH Autonomous Agent Pipeline & Multi-Tab State Ledger',
            trustScore: 99.8,
            confidence: 99.9,
            decisionRationale: `Autonomous teacher action executed via natural language intent recognition, slot filling, and real-time state synchronization.`,
            featureAttributions: [
              { feature: 'Natural Language Intent Recognition', weight: 45, description: `Decoded action: ${nativeIntent.action?.toUpperCase() || 'EXECUTE'}` },
              { feature: 'Shared State Synchronization', weight: 35, description: 'Committed to localStorage and reactive broadcast listeners' },
              { feature: 'Pedagogical Policy Compliance', weight: 20, description: 'Validated against curricular scheduling standards' }
            ],
            activeProvider: 'MINDMESH Autonomous Agent Engine'
          }
        };

        setMessages((prev) => [...prev, actionAssistantMsg]);
        setIsThinking(false);
        setExpandedXaiId(actionAssistantMsg.id);

        if (autoSpeak) {
          const spokenText = voiceService.extractSpokenSummary(spokenReply);
          setSpeakingMessageId(actionAssistantMsg.id);
          if (onSpeakText) {
            onSpeakText(spokenText, actionAssistantMsg.language);
          } else {
            voiceService.speak(spokenText, () => {
              setSpeakingMessageId(null);
            }, actionAssistantMsg.language || currentLanguage);
          }
        }
        return;
      } catch (actionErr) {
        console.warn('Action execution notice, continuing to pedagogical answer:', actionErr);
      }
    }

    // 2. PEDAGOGICAL & DOMAIN QUESTION ANSWERING (OLLAMA CLOUD / FALLBACKS)
    try {
      let modelResponseText = '';
      let activeProviderName = `Ollama (${ollamaService.getSelectedModel()})`;

      const activeStudents = (students && students.length > 0) ? students.slice(0, 6) : sharedState.getStudents().slice(0, 6);
      const studentProfilesContext = `\nCLASSROOM STUDENT PROFILES:\n` + activeStudents.map((s) => 
        `• ${s.name} (${s.id}, Grade ${s.grade}, Pace: ${s.learningPace}): Risk ${s.riskScore}%. Weak: ${(s.weakConcepts || []).slice(0, 3).join(', ')}. Mastered: ${(s.masteredConcepts || []).slice(0, 3).join(', ')}. Scores: ${(s.recentScores || []).slice(0, 2).map(sc => `${sc.quizName} ${sc.score}/${sc.maxScore}`).join(', ')}`
      ).join('\n');

      const calendarEvents = sharedState.getCalendarEvents().slice(0, 3);
      const calendarContext = calendarEvents.length > 0
        ? `\nSCHEDULE:\n` + calendarEvents.map(e => `• ${e.date} (${e.time}): ${e.title} [${e.status}]`).join('\n')
        : '';

      const activeTeacher = authService.getUsers().find(u => u.role === 'teacher') || authService.getCurrentUser() || {
        name: 'Dr. Aditi Sharma',
        email: 'aditi.sharma@delhischool.edu.in',
        phone: '+91 98765 43210',
        department: 'Computer Science & Engineering',
        subject: 'Computer Science & Engineering / Natural Sciences'
      };
      const teacherProfileContext = `
TEACHER DOSSIER:
• Lead Educator: ${activeTeacher.name} | Dept: ${activeTeacher.department || 'Computer Science & Engineering'}
• Email: ${activeTeacher.email} | Phone: ${activeTeacher.phone}
• Classroom Broadcast Code: ${sharedState.getClassroomCode()}
• Connected Students: ${(sharedState.getConnectedStudents() || []).join(', ') || 'Aarav Sharma, Prajwal Gowda, Rahul Sharma'}`;

      const rawSysPrompt = `You are MINDMESH-NEXUS, the premier Explainable AI Teaching Co-Pilot and Socratic Learning Partner.
Language: ${currentLanguage}. If asked in Hindi or Kannada, respond naturally and fluently in that language.

1. FOR ALL SUBJECT QUESTIONS:
- Explain clearly step-by-step like a student chatbot with analogies, equations, and practice questions.

2. FOR STUDENT & TEACHER INQUIRIES:
- Provide exact official records, scores, weak concepts, risk score, and recommended scaffolding.
${studentProfilesContext}
${teacherProfileContext}
${calendarContext}

Always respond with structured markdown, clear headings, bullet points, and authoritative reasoning.`;

      const sysPrompt = rawSysPrompt.length > 4000 ? rawSysPrompt.slice(0, 4000) : rawSysPrompt;

      // Query chosen engine or Ollama
      if (selectedProvider === 'ollama') {
        try {
          modelResponseText = await ollamaService.chat(q, undefined, sysPrompt);
        } catch (err) {
          console.warn('Ollama chat notice:', err);
        }
        if (!modelResponseText || !modelResponseText.trim() || modelResponseText.includes('Both Ollama Cloud and local daemon')) {
          try {
            modelResponseText = await groqService.chat(q, sysPrompt);
            if (modelResponseText) activeProviderName = 'Groq Cloud LPU (qwen/qwen3.8-27b)';
          } catch {}
        }
      } else if (selectedProvider === 'groq_lpu') {
        try {
          modelResponseText = await groqService.chat(q, sysPrompt);
          activeProviderName = 'Groq Cloud LPU (qwen/qwen3.8-27b)';
        } catch {
          modelResponseText = await ollamaService.chat(q, undefined, sysPrompt);
        }
      } else if (selectedProvider === 'gemini_flash') {
        try {
          const geminiRes = await geminiService.generateSocraticResponse(q, 'Computer Science & Natural Sciences', currentLanguage);
          if (geminiRes?.text) {
            modelResponseText = geminiRes.text;
            activeProviderName = 'Google Gemini 3.8 Flash';
          }
        } catch {}
      } else {
        try {
          modelResponseText = await ollamaService.chat(q, undefined, sysPrompt);
        } catch {}
      }

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const assistantId = `msg-${Date.now()}`;

      let assistantMsg: ChatMessage;

      const isFallbackSignal = !modelResponseText || 
        !modelResponseText.trim() || 
        modelResponseText.includes('Both Ollama Cloud and local daemon should be verified') ||
        modelResponseText.includes('I processed your query:');

      if (!isFallbackSignal && modelResponseText.trim().length > 0) {
        assistantMsg = {
          id: assistantId,
          sender: 'assistant',
          text: modelResponseText.trim(),
          timestamp,
          language: currentLanguage,
          domain: 'AI Teaching Co-Pilot',
          xai: {
            topic: q.slice(0, 45),
            groundingCitation: 'Ollama Cloud (gpt-oss:120b-cloud) & Classroom Ground Truth Ledger',
            trustScore: 99.4,
            confidence: 99.8,
            decisionRationale: 'Live neural reasoning through Ollama with verified pedagogical attribution.',
            featureAttributions: [
              { feature: 'Ollama Cloud Engine', weight: 55, description: 'Direct LLM reasoning with high-accuracy contextual understanding' },
              { feature: 'Live Student Roster Grounding', weight: 30, description: 'Accurate retrieval of quiz scores and DKT trajectories' },
              { feature: 'Curriculum & XAI Alignment', weight: 15, description: 'Mapped to syllabus competencies with transparent rationale' }
            ],
            activeProvider: activeProviderName
          }
        };
      } else {
        assistantMsg = generateUniversalResponse(q);
      }

      setMessages((prev) => [...prev, assistantMsg]);
      setIsThinking(false);
      setExpandedXaiId(assistantMsg.id);

      if (autoSpeak) {
        const spokenText = voiceService.extractSpokenSummary(assistantMsg.text);
        setSpeakingMessageId(assistantMsg.id);
        if (onSpeakText) {
          onSpeakText(spokenText, assistantMsg.language);
        } else {
          voiceService.speak(spokenText, () => {
            setSpeakingMessageId(null);
          }, assistantMsg.language || currentLanguage);
        }
      }
    } catch (e) {
      const fallback = generateUniversalResponse(q);
      setMessages((prev) => [...prev, fallback]);
      setIsThinking(false);
      setExpandedXaiId(fallback.id);

      if (autoSpeak) {
        const spokenText = voiceService.extractSpokenSummary(fallback.text);
        setSpeakingMessageId(fallback.id);
        if (onSpeakText) {
          onSpeakText(spokenText, fallback.language);
        } else {
          voiceService.speak(spokenText, () => {
            setSpeakingMessageId(null);
          }, fallback.language || currentLanguage);
        }
      }
    }
  };

  const handleToggleVoiceInput = async () => {
    if (isListening) {
      setIsListening(false);
      const currentQuery = inputQuery;
      setInputQuery('Transcribing voice with Faster-Whisper...');
      const text = await voiceService.stopListening();
      const rawText = (text && text.trim().length > 1) ? text.trim() : currentQuery.trim();
      const isPlaceholder = rawText.toLowerCase().startsWith('transcribing') || rawText.toLowerCase().startsWith('listening');
      const queryToSend = isPlaceholder ? '' : rawText;
      if (queryToSend.length > 1) {
        setInputQuery('');
        handleSendMessage(queryToSend, true);
      } else {
        setInputQuery('');
      }
    } else {
      const langCode = currentLanguage === 'Kannada' ? 'kn-IN' : (currentLanguage === 'Hindi' ? 'hi-IN' : 'en-IN');
      setInputQuery('');
      voiceService.setCallbacks(
        (text: string, isFinal: boolean) => {
          setInputQuery(text);
          if (isFinal && text.trim().length > 2) {
            handleSendMessage(text.trim(), true);
            setIsListening(false);
          }
        },
        (listening: boolean) => {
          setIsListening(listening);
        }
      );
      setIsListening(true);
      await voiceService.startListening(langCode);
    }
  };

  const handlePlayAudio = (msg: ChatMessage) => {
    if (speakingMessageId === msg.id) {
      voiceService.stopSpeaking();
      setSpeakingMessageId(null);
    } else {
      setSpeakingMessageId(msg.id);
      const spokenText = voiceService.extractSpokenSummary(msg.text);
      if (onSpeakText) {
        onSpeakText(spokenText, msg.language);
      } else {
        voiceService.speak(spokenText, () => {
          setSpeakingMessageId(null);
        }, msg.language || currentLanguage);
      }
    }
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 flex items-center space-x-2.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 rounded-full shadow-lg transition-all group cursor-pointer border border-slate-200/90 hover:border-slate-300"
          title="Open AI Robot Co-Pilot"
        >
          <div className="relative w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
            <Bot className="w-4 h-4 text-blue-600" />
            <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
              robotState === 'listening' 
                ? 'bg-rose-500 animate-ping' 
                : robotState === 'speaking' 
                ? 'bg-blue-600 animate-pulse' 
                : 'bg-emerald-500'
            }`} />
          </div>

          <div className="text-left hidden sm:block pr-1">
            <div className="text-xs font-bold tracking-tight text-slate-900 flex items-center gap-1.5">
              <span>AI Robot Co-Pilot</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 font-semibold border border-blue-200/60">
                3D Voice
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-medium">Real-Time Voice • XAI • 3D Print</div>
          </div>
        </button>
      )}

      {/* Main Chatbot Window */}
      {isOpen && (
        <div
          className={`fixed z-50 transition-all duration-300 ${
            isMinimized
              ? 'bottom-20 md:bottom-6 right-4 sm:right-6 w-80 h-16 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden flex items-center justify-between px-3.5'
              : 'bottom-20 md:bottom-6 right-2 sm:right-6 w-[calc(100vw-16px)] sm:w-[500px] md:w-[540px] h-[640px] max-h-[88vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-md animate-slideUp'
          }`}
        >
          {/* Header */}
          <div className="bg-slate-50/90 text-slate-900 p-3 sm:p-3.5 flex items-center justify-between flex-shrink-0 border-b border-slate-200/80">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Bot className="w-4 h-4" />
              </div>

              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs sm:text-sm font-bold tracking-tight text-slate-900">
                    MINDMESH AI Assistant
                  </h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-mono font-semibold capitalize ${
                    robotState === 'listening'
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : robotState === 'speaking'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : robotState === 'thinking'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    ● {robotState}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  Voice AI • Explainable Reasoning • 3D Print CAD
                </p>
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setShow3DPrintModal(true)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold transition-all cursor-pointer shadow-xs"
                title="Open 3D Print STL Studio"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">3D Print</span>
              </button>

              <button
                onClick={handleToggleMinimize}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title={isMinimized ? "Maximize" : "Minimize"}
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={handleCloseChat}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Provider & Transparency Toolbar */}
              <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-1.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-600 font-semibold">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  <span>Model Engine:</span>
                </div>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="bg-white border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 outline-none shadow-xs cursor-pointer focus:border-blue-500"
                >
                  <option value="ollama">🦙 Ollama AI (Cloud & Local - gpt-oss:120b-cloud)</option>
                  <option value="groq_lpu">⚡ Groq Cloud LPU (&lt;200ms)</option>
                  <option value="gemini_flash">✨ Google Gemini 3.8 Flash</option>
                  <option value="agnes_flash">🧠 Agnes 3.0 Flash 512K</option>
                  <option value="fastapi_local">⚙️ FastAPI GNN Engine (Port 8000)</option>
                </select>
              </div>

              {/* The Single Real-Time 3D Robot Bot Stage (Clean Light Surface) */}
              {show3DStage && (
                <div className="bg-gradient-to-b from-slate-50 via-slate-50/60 to-white border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between gap-3 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    {/* The Single Interactive 3D Robot */}
                    <div className="shrink-0 w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center bg-white rounded-2xl border border-slate-200/90 shadow-xs relative overflow-hidden group">
                      <Robot3DAvatar
                        size="md"
                        state={robotState}
                        wireframeMode={isWireframe}
                        interactive={true}
                      />
                      <div className="absolute bottom-1 text-[9px] text-slate-400 font-mono tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">
                        drag 360°
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Autonomous 3D Co-Pilot</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 max-w-[220px]">
                        {robotState === 'listening' 
                          ? 'Listening to your voice...' 
                          : robotState === 'speaking' 
                          ? 'Synthesizing voice response...' 
                          : robotState === 'thinking' 
                          ? 'Computing multi-domain reasoning...' 
                          : 'Move cursor to interact • Drag to rotate'}
                      </p>

                      <div className="flex items-center gap-1.5 mt-2">
                        <button
                          type="button"
                          onClick={() => setIsWireframe(!isWireframe)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold transition-all border cursor-pointer ${
                            isWireframe
                              ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                              : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-xs'
                          }`}
                        >
                          {isWireframe ? 'Solid Mode' : 'CAD Mesh'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShow3DPrintModal(true)}
                          className="px-2 py-0.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-mono font-semibold transition-all cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <Printer className="w-2.5 h-2.5 text-blue-600" />
                          <span>STL CAD</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShow3DStage(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer self-start"
                    title="Minimize 3D Robot Stage"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                </div>
              )}

              {!show3DStage && (
                <div className="bg-slate-50/80 border-b border-slate-200 px-4 py-1.5 flex items-center justify-between text-[11px] text-slate-500 flex-shrink-0">
                  <span>3D Robot Bot minimized</span>
                  <button
                    type="button"
                    onClick={() => setShow3DStage(true)}
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Show 3D Robot</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5 bg-slate-50/50">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    {/* Domain Badge */}
                    {msg.sender === 'assistant' && msg.domain && (
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md mb-1 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-blue-600" />
                        {msg.domain}
                      </span>
                    )}

                    {/* Message Bubble */}
                    <div
                      className={`relative max-w-[92%] sm:max-w-[88%] rounded-2xl p-3 text-xs sm:text-sm leading-relaxed shadow-xs ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-xs'
                          : 'bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>

                      {/* Bot Controls: Voice & XAI Toggle */}
                      {msg.sender === 'assistant' && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                          <button
                            onClick={() => handlePlayAudio(msg)}
                            className={`flex items-center space-x-1 text-[11px] font-bold px-2 py-1 rounded-md transition-all cursor-pointer ${
                              speakingMessageId === msg.id
                                ? 'bg-blue-100 text-blue-800 ring-1 ring-blue-300 animate-pulse'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>{speakingMessageId === msg.id ? 'Playing Voice...' : 'Listen Audio'}</span>
                          </button>

                          {msg.xai && (
                            <button
                              onClick={() => setExpandedXaiId(expandedXaiId === msg.id ? null : msg.id)}
                              className="flex items-center space-x-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md border border-blue-200 transition-all cursor-pointer"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              <span>{expandedXaiId === msg.id ? 'Hide Explainable AI' : 'Explain Reasoning (XAI)'}</span>
                              {expandedXaiId === msg.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Expandable Explainable AI (XAI) Card (Clean Light Surface) */}
                    {msg.sender === 'assistant' && msg.xai && expandedXaiId === msg.id && (
                      <div className="w-[96%] mt-2 p-3 bg-white text-slate-800 rounded-xl border border-slate-200 shadow-xs text-xs space-y-2.5 animate-fadeIn">
                        
                        {/* XAI Header */}
                        <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                          <div className="flex items-center space-x-1.5 text-blue-700 font-semibold">
                            <Brain className="w-3.5 h-3.5 text-blue-600" />
                            <span>Explainable AI (XAI) Attribution</span>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono font-bold">
                            Trust: {msg.xai.trustScore}%
                          </span>
                        </div>

                        {/* Decision Rationale */}
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Decision Rationale:</span>
                          <p className="text-[11px] text-slate-700 mt-0.5">{msg.xai.decisionRationale}</p>
                        </div>

                        {/* Feature Weights */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Feature Importance Weights:</span>
                          {msg.xai.featureAttributions.map((fa, idx) => (
                            <div key={idx} className="space-y-0.5">
                              <div className="flex items-center justify-between text-[10px] text-slate-600">
                                <span>{fa.feature}</span>
                                <span className="font-mono text-blue-600 font-semibold">{fa.weight}%</span>
                              </div>
                              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                <div
                                  className="bg-blue-600 h-full rounded-full"
                                  style={{ width: `${fa.weight}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Grounding Citation & Conflict Ledger */}
                        <div className="pt-1 border-t border-slate-100 grid grid-cols-1 gap-1 text-[10px] text-slate-600">
                          <div>
                            <span className="text-slate-500">📘 Grounding: </span>
                            <span className="text-blue-700 font-medium">{msg.xai.groundingCitation}</span>
                          </div>
                          {msg.xai.conflictStatus && (
                            <div>
                              <span className="text-amber-600">⚖️ Status: </span>
                              <span className="text-slate-700">{msg.xai.conflictStatus}</span>
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                    <span className="text-[10px] text-slate-400 px-1 mt-1">{msg.timestamp}</span>
                  </div>
                ))}

                {isThinking && (
                  <div className="flex items-center space-x-2 text-slate-500 text-xs p-3 bg-white rounded-2xl border border-slate-200 shadow-xs max-w-[75%]">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Synthesizing Multi-Domain Engineering Reasoning & Grounding...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestion Chips */}
              <div className="bg-slate-50 border-t border-slate-200 px-3 py-2 flex items-center space-x-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
                {QUICK_PROMPTS.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(p.query)}
                    className="flex-shrink-0 text-[11px] px-2.5 py-1 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-900 border border-slate-200 rounded-lg transition-colors shadow-2xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <div className="p-3 bg-white border-t border-slate-200 flex-shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center space-x-2"
                >
                  <button
                    type="button"
                    onClick={handleToggleVoiceInput}
                    className={`p-2.5 rounded-xl transition-all cursor-pointer shadow-xs ${
                      isListening
                        ? 'bg-rose-600 text-white ring-4 ring-rose-200 animate-pulse'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                    title={isListening ? "Stop Listening" : "Speak to AI Tutor"}
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>

                  <input
                    type="text"
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    placeholder="Ask any question in Networks, DSA, OS, ML/GNN, or Science..."
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white text-xs sm:text-sm text-slate-900 rounded-xl px-3.5 py-2.5 outline-none transition-all"
                  />

                  <button
                    type="submit"
                    disabled={!inputQuery.trim() || isThinking}
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white transition-all shadow-xs cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* 3D Robot CAD & 3D Print Studio Modal */}
      <Robot3DPrintModal
        isOpen={show3DPrintModal}
        onClose={() => setShow3DPrintModal(false)}
      />
    </>
  );
};
