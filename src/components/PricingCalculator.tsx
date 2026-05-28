import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator, TrendingUp, Clock, Plus, Minus, Info, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEventTracking } from "@/hooks/useEventTracking";

type RecommendedPlan = "side-gig" | "full-time";
type CalculatorVariant = "pricing" | "landing" | "hero";

export interface OneMinutePrepCalculatorInput {
  prepMinutesPerStudent: number;
  studentsPerWeek: number;
  lessonPrice: number;
  lessonLengthMinutes: number;
}

export interface OneMinutePrepCalculatorResult {
  currentWeeklyPrepMinutes: number;
  targetWeeklyPrepMinutes: number;
  savedWeeklyMinutes: number;
  savedMonthlyHours: number;
  extraLessonsPerWeek: number;
  potentialMonthlyRevenue: number;
  currentMonthlyPrepMinutes: number;
  targetMonthlyPrepMinutes: number;
  monthlyPrepMinutesTiedUp: number;
  monthlyPrepHoursTiedUp: number;
  monthlyLessonSlotsTiedUp: number;
  monthlyRevenueCapacityTiedUp: number;
  recommendedPlan: RecommendedPlan;
  recommendedWorksheets: number;
  monthlyPlanCost: number;
}

interface PricingCalculatorProps {
  onRecommendation?: (plan: RecommendedPlan, worksheetsNeeded: number, lessonsPerWeek?: number) => void;
  variant?: CalculatorVariant;
  value?: OneMinutePrepCalculatorInput;
  defaultValue?: OneMinutePrepCalculatorInput;
  onValueChange?: (value: OneMinutePrepCalculatorInput) => void;
  onPrimaryCta?: () => void;
  onSecondaryCta?: () => void;
  className?: string;
}

const WEEKS_PER_MONTH = 4.33;
const TARGET_PREP_MINUTES_PER_STUDENT_PER_WEEK = 1;

export const DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT: OneMinutePrepCalculatorInput = {
  prepMinutesPerStudent: 25,
  studentsPerWeek: 7,
  lessonPrice: 25,
  lessonLengthMinutes: 60,
};

const FULL_TIME_PLANS = [
  { worksheets: 30, cost: 19 },
  { worksheets: 60, cost: 39 },
  { worksheets: 90, cost: 59 },
  { worksheets: 120, cost: 79 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

const clampNumber = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
};

const getPlanForWorksheets = (worksheetsNeeded: number) => {
  if (worksheetsNeeded <= 15) {
    return { recommendedPlan: "side-gig" as const, recommendedWorksheets: 15, monthlyPlanCost: 9 };
  }

  const fullTime = FULL_TIME_PLANS.find((plan) => worksheetsNeeded <= plan.worksheets) || FULL_TIME_PLANS[FULL_TIME_PLANS.length - 1];
  return {
    recommendedPlan: "full-time" as const,
    recommendedWorksheets: fullTime.worksheets,
    monthlyPlanCost: fullTime.cost,
  };
};

export const calculateOneMinutePrepImpact = ({
  prepMinutesPerStudent,
  studentsPerWeek,
  lessonPrice,
  lessonLengthMinutes,
}: OneMinutePrepCalculatorInput): OneMinutePrepCalculatorResult => {
  const worksheetsNeeded = Math.ceil(studentsPerWeek * WEEKS_PER_MONTH);
  const plan = getPlanForWorksheets(worksheetsNeeded);
  const currentWeeklyPrepMinutes = prepMinutesPerStudent * studentsPerWeek;
  const targetWeeklyPrepMinutes = studentsPerWeek * TARGET_PREP_MINUTES_PER_STUDENT_PER_WEEK;
  const savedWeeklyMinutes = Math.max(0, currentWeeklyPrepMinutes - targetWeeklyPrepMinutes);
  const currentMonthlyPrepMinutes = currentWeeklyPrepMinutes * WEEKS_PER_MONTH;
  const targetMonthlyPrepMinutes = targetWeeklyPrepMinutes * WEEKS_PER_MONTH;
  const monthlyPrepMinutesTiedUp = Math.max(0, currentMonthlyPrepMinutes - targetMonthlyPrepMinutes);
  const monthlyPrepHoursTiedUp = monthlyPrepMinutesTiedUp / 60;
  const monthlyLessonSlotsTiedUp = Math.floor(monthlyPrepMinutesTiedUp / lessonLengthMinutes);
  const monthlyRevenueCapacityTiedUp = Math.max(0, monthlyLessonSlotsTiedUp * lessonPrice);

  return {
    currentWeeklyPrepMinutes,
    targetWeeklyPrepMinutes,
    savedWeeklyMinutes,
    savedMonthlyHours: monthlyPrepHoursTiedUp,
    extraLessonsPerWeek: Math.floor(savedWeeklyMinutes / lessonLengthMinutes),
    potentialMonthlyRevenue: monthlyRevenueCapacityTiedUp,
    currentMonthlyPrepMinutes,
    targetMonthlyPrepMinutes,
    monthlyPrepMinutesTiedUp,
    monthlyPrepHoursTiedUp,
    monthlyLessonSlotsTiedUp,
    monthlyRevenueCapacityTiedUp,
    ...plan,
  };
};

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onRecommendation,
  variant = "pricing",
  value,
  defaultValue = DEFAULT_ONE_MINUTE_PREP_CALCULATOR_INPUT,
  onValueChange,
  onPrimaryCta,
  onSecondaryCta,
  className,
}) => {
  const [internalValue, setInternalValue] = useState<OneMinutePrepCalculatorInput>(defaultValue);
  const { trackEvent } = useEventTracking();
  const calculatorValue = value ?? internalValue;
  const isHero = variant === "hero";

  const result = useMemo(() => calculateOneMinutePrepImpact(calculatorValue), [calculatorValue]);

  useEffect(() => {
    onRecommendation?.(result.recommendedPlan, result.recommendedWorksheets, calculatorValue.studentsPerWeek);
  }, [onRecommendation, result.recommendedPlan, result.recommendedWorksheets, calculatorValue.studentsPerWeek]);

  const updateValue = (patch: Partial<OneMinutePrepCalculatorInput>) => {
    const next = { ...calculatorValue, ...patch };
    if (!value) setInternalValue(next);
    onValueChange?.(next);
  };

  const trackCalculatorCta = (target: "signup-modal" | "worksheet-form" | "pricing") => {
    trackEvent({
      eventType: target === "pricing" ? "one_minute_calculator_pricing_click" : "one_minute_calculator_cta_click",
      eventData: {
        target,
        variant,
        ...calculatorValue,
        monthlyPrepHoursTiedUp: Number(result.monthlyPrepHoursTiedUp.toFixed(1)),
        monthlyLessonSlotsTiedUp: result.monthlyLessonSlotsTiedUp,
        monthlyRevenueCapacityTiedUp: Math.round(result.monthlyRevenueCapacityTiedUp),
        recommendedPlan: result.recommendedPlan,
      },
    });
  };

  const handleIncrement = (field: "prepMinutesPerStudent" | "lessonPrice" | "studentsPerWeek") => {
    const step = field === "studentsPerWeek" ? 1 : 5;
    const max = field === "prepMinutesPerStudent" ? 120 : field === "lessonPrice" ? 200 : 50;
    updateValue({ [field]: clampNumber(calculatorValue[field] + step, 1, max) });
  };

  const handleDecrement = (field: "prepMinutesPerStudent" | "lessonPrice" | "studentsPerWeek") => {
    const step = field === "studentsPerWeek" ? 1 : 5;
    const max = field === "prepMinutesPerStudent" ? 120 : field === "lessonPrice" ? 200 : 50;
    updateValue({ [field]: clampNumber(calculatorValue[field] - step, 1, max) });
  };

  const handleNumberChange = (field: "prepMinutesPerStudent" | "lessonPrice" | "studentsPerWeek", rawValue: string) => {
    const max = field === "prepMinutesPerStudent" ? 120 : field === "lessonPrice" ? 200 : 50;
    updateValue({ [field]: clampNumber(Number(rawValue), 1, max) });
  };

  const handlePrimaryCta = () => {
    trackCalculatorCta("signup-modal");
    onPrimaryCta?.();
  };

  const handleSecondaryCta = () => {
    trackCalculatorCta("pricing");
    onSecondaryCta?.();
  };

  const inputControls = (
    <div className={cn("grid gap-3", "grid-cols-1 sm:grid-cols-2")}>
      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label htmlFor={`prep-time-${variant}`} className="text-sm text-gray-900">
            Prep per student weekly
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>How many minutes do you usually spend preparing for one student each week?</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
            onClick={() => handleDecrement("prepMinutesPerStudent")}
            aria-label="Decrease weekly prep time per student"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            id={`prep-time-${variant}`}
            type="number"
            value={calculatorValue.prepMinutesPerStudent}
            onChange={(e) => handleNumberChange("prepMinutesPerStudent", e.target.value)}
            min="1"
            max="120"
            className="h-9 w-full min-w-0 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            aria-label="Weekly prep minutes per student"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
            onClick={() => handleIncrement("prepMinutesPerStudent")}
            aria-label="Increase weekly prep time per student"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label htmlFor={`students-week-${variant}`} className="text-sm text-gray-900">
            Students weekly
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>How many 1:1 students do you prepare for each week? Include repeat and one-off students if you prepare materials for them.</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
            onClick={() => handleDecrement("studentsPerWeek")}
            aria-label="Decrease weekly students"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            id={`students-week-${variant}`}
            type="number"
            value={calculatorValue.studentsPerWeek}
            onChange={(e) => handleNumberChange("studentsPerWeek", e.target.value)}
            min="1"
            max="50"
            className="h-9 w-full min-w-0 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            aria-label="Students weekly"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
            onClick={() => handleIncrement("studentsPerWeek")}
            aria-label="Increase weekly students"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-1">
          <Label htmlFor={`lesson-price-${variant}`} className="text-sm text-gray-900">
            Lesson price
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              <p>What do you charge for one lesson?</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
            onClick={() => handleDecrement("lessonPrice")}
            aria-label="Decrease lesson price"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Input
            id={`lesson-price-${variant}`}
            type="number"
            value={calculatorValue.lessonPrice}
            onChange={(e) => handleNumberChange("lessonPrice", e.target.value)}
            min="1"
            max="200"
            className="h-9 w-full min-w-0 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            aria-label="Lesson price in dollars"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
            onClick={() => handleIncrement("lessonPrice")}
            aria-label="Increase lesson price"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor={`lesson-length-${variant}`} className="text-sm text-gray-900">
          Lesson length
        </Label>
        <select
          id={`lesson-length-${variant}`}
          value={calculatorValue.lessonLengthMinutes}
          onChange={(e) => updateValue({ lessonLengthMinutes: Number(e.target.value) })}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-gray-900"
          aria-label="Lesson length in minutes"
        >
          <option value={30}>30 min</option>
          <option value={45}>45 min</option>
          <option value={60}>60 min</option>
          <option value={90}>90 min</option>
        </select>
      </div>
    </div>
  );

  return (
    <Card
      className={cn(
        "w-full max-w-full overflow-hidden bg-white border-2 shadow-md",
        isHero ? "mb-0 border-violet-100 shadow-xl shadow-violet-500/10" : "mb-6",
        className
      )}
      style={{ backgroundColor: "white", opacity: 1 }}
    >
      <CardHeader className={cn("text-center bg-white rounded-none", isHero ? "pb-1 px-4 pt-3" : "pb-3")}>
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className={cn("text-gray-900", isHero ? "text-base" : "text-lg")}>See how much prep is silently costing you</CardTitle>
          </div>
          <p className={cn("text-gray-600", isHero ? "text-xs max-w-sm" : "text-sm max-w-2xl")}>
            See how many hours, lessons and dollars you currently lose to prep every month. Benchmark: about 1 focused minute per student.
          </p>
        </div>
      </CardHeader>

      <CardContent className={cn("bg-white", isHero ? "px-4 pb-4" : "")}>
        <div className={cn("grid gap-6", isHero ? "grid-cols-1" : "grid-cols-1 xl:grid-cols-[1fr_1fr]")}>
          <div className={cn(isHero ? "space-y-4" : "rounded-lg border border-gray-100 bg-gray-50/60 p-4")}>
            {inputControls}
            {!isHero && (
              <p className="text-xs text-muted-foreground leading-relaxed mt-4">
                Based on your weekly inputs. Results are normalized to a monthly estimate using 4.33 weeks per month.
              </p>
            )}
          </div>

          <div className={cn("bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800", isHero ? "p-3" : "p-4")}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200 text-sm">What prep is costing you monthly</span>
              </div>
              <Badge variant="secondary" className="bg-white text-green-800 border-green-200">
                {result.recommendedPlan === "side-gig" ? "Side-Gig" : "Full-Time"} fit
              </Badge>
            </div>

            <div className={cn("grid gap-2", isHero ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
              <div className={cn("text-center bg-white/70 rounded-md border border-green-100", isHero ? "p-2" : "p-3")}>
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <Clock className="h-4 w-4" />
                  <span className={cn("font-bold", isHero ? "text-xl" : "text-2xl")}>{result.monthlyPrepHoursTiedUp.toFixed(1)}h</span>
                </div>
                <div className={cn("text-green-700 dark:text-green-400", isHero ? "text-[10px] leading-tight" : "text-xs")}>hours lost to prep every month</div>
              </div>
              <div className={cn("text-center bg-white/70 rounded-md border border-green-100", isHero ? "p-2" : "p-3")}>
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <Users className="h-4 w-4" />
                  <span className={cn("font-bold", isHero ? "text-xl" : "text-2xl")}>{result.monthlyLessonSlotsTiedUp}</span>
                </div>
                <div className={cn("text-green-700 dark:text-green-400", isHero ? "text-[10px] leading-tight" : "text-xs")}>paid lessons you can't fit in</div>
              </div>
              <div className={cn("text-center bg-white/70 rounded-md border border-green-100", isHero ? "p-2 col-span-2" : "p-3")}>
                <div className={cn("font-bold text-green-600", isHero ? "text-xl" : "text-2xl")}>{formatCurrency(result.monthlyRevenueCapacityTiedUp)}</div>
                <div className={cn("text-green-700 dark:text-green-400", isHero ? "text-[10px] leading-tight" : "text-xs")}>revenue you leave on the table monthly</div>
              </div>
            </div>

            <p className={cn("leading-relaxed text-green-800/80", isHero ? "text-[10px] mt-2" : "text-[11px] mt-3")}>
              Estimate only. Edooqoo does not guarantee income or exact prep time. Results depend on student setup quality, lesson format, teacher review and plan usage.
            </p>

            {variant === "landing" && (
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button type="button" className="flex-1" onClick={handlePrimaryCta}>
                  Start 1-Minute Prep Free
                </Button>
                <Button type="button" variant="outline" className="flex-1 bg-white" onClick={handleSecondaryCta}>
                  See plans
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
