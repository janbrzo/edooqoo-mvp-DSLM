
import React from 'react';
import { Info } from 'lucide-react';

interface TeacherTipBoxProps {
  tip: string;
}

const TeacherTipBox = ({ tip }: TeacherTipBoxProps) => {
  return (
    <div
      className="flex items-start rounded-md px-3 py-1 my-2 teacher-tip bg-amber-50"
      style={{
        background: "linear-gradient(90deg, #FEF7CD 85%, #FAF5E3 100%)",
        border: "1.5px solid #ffeab9",
        minHeight: "28px",
        alignItems: "center",
        boxShadow: "none"
      }}
      data-no-pdf="true"
      data-teacher-tip="true"
    >
      <Info className="text-amber-400 flex-shrink-0 mr-2 mt-0.5" size={19} />
      <div>
        <h4 className="font-medium text-amber-800 mb-0.5 leading-tight text-sm flex items-center" style={{marginBottom:2}}>
          Teacher&#39;s Tip:
        </h4>
        <span className="text-amber-800 text-[13.5px] leading-tight">{tip}</span>
      </div>
    </div>
  );
};

export default TeacherTipBox;
