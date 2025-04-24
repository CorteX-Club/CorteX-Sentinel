import React from 'react';
import Image from 'next/image';

const Logo: React.FC = () => {
  return (
    <div className="relative">
      <div className="w-48 h-48 md:w-64 md:h-64 relative flex items-center justify-center">
        <div className="absolute inset-0 bg-cortex-purple-600 opacity-30 blur-3xl rounded-full"></div>
        <div className="absolute inset-0 bg-cortex-purple-700 opacity-20 animate-pulse blur-2xl rounded-full"></div>
        <Image 
          src="/Logo.png" 
          alt="CorteX Logo" 
          width={220} 
          height={220} 
          className="relative z-10 drop-shadow-[0_0_35px_rgba(163,92,255,0.9)]" 
        />
      </div>
    </div>
  );
};

export default Logo; 