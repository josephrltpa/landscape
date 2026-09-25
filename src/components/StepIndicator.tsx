interface StepIndicatorProps {
  steps: { key: string; label: string; icon: string }[];
  currentIndex: number;
}

export default function StepIndicator({ steps, currentIndex }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isActive = index === currentIndex;
        const isCompleted = index < currentIndex;
        
        return (
          <div key={step.key} className="flex items-center">
            <div
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300
                ${isActive 
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 scale-105' 
                  : isCompleted 
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30' 
                    : 'bg-white/5 text-white/40 border border-white/10'
                }
              `}
            >
              <span className="text-lg">{isCompleted ? '✓' : step.icon}</span>
              <span className="hidden sm:inline">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-1 transition-all duration-300 ${
                isCompleted ? 'bg-green-500/50' : 'bg-white/10'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
