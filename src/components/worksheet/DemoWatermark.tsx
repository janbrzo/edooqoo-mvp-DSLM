
import React from 'react';

const DemoWatermark: React.FC = () => {
  return (
    <div 
      className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none z-10"
      data-demo-watermark="true"
    >
      <div className="transform -rotate-12 p-4">
        <p className="text-4xl md:text-6xl font-black text-gray-300 opacity-80 border-4 border-gray-300 p-4 rounded-md">
          DEMO VERSION
        </p>
      </div>
    </div>
  );
};

export default DemoWatermark;
