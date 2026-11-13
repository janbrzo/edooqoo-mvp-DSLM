// Pure builders for the records a placement report claim creates.
export type ClaimSkill = { score: number | null };
export type ClaimResult = {
  level: string | null;
  answeredCount: number;
  totalQuestions: number;
  completedAt: string;
  skills: Record<string, ClaimSkill>;
};

const SKILL_LABEL: Record<string, string> = {
  grammar: "grammar accuracy", vocabulary: "vocabulary range",
  reading: "reading comprehension", listening: "listening comprehension",
};

export function rankSkills(skills: Record<string, ClaimSkill>): { strongest: string | null; weakest: string | null; average: number | null } {
  const scored = Object.entries(skills).filter(([, s]) => typeof s?.score === "number") as [string, { score: number }][];
  scored.sort((a, b) => b[1].score - a[1].score);
  const average = scored.length ? Math.round(scored.reduce((n, [, s]) => n + s.score, 0) / scored.length) : null;
  return { strongest: scored[0]?.[0] ?? null, weakest: scored.length > 1 ? scored[scored.length - 1][0] : null, average };
}

/** Student email for the claimed student: invite email first, never the teacher's own address. */
export function resolveStudentEmail(inviteEmail: string | null | undefined, reportEmail: string | null | undefined, teacherEmails: Array<string | null | undefined>): string | null {
  const blocked = new Set(teacherEmails.filter(Boolean).map((e) => String(e).toLowerCase()));
  for (const candidate of [inviteEmail, reportEmail]) {
    const e = candidate?.trim().toLowerCase();
    if (e && !blocked.has(e)) return e;
  }
  return null;
}

export function buildWelcomeTestRow(r: ClaimResult, studentId: string, teacherId: string, reportId: string) {
  const { average } = rankSkills(r.skills);
  return {
    student_id: studentId, teacher_id: teacherId, test_type: "welcome", status: "reviewed",
    title: "Welcome Test (public placement)", total_questions: r.totalQuestions, answered_count: r.answeredCount,
    score_percentage: average, completed_at: r.completedAt, reviewed_at: new Date().toISOString(),
    generation_params: { source: "public_placement_preview", report_id: reportId },
  };
}

export function buildGoalRows(r: ClaimResult, studentId: string, teacherId: string, testId: string) {
  const { strongest, weakest } = rankSkills(r.skills);
  const label = (s: string) => SKILL_LABEL[s] ?? s;
  const base = { from: "public_placement", test_id: testId, estimated_level: r.level };
  const goals: Array<{ title: string; description: string; signal: string; value: string }> = [];
  if (weakest) goals.push({ title: `Improve ${label(weakest)}`, description: `The placement test marked ${label(weakest)} as the weakest skill. Focused practice should lift overall CEFR confidence.`, signal: "weakest_skill", value: weakest });
  if (strongest && strongest !== weakest) goals.push({ title: `Build confidence from ${label(strongest)}`, description: `The placement test marked ${label(strongest)} as the strongest skill. Use it as a confidence anchor while building weaker areas.`, signal: "strongest_skill", value: strongest });
  return goals.map((g, i) => ({
    student_id: studentId, teacher_id: teacherId, goal_type: "supporting", title: g.title, description: g.description,
    display_order: i, source: "welcome_test_auto", kind: "skill", target_category: g.value,
    metadata: { ...base, signal: g.signal, value: g.value },
  }));
}
