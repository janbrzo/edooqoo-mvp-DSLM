
import React from 'react';

const TeacherNotes: React.FC = () => {
  return (
    <div className="bg-white p-6 border rounded-lg shadow-sm mt-6" data-no-pdf="true">
      <h2 className="text-2xl font-bold mb-4 text-indigo-800 text-center">Tips for teachers</h2>
      
      <div className="space-y-4">
        <p className="border-b pb-3">This worksheet is a general template you can customize for your student.</p>
        
        <p className="border-b pb-3">Verify the industry-specific terminology for accuracy.</p>
        
        <p className="border-b pb-3">Adjust the difficulty level as needed for your student.</p>
        
        <p>Consider adding more visual elements for visual learners.</p>
      </div>
    </div>
  );
};

export default TeacherNotes;
