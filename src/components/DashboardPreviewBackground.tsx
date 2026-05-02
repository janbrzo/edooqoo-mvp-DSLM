import React from "react";
import { FileText, Users, Calendar, Sparkles } from "lucide-react";

/**
 * DashboardPreviewBackground - Static dashboard-like background for auth pages
 * This component creates a visual preview of the dashboard to use as a backdrop
 * for login/signup modals, providing better visual context for users.
 */
export const DashboardPreviewBackground = () => {
  return (
    <div className="fixed inset-0 bg-background overflow-hidden light">
      {/* Sidebar Mock */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-border">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <FileText className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Edooqoo</span>
          </div>

          <nav className="space-y-2">
            <div className="px-3 py-2 rounded-lg bg-primary/10 text-primary font-medium">Dashboard</div>
            <div className="px-3 py-2 rounded-lg text-muted-foreground">My Worksheets</div>
            <div className="px-3 py-2 rounded-lg text-muted-foreground">Students</div>
            <div className="px-3 py-2 rounded-lg text-muted-foreground">Homework</div>
          </nav>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="ml-64 min-h-screen p-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome back, Teacher</h1>
            <p className="text-muted-foreground">Here's your teaching overview</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-card border rounded-lg">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-semibold">150 tokens</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Token Card */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Tokens</span>
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="text-3xl font-bold mb-1">150</div>
            <div className="text-xs text-green-600">+50 this month</div>
          </div>

          {/* Monthly Worksheets Card */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">This Month</span>
              <Calendar className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-3xl font-bold mb-1">12</div>
            <div className="text-xs text-muted-foreground">worksheets created</div>
          </div>

          {/* Total Worksheets Card */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">All Time</span>
              <FileText className="h-4 w-4 text-purple-600" />
            </div>
            <div className="text-3xl font-bold mb-1">45</div>
            <div className="text-xs text-muted-foreground">total worksheets</div>
          </div>

          {/* Students Card */}
          <div className="bg-card border rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Students</span>
              <Users className="h-4 w-4 text-orange-600" />
            </div>
            <div className="text-3xl font-bold mb-1">8</div>
            <div className="text-xs text-muted-foreground">active students</div>
          </div>
        </div>

        {/* Recent Activity Section */}
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Worksheets</h3>
            <div className="space-y-3">
              <div className="p-3 bg-muted/50 rounded">
                <div className="font-medium">Business English Vocabulary</div>
                <div className="text-sm text-muted-foreground">Created 2 days ago</div>
              </div>
              <div className="p-3 bg-muted/50 rounded">
                <div className="font-medium">Past Perfect Tense Practice</div>
                <div className="text-sm text-muted-foreground">Created 5 days ago</div>
              </div>
              <div className="p-3 bg-muted/50 rounded">
                <div className="font-medium">Listening Comprehension</div>
                <div className="text-sm text-muted-foreground">Created 1 week ago</div>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Students</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded">
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                  JS
                </div>
                <div>
                  <div className="font-medium">John Smith</div>
                  <div className="text-sm text-muted-foreground">B2 Level</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded">
                <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-600 font-semibold">
                  MJ
                </div>
                <div>
                  <div className="font-medium">Mary Johnson</div>
                  <div className="text-sm text-muted-foreground">C1 Level</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded">
                <div className="h-10 w-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-600 font-semibold">
                  RD
                </div>
                <div>
                  <div className="font-medium">Robert Davis</div>
                  <div className="text-sm text-muted-foreground">A2 Level</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Blur Overlay - makes everything blurred and darkened */}
      <div className="absolute inset-0 backdrop-blur-sm bg-black/5" />
    </div>
  );
};
