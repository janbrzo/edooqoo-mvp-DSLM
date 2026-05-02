
import { Clock, FileText, Settings, Star } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Sidebar() {
  const isMobile = useIsMobile();
  
  // Na mobile sidebar jest ukryty w FormView, więc ten komponent nie będzie renderowany
  // ale zachowujemy pełną funkcjonalność dla desktop
  return (
    <div className="bg-worksheet-purpleLight p-6 rounded-lg h-fit mx-0 py-[24px]">
      <div className="mb-8">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-violet-500 to-blue-500">
          English Worksheet Generator
        </h1>
      </div>
      
      <div className="space-y-8 mt-12">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-full text-worksheet-purple">
            <Clock size={20} />
          </div>
          <div>
            <h3 className="font-medium text-worksheet-purpleDark">Save Time</h3>
            <p className="text-sm text-gray-600 font-light">Create in less than 5 minutes what would normally take 1-2 hours</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-full text-worksheet-purple">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="font-medium text-worksheet-purpleDark">Tailored Content</h3>
            <p className="text-sm text-gray-600 font-light">Specific, industry-focused exercises for your students</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-full text-worksheet-purple">
            <Star size={20} />
          </div>
          <div>
            <h3 className="font-medium text-worksheet-purpleDark">Ready to Use</h3>
            <p className="text-sm text-gray-600 font-light">Minimal edits needed (less than 10%)</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3">
          <div className="p-2 bg-white rounded-full text-worksheet-purple">
            <Settings size={20} />
          </div>
          <div>
            <h3 className="font-medium text-worksheet-purpleDark">Customizable</h3>
            <p className="text-sm text-gray-600 font-light">Easy to edit and adapt to your needs</p>
          </div>
        </div>
      </div>
    </div>
  );
}
