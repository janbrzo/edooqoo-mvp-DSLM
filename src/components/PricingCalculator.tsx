import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Calculator, TrendingUp, Clock, Plus, Minus, Info } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
interface PricingCalculatorProps {
  onRecommendation: (plan: "side-gig" | "full-time", worksheetsNeeded: number, lessonsPerWeek?: number) => void;
}
export const PricingCalculator: React.FC<PricingCalculatorProps> = ({ onRecommendation }) => {
  const { profile } = useProfile();
  const [prepTime, setPrepTime] = useState(25);
  const [lessonPrice, setLessonPrice] = useState(25);
  const [lessonsPerWeek, setLessonsPerWeek] = useState(7);
  const [monthlySavings, setMonthlySavings] = useState(0);
  const [timeSavings, setTimeSavings] = useState(0);
  const [recommendedPlan, setRecommendedPlan] = useState<"side-gig" | "full-time">("side-gig");
  const [recommendedWorksheets, setRecommendedWorksheets] = useState(15);
  const isCurrentPlanLower = (planType: string) => {
    const currentPlan = profile?.subscription_type || "Free Demo";
    if (planType === "Free Demo") {
      return currentPlan === "Side-Gig" || currentPlan.includes("Full-Time");
    }
    if (planType === "Side-Gig") {
      return currentPlan.includes("Full-Time");
    }
    return false;
  };
  const getPlanButtonText = (planType: string) => {
    if (isCurrentPlanLower(planType)) {
      return "Lower Plan";
    }
    const currentPlan = profile?.subscription_type || "Free Demo";
    if (planType === "Free Demo") {
      return currentPlan === "Free Demo" ? "Current Plan" : "Get Started Free";
    }
    if (planType === "Side-Gig") {
      return currentPlan === "Side-Gig" ? "Current Plan" : "Upgrade to Side-Gig";
    }
    return "Upgrade Plan";
  };
  useEffect(() => {
    // Calculate monthly prep time and cost
    const monthlyPrepHours = (prepTime * lessonsPerWeek * 4) / 60;
    const monthlyCost = monthlyPrepHours * lessonPrice;
    const monthlyPrepMinutes = prepTime * lessonsPerWeek * 4;

    // Determine recommended plan based on lessons per week
    const worksheetsNeeded = lessonsPerWeek * 4; // Assume 1 worksheet per lesson

    let planType: "side-gig" | "full-time" = "side-gig";
    let planCost = 9;
    let recommendedWorksheetCount = 15;
    if (worksheetsNeeded > 15) {
      planType = "full-time";
      // Find the best Full-Time plan
      if (worksheetsNeeded <= 30) {
        planCost = 19;
        recommendedWorksheetCount = 30;
      } else if (worksheetsNeeded <= 60) {
        planCost = 39;
        recommendedWorksheetCount = 60;
      } else if (worksheetsNeeded <= 90) {
        planCost = 59;
        recommendedWorksheetCount = 90;
      } else {
        planCost = 79;
        recommendedWorksheetCount = 120;
      }
    }
    const savings = monthlyCost - planCost;
    setMonthlySavings(savings);
    setTimeSavings(monthlyPrepMinutes);
    setRecommendedPlan(planType);
    setRecommendedWorksheets(recommendedWorksheetCount);

    // Pass lessons per week to parent for proper dropdown handling
    onRecommendation(planType, recommendedWorksheetCount, lessonsPerWeek);
  }, [prepTime, lessonPrice, lessonsPerWeek, onRecommendation, profile]);
  const handleIncrement = (field: "prepTime" | "lessonPrice" | "lessonsPerWeek") => {
    switch (field) {
      case "prepTime":
        setPrepTime((prev) => Math.min(prev + 5, 120));
        break;
      case "lessonPrice":
        setLessonPrice((prev) => Math.min(prev + 5, 200));
        break;
      case "lessonsPerWeek":
        setLessonsPerWeek((prev) => Math.min(prev + 1, 50));
        break;
    }
  };
  const handleDecrement = (field: "prepTime" | "lessonPrice" | "lessonsPerWeek") => {
    switch (field) {
      case "prepTime":
        setPrepTime((prev) => Math.max(prev - 5, 1));
        break;
      case "lessonPrice":
        setLessonPrice((prev) => Math.max(prev - 5, 1));
        break;
      case "lessonsPerWeek":
        setLessonsPerWeek((prev) => Math.max(prev - 1, 1));
        break;
    }
  };
  return (
    <Card className="mb-6 bg-white border-2 shadow-md" style={{ backgroundColor: "white", opacity: 1 }}>
      <CardHeader className="text-center pb-3 bg-white rounded-none">
        <div className="flex flex-col items-center gap-1 mb-2">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg text-gray-900">Calculate Your Savings</CardTitle>
          </div>
          <p className="text-gray-600 text-sm">
            See how much time and money you'll earn with our worksheet generator
          </p>
        </div>
      </CardHeader>

      <CardContent className="bg-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <Label htmlFor="prep-time" className="text-sm text-gray-900">
                  Prep time? (minutes)
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How many minutes do you typically spend preparing materials for each lesson?</p>
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
                  className="h-9 w-14 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  aria-label="Prep time in minutes"
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
                <Label htmlFor="lesson-price" className="text-sm text-gray-900">
                  Lesson price? ($)
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>What do you charge per hour for your English lessons?</p>
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
                  className="h-9 w-14 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
              <div className="flex items-center gap-1">
                <Label htmlFor="lessons-week" className="text-sm text-gray-900">
                  Lessons weekly?
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>How many lessons do you teach per week on average?</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
                  onClick={() => handleDecrement("lessonsPerWeek")}
                  aria-label="Decrease lessons per week"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Input
                  id="lessons-week"
                  type="number"
                  value={lessonsPerWeek}
                  onChange={(e) => setLessonsPerWeek(Math.max(1, Math.min(50, Number(e.target.value))))}
                  min="1"
                  max="50"
                  className="h-9 w-14 text-center [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                  aria-label="Lessons per week"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-8 p-0 bg-primary text-primary-foreground hover:bg-primary/90 border-none"
                  onClick={() => handleIncrement("lessonsPerWeek")}
                  aria-label="Increase lessons per week"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {monthlySavings > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-200 text-sm">Your Monthly Savings</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">${monthlySavings.toFixed(0)}</div>
                  <div className="text-xs text-green-700 dark:text-green-400">money saved with edooqoo</div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 text-green-600">
                    <Clock className="h-4 w-4" />
                    <span className="text-2xl font-bold">{timeSavings}min</span>
                  </div>
                  <div className="text-xs text-green-700 dark:text-green-400">time saved with edooqoo</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
