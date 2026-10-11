import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Terminal } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error captured by ErrorBoundary:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorageAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Failed to clear storage:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-center p-4">
          <div className="max-w-xl w-full bg-slate-800/90 backdrop-blur-xl border border-rose-500/30 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 shrink-0">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  MINDMESH-NEXUS Co-Pilot
                </h1>
                <p className="text-sm text-slate-400">
                  A client-side initialization anomaly occurred.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-4 font-mono text-xs text-rose-300 overflow-x-auto max-h-40">
              <p className="font-bold text-rose-400 mb-1">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              {this.state.errorInfo?.componentStack && (
                <pre className="text-slate-400 text-[11px] whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack.trim()}
                </pre>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4 animate-spin-hover" />
                Reload Application
              </button>
              <button
                type="button"
                onClick={this.handleClearStorageAndReload}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 font-semibold text-slate-200 border border-slate-600 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-rose-400" />
                Reset Cache & Restart
              </button>
            </div>

            <p className="text-center text-xs text-slate-400">
              Backend Fast-API Engine: <span className="text-emerald-400 font-mono">http://127.0.0.1:8000</span> (Active)
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
