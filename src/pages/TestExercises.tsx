import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import WorksheetContent from "@/components/worksheet/WorksheetContent";
import { mockNewExercisesData } from "@/mockNewExercisesData";

/**
 * Test page for previewing all 6 new exercise types
 * Accessible at /test-exercises for immediate testing without generation
 */
const TestExercises = () => {
  const [editableWorksheet, setEditableWorksheet] = useState(mockNewExercisesData);
  const [isEditing, setIsEditing] = useState(false);
  const [viewMode, setViewMode] = useState<"student" | "teacher">("teacher");

  const mockInputParams = {
    lessonTime: "60min" as const,
    lessonTopic: "New Exercise Types Testing",
    lessonGoal: "Test and preview all new exercise formats",
    teachingPreferences: "Interactive and varied exercise types",
    englishLevel: "B1/B2" as const,
    languageStyle: 5
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header with navigation and controls */}
      <div className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Back button */}
            <Button asChild variant="ghost" size="sm">
              <Link to="/" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </Link>
            </Button>

            {/* Title and badge */}
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                TEST MODE
              </Badge>
              <h1 className="text-lg font-semibold text-gray-900">
                New Exercise Types Preview
              </h1>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "student" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("student")}
              >
                Student View
              </Button>
              <Button
                variant={viewMode === "teacher" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("teacher")}
              >
                Teacher View
              </Button>
              <Button
                variant={isEditing ? "default" : "outline"}
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "Save Changes" : "Edit Mode"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-800 flex items-center gap-2">
              🧪 Test Environment - New Exercise Types
            </CardTitle>
            <CardDescription className="text-blue-700">
              This page displays all 20 exercise types available in the system for testing and preview purposes. 
              You can switch between student and teacher views, and test editing functionality.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {/* Advanced Exercise Types */}
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Odd One Out
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Synonyms/Antonyms
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Sentence Transform
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Word Order
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Gap Text
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Negative Prefixes
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Categorize
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Paraphrasing
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Complete Word
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-blue-50">
                Matching Halves
              </Badge>
              {/* New Additional Types */}
              <Badge variant="outline" className="justify-center py-2 bg-green-50">
                Describe Picture
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-green-50">
                Answer Questions
              </Badge>
              {/* Basic Exercise Types */}
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Reading
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                True/False
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Matching
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Fill in Blanks
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Multiple Choice
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Dialogue
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Discussion
              </Badge>
              <Badge variant="outline" className="justify-center py-2 bg-gray-50">
                Error Correction
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Worksheet content */}
        <WorksheetContent
          editableWorksheet={editableWorksheet}
          isEditing={isEditing}
          viewMode={viewMode}
          setEditableWorksheet={setEditableWorksheet}
          worksheetId="test-new-exercises"
          onFeedbackSubmit={() => {}}
          isDownloadUnlocked={true}
          inputParams={mockInputParams}
        />
      </div>
    </div>
  );
};

export default TestExercises;