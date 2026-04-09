'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { getSupabaseBrowser } from '@/lib/supabase-browser';
import { ShareTrustCard } from './TrustCardShare';

type TrustGrade = 'unverified' | 'low' | 'medium' | 'high' | 'verified';

const GRADE_STYLE: Record<TrustGrade, { color: string; border: string }> = {
  verified:   { color: 'text-emerald-400', border: 'border-emerald-800' },
  high:       { color: 'text-blue-400',    border: 'border-blue-800' },
  medium:     { color: 'text-indigo-400',  border: 'border-indigo-800' },
  low:        { color: 'text-amber-400',   border: 'border-amber-800' },
  unverified: { color: 'text-gray-400',    border: 'border-gray-700' },
};

const NOTABLE_GRADES: TrustGrade[] = ['high', 'verified'];

const GRADE_SCORES: Record<TrustGrade, number> = {
  unverified: 0,
  low: 30,
  medium: 50,
  high: 70,
  verified: 90,
};

interface AgentWithGrade {
  id: string;
  name: string;
  trust_grade: TrustGrade | null;
  trust_score: number | null;
}

export function TrustBanner() {
  const { user, isLoaded } = useUser();
  const [banner, setBanner] = useState<{ agentName: string; grade: TrustGrade; agentId: string; score: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const supabase = getSupabaseBrowser();
    const dismissedKey = `mandatez_dismissed_grades_${user.id}`;

    async function checkGrades() {
      const { data: agents } = await supabase
        .from('agents')
        .select('id, name, trust_grade, trust_score')
        .eq('owner_id', user!.id);

      if (!agents || agents.length === 0) return;

      // Check which grades have been dismissed
      const dismissedRaw = localStorage.getItem(dismissedKey);
      const dismissedGrades: Record<string, string> = dismissedRaw ? JSON.parse(dismissedRaw) : {};

      // Find an agent that recently reached a notable grade that hasn't been dismissed
      for (const agent of agents as AgentWithGrade[]) {
        const grade = agent.trust_grade ?? 'unverified';
        if (!NOTABLE_GRADES.includes(grade)) continue;
        if (dismissedGrades[agent.id] === grade) continue;

        const score = agent.trust_score ?? GRADE_SCORES[grade];
        setBanner({ agentName: agent.name, grade, agentId: agent.id, score });
        break;
      }
    }

    checkGrades();
  }, [user, isLoaded]);

  function handleDismiss() {
    if (!user || !banner) return;
    const dismissedKey = `mandatez_dismissed_grades_${user.id}`;
    const dismissedRaw = localStorage.getItem(dismissedKey);
    const dismissedGrades: Record<string, string> = dismissedRaw ? JSON.parse(dismissedRaw) : {};
    dismissedGrades[banner.agentId] = banner.grade;
    localStorage.setItem(dismissedKey, JSON.stringify(dismissedGrades));
    setDismissed(true);
  }

  if (!banner || dismissed) return null;

  const style = GRADE_STYLE[banner.grade];
  const gradeLabel = banner.grade === 'verified' ? 'VERIFIED' : 'HIGH TRUST';

  return (
    <div className="space-y-4 mb-6">
      <div className={`border ${style.border} rounded-lg p-4 flex items-center justify-between gap-4`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl shrink-0">🎉</span>
          <p className="text-sm text-gray-200">
            Your agent <span className={`font-semibold ${style.color}`}>{banner.agentName}</span>{' '}
            just reached <span className={`font-bold ${style.color}`}>{gradeLabel}</span> status — trust score {banner.score}/100
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowShareCard(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            Share your trust card →
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded hover:bg-gray-800 text-gray-500 hover:text-gray-300 transition-colors"
            aria-label="Dismiss"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {showShareCard && (
        <ShareTrustCard
          agentId={banner.agentId}
          score={banner.score}
          grade={banner.grade}
          onClose={() => setShowShareCard(false)}
        />
      )}
    </div>
  );
}
