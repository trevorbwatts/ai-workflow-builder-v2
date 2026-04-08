import React from 'react';
import { ApprovalWorkflow } from '../types';
import {
  ArrowLeft, Save, Upload,
  FileEdit, Calendar, Clock, DollarSign, UserCog, Briefcase, Award,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  FileEdit, Calendar, Clock, DollarSign, UserCog, Briefcase, Award,
};

const statusBadge = (status: string) => {
  const styles: Record<string, string> = {
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    saved: 'bg-sky-50 text-sky-700 border-sky-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return styles[status] ?? styles.draft;
};

interface EditorHeaderProps {
  workflow: ApprovalWorkflow;
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  hasErrors: boolean;
  isDirty: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  workflow, onBack, onSave, onPublish, hasErrors, isDirty,
}) => {
  const Icon = ICON_MAP[workflow.icon] ?? FileEdit;

  return (
    <div className="h-14 border-b border-slate-200 bg-white flex items-center px-5 shrink-0 gap-3">
      <button
        onClick={onBack}
        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
      >
        <ArrowLeft size={18} />
      </button>

      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
        <Icon size={16} className="text-indigo-600" />
      </div>

      <h2 className="text-sm font-bold text-slate-900 flex-1">{workflow.name}</h2>

      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge(workflow.status)}`}>
        {workflow.status}
      </span>

      <div className="flex items-center gap-2 ml-2">
        <button
          onClick={onSave}
          disabled={!isDirty}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save size={13} /> Save
        </button>
        <button
          onClick={onPublish}
          disabled={hasErrors}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Upload size={13} /> Publish
        </button>
      </div>
    </div>
  );
};
