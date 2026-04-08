import React from 'react';
import { ApprovalWorkflow } from '../types';
import { motion } from 'motion/react';
import {
  FileEdit, Calendar, Clock, DollarSign, UserCog, Briefcase, Award,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  FileEdit, Calendar, Clock, DollarSign, UserCog, Briefcase, Award,
};

const statusBadge = (status: string) => {
  const styles = {
    published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    saved: 'bg-sky-50 text-sky-700 border-sky-200',
    draft: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return styles[status as keyof typeof styles] ?? styles.draft;
};

interface ApprovalTileGridProps {
  workflows: ApprovalWorkflow[];
  onSelect: (id: string) => void;
}

export const ApprovalTileGrid: React.FC<ApprovalTileGridProps> = ({ workflows, onSelect }) => {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-900 mb-1">Approval Workflows</h2>
      <p className="text-sm text-slate-500 mb-6">Configure how requests are routed and approved across your organization.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workflows.map((wf, i) => {
          const Icon = ICON_MAP[wf.icon] ?? FileEdit;
          const ruleCount = wf.rules.length;

          return (
            <motion.button
              key={wf.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, type: 'spring', damping: 28, stiffness: 220 }}
              onClick={() => onSelect(wf.id)}
              className="glass-panel rounded-2xl p-5 text-left hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
                  <Icon size={20} className="text-indigo-600" />
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadge(wf.status)}`}>
                  {wf.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">{wf.name}</h3>
              <p className="text-xs text-slate-400">
                {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
