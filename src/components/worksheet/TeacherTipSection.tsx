
import React from "react";
import { Info } from "lucide-react";

interface TeacherTipSectionProps {
  tip: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  viewMode: "student" | "teacher";
}

const TeacherTipSection: React.FC<TeacherTipSectionProps> = ({
  tip,
  isEditing,
  onChange,
  viewMode
}) => {
  return (
    <div 
      style={{
        background: "#FEF9E7", // Lighter yellow background
        borderLeft: "4px solid #ffeab9"
      }} 
      data-no-pdf="true" 
      data-teacher-tip="true"
      className={`mt-4 px-3 pt-2 pb-1 rounded-md teacher-tip items-start bg-amber-50 ${viewMode === 'student' ? 'hidden' : 'flex'}`}
    >
      <Info className="text-amber-400 mr-2 mt-1" size={19} />
      <div className="flex-1 min-w-0">
        <span className="text-amber-800 text-[13.5px] leading-tight">
          <span className="font-medium text-sm">Teacher&#39;s Tip: </span>
          {isEditing ? (
            <textarea 
              value={tip} 
              onChange={e => onChange(e.target.value)} 
              className="w-full border p-2 editable-content h-16" 
            />
          ) : tip}
        </span>
      </div>
    </div>
  );
};

export default TeacherTipSection;

