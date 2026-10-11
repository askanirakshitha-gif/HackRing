// ============================================================================
// MINDMESH-NEXUS: Global Curriculum Reactive State Manager
// Enables real-time synchronization between the Hierarchical Breadcrumb Bar
// and all dashboard modules (Curriculum, Lesson Plan, AI Chat, Quizzes, Risk Dashboard).
// ============================================================================

import { 
  UNIVERSITIES_DATABASE, 
  University, 
  AcademicScheme, 
  BranchSemester, 
  CurriculumSubject, 
  getDefaultCurriculumSelection 
} from '../data/curriculumDatabase';

export interface CurriculumSelectionState {
  university: University;
  scheme: AcademicScheme;
  branchSem: BranchSemester;
  subject: CurriculumSubject;
}

type Listener = (state: CurriculumSelectionState) => void;

class CurriculumStateManager {
  private state: CurriculumSelectionState;
  private listeners: Set<Listener> = new Set();
  private storageKey = 'mindmesh_nexus_curriculum_state';

  constructor() {
    this.state = this.loadInitialState();
  }

  private loadInitialState(): CurriculumSelectionState {
    try {
      if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
        return getDefaultCurriculumSelection();
      }
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const univ = UNIVERSITIES_DATABASE.find(u => u.id === parsed?.universityId) || UNIVERSITIES_DATABASE[0];
        const scheme = univ?.schemes?.find(s => s.id === parsed?.schemeId) || univ?.schemes?.[0];
        const branchSem = scheme?.branchSemesters?.find(b => b.id === parsed?.branchSemId) || scheme?.branchSemesters?.[0];
        const subject = branchSem?.subjects?.find(s => s.id === parsed?.subjectId) || branchSem?.subjects?.[0];
        if (univ && scheme && branchSem && subject) {
          return { university: univ, scheme, branchSem, subject };
        }
      }
    } catch (e) {
      console.warn('Failed to load saved curriculum state, defaulting to VTU 2025:', e);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(this.storageKey);
        }
      } catch {}
    }
    return getDefaultCurriculumSelection();
  }

  private saveState() {
    try {
      if (typeof localStorage === 'undefined') return;
      if (!this.state?.university || !this.state?.scheme || !this.state?.branchSem || !this.state?.subject) return;
      localStorage.setItem(this.storageKey, JSON.stringify({
        universityId: this.state.university.id,
        schemeId: this.state.scheme.id,
        branchSemId: this.state.branchSem.id,
        subjectId: this.state.subject.id
      }));
    } catch (e) {
      console.warn('Failed to persist curriculum state:', e);
    }
  }

  public getState(): CurriculumSelectionState {
    if (!this.state || !this.state.subject) {
      this.state = getDefaultCurriculumSelection();
    }
    return this.state;
  }

  public setUniversity(universityId: string) {
    const university = UNIVERSITIES_DATABASE.find(u => u.id === universityId) || UNIVERSITIES_DATABASE[0];
    if (!university) return;
    const scheme = university.schemes?.[0];
    if (!scheme) return;
    const branchSem = scheme.branchSemesters?.[0];
    if (!branchSem) return;
    const subject = branchSem.subjects?.[0];
    if (!subject) return;

    this.state = { university, scheme, branchSem, subject };
    this.saveState();
    this.notify();
  }

  public setScheme(schemeId: string) {
    const scheme = this.state.university?.schemes?.find(s => s.id === schemeId) || this.state.university?.schemes?.[0];
    if (!scheme) return;
    const branchSem = scheme.branchSemesters?.[0];
    if (!branchSem) return;
    const subject = branchSem.subjects?.[0];
    if (!subject) return;

    this.state = { ...this.state, scheme, branchSem, subject };
    this.saveState();
    this.notify();
  }

  public setBranchSem(branchSemId: string) {
    const branchSem = this.state.scheme?.branchSemesters?.find(b => b.id === branchSemId) || this.state.scheme?.branchSemesters?.[0];
    if (!branchSem) return;
    const subject = branchSem.subjects?.[0];
    if (!subject) return;

    this.state = { ...this.state, branchSem, subject };
    this.saveState();
    this.notify();
  }

  public setSubject(subjectId: string) {
    const subject = this.state.branchSem?.subjects?.find(s => s.id === subjectId) || this.state.branchSem?.subjects?.[0];
    if (!subject) return;

    this.state = { ...this.state, subject };
    this.saveState();
    this.notify();
  }

  public setFullSelection(universityId: string, schemeId: string, branchSemId: string, subjectId: string) {
    const university = UNIVERSITIES_DATABASE.find(u => u.id === universityId) || UNIVERSITIES_DATABASE[0];
    const scheme = university?.schemes?.find(s => s.id === schemeId) || university?.schemes?.[0];
    const branchSem = scheme?.branchSemesters?.find(b => b.id === branchSemId) || scheme?.branchSemesters?.[0];
    const subject = branchSem?.subjects?.find(s => s.id === subjectId) || branchSem?.subjects?.[0];

    if (university && scheme && branchSem && subject) {
      this.state = { university, scheme, branchSem, subject };
      this.saveState();
      this.notify();
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.state));
  }
}

export const curriculumStateManager = new CurriculumStateManager();
