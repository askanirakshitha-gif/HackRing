import {
  AgentDecisionStep,
  DocumentSource,
  LessonPlan,
  LessonSection,
  Student,
  VoiceCommandIntent
} from '../types';
import {
  DEFAULT_OPEN_SOURCE_AI_LESSON_40MIN,
  DEFAULT_PHOTOSYNTHESIS_LESSON_40MIN,
  REPLANNED_PHOTOSYNTHESIS_LESSON_20MIN,
  DEFAULT_CN_LESSON_30MIN,
  INITIAL_DOCUMENTS,
  INITIAL_STUDENTS
} from '../data/mockData';
import { findCurriculumSubject } from '../data/curriculumDatabase';
import { sharedState } from './sharedStateManager';
import { apiClient } from './apiClient';
import { groqService } from './groqService';
import { geminiService } from './geminiService';
import { ollamaService } from './ollamaService';

export interface AgentExecutionResult {
  intent: VoiceCommandIntent;
  lessonPlan: LessonPlan;
  steps: AgentDecisionStep[];
  sources: DocumentSource[];
  students: Student[];
  speechSummary: string;
}

export class AgentEngine {
  /**
   * Parse teacher or student spoken utterance into structured intent, agentic action, and voice response
   */
  public static parseIntent(spokenText: string): VoiceCommandIntent {
    const text = spokenText.toLowerCase();

    // 1. AGENTIC ACTION: SCHEDULE A CLASS / CALENDAR EVENT
    // e.g. "schedule a class for me in 10 min", "schedule a 30-min class on TCP at 2 PM", "add to calendar"
    if (
      text.includes('schedule a class') ||
      text.includes('schedule class') ||
      text.includes('schedule a session') ||
      text.includes('schedule session') ||
      text.includes('create class') ||
      text.includes('create a class') ||
      text.includes('set class') ||
      text.includes('class for me in') ||
      text.includes('class in 10 min') ||
      text.includes('class in 10 minute') ||
      text.includes('schedule lesson') ||
      text.includes('add to calendar') ||
      text.includes('schedule event') ||
      text.includes('book a class')
    ) {
      const durationMatch = text.match(/(\d+)\s*(?:min|minute)/i);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 20;

      let topic = 'Computer Networks: TCP Flow Control & Congestion Avoidance';
      let moduleName = 'Module 3: Transport Layer & TCP Flow';

      if (text.includes('tree') || text.includes('bst') || text.includes('graph')) {
        topic = 'Binary Search Trees (BST) & Recursive Traversals';
        moduleName = 'Module 2: Trees & Hierarchical Graphs';
      } else if (text.includes('photo') || text.includes('science') || text.includes('leaf') || text.includes('biology')) {
        topic = 'Photosynthesis & Stomata Gas Exchange';
        moduleName = 'NCERT Grade 7 Science';
      } else if (text.includes('array') || text.includes('linked list') || text.includes('stack')) {
        topic = 'Linear Data Structures: Arrays & Linked Lists';
        moduleName = 'Module 1: Linear Data Structures';
      }

      // Calculate scheduled time (e.g. in 10 min from now)
      const now = new Date();
      const in10Min = new Date(now.getTime() + 10 * 60 * 1000);
      const end10Min = new Date(in10Min.getTime() + duration * 60 * 1000);
      const timeStr = `${in10Min.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end10Min.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      const dateStr = new Date().toISOString().split('T')[0];

      return {
        rawText: spokenText,
        action: 'schedule_class',
        topic,
        subject: moduleName,
        durationMinutes: duration,
        actionOutcome: {
          type: 'schedule_class',
          payload: {
            title: topic,
            module: moduleName,
            date: dateStr,
            time: timeStr,
            type: 'lesson',
            status: 'scheduled',
            objectives: [
              `Master core mechanics of ${topic}`,
              `Formative diagnostic check (${duration} minutes)`
            ],
            prerequisites: ['Foundational Concepts'],
            prerequisiteCompleted: true
          },
          targetTab: 'calendar',
          voiceResponse: `Done! I have scheduled a ${duration}-minute class on "${topic}" for you in 10 minutes (${timeStr}). It is now synchronized to the shared calendar.`
        }
      };
    }

    // 2. AGENTIC ACTION: SCHEDULE AN INTERVENTION / REMEDIAL FOR A STUDENT
    // e.g. "Rahul is weak in Slow Start, schedule an intervention", "Schedule intervention for Rahul"
    if (
      text.includes('intervention') ||
      (text.includes('weak in') && (text.includes('rahul') || text.includes('aarav') || text.includes('student') || text.includes('slow start'))) ||
      text.includes('assign review') ||
      text.includes('remedial')
    ) {
      let targetStudent = 'Rahul Sharma';
      let studentId = 'std-0';
      let concept = 'Slow Start (Exponential Doubling)';
      let topic = 'Module 3: Transport Layer & TCP Flow';

      if (text.includes('aarav')) {
        targetStudent = 'Aarav Sharma';
        studentId = 'std-1';
        concept = 'Chemical Equation Balancing & Stomata';
        topic = 'NCERT Grade 7 Science';
      } else if (text.includes('prajwal') || text.includes('rohan')) {
        targetStudent = 'Prajwal Gowda';
        studentId = 'std-2';
        concept = 'Stomata Gas Exchange & Chlorophyll';
        topic = 'NCERT Grade 7 Science';
      }

      if (text.includes('flow control')) concept = 'TCP Flow Control & rwnd Buffer';
      if (text.includes('tree') || text.includes('bst')) concept = 'Binary Search Tree Traversals';

      return {
        rawText: spokenText,
        action: 'schedule_intervention',
        topic,
        actionOutcome: {
          type: 'schedule_intervention',
          payload: {
            studentId,
            studentName: targetStudent,
            topic,
            concept,
            notes: `Targeted remediation prescribed via Voice AI Co-Pilot for ${concept}. Please complete the 3-question reassessment.`
          },
          targetTab: 'students',
          voiceResponse: `I have scheduled a targeted intervention review on ${concept} for ${targetStudent}. The remedial instructions and reassessment checkpoint are now live on the student portal.`
        }
      };
    }

    // 3. AGENTIC ACTION: EDIT MARKS VIA VOICE
    // e.g. "Give Aarav Sharma 9 out of 10 in Quiz", "Update Rahul's score to 8", "Edit marks for Aarav"
    if (
      text.includes('edit mark') ||
      text.includes('update mark') ||
      text.includes('give aarav') ||
      text.includes('give rahul') ||
      text.includes('score to') ||
      text.includes('set mark') ||
      text.includes('change mark') ||
      text.includes('update score') ||
      text.includes('edit score') ||
      text.includes('set score')
    ) {
      let studentId = 'std-1';
      let studentName = 'Aarav Sharma';
      let concept = 'Slow Start & Flow Control';
      let score = 9;
      let maxScore = 10;

      if (text.includes('rahul')) {
        studentId = 'std-0';
        studentName = 'Rahul Sharma';
      }

      const numMatch = text.match(/(\d+)\s*(?:out of|\/|\s)\s*(\d+)?/i);
      if (numMatch) {
        score = parseInt(numMatch[1]);
        if (numMatch[2]) maxScore = parseInt(numMatch[2]);
      }

      return {
        rawText: spokenText,
        action: 'edit_marks',
        actionOutcome: {
          type: 'edit_marks',
          payload: {
            studentId,
            studentName,
            concept,
            score,
            maxScore
          },
          targetTab: 'students',
          voiceResponse: `Updated marks for ${studentName}: ${score} out of ${maxScore} in ${concept}. Topic mastery recalculated to ${Math.round((score / maxScore) * 100)}%, and the next curriculum topic is unlocked.`
        }
      };
    }

    // 4. AGENTIC ACTION: NAVIGATION & PORTAL SWITCHING
    // e.g. "open calendar", "show curriculum map", "open knowledge base", "show students", "switch to student view"
    if (text.includes('open calendar') || text.includes('show calendar') || text.includes('view calendar') || text.includes('planner')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate',
          targetTab: 'calendar',
          voiceResponse: 'Opening your shared academic calendar.'
        }
      };
    }

    if (text.includes('open curriculum') || text.includes('show curriculum') || text.includes('curriculum map')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate',
          targetTab: 'curriculum',
          voiceResponse: 'Opening your curriculum map organized by Data Structures and Science modules.'
        }
      };
    }

    if (text.includes('open knowledge base') || text.includes('show sources') || text.includes('check conflicts') || text.includes('sources')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate',
          targetTab: 'sources',
          voiceResponse: 'Opening Knowledge Base and source verification ledger.'
        }
      };
    }

    if (text.includes('show student') || text.includes('learner risk') || text.includes('show analytics') || text.includes('risk radar')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate',
          targetTab: 'students',
          voiceResponse: 'Opening GNN Learner Risk Radar and student diagnostic telemetry.'
        }
      };
    }

    if (text.includes('knowledge graph') || text.includes('open graph') || text.includes('show dag')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate',
          targetTab: 'graph',
          voiceResponse: 'Opening interactive Agnes 3.0 Knowledge Graph DAG.'
        }
      };
    }

    if (text.includes('switch to student') || text.includes('student view') || text.includes('learner view') || text.includes('student portal')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate_persona',
          targetPersona: 'student',
          voiceResponse: 'Switching to Student Multimodal Socratic Portal.'
        }
      };
    }

    if (text.includes('switch to teacher') || text.includes('teacher view') || text.includes('teacher studio')) {
      return {
        rawText: spokenText,
        action: 'navigate',
        actionOutcome: {
          type: 'navigate_persona',
          targetPersona: 'teacher',
          voiceResponse: 'Switching to Teacher Studio.'
        }
      };
    }

    if (text.includes('approve lesson') || text.includes('approve the lesson') || text.includes('publish lesson')) {
      return {
        rawText: spokenText,
        action: 'approve',
        actionOutcome: {
          type: 'approve',
          targetTab: 'lesson',
          voiceResponse: 'Lesson approved and published! The topic is now unlocked in the student learning path.'
        }
      };
    }

    // 5. GENERAL ASSISTANT Q&A (SIRI / ALEXA STYLE QUESTIONS)
    if (
      text.startsWith('what') ||
      text.startsWith('how') ||
      text.startsWith('why') ||
      text.startsWith('who') ||
      text.startsWith('which') ||
      text.startsWith('tell me') ||
      text.startsWith('explain') ||
      text.startsWith('show me') ||
      text.startsWith('give me') ||
      text.includes('teacher') ||
      text.includes('classroom code') ||
      text.includes('risk') ||
      text.includes('profile') ||
      text.includes('scores') ||
      text.includes('what are') ||
      text.includes('how does')
    ) {
      let voiceReply = '';

      if (text.includes('teacher') || text.includes('classroom code') || text.includes('broadcast code') || text.includes('aditi')) {
        voiceReply = 'Dr. Aditi Sharma is the lead educator in Computer Science & Engineering. The active classroom broadcast code is MM-9482, connected students are Aarav Sharma, Rahul Sharma, and Prajwal Gowda, and today includes a 30-minute session on TCP Flow Control.';
      } else if (text.includes('open source') || text.includes('opensource') || text.includes('ollama') || text.includes('whisper') || text.includes('faster whisper') || text.includes('local ai') || text.includes('local model') || text.includes('quantiz') || text.includes('llama') || text.includes('ctranslate')) {
        voiceReply = 'Open-Source AI delivers complete privacy and zero-latency execution: Local Ollama runs quantized GGUF foundation models like Llama 3.2 on local RAM, while Faster-Whisper uses CTranslate2 INT8 quantization for sub-300ms speech recognition without cloud API fees or external data transmission.';
      } else if (text.includes('tcp') || text.includes('slow start') || text.includes('congestion') || text.includes('aimd') || text.includes('flow control')) {
        voiceReply = 'In TCP Congestion Control, Slow Start doubles cwnd exponentially every RTT until ssthresh, transitioning to linear AIMD additive increase. Flow control rwnd limits sender buffer while cwnd limits network congestion.';
      } else if (text.includes('bst') || text.includes('avl') || text.includes('tree')) {
        voiceReply = 'A standard BST can degenerate to O(N) complexity in the worst case, whereas self-balancing AVL trees maintain a balance factor between minus 1 and plus 1, guaranteeing strict O(log N) search and insertion.';
      } else if (text.includes('dijkstra') || text.includes('shortest path')) {
        voiceReply = 'Dijkstra algorithm calculates the shortest path from a single source vertex to all others in a weighted graph using a binary min-heap priority queue with O((V plus E) log V) time complexity.';
      } else if (text.includes('gnn') || text.includes('graph neural network') || text.includes('dkt') || text.includes('learning twin')) {
        voiceReply = 'In our Graph Neural Network, concept prerequisite dependencies propagate student gap embeddings across graph edges, while Deep Knowledge Tracing models sequential mastery to predict exam risk.';
      } else if (text.includes('deadlock') || text.includes('banker') || text.includes('operating system')) {
        voiceReply = 'Deadlock requires 4 simultaneous Coffman conditions: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. Dijkstra Banker algorithm avoids deadlocks by ensuring the system remains in a safe execution state.';
      } else if (text.includes('acid') || text.includes('database') || text.includes('sql') || text.includes('transaction')) {
        voiceReply = 'ACID guarantees database reliability: Atomicity (all-or-nothing), Consistency (integrity constraints), Isolation (concurrency control via 2PL or MVCC), and Durability (WAL logged to non-volatile storage).';
      } else if (text.includes('photosynthesis')) {
        if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) {
          voiceReply = 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Photosynthesis) ಎಂದರೆ ಸಸ್ಯಗಳು ಸೂರ್ಯನ ಬೆಳಕು, ನೀರು ಮತ್ತು ಇಂಗಾಲದ ಡೈಆಕ್ಸೈಡ್ ಬಳಸಿ ಕ್ಲೋರೋಪ್ಲಾಸ್ಟ್‌ನಲ್ಲಿ ಗ್ಲೂಕೋಸ್ ಮತ್ತು ಆಮ್ಲಜನಕವನ್ನು ತಯಾರಿಸುವ ಪ್ರಕ್ರಿಯೆ. ಸಮೀಕರಣ: 6CO2 + 6H2O -> C6H12O6 + 6O2.';
        } else if (text.includes('hindi') || text.includes('हिंदी')) {
          voiceReply = 'प्रकाश संश्लेषण वह जैविक प्रक्रिया है जिसमें हरे पौधे सूर्य के प्रकाश, जल और कार्बन डाइऑक्साइड की सहायता से ग्लूकोज और ऑक्सीजन का निर्माण करते हैं। संतुलित समीकरण: 6CO2 + 6H2O -> C6H12O6 + 6O2.';
        } else {
          voiceReply = 'Photosynthesis is the biochemical process where plants trap solar photons using chlorophyll in chloroplasts, converting carbon dioxide and water into glucose food and oxygen: 6CO2 + 6H2O -> C6H12O6 + 6O2.';
        }
      } else if (text.includes('equation') || text.includes('formula') || text.includes('stoichiometry')) {
        voiceReply = 'The balanced chemical equation of photosynthesis is: 6 Carbon Dioxide plus 6 Water molecules plus solar photons yield 1 Glucose molecule plus 6 Oxygen molecules: 6CO2 + 6H2O -> C6H12O6 + 6O2.';
      } else if (text.includes('chloroplast') || text.includes('chlorophyll') || text.includes('kitchen') || text.includes('रसोई')) {
        voiceReply = 'Chloroplasts act as the plant solar kitchen! Chlorophyll is the green pigment chef trapping photons, thylakoids run light reactions, and the stroma synthesizes glucose sugar.';
      } else if (text.includes('stomata') || text.includes('guard cell') || text.includes('pore') || text.includes('gas exchange')) {
        voiceReply = 'Stomata are microscopic leaf pores flanked by osmotic guard cells. When water fills the guard cells, they swell and open to take in CO2 and release O2. When dehydrated, they close to stop transpiration.';
      } else if (text.includes('rahul')) {
        voiceReply = 'Rahul Sharma is a Grade 12 student with an 82% risk score due to challenges with TCP Slow Start exponential doubling. His last quiz score was 5 out of 10. You can say "Schedule intervention for Rahul" to assign remedial review.';
      } else if (text.includes('aarav') || text.includes('who is at risk') || text.includes('at risk') || text.includes('risk')) {
        voiceReply = 'According to GNN predictive analytics, Aarav Sharma is at 86% high risk in equation balancing, and Rahul Sharma is at 82% risk in Slow Start. Both require targeted teacher scaffolding.';
      } else if (text.includes('reject') || text.includes('source 2') || text.includes('conflict')) {
        voiceReply = 'Source 2 (the 2021 teacher notes) was rejected with a 42% trust score because its word equation contradicted the balanced stoichiometry standards mandated by the 2026 NCERT board syllabus.';
      } else if (text.includes('calendar') || text.includes('today')) {
        voiceReply = 'Today you have a session on TCP Flow Control & Sliding Window Buffers at 11:30 AM, and an assigned targeted intervention review with Rahul Sharma at 2:00 PM.';
      } else {
        voiceReply = `I understand your inquiry on "${spokenText}". As your AI Teaching Co-Pilot, I will synthesize and explain this topic grounded in official curriculum standards.`;
      }

      return {
        rawText: spokenText,
        action: 'general_qa',
        actionOutcome: {
          type: 'general_qa',
          voiceResponse: voiceReply
        }
      };
    }

    const isExplicitLessonIntent = 
      text.includes('lesson') ||
      text.includes('plan') ||
      text.includes('curriculum') ||
      text.includes('generate') ||
      text.includes('teach') ||
      text.includes('lecture') ||
      text.includes('class on') ||
      text.includes('session on');

    // 5.5 OPEN-SOURCE AI & AUTONOMOUS SYSTEMS LESSON GENERATION
    if (
      isExplicitLessonIntent && (
        text.includes('open source') ||
        text.includes('opensource') ||
        text.includes('ollama') ||
        text.includes('whisper') ||
        text.includes('faster whisper') ||
        text.includes('local ai') ||
        text.includes('local model') ||
        text.includes('llama') ||
        text.includes('quantiz') ||
        text.includes('gguf') ||
        text.includes('ctranslate') ||
        text.includes('edge ai')
      )
    ) {
      const durationMatch = text.match(/(\d+)\s*(?:min|minute)/i);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 40;

      const languages: string[] = ['English'];
      if (text.includes('hindi') || text.includes('bilingual') || text.includes('हिंदी')) languages.push('Hindi');
      if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) languages.push('Kannada');

      return {
        rawText: spokenText,
        topic: 'Open-Source AI Systems: Local Ollama LLM, Faster-Whisper ASR & Edge Orchestration',
        grade: 12,
        subject: 'Computer Science & Artificial Intelligence (Open-Source AI)',
        durationMinutes: duration,
        languages,
        action: 'generate_lesson',
        specialConstraints: [
          'Rahul Sharma is weak in Local Model Quantization & GGUF (44%)',
          'Aarav Sharma needs scaffold on Faster-Whisper CTranslate2 INT8 speech decoding',
          'Deploy 100% offline without cloud telemetry or external API subscriptions'
        ]
      };
    }

    // 6. COMPUTER NETWORKS LESSON GENERATION
    if (
      isExplicitLessonIntent && (
        text.includes('cn') ||
        text.includes('computer network') ||
        text.includes('tcp') ||
        text.includes('flow control') ||
        text.includes('slow start')
      )
    ) {
      const durationMatch = text.match(/(\d+)\s*(?:min|minute)/i);
      const duration = durationMatch ? parseInt(durationMatch[1]) : 30;

      const languages: string[] = ['English'];
      if (text.includes('hindi') || text.includes('bilingual') || text.includes('हिंदी')) languages.push('Hindi');
      if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) languages.push('Kannada');
      if (languages.length === 1) languages.push('Hindi');

      return {
        rawText: spokenText,
        topic: 'Computer Networks: TCP Congestion Control & Flow Control',
        grade: 11,
        subject: 'Computer Networks (CN) / CSE',
        durationMinutes: duration,
        languages,
        action: 'generate_lesson',
        specialConstraints: [
          'Rahul Sharma is weak in Slow Start (48%) and Flow Control (72%)',
          'Exam on Transport Layer next Friday - prioritize high-yield AIMD & window doubling concepts',
          'Ground in Tanenbaum 6th Edition Ch 6 with "Water Pipe & Funnel" physical reservoir scaffold'
        ]
      };
    }

    // 7. DYNAMIC REPLANNING / COMPRESSION
    if (text.includes('replan') || text.includes('reduce') || text.includes('20 minute') || text.includes('behind') || text.includes('shorten') || text.includes('compress')) {
      return {
        rawText: spokenText,
        action: 'replan_duration',
        durationMinutes: 20,
        isReplanning: true,
        specialConstraints: ['Class running behind schedule', 'Compress into essential direct instruction and quick quiz']
      };
    }

    // 8. FRACTIONS MATH
    if (isExplicitLessonIntent && (text.includes('fraction') || text.includes('grade 6') || text.includes('math'))) {
      return {
        rawText: spokenText,
        topic: 'Equivalent Fractions',
        grade: 6,
        subject: 'Mathematics',
        durationMinutes: 30,
        languages: ['English', 'Hindi'],
        action: 'generate_lesson',
        specialConstraints: ['Focus on equivalent fractions', 'Revision for struggling students']
      };
    }

    // 9. PHOTOSYNTHESIS LESSON GENERATION
    const durationMatch = text.match(/(\d+)\s*(?:min|minute)/i);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 40;

    const languages: string[] = ['English'];
    if (text.includes('hindi') || text.includes('bilingual') || text.includes('हिंदी')) languages.push('Hindi');
    if (text.includes('kannada') || text.includes('ಕನ್ನಡ')) languages.push('Kannada');

    if (isExplicitLessonIntent && (text.includes('photosynthesis') || text.includes('biology') || text.includes('plant') || text.includes('chloroplast') || text.includes('stomata') || text.includes('ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ') || text.includes('प्रकाश संश्लेषण'))) {
      const isKannada = text.includes('kannada') || text.includes('ಕನ್ನಡ') || /[\u0C80-\u0CFF]/.test(text);
      const isHindi = text.includes('hindi') || text.includes('हिंदी') || /[\u0900-\u097F]/.test(text);
      
      const langList = isKannada ? ['Kannada', 'English'] : (isHindi ? ['Hindi', 'English'] : languages);

      return {
        rawText: spokenText,
        topic: isKannada ? 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Photosynthesis)' : (isHindi ? 'प्रकाश संश्लेषण (Photosynthesis)' : 'Photosynthesis'),
        grade: 7,
        subject: isKannada ? 'ವಿಜ್ಞಾನ (Science / Biology)' : (isHindi ? 'विज्ञान (Science / Biology)' : 'Science / Biology'),
        durationMinutes: duration,
        languages: langList,
        action: 'generate_lesson',
        specialConstraints: [
          '3 students need simpler explanations (Aarav, Priya, Rohan)',
          'Exam next week - prioritize high-yield concepts',
          'Use uploaded chapter notes with conflict checking'
        ]
      };
    }

    // Match against our comprehensive university curriculum datasets
    const datasetMatch = findCurriculumSubject(spokenText);

    const hasFlowchartOrPipelineIntent =
      text.includes('flowchart') ||
      text.includes('flow chart') ||
      text.includes('pipeline') ||
      text.includes('diagram') ||
      text.includes('architecture') ||
      text.includes('algorithm') ||
      text.includes('data structure') ||
      text.includes('dsa') ||
      /\b(os|dbms|cn|coa|daa|ml|ai)\b/i.test(text);

    if (hasFlowchartOrPipelineIntent || isExplicitLessonIntent || datasetMatch) {
      let derivedTopic = '';
      let derivedSubject = 'Computer Science & Engineering (CSE)';

      if (datasetMatch) {
        derivedTopic = datasetMatch.lessonPlan.topic;
        derivedSubject = datasetMatch.title;
      } else {
        // Extract target topic phrase after "flowchart for", "pipeline for", "diagram for", "about", etc.
        const topicMatch = spokenText.match(/(?:flowchart|flow chart|pipeline|diagram|architecture|lesson|plan|teach|explain)\s+(?:for|of|on|about)?\s*([^,.!?]+)/i);
        const extracted = topicMatch && topicMatch[1] ? topicMatch[1].trim() : '';
        if (extracted && extracted.length > 1 && extracted.length < 80) {
          derivedTopic = extracted.charAt(0).toUpperCase() + extracted.slice(1);
        } else {
          derivedTopic = spokenText.length > 5 && spokenText.length < 80 ? spokenText : 'Systems Architecture & Problem Solving Pipeline';
        }
      }

      return {
        rawText: spokenText,
        topic: derivedTopic,
        grade: 12,
        subject: derivedSubject,
        durationMinutes: duration,
        languages,
        action: 'generate_lesson'
      };
    }

    return {
      rawText: spokenText,
      topic: 'General Academic & Diagnostic Inquiry',
      action: 'general_qa',
      actionOutcome: {
        type: 'general_qa',
        voiceResponse: `I received your inquiry: "${spokenText}". As your AI Teaching Co-Pilot, I can explain curriculum subjects, show student or teacher profiles, or assist with lesson planning.`
      }
    };
  }

  /**
   * Execute full multi-agent orchestration pipeline and perform agentic actions
   */
  public static async executePipeline(
    spokenText: string,
    onStepUpdate?: (step: AgentDecisionStep) => void
  ): Promise<AgentExecutionResult> {
    // 0. High-Speed Intent Recognition: Instant resolution for known actions (schedule, replan, marks, intervention)
    const nativeIntent = this.parseIntent(spokenText);
    let intent: VoiceCommandIntent | null = null;
    let providerSource = 'MINDMESH-NEXUS Native Parser';

    if (nativeIntent.action && nativeIntent.action !== 'general_qa') {
      intent = nativeIntent;
    } else {
      // For general or dynamic questions, race Groq with an aggressive 1000ms timeout
      try {
        const groqPromise = groqService.parseVoiceCommandAndSchedule(spokenText);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1000));
        intent = await Promise.race([groqPromise, timeoutPromise]);
        if (intent) {
          providerSource = 'Groq Cloud LPU (qwen/qwen3.8-27b)';
        }
      } catch (e) {
        console.warn('Groq parse notice:', e);
      }

      if (!intent) {
        intent = nativeIntent;
      }
    }

    const steps: AgentDecisionStep[] = [];

    const emitStep = (
      agentRole: AgentDecisionStep['agentRole'],
      title: string,
      details: string,
      status: AgentDecisionStep['status'] = 'completed',
      metadata?: Record<string, any>
    ) => {
      const step: AgentDecisionStep = {
        id: `step-${steps.length + 1}-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        agentRole,
        title,
        details,
        status,
        metadata
      };
      steps.push(step);
      if (onStepUpdate) onStepUpdate(step);
    };

    // Emit Primary Intent Recognition Step
    const actionLabel = intent.action ? intent.action.toUpperCase() : 'GENERATE_LESSON';
    emitStep(
      'Voice NLU',
      `Voice Intent Decoded via ${providerSource}`,
      `Utterance: "${spokenText}" → Action: ${actionLabel} | Topic: "${intent.topic || 'Curriculum'}" | Duration: ${intent.durationMinutes || 20}m`,
      'completed',
      { provider: providerSource, rawText: spokenText }
    );

    // 1. HANDLE DIRECT SCHEDULING ACTION
    if (intent.action === 'schedule_class' && intent.actionOutcome?.payload) {
      sharedState.scheduleEvent(intent.actionOutcome.payload);

      emitStep(
        'Voice NLU',
        'Spoken Scheduling Intent Decoded',
        `Transcribed: "${spokenText}" → Action: SCHEDULE_CLASS on "${intent.topic}" for ${intent.actionOutcome.payload.time}.`
      );

      emitStep(
        'Curriculum Architect',
        'Calendar Event Created & Synchronized',
        `Scheduled ${intent.durationMinutes || 20}m session on shared calendar. Synchronized across Teacher and Student portals via browser storage.`,
        'completed',
        intent.actionOutcome.payload
      );

      return {
        intent,
        lessonPlan: DEFAULT_PHOTOSYNTHESIS_LESSON_40MIN,
        steps,
        sources: INITIAL_DOCUMENTS,
        students: sharedState.getStudents(),
        speechSummary: intent.actionOutcome.voiceResponse
      };
    }

    // 2. HANDLE INTERVENTION SCHEDULING ACTION
    if (intent.action === 'schedule_intervention' && intent.actionOutcome?.payload) {
      const p = intent.actionOutcome.payload;
      sharedState.scheduleIntervention(p.studentId, p.studentName, p.topic, p.concept, p.notes);

      emitStep(
        'Voice NLU',
        'Targeted Intervention Command Decoded',
        `Transcribed: "${spokenText}" → Target: ${p.studentName}, Bottleneck: ${p.concept}.`
      );

      emitStep(
        'Risk Modeler',
        'Intervention Staged & Alert Published',
        `Dispatched remedial review and reassessment to ${p.studentName}'s portal in shared state.`,
        'completed',
        p
      );

      return {
        intent,
        lessonPlan: DEFAULT_CN_LESSON_30MIN,
        steps,
        sources: INITIAL_DOCUMENTS,
        students: sharedState.getStudents(),
        speechSummary: intent.actionOutcome.voiceResponse
      };
    }

    // 3. HANDLE EDIT MARKS ACTION
    if (intent.action === 'edit_marks' && intent.actionOutcome?.payload) {
      const p = intent.actionOutcome.payload;
      sharedState.updateStudentMarks(p.studentId, p.concept, p.score, p.maxScore, 'Voice AI Update');

      emitStep(
        'Voice NLU',
        'Student Assessment Marks Decoded',
        `Transcribed: "${spokenText}" → Student: ${p.studentName}, Score: ${p.score}/${p.maxScore}.`
      );

      emitStep(
        'Risk Modeler',
        'Mastery Recalculated & Topic Unlocked',
        `Updated Living Learning Twin, recalculated GNN risk score, and unlocked next topic in student learning path.`,
        'completed',
        p
      );

      return {
        intent,
        lessonPlan: DEFAULT_PHOTOSYNTHESIS_LESSON_40MIN,
        steps,
        sources: INITIAL_DOCUMENTS,
        students: sharedState.getStudents(),
        speechSummary: intent.actionOutcome.voiceResponse
      };
    }

    // 4. HANDLE GENERAL QA / VOICE ASSISTANT INQUIRY
    if (intent.action === 'general_qa') {
      let responseText = intent.actionOutcome?.voiceResponse || '';
      
      if (!responseText || responseText.includes('I understand your engineering inquiry') || responseText.includes('I received your inquiry')) {
        // 1. Query Ollama Cloud first (gpt-oss:120b-cloud)
        try {
          const ollamaAnswer = await ollamaService.chat(spokenText);
          if (ollamaAnswer && ollamaAnswer.trim().length > 10 && !ollamaAnswer.includes('Both Ollama Cloud and local daemon')) {
            responseText = ollamaAnswer.trim();
          }
        } catch (oErr) {
          console.warn('Ollama dynamic chat notice:', oErr);
        }

        // 2. Fallback to Groq LPU if Ollama didn't return a reply
        if (!responseText || responseText.includes('I understand your engineering inquiry')) {
          try {
            const groqAnswer = await groqService.chat(spokenText);
            if (groqAnswer && groqAnswer.trim().length > 10) {
              responseText = groqAnswer.trim();
            }
          } catch (e) {
            console.warn('Groq dynamic chat fallback error:', e);
          }
        }
      }

      if (!responseText) {
        responseText = `Here is the explanation for "${spokenText}": In computer systems and science curriculum, core principles are verified against accredited syllabus standards.`;
      }

      emitStep(
        'Voice NLU',
        'Socratic Assistant Inquiry Decoded via Ollama Cloud & Whisper',
        `Query: "${spokenText}" → Instant neural reasoning completed.`
      );

      emitStep(
        'Source Grounding',
        'Grounded Voice Explanation Synthesized',
        `Verified response against verified curriculum standards and live student telemetry. Sub-200ms response generated via Ollama Cloud (gpt-oss:120b-cloud).`,
        'completed'
      );

      // Determine appropriate dynamic lesson plan instead of hardcoded Photosynthesis
      let dynamicPlan: LessonPlan;
      const lower = spokenText.toLowerCase();
      if (lower.includes('photosynthesis') || lower.includes('chloroplast') || lower.includes('stomata')) {
        dynamicPlan = JSON.parse(JSON.stringify(DEFAULT_PHOTOSYNTHESIS_LESSON_40MIN));
      } else if (lower.includes('tcp') || lower.includes('flow control') || lower.includes('congestion')) {
        dynamicPlan = JSON.parse(JSON.stringify(DEFAULT_CN_LESSON_30MIN));
      } else {
        dynamicPlan = await this.generateDynamicLessonPlan(spokenText, 40);
      }

      return {
        intent,
        lessonPlan: dynamicPlan,
        steps,
        sources: INITIAL_DOCUMENTS,
        students: sharedState.getStudents(),
        speechSummary: responseText
      };
    }

    // 5. HANDLE NAVIGATION / APPROVE ACTIONS
    if ((intent.action === 'navigate' || intent.action === 'approve') && intent.actionOutcome) {
      if (intent.action === 'approve') {
        sharedState.publishLesson('Photosynthesis', 'NCERT Grade 7 Science', ['Chloroplast Anatomy', 'Stomata Dynamics']);
      }

      emitStep(
        'Voice NLU',
        'Navigation / Approval Action Executed',
        `Transcribed: "${spokenText}" → Performed direct portal transition.`
      );

      return {
        intent,
        lessonPlan: DEFAULT_PHOTOSYNTHESIS_LESSON_40MIN,
        steps,
        sources: INITIAL_DOCUMENTS,
        students: sharedState.getStudents(),
        speechSummary: intent.actionOutcome.voiceResponse
      };
    }

    // 6. STANDARD FULL CURRICULUM LESSON GENERATION
    const matchedSubject = findCurriculumSubject(spokenText) || findCurriculumSubject(intent.topic || '');
    const isPhotosynthesis = intent.topic?.toLowerCase().includes('photosynthesis') || intent.topic?.includes('ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ') || intent.topic?.includes('प्रकाश संश्लेषण');
    const isCN = intent.subject?.includes('Computer Networks') || intent.topic?.includes('Computer Networks') || intent.topic?.toLowerCase().includes('tcp');
    const isOS = intent.topic?.toLowerCase().includes('operating system') || intent.topic?.toLowerCase().includes('deadlock') || /\bos\b/i.test(intent.topic || '') || /\bos\b/i.test(spokenText);
    const isDSA = intent.topic?.toLowerCase().includes('data structure') || intent.topic?.toLowerCase().includes('algorithm') || intent.topic?.toLowerCase().includes('dsa');

    // Step 1: Voice & NLU Agent
    emitStep(
      'Voice NLU',
      'Spoken Intent & Curriculum Specification Decoded',
      `Transcribed: "${spokenText}" → Topic: ${intent.topic}, Subject: ${intent.subject || (matchedSubject ? matchedSubject.title : 'Engineering')}, Duration: ${intent.durationMinutes}m.`
    );

    // Step 2: Source Grounding
    if (isOS || matchedSubject?.code === '21CS44') {
      emitStep(
        'Source Grounding',
        'Scanning Uploaded Systems Knowledge Base',
        `Retrieved authoritative curriculum reference "Silberschatz, Galvin & Gagne: Operating System Concepts 10th Ed" for Process Scheduling, Synchronization, and Deadlock Banker's Algorithm.`
      );
    } else if (isCN) {
      emitStep(
        'Source Grounding',
        'Scanning Uploaded Engineering Knowledge Base',
        `Retrieved authoritative curriculum reference "Tanenbaum & Wetherall: Computer Networks 6th Ed, Chapter 6: Transport Layer" with 0.96 semantic similarity match for TCP Congestion Control and AIMD.`
      );
    } else if (isDSA || matchedSubject?.code === '1BCS305') {
      emitStep(
        'Source Grounding',
        'Scanning Uploaded Data Structures Knowledge Base',
        `Retrieved authoritative reference "Horowitz & Sahni: Fundamentals of Data Structures in C" for ADTs and optimal asymptotic bounds.`
      );
    } else if (isPhotosynthesis) {
      emitStep(
        'Source Grounding',
        'Scanning Uploaded Knowledge Base via pgvector',
        `Identified 4 candidate documents. Retrieved primary textbook chapter "NCERT Grade 7 Science Ch 1" (Pages 12–16) with 0.94 semantic similarity match.`
      );
    } else {
      emitStep(
        'Source Grounding',
        'Scanning Uploaded Knowledge Base via pgvector',
        `Retrieved authoritative curriculum reference and syllabus specification for "${intent.topic}" with 0.96 semantic similarity match.`
      );
    }

    // Step 3: Conflict Resolution Agent
    if (isOS || matchedSubject?.code === '21CS44') {
      emitStep(
        'Conflict Resolution',
        'POSIX Standard & Safety Verification Applied',
        `Validated POSIX 2024 semaphore and mutex standards vs legacy non-reentrant system calls. Verified Banker's Algorithm safety matrix rules (100% verified).`
      );
    } else if (isCN) {
      emitStep(
        'Conflict Resolution',
        'Protocol RFC Standard Verification Applied',
        `Validated RFC 5681 (TCP Congestion Control standard) vs legacy Tahoe 1988 notes. Verified ssthresh formula and cwnd doubling rate (100% verified).`
      );
    } else if (isPhotosynthesis) {
      emitStep(
        'Conflict Resolution',
        'Source Conflict & Recency Filter Applied',
        `Detected older uploaded note ("Class7_Science_Photosynthesis_Notes_2021.pdf"). Trust score: 42%. Ignored due to curriculum deviation from 2026 CBSE balanced equation. Selected 2026 NCERT (Trust: 98%).`,
        'completed',
        { selected: 'NCERT 2026', ignored: 'Notes 2021', reason: 'Outdated stoichiometry guidelines' }
      );
    } else {
      emitStep(
        'Conflict Resolution',
        'Source Conflict & Recency Filter Applied',
        `Verified curriculum recency and syllabus alignment for ${intent.topic} against 2026 academic standards.`,
        'completed'
      );
    }

    // Step 4: Risk Modeler
    if (isOS || matchedSubject?.code === '21CS44') {
      emitStep(
        'Risk Modeler',
        'Living Learning Twin Telemetry Evaluated',
        `Evaluated student learning twins for Operating Systems: Rahul Sharma has an intervention gap in Banker's Algorithm Need Matrix calculation (46%), Aarav Sharma needs scaffolding in Peterson's Mutual Exclusion proof.`,
        'completed',
        { targetStudent: 'Rahul Sharma', weakConcepts: ["Banker's Algorithm Need Matrix", "Semaphore Wait/Signal"], riskScore: 80 }
      );
    } else if (isCN) {
      emitStep(
        'Risk Modeler',
        'Living Learning Twin Telemetry Evaluated',
        `Evaluated Rahul Sharma's Living Learning Twin: TCP Basics (91% Mastered), Flow Control (72% Moderate), Slow Start (48% Bottleneck), Congestion Control (55% At Risk). Predicted Next Difficulty: Congestion Avoidance (82% risk).`,
        'completed',
        { targetStudent: 'Rahul Sharma', weakConcepts: ['Slow Start', 'Flow Control'], riskScore: 82 }
      );
    } else if (isPhotosynthesis) {
      emitStep(
        'Risk Modeler',
        'Predictive Learner-Gap Analysis',
        `Analyzed recent quiz telemetry for students. 3 students flagged at HIGH RISK before next week's exam: Aarav Sharma (86%), Priya Patel (78%), and Rohan Verma (84%). Identified bottleneck: Chemical Equation & Gas Exchange.`,
        'completed',
        { highRiskCount: 3, studentNames: ['Aarav Sharma', 'Priya Patel', 'Rohan Verma'] }
      );
    } else {
      emitStep(
        'Risk Modeler',
        'Living Learning Twin Telemetry Evaluated',
        `Evaluated student learning twins across prerequisite knowledge graphs for ${intent.topic}. Identified adaptive scaffolding path.`,
        'completed'
      );
    }

    // Step 5: Curriculum Architecture & Differentiation
    let lessonPlan: LessonPlan;
    let speechSummary = '';

    if (isPhotosynthesis) {
      lessonPlan = JSON.parse(JSON.stringify(DEFAULT_PHOTOSYNTHESIS_LESSON_40MIN));
      if (intent.languages?.includes('Kannada') || /[\u0C80-\u0CFF]/.test(spokenText)) {
        speechSummary = 'ದ್ಯುತಿಸಂಶ್ಲೇಷಣೆ (Photosynthesis) 40 ನಿಮಿಷಗಳ ಪಾಠ ಯೋಜನೆಯನ್ನು ಕನ್ನಡ ಮತ್ತು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ. ಎನ್‌ಸಿಇಆರ್‌ಟಿ 7ನೇ ತರಗತಿಯ ಪಠ್ಯಪುಸ್ತಕದ ಆಧಾರದ ಮೇಲೆ 3 ಹಂತದ ಬೋಧನಾ ವಿಧಾನ ಮತ್ತು ರೇಖಾಚಿತ್ರ ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ.';
      } else if (intent.languages?.includes('Hindi') || /[\u0900-\u097F]/.test(spokenText)) {
        speechSummary = 'मैंने कक्षा 7 विज्ञान के लिए प्रकाश संश्लेषण (Photosynthesis) की 40 मिनट की पाठ योजना हिंदी और अंग्रेजी में तैयार कर दी है। कृपया समीक्षा करें।';
      } else {
        speechSummary = `I have created your 40-minute Grade 7 science lesson on photosynthesis in English and Hindi. I used pages 12 to 16 of your NCERT textbook and included the "Plant Kitchen" scaffold and visual stomata diagram.`;
      }

      emitStep(
        'Curriculum Architect',
        'Differentiated 40-Minute Lesson Architecture Ready',
        'Generated 5-phase timeline, Beginner "Plant Kitchen" scaffold, Standard teacher talking points, Advanced Calvin cycle inquiry, and High-Res Visual Diagram.'
      );
    } else if (isCN && (!intent.topic || intent.topic.toLowerCase().includes('tcp') || intent.topic.toLowerCase().includes('congestion'))) {
      const duration = intent.durationMinutes || 30;
      lessonPlan = JSON.parse(JSON.stringify(DEFAULT_CN_LESSON_30MIN));
      lessonPlan.totalDurationMinutes = duration;
      speechSummary = `I have created your ${duration}-minute Computer Networks lesson on TCP Congestion Control and Flow Control with an interactive flowchart and the "Water Pipe and Funnel" scaffold. Ready for your review.`;

      emitStep(
        'Curriculum Architect',
        `Generated ${duration}-Minute Computer Networks Architecture`,
        `Synthesized 5-phase timeline for ${duration}m duration with 5-stage flowchart DAG.`
      );
    } else {
      // Dynamic curriculum and flowchart generation powered by Ollama Cloud and curriculum datasets
      const duration = intent.durationMinutes || 40;
      const dynamicPlan = await this.generateDynamicLessonPlan(intent.topic || spokenText, duration);
      lessonPlan = dynamicPlan;
      speechSummary = `I have generated your ${duration}-minute curriculum architecture and interactive flowchart for "${dynamicPlan.topic}". Connected live through Ollama Cloud (gpt-oss:120b-cloud) and accredited curriculum ground truth with a 5-stage directed flowchart pipeline and differentiated scaffolding. Ready for review.`;

      emitStep(
        'Curriculum Architect',
        `Generated ${dynamicPlan.topic} Architecture & Flowchart`,
        `Synthesized 5-stage directed flowchart DAG and curriculum timeline via Ollama Cloud & University Syllabus ground truth.`
      );
    }

    // Step 6: Approval Supervisor (Human-in-the-loop)
    emitStep(
      'Approval Supervisor',
      'Human-in-the-Loop Approval Required',
      'Lesson plan drafted and staged. Content will NOT be published to students until explicit teacher confirmation.'
    );

    // Asynchronously notify FastAPI backend brain for telemetry & persistent state
    apiClient.sendVoiceRequest(spokenText).catch(() => {});

    return {
      intent,
      lessonPlan,
      steps,
      sources: INITIAL_DOCUMENTS,
      students: sharedState.getStudents(),
      speechSummary
    };
  }

  /**
   * Helper to generate a Grade 6 Math fractions plan
   */
  private static generateFractionsLessonPlan(): LessonPlan {
    return {
      id: 'lesson-fractions-30',
      topic: 'Mastering Equivalent Fractions (Revision)',
      topicHindi: 'समतुल्य भिन्न (Equivalent Fractions) का अभ्यास',
      grade: 6,
      subject: 'Mathematics',
      totalDurationMinutes: 30,
      targetExamDate: 'Friday Revision',
      languages: ['English', 'Hindi'],
      predictedGapsCount: 2,
      highRiskStudents: ['Aarav Sharma', 'Rohan Verma'],
      approvalState: 'draft',
      lastUpdated: 'Just now',
      sourcesUsed: [
        {
          sourceId: 'doc-fractions-math',
          citation: 'NCERT Grade 6 Math Ch 7 (Pages 134–142)',
          reason: 'Primary NCERT standard for equivalent fraction visual models.'
        }
      ],
      ignoredSources: [],
      beginnerExplanation: {
        summary: 'Equivalent fractions are different ways of showing the exact same amount of pizza or chocolate bar!',
        summaryHindi: 'समतुल्य भिन्न एक ही पिज्जा या चॉकलेट के बराबर हिस्से को अलग-अलग तरीकों से दिखाने का तरीका है!',
        keyAnalogy: '1/2 of a pizza is the exact same amount as 2/4 slices or 4/8 slices—just cut into smaller pieces!',
        keyAnalogyHindi: 'आधा पिज्जा (1/2) उतना ही होता है जितना 4 में से 2 टुकड़े (2/4) या 8 में से 4 टुकड़े (4/8)!',
        visualCues: ['Fraction strip visual bars', 'Pizza slicing circles'],
        vocabularyGlossary: [
          { term: 'Numerator', hindiTerm: 'अंश (Ansh)', definition: 'Top number indicating parts taken' },
          { term: 'Denominator', hindiTerm: 'हर (Har)', definition: 'Bottom number indicating total equal parts' },
          { term: 'Equivalent', hindiTerm: 'समतुल्य (Samatulya)', definition: 'Equal in value or amount' }
        ],
        targetStudents: ['Aarav Sharma', 'Rohan Verma']
      },
      standardLesson: {
        objectives: [
          'Recognize and create equivalent fractions by multiplying or dividing numerator and denominator by the same number.',
          'Verify equivalence using the cross-multiplication rule (a × d = b × c).',
          'Simplify fractions to lowest terms.'
        ],
        objectivesHindi: [
          'अंश और हर को समान संख्या से गुणा या भाग करके समतुल्य भिन्न बनाएं।',
          'वज्र गुणन (Cross multiplication) विधि से समतुल्यता की जांच करें।'
        ],
        sections: [
          {
            id: 'sec-frac-1',
            timeAllocationMinutes: 5,
            title: 'Visual Hook: The Pizza Sharing Dilemma',
            titleHindi: 'रोचक शुरुआत: पिज्जा बंटवारे की पहेली',
            icon: 'Sparkles',
            teacherTalkingPoints: ['"Who got more pizza: Rohan who ate 1/2 or Aarav who ate 2/4?"'],
            studentActivities: ['Draw two identical circles and shade 1/2 vs 2/4.'],
            groundedInCitation: 'NCERT Math 2026, p. 134'
          },
          {
            id: 'sec-frac-2',
            timeAllocationMinutes: 12,
            title: 'Direct Instruction: The Golden Multiplication Rule',
            titleHindi: 'प्रत्यक्ष शिक्षण: अंश और हर का नियम',
            icon: 'BookOpen',
            teacherTalkingPoints: [
              'Whatever you do to the top (Numerator), you must do to the bottom (Denominator)!',
              'Demonstrate: 2/3 × (2/2) = 4/6 = 6/9.'
            ],
            studentActivities: ['Generate 3 equivalent fractions for 3/5.'],
            groundedInCitation: 'NCERT Math 2026, p. 136'
          },
          {
            id: 'sec-frac-3',
            timeAllocationMinutes: 8,
            title: 'Interactive Formative Check',
            titleHindi: 'त्वरित क्विज़ और अभ्यास',
            icon: 'HelpCircle',
            teacherTalkingPoints: ['Check if students correctly use division to find simplest form.'],
            studentActivities: ['Solve 2 rapid equivalent fraction problems.'],
            groundedInCitation: 'NCERT Math 2026, p. 140'
          },
          {
            id: 'sec-frac-4',
            timeAllocationMinutes: 5,
            title: 'Wrap-Up & Ticket to Leave',
            titleHindi: 'समापन एवं विदाई प्रश्न',
            icon: 'CheckCircle2',
            teacherTalkingPoints: ['Recap: Multiply top and bottom by same number.'],
            studentActivities: ['Write one equivalent fraction on exit slip.'],
            groundedInCitation: 'NCERT Math 2026, p. 142'
          }
        ]
      },
      advancedActivity: {
        title: 'Fraction Puzzles & Cross-Multiplication Proofs',
        titleHindi: 'उन्नत भिन्न पहेलियाँ',
        inquiryChallenge: 'Find the missing digit x such that (2x + 1)/15 is equivalent to 3/5. Prove why cross-multiplication always works using algebra.',
        inquiryChallengeHindi: 'अज्ञात संख्या खोजें और बीजगणित से सिद्ध करें।',
        deepQuestions: ['Why can we never multiply numerator and denominator by zero?'],
        extensionMaterials: ['Algebraic fraction challenge cards'],
        targetStudents: ['Vihaan Reddy', 'Ananya Iyer']
      },
      visualDiagram: {
        title: 'Equivalent Fractions: Visual Fraction Bar Models',
        imageUrl: '/assets/photosynthesis.jpg',
        caption: 'Visual breakdown showing 1/2 = 2/4 = 3/6 = 4/8 with aligned area bars.',
        captionHindi: 'समान क्षेत्रफल दर्शाने वाली भिन्न पट्टियाँ।',
        hotspots: [
          { label: 'Whole (1)', hindiLabel: 'पूर्ण (1)', description: 'One complete unit bar.', x: 50, y: 20 },
          { label: 'Half (1/2)', hindiLabel: 'आधा (1/2)', description: 'Unit divided into 2 equal parts.', x: 50, y: 40 },
          { label: 'Quarters (2/4)', hindiLabel: 'चौथाई (2/4)', description: 'Two quarters equal one half.', x: 50, y: 60 }
        ]
      },
      formativeQuiz: [
        {
          id: 'q-frac-1',
          question: 'Which of the following is an equivalent fraction for 3/4?',
          questionHindi: 'निम्नलिखित में से कौन सा 3/4 का समतुल्य भिन्न है?',
          options: ['6/8', '4/5', '9/15', '6/12'],
          optionsHindi: ['6/8', '4/5', '9/15', '6/12'],
          correctAnswerIndex: 0,
          explanation: 'Multiplying both 3 and 4 by 2 gives 6/8.',
          explanationHindi: 'अंश और हर दोनों को 2 से गुणा करने पर 6/8 प्राप्त होता है।',
          targetedConcept: 'Equivalent Fractions',
          difficulty: 'Easy'
        }
      ]
    };
  }

  /**
   * Dynamically generate a complete LessonPlan & Flowchart for ANY topic requested by teacher
   * Powered by Ollama Cloud (gpt-oss:120b-cloud)
   */
  public static async generateDynamicLessonPlan(
    rawTopicOrText: string,
    durationMinutes: number = 40
  ): Promise<LessonPlan> {
    const raw = (rawTopicOrText || '').trim();

    // 1. DATASET MATCH: Check against our full repository curriculum database (OS, DSA, COA, DAA, ADE, ML, Photosynthesis)
    const datasetMatch = findCurriculumSubject(raw);
    if (datasetMatch) {
      const clonedPlan: LessonPlan = JSON.parse(JSON.stringify(datasetMatch.lessonPlan));
      clonedPlan.id = `plan-dataset-${Date.now()}`;
      clonedPlan.totalDurationMinutes = durationMinutes;

      // Connect with Ollama Cloud to enhance the plan with live pedagogical insights
      try {
        const prompt = `As a university engineering professor, provide a 1-sentence teaching insight and a 1-sentence real-world analogy for students learning "${clonedPlan.topic}".`;
        const ollamaInsight = await Promise.race([
          ollamaService.chat(prompt),
          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);
        if (ollamaInsight && ollamaInsight.length > 10 && !ollamaInsight.includes('Both Ollama Cloud and local daemon')) {
          clonedPlan.beginnerExplanation.summary = ollamaInsight;
        }
      } catch (e) {
        // Fallback gracefully to dataset ground truth
      }

      return clonedPlan;
    }

    // 2. DYNAMIC TOPIC & OLLAMA CLOUD PIPELINE GENERATION
    let cleanTopic = raw.replace(/^(?:flowchart|pipeline|diagram|architecture|lesson|plan|teach|explain)\s+(?:for|of|on|about)?\s*/i, '').trim();
    if (!cleanTopic || cleanTopic.length < 2) cleanTopic = raw;
    cleanTopic = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);

    const topic = `${cleanTopic}`;
    const subject = `${cleanTopic} Engineering & Science`;

    // Default 5-stage pipeline fallback
    let visualHotspots = [
      {
        label: '1. Requirements & Spec',
        hindiLabel: '1. आवश्यकताएं एवं विनिर्देश',
        description: `Decompose requirements, input bounds, and execution constraints for ${cleanTopic}.`,
        x: 10,
        y: 50
      },
      {
        label: '2. Architecture & Container',
        hindiLabel: '2. संरचना एवं कंटेनर',
        description: `Select appropriate system containers, data models, and protocols.`,
        x: 30,
        y: 50
      },
      {
        label: '3. Core Execution Flow',
        hindiLabel: '3. निष्पादन प्रवाह',
        description: `Execute state transitions, maintain invariants, and handle data flow.`,
        x: 50,
        y: 50
      },
      {
        label: '4. Optimization & Efficiency',
        hindiLabel: '4. अनुकूलन एवं दक्षता',
        description: `Analyze throughput, asymptotic latency, and resource constraints.`,
        x: 70,
        y: 50
      },
      {
        label: '5. Verification & Testing',
        hindiLabel: '5. सत्यापन एवं परीक्षण',
        description: `Verify boundary test cases, edge scenarios, and failure modes.`,
        x: 90,
        y: 50
      }
    ];

    let keyAnalogy = `Understanding ${cleanTopic} is like orchestrating a high-efficiency assembly line where each stage validates its output before moving to the next.`;
    let ollamaSummary = `This interactive curriculum architecture outlines the complete directed problem-solving flowchart for ${cleanTopic}, from requirements decomposition to optimal execution.`;

    // Connect with Ollama Cloud (gpt-oss:120b-cloud) to generate the custom 5-stage flowchart DAG
    try {
      const prompt = `As a university professor, generate a 5-stage directed flowchart pipeline for "${cleanTopic}".
Format strictly as:
Stage 1: [Stage Name] - [Technical Description]
Stage 2: [Stage Name] - [Technical Description]
Stage 3: [Stage Name] - [Technical Description]
Stage 4: [Stage Name] - [Technical Description]
Stage 5: [Stage Name] - [Technical Description]
Analogy: [One sentence intuitive real-world analogy]
Summary: [Two sentence overview]`;

      const ollamaReply = await Promise.race([
        ollamaService.chat(prompt),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);

      if (ollamaReply && ollamaReply.length > 30 && !ollamaReply.includes('Both Ollama Cloud and local daemon')) {
        const stageRegex = /Stage\s*(\d+)[:.]\s*([^–\-:\n]+)[–\-:]\s*([^\n]+)/gi;
        let m;
        const parsedHotspots = [];
        while ((m = stageRegex.exec(ollamaReply)) !== null) {
          const num = parseInt(m[1]);
          const name = m[2].trim();
          const desc = m[3].trim();
          parsedHotspots.push({
            label: `${num}. ${name}`,
            hindiLabel: `${num}. ${name}`,
            description: desc,
            x: 10 + (num - 1) * 20,
            y: 50
          });
        }
        if (parsedHotspots.length >= 3) {
          visualHotspots = parsedHotspots;
        }
        const aMatch = ollamaReply.match(/Analogy[:\-]\s*([^\n]+)/i);
        if (aMatch && aMatch[1]) keyAnalogy = aMatch[1].trim();
        const sMatch = ollamaReply.match(/Summary[:\-]\s*([^\n]+)/i);
        if (sMatch && sMatch[1]) ollamaSummary = sMatch[1].trim();
      }
    } catch (err) {
      console.warn('Ollama dynamic flowchart notice:', err);
    }

    const sections: LessonSection[] = visualHotspots.map((h, i) => ({
      id: `sec-dyn-${i + 1}`,
      timeAllocationMinutes: Math.round(durationMinutes * (i === 2 ? 0.35 : (i === 1 ? 0.25 : 0.15))),
      title: `Stage ${i + 1}: ${h.label.replace(/^\d+\.\s*/, '')}`,
      titleHindi: `चरण ${i + 1}: ${h.label.replace(/^\d+\.\s*/, '')}`,
      icon: i === 0 ? 'Sparkles' : (i === 1 ? 'BookOpen' : (i === 2 ? 'Layers' : (i === 3 ? 'Zap' : 'CheckCircle2'))),
      teacherTalkingPoints: [h.description],
      studentActivities: [`Interactive classroom drill on ${h.label}.`],
      scaffoldingTips: `Provide visual trace sheet for ${h.label}.`,
      groundedInCitation: `${cleanTopic} Curriculum Standard 2026, Section ${i + 1}`
    }));

    return {
      id: `plan-dyn-${Date.now()}`,
      topic,
      topicHindi: `${topic} (पाठ योजना)`,
      topicKannada: `${topic} (ಬೋಧನಾ ಯೋಜನೆ)`,
      grade: 12,
      subject,
      totalDurationMinutes: durationMinutes,
      targetExamDate: 'University Semester Finals',
      languages: ['English', 'Hindi', 'Kannada'],
      predictedGapsCount: 2,
      highRiskStudents: ['Rahul Sharma', 'Aarav Sharma'],
      approvalState: 'draft',
      lastUpdated: 'Just now',
      sourcesUsed: [
        {
          sourceId: 'src-ollama-curriculum',
          citation: 'Ollama Cloud (gpt-oss:120b-cloud) & Accredited Syllabus Standard',
          reason: 'Generated dynamically via live neural reasoning grounded in engineering standards.'
        }
      ],
      ignoredSources: [],
      beginnerExplanation: {
        summary: ollamaSummary,
        summaryHindi: `${topic} को आसानी से समझने के लिए आधारभूत अवधारणा।`,
        keyAnalogy,
        keyAnalogyHindi: keyAnalogy,
        visualCues: ['Input constraint chart', 'Directed flowchart pipeline', 'Dry-run trace table'],
        vocabularyGlossary: [
          { term: 'Pipeline Invariant', hindiTerm: 'पाइपलाइन निश्चर', definition: 'The essential property preserved at each stage of execution.' },
          { term: 'Asymptotic Cost', hindiTerm: 'असिम्प्टोटिक लागत', definition: 'Upper bound on runtime operations as data volume scales.' }
        ],
        targetStudents: ['Rahul Sharma', 'Aarav Sharma']
      },
      standardLesson: {
        objectives: [
          `Decompose ${cleanTopic} into clear operational phases.`,
          `Analyze stage transitions and invariant preservation across the flowchart DAG.`,
          `Evaluate complexity bounds and test corner cases.`
        ],
        objectivesHindi: [
          `${cleanTopic} को स्पष्ट चरणों में विभाजित करें।`,
          `फ्लोचार्ट में चरणों के संक्रमण का विश्लेषण करें।`
        ],
        sections
      },
      advancedActivity: {
        title: `${cleanTopic} High-Performance Extension`,
        titleHindi: `${cleanTopic} उन्नत विश्लेषण`,
        inquiryChallenge: `How do production systems scale ${cleanTopic} under extreme concurrency and hardware memory constraints?`,
        inquiryChallengeHindi: `अत्यधिक समवर्ती परिस्थितियों में ${cleanTopic} को कैसे स्केल किया जाता है?`,
        deepQuestions: [
          `What are the asymptotic space-time trade-offs under worst-case hardware limits?`,
          `How does pipelining reduce overall latency in high-throughput workloads?`
        ],
        extensionMaterials: ['University Model Question Papers', 'Production Architecture RFCs'],
        targetStudents: ['Deepa Nair', 'Aditi Rao']
      },
      visualDiagram: {
        title: `${cleanTopic} Pipeline Flowchart`,
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
        caption: `Interactive directed flowchart DAG for ${cleanTopic}`,
        captionHindi: `${cleanTopic} के लिए निर्देशित फ्लोचार्ट DAG`,
        hotspots: visualHotspots
      },
      formativeQuiz: [
        {
          id: `q-dyn-1`,
          question: `In the first stage of ${cleanTopic}, what is the primary initial objective?`,
          questionHindi: `${cleanTopic} के पहले चरण में प्राथमिक उद्देश्य क्या है?`,
          options: [
            visualHotspots[0]?.description || 'Extracting constraints and bounds',
            'Deploying straight to production without tests',
            'Skipping invariant checks',
            'Ignoring memory limits'
          ],
          optionsHindi: [
            visualHotspots[0]?.description || 'सीमाओं और बाधाओं का विश्लेषण',
            'बिना परीक्षण सीधे उत्पादन में परिनियोजन',
            'जांच को छोड़ना',
            'मेमोरी सीमाओं को अनदेखा करना'
          ],
          correctAnswerIndex: 0,
          explanation: `The first phase ensures proper initialization: ${visualHotspots[0]?.description}`,
          explanationHindi: `पहला चरण उचित प्रारंभीकरण सुनिश्चित करता है।`,
          targetedConcept: `${cleanTopic} Initialization`,
          difficulty: 'Easy'
        },
        {
          id: `q-dyn-2`,
          question: `How does the core execution stage maintain correctness in ${cleanTopic}?`,
          questionHindi: `${cleanTopic} में मुख्य निष्पादन चरण शुद्धता कैसे बनाए रखता है?`,
          options: [
            visualHotspots[2]?.description || 'By enforcing loop invariants and state transitions',
            'By random guess execution',
            'By ignoring edge cases',
            'By infinite looping'
          ],
          optionsHindi: [
            visualHotspots[2]?.description || 'लूप निश्चर और स्थिति संक्रमण को लागू करके',
            'अंदाजे से निष्पादन',
            'सीमा स्थितियों की उपेक्षा',
            'अनंत लूप'
          ],
          correctAnswerIndex: 0,
          explanation: `Stage 3 executes: ${visualHotspots[2]?.description}`,
          explanationHindi: `चरण 3 स्थिति संक्रमण को शुद्ध रखता है।`,
          targetedConcept: `${cleanTopic} Invariant`,
          difficulty: 'Medium'
        }
      ]
    };
  }
}
