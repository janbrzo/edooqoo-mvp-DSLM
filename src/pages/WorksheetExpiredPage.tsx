import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, LogIn, UserPlus, FileText } from "lucide-react";

export default function WorksheetExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center">
          <Clock className="w-10 h-10 text-amber-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900">
          Worksheet Link Expired
        </h1>

        {/* Description */}
        <p className="text-gray-600 leading-relaxed">
          This worksheet link has expired after 24 hours. 
          Create a free account to save your worksheets forever and access all features!
        </p>

        {/* Benefits list */}
        <div className="bg-slate-50 rounded-lg p-4 text-left space-y-2">
          <p className="font-medium text-gray-800 text-sm">With a free account you get:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Worksheets that never expire
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Live Session with students
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Homework assignments
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span> Student progress tracking
            </li>
          </ul>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          <Link to="/signup" className="w-full">
            <Button className="w-full bg-primary hover:bg-primary/90" size="lg">
              <UserPlus className="mr-2 h-5 w-5" />
              Create Free Account
            </Button>
          </Link>
          
          <Link to="/login" className="w-full">
            <Button variant="outline" className="w-full" size="lg">
              <LogIn className="mr-2 h-5 w-5" />
              Log In
            </Button>
          </Link>
        </div>

        {/* Generate new worksheet link */}
        <div className="pt-4 border-t border-gray-200">
          <Link 
            to="/" 
            className="text-primary hover:underline text-sm inline-flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            Generate a new worksheet
          </Link>
        </div>
      </div>
    </div>
  );
}
