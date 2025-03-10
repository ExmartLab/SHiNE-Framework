import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';

const TaskAbortModal = ({ 
  isOpen, 
  onClose, 
  onAbort, 
  abortReasons = [] 
}) => {
  const [selectedReason, setSelectedReason] = useState(null);
  
  // Reset selected reason when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedReason(null);
    }
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle abort confirmation
  const handleAbort = () => {
    if (selectedReason !== null) {
      onAbort(selectedReason);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden transform transition-all animate-fadeIn">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-200 flex items-center">
          <div className="bg-red-100 p-2 rounded-full mr-3">
            <AlertTriangle className="text-red-500" size={20} />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 flex-1">
            Why do you want to abort the task?
          </h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-3">
          <p className="mb-3 text-gray-600">
            Please select one of the following reasons for aborting this task:
          </p>
          
          {/* Dynamic Reason Options */}
          <div className="space-y-2">
            {abortReasons.map((reason, index) => (
              <div 
                key={index}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 flex items-center ${
                  selectedReason === index 
                    ? 'bg-blue-50 border-blue-400 shadow-sm' 
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => setSelectedReason(index)}
              >
                <div className="mr-3">
                  {selectedReason === index ? (
                    <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                      <Check className="text-white" size={12} />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-gray-300"></div>
                  )}
                </div>
                <span className={`${selectedReason === index ? 'text-blue-800' : 'text-gray-700'}`}>
                  {reason}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <div className="flex justify-end px-6 py-3 bg-gray-50 border-t border-gray-200 space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 font-medium text-gray-700 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleAbort}
            disabled={selectedReason === null}
            className={`px-5 py-1.5 rounded-lg font-medium text-white transition-all shadow-sm ${
              selectedReason === null
                ? 'bg-gray-400 cursor-not-allowed opacity-70'
                : 'bg-red-500 hover:bg-red-600'
            }`}
          >
            Abort Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default TaskAbortModal;