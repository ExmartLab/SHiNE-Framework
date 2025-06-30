import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Check } from 'lucide-react';

/**
 * Props interface for the TaskAbortModal component
 */
interface TaskAbortModalProps {
  /** Whether the modal is currently visible */
  isOpen: boolean;
  /** Callback function to close the modal */
  onClose: () => void;
  /** Callback function when user confirms task abortion */
  onAbort: (reasonIndex: number) => void;
  /** Array of abort reason strings to display as options */
  abortReasons?: string[];
}

/**
 * Modal component for task abortion with reason selection
 * Allows users to select from predefined reasons before aborting a study task
 * Includes validation to ensure a reason is selected before allowing abort
 */
const TaskAbortModal = ({ 
  isOpen, 
  onClose, 
  onAbort, 
  abortReasons = [] 
}: TaskAbortModalProps) => {
  /** Index of the currently selected abort reason */
  const [selectedReason, setSelectedReason] = useState<number | null>(null);
  
  /**
   * Reset selected reason when modal state changes
   * Ensures clean state when modal reopens
   */
  useEffect(() => {
    if (!isOpen) {
      setSelectedReason(null);
    }
  }, [isOpen]);

  /**
   * Handles clicks on the modal backdrop (outside the modal content)
   * Closes the modal when user clicks outside the modal dialog
   * @param e Mouse event from the backdrop click
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  /**
   * Handles the abort confirmation action
   * Only proceeds if a reason has been selected
   */
  const handleAbort = () => {
    if (selectedReason !== null) {
      onAbort(selectedReason);
    }
  };

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden transform transition-all animate-fadeIn">
        {/* Modal header with warning icon and close button */}
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
        
        {/* Modal content with reason selection */}
        <div className="px-6 py-3">
          <p className="mb-3 text-gray-600">
            Please select one of the following reasons for aborting this task:
          </p>
          
          {/* Dynamic list of abort reasons as selectable options */}
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
                {/* Radio button-style selection indicator */}
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
        
        {/* Modal footer with action buttons */}
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