import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator, TrendingUp, Clock, Plus, Minus, Info, Users } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";

type RecommendedPlan = "side-gig" | "full-time";

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
  recommendedPlan: RecommendedPlan;
  recommendedWorksheets: number;
  monthlyPlanCost: number;
}

interface PricingCalculatorProps {
  onRecommendation?: (plan: RecommendedPlan, worksheetsNeeded: number, lessonsPerWeek?: number) => void;
  variant?: "pricing" | "landing";
  onPrimaryCta?: () => void;
  onSecondaryCta?: () => void;
}

const FULL_TIME_PLANS = [
  { worksheets: 30, cost: 19 },
  { worksheets: 60, cost: 39 },
  { worksheets: 90, cost: 59 },
  { worksheets: 120, cost: 79 },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

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
  const worksheetsNeeded = Math.ceil(studentsPerWeek * 4);
  const plan = getPlanForWorksheets(worksheetsNeeded);
  const currentWeeklyPrepMinutes = prepMinutesPerStudent * studentsPerWeek;
  const targetWeeklyPrepMinutes = studentsPerWeek;
  const savedWeeklyMinutes = Math.max(0, currentWeeklyPrepMinutes - targetWeeklyPrepMinutes);
  const savedMonthlyHours = savedWeeklyMinutes * 4.33 / 60;
  const extraLessonsPerWeek = Math.floor(savedWeeklyMinutes / lessonLengthMinutes);
  const potentialMonthlyRevenue = Math.max(0, extraLessonsPerWeek * lessonPrice * 4.33 - plan.monthlyPlanCost);

  return {
    currentWeeklyPrepMinutes,
    targetWeeklyPrepMinutes,
    savedWeeklyMinutes,
    savedMonthlyHours,
    extraLessonsPerWeek,
    potentialMonthlyRevenue,
    ...plan,
  };
};

export const PricingCalculator: React.FC<PricingCalculatorProps> = ({
  onRecommendation,
  variant = "pricing",
  onPrimaryCta,
  onSecondaryCta,
}) => {
  const [prepTime, setPrepTime] = useState(25);
  const [lessonPrice, setLessonPrice] = useState(25);
  const [studentsPerWeek, setStudentsPerWeek] = useState(7);
  const [lessonLength, setLessonLength] = useState(60);
  const { trackEvent } = useEventTracking();

  const result = useMemo(
    () =>
      calculateOneMinutePrepImpact({
        prepMinutesPerStudent: prepTime,
        studentsPerWeek,
        lessonPrice,
        lessonLengthMinutes: lessonLength,
      }),
    [prepTime, studentsPerWeek, lessonPrice, lessonLength]
  );

  useEffect(() => {
    onRecommendation?.(result.recommendedPlan, result.recommendedWorksheets, studentsPerWeek);
  }, [onRecommendation, result.recommendedPlan, result.recommendedWorksheets, studentsPerWeek]);

  const trackCalculatorCta = (target: "worksheet-form" | "pricing") => {
    trackEvent({
      eventType: target === "worksheet-form" ? "one_minute_calculator_cta_click" : "one_minute_calculator_pricing_click",
      eventData: {
        target,
        prepMinutesPerStudent: prepTime,
        studentsPerWeek,
        lessonPrice,
        lessonLengthMinutes: lessonLength,
        savedMonthlyHours: Number(result.savedMonthlyHours.toFixed(1)),
        extraLessonsPerWeek: result.extraLessonsPerWeek,
        potentialMonthlyRevenue: Math.round(result.potentialMonthlyRevenue),
        recommendedPlan: result.recommendedPlan,
      },
    });
  };

  const handleIncrement = (field: "prepTime" | "lessonPrice" | "studentsPerWeek") => {
    switch (field) {
      case "prepTime":
        setPrepTime((prev) => Math.min(prev + 5, 120));
        break;
      case "lessonPrice":
        setLessonPrice((prev) => Math.min(prev + 5, 200));
        break;
      case "studentsPerWeek":
        setStudentsPerWeek((prev) => Math.min(prev + 1, 50));
        break;
    }
  };

  const handleDecrement = (field: "prepTime" | "lessonPrice" | "studentsPerWeek") => {
    switch (field) {
      case "prepTime":
        setPrepTime((prev) => Math.max(prev - 5, 1));
        break;
      case "lessonPrice":
        setLessonPrice((prev) => Math.max(prev - 5, 1));
        break;
      case "studentsPerWeek":
        setStudentsPerWeek((prev) => Math.max(prev - 1, 1));
        break;
    }
  };

  const handlePrimaryCta = () => {
    trackCalculatorCta("worksheet-form");
    onPrimaryCta?.();
  };

  const handleSecondaryCta = () => {
    trackCalculatorCta("pricing");
    onSecondaryCta?.();
  };

  return (
    <Card className="mb-6 bg-white border-2 shadow-md" style={{ backgroundColor: "white", opacity: 1 }}>
      <CardHeader className="text-center pb-3 bg-white rounded-none">
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-gray-900">Calculate your 1-Minute Prep impact</CardTitle>
          </div>
          <p className="text-gray-600 text-sm max-w-2xl">
            Compare your current weekly prep with a workflow designed around about 1 focused minute per recurring student.
          </p>
        </div>
      </CardHeader>

      <CardContent className="bg-white">
        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor="prep-time" className="text-sm text-gray-900">
                  Prep per student
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How many minutes do you usually spend preparing for one recurring student each week?</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
                  onClick={() => handleDecrement("prepTime")}
                  aria-label="Decrease prep time"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  id="prep-time"
                  type="number"
                  value={prepTime}
                  onChange={(e) => setPrepTime(Math.max(1, Math.min(120, Number(e.target.value))))}
                  min="1"
                  max="120"
                  className="h-9 w-16 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  aria-label="Prep minutes per student"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
                  onClick={() => handleIncrement("prepTime")}
                  aria-label="Increase prep time"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor="students-week" className="text-sm text-gray-900">
                  Recurring students
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How many recurring 1:1 students do you prepare for each week?</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
                  onClick={() => handleDecrement("studentsPerWeek")}
                  aria-label="Decrease recurring students"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  id="students-week"
                  type="number"
                  value={studentsPerWeek}
                  onChange={(e) => setStudentsPerWeek(Math.max(1, Math.min(50, Number(e.target.value))))}
                  min="1"
                  max="50"
                  className="h-9 w-16 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  aria-label="Recurring students per week"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
                  onClick={() => handleIncrement("studentsPerWeek")}
                  aria-label="Increase recurring students"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor="lesson-price" className="text-sm text-gray-900">
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
                  id="lesson-price"
                  type="number"
                  value={lessonPrice}
                  onChange={(e) => setLessonPrice(Math.max(1, Math.min(200, Number(e.target.value))))}
                  min="1"
                  max="200"
                  className="h-9 w-16 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
              <Label htmlFor="lesson-length" className="text-sm text-gray-900">
                Lesson length
              </Label>
              <select
                id="lesson-length"
                value={lessonLength}
                onChange={(e) => setLessonLength(Number(e.target.value))}
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

          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200 text-sm">Estimated prep impact</span>
              </div>
              <Badge variant="secondary" className="bg-white text-green-800 border-green-200">
                {result.recommendedPlan === "side-gig" ? "Side-Gig" : "Full-Time"} fit
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="text-center bg-white/70 rounded-md p-3 border border-green-100">
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <Clock className="h-4 w-4" />
                  <span className="text-2xl font-bold">{result.savedMonthlyHours.toFixed(1)}h</span>
                </div>
                <div className="text-xs text-green-700 dark:text-green-400">prep time you can reclaim monthly</div>
              </div>
              <div className="text-center bg-white/70 rounded-md p-3 border border-green-100">
                <div className="flex items-center justify-center gap-1 text-green-600">
                  <Users className="h-4 w-4" />
                  <span className="text-2xl font-bold">{result.extraLessonsPerWeek}</span>
                </div>
                <div className="text-xs text-green-700 dark:text-green-400">potential extra lessons weekly</div>
              </div>
              <div className="text-center bg-white/70 rounded-md p-3 border border-green-100">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(result.potentialMonthlyRevenue)}</div>
                <div className="text-xs text-green-700 dark:text-green-400">estimated monthly revenue capacity</div>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-green-800/80 mt-3">
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
