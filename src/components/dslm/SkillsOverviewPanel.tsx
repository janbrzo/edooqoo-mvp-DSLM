import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSkillMetrics, SkillMetric, CategoryMetric, MicroSkillMetric } from '@/hooks/useSkillMetrics';
import { TrendingUp, TrendingDown, Minus, BarChart3, List, ArrowUpDown, Filter, Layers, GraduationCap } from 'lucide-react';
import { MasterySparkline } from './MasterySparkline';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
} from 'recharts';

interface SkillsOverviewPanelProps {
  studentId: string;
  teacherId: string;
  /** v4.2: render only one section (used to split Skills view into independently-collapsible cards). */
  onlySection?: 'heatmap' | 'micro';
}

const CATEGORY_LABELS: Record<string, string> = {
  grammar: 'Grammar',
  vocabulary: 'Vocabulary',
  reading: 'Reading',
  speaking: 'Speaking',
  writing: 'Writing',
  listening: 'Listening',
  pronunciation: 'Pronunciation',
  visual_comprehension: 'Visual Comprehension',
  other: 'Other',
};

const MICRO_SKILL_LABELS: Record<string, string> = {
  ps: 'Past Simple', pc: 'Past Continuous', pp: 'Past Perfect',
  prs: 'Present Simple', prc: 'Present Continuous', prp: 'Present Perfect', prpc: 'Pres. Perfect Cont.',
  fs: 'Future Simple', fg: 'Future Going To', fc: 'Future Continuous',
  cond1: 'First Conditional', cond2: 'Second Conditional', cond3: 'Third Conditional', condm: 'Mixed Conditionals',
  passive: 'Passive Voice', rs: 'Reported Speech', rel: 'Relative Clauses', mod: 'Modal Verbs',
  ger_inf: 'Gerund/Infinitive', phr: 'Phrasal Verbs', comp: 'Comparatives', sup: 'Superlatives',
  art: 'Articles', prep: 'Prepositions', wo: 'Word Order', neg: 'Negative Prefixes', wf: 'Word Formation',
  vocab: 'Vocabulary', coll: 'Collocations', idiom: 'Idioms', syn: 'Synonyms', ant: 'Antonyms',
  reading: 'Reading', speaking: 'Speaking', writing: 'Writing', listening: 'Listening',
  grammar_other: 'Grammar (Other)', pronunciation: 'Pronunciation',
};

const CATEGORY_ORDER = ['grammar', 'vocabulary', 'reading', 'speaking', 'writing', 'listening', 'pronunciation', 'visual_comprehension'];

const PERIOD_PRESETS = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '60d', days: 60 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: 'All', days: null as number | null },
];

const CEFR_LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'improving') return <TrendingUp className="h-4 w-4 text-green-500" />;
  if (trend === 'declining') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

function MasteryBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-green-500' : value >= 50 ? 'bg-yellow-500' : value >= 25 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-mono w-8 text-right">{Math.round(value)}%</span>
    </div>
  );
}

function formatSkillName(name: string): string {
  if (name.startsWith('flashcard:')) return `Flashcard ${name.slice(10, 18)}…`;
  const parts = name.split('.');
  const last = parts[parts.length - 1];
  return last.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function SkillsOverviewPanel({ studentId, teacherId, onlySection }: SkillsOverviewPanelProps) {
  const [periodDays, setPeriodDays] = useState<number | null>(null);
  const [customPeriod, setCustomPeriod] = useState('');
  const [viewMode, setViewMode] = useState<'nano' | 'micro'>('micro');
  const [cefrFilter, setCefrFilter] = useState<string>('All');

  const { skills, categories, microSkills, isLoading, error } = useSkillMetrics(studentId, teacherId, periodDays);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'mastery' | 'events' | 'name'>('mastery');
  const [showFlashcards, setShowFlashcards] = useState(false);

  // Helper: extract CEFR level from skill_name like ns.A2.vocabulary.xxx
  const extractCefr = (skillName: string): string | null => {
    const match = skillName.match(/^ns\.([A-C][12])\./);
    return match ? match[1] : null;
  };

  const matchesCefr = (skillName: string): boolean => {
    if (cefrFilter === 'All') return true;
    return extractCefr(skillName) === cefrFilter;
  };

  const nanoSkills = useMemo(() => {
    let filtered = skills.filter(s => showFlashcards || !s.skill_name.startsWith('flashcard:'));
    filtered = filtered.filter(s => matchesCefr(s.skill_name));
    if (selectedCategory) {
      filtered = filtered.filter(s => s.skill_category === selectedCategory);
    }
    return filtered.sort((a, b) => {
      if (sortBy === 'mastery') return b.current_mastery - a.current_mastery;
      if (sortBy === 'events') return b.total_events - a.total_events;
      return a.skill_name.localeCompare(b.skill_name);
    });
  }, [skills, selectedCategory, sortBy, showFlashcards, cefrFilter]);

  const filteredMicroSkills = useMemo(() => {
    let filtered = microSkills;
    if (selectedCategory) {
      filtered = filtered.filter(s => s.skill_category === selectedCategory);
    }
    // CEFR filter for micro skills - filter underlying nano skills
    if (cefrFilter !== 'All') {
      const microSkillsWithCefr = skills
        .filter(s => matchesCefr(s.skill_name) && s.micro_skill)
        .map(s => s.micro_skill);
      const uniqueMicro = new Set(microSkillsWithCefr);
      filtered = filtered.filter(s => uniqueMicro.has(s.micro_skill));
    }
    return filtered.sort((a, b) => {
      if (sortBy === 'mastery') return b.avg_mastery - a.avg_mastery;
      if (sortBy === 'events') return b.total_events - a.total_events;
      return a.micro_skill.localeCompare(b.micro_skill);
    });
  }, [microSkills, selectedCategory, sortBy, cefrFilter, skills]);

  const radarData = useMemo(() => {
    return CATEGORY_ORDER
      .map(cat => {
        const found = categories.find(c => c.category === cat);
        return {
          category: CATEGORY_LABELS[cat] || cat,
          mastery: found ? found.avg_mastery : 0,
          events: found ? found.total_events : 0,
        };
      })
      .filter(d => d.events > 0 || categories.length > 0);
  }, [categories]);

  const totalSkills = skills.filter(s => !s.skill_name.startsWith('flashcard:')).length;
  const flashcardCount = skills.filter(s => s.skill_name.startsWith('flashcard:')).length;
  const overallMastery = categories.length > 0
    ? Math.round(categories.reduce((sum, c) => sum + c.avg_mastery, 0) / categories.length)
    : 0;

  const handleCustomPeriod = () => {
    const val = parseInt(customPeriod);
    if (val > 0 && val <= 365) {
      setPeriodDays(val);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground mt-2">Loading skill metrics...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          Error loading metrics: {(error as Error).message}
        </CardContent>
      </Card>
    );
  }

  // Period filter is now always visible (moved to render below)
  const hasNoData = skills.length === 0;

  return (
    <div className="space-y-6">
      {/* Period Filter - always visible */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-muted-foreground">Period:</span>
        {PERIOD_PRESETS.map(p => (
          <Button
            key={p.label}
            variant={periodDays === p.days ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setPeriodDays(p.days)}
          >
            {p.label}
          </Button>
        ))}
        <div className="flex items-center gap-1">
          <Input
            type="number"
            placeholder="Custom"
            className="h-7 w-20 text-xs"
            value={customPeriod}
            onChange={e => setCustomPeriod(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomPeriod()}
          />
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={handleCustomPeriod}>
            Go
          </Button>
        </div>

        <div className="h-5 w-px bg-border mx-1" />

        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <GraduationCap className="h-4 w-4" />
          CEFR:
        </span>
        {CEFR_LEVELS.map(level => (
          <Button
            key={level}
            variant={cefrFilter === level ? 'default' : 'outline'}
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setCefrFilter(level)}
          >
            {level}
          </Button>
        ))}
      </div>

      {/* No data message - shown below filters */}
      {hasNoData && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No skill data yet</h3>
            <p className="text-muted-foreground">
              {periodDays !== null
                ? `No skills found for the last ${periodDays} days. Try selecting a longer period.`
                : 'Skills will appear here after the student completes worksheets, homework, or flashcard reviews.'}
            </p>
          </CardContent>
        </Card>
      )}

      {hasNoData ? null : (
      <>

      {/* Summary Cards — heatmap-only */}
      {onlySection !== 'micro' && (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{overallMastery}%</p>
            <p className="text-xs text-muted-foreground">Overall Mastery</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{totalSkills}</p>
            <p className="text-xs text-muted-foreground">Nano Skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{microSkills.length}</p>
            <p className="text-xs text-muted-foreground">Micro Skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <p className="text-2xl font-bold">{flashcardCount}</p>
            <p className="text-xs text-muted-foreground">Flashcards Tracked</p>
          </CardContent>
        </Card>
      </div>
      )}

      {/* Radar Chart + Category List — heatmap-only */}
      {onlySection !== 'micro' && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {radarData.length >= 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Skills Radar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Radar name="Mastery" dataKey="mastery" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CATEGORY_ORDER.map(cat => {
              const metric = categories.find(c => c.category === cat);
              if (!metric) return null;
              return (
                <button
                  key={cat}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedCategory === cat ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{CATEGORY_LABELS[cat]}</span>
                      <TrendIcon trend={metric.trend} />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {metric.skill_count} skills
                    </Badge>
                  </div>
                  <MasteryBar value={metric.avg_mastery} />
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Skills List — micro-only */}
      {onlySection !== 'heatmap' && (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <List className="h-4 w-4" />
              {viewMode === 'micro' ? 'Micro Skills' : (selectedCategory ? `${CATEGORY_LABELS[selectedCategory]} Skills` : 'All Nano Skills')}
              <Badge variant="outline">{viewMode === 'micro' ? filteredMicroSkills.length : nanoSkills.length}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'micro' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode(viewMode === 'micro' ? 'nano' : 'micro')}
              >
                <Layers className="h-3 w-3 mr-1" />
                {viewMode === 'micro' ? 'Micro View' : 'Nano View'}
              </Button>
              {viewMode === 'nano' && (
                <Button
                  variant={showFlashcards ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowFlashcards(!showFlashcards)}
                >
                  {showFlashcards ? 'Hide' : 'Show'} Flashcards
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortBy(sortBy === 'mastery' ? 'events' : sortBy === 'events' ? 'name' : 'mastery')}
              >
                <ArrowUpDown className="h-3 w-3 mr-1" />
                {sortBy === 'mastery' ? 'By Mastery' : sortBy === 'events' ? 'By Events' : 'By Name'}
              </Button>
              {selectedCategory && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedCategory(null)}>
                  <Filter className="h-3 w-3 mr-1" /> Clear Filter
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {viewMode === 'micro' ? (
              <>
                {filteredMicroSkills.map(ms => (
                  <div key={ms.micro_skill} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                    <TrendIcon trend={ms.trend} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{MICRO_SKILL_LABELS[ms.micro_skill] || ms.micro_skill}</p>
                      <p className="text-xs text-muted-foreground">
                        {ms.total_events} event{ms.total_events !== 1 ? 's' : ''} · {ms.nano_skill_count} nano skills · {ms.skill_category}
                      </p>
                    </div>
                    <div className="w-32">
                      <MasteryBar value={ms.avg_mastery} />
                    </div>
                  </div>
                ))}
                {filteredMicroSkills.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No micro skills found for this filter.</p>
                )}
              </>
            ) : (
              <>
                {nanoSkills.slice(0, 100).map(skill => (
                  <div key={skill.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                    <TrendIcon trend={skill.trend} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{formatSkillName(skill.skill_name)}</p>
                      <p className="text-xs text-muted-foreground">
                        {skill.total_events} event{skill.total_events !== 1 ? 's' : ''} · {skill.skill_category}
                        {skill.micro_skill && ` · ${MICRO_SKILL_LABELS[skill.micro_skill] || skill.micro_skill}`}
                      </p>
                    </div>
                    <MasterySparkline history={skill.mastery_history} trend={skill.trend} />
                    <div className="w-32">
                      <MasteryBar value={skill.current_mastery} />
                    </div>
                  </div>
                ))}
                {nanoSkills.length > 100 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Showing 100 of {nanoSkills.length} skills
                  </p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
      )}
      </>
      )}
    </div>
  );
}
