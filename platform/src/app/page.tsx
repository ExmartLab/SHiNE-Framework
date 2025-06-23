"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const router = useRouter();
  const [isValid, setIsValid] = useState(false);
  const [customData, setCustomData] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

    // Check for existing session on component mount and process URL parameters
  useEffect(() => {
    // Check for data parameter in URL
    const queryParams = new URLSearchParams(window.location.search);
    const encodedData = queryParams.get('data');
    let customData = null;
    
    // Try to decode the data parameter if it exists
    if (encodedData) {
      try {
        const decodedString = atob(encodedData);
        customData = JSON.parse(decodedString);
        // If we have valid custom data, enable the button
        if (customData) {
          setIsValid(true);
        }
      } catch (error) {
        console.error('Error parsing URL data parameter:', error);
      }
    }
    
    // Store the custom data for session creation
    setCustomData(customData);
    
    // Check if there's a saved session ID in localStorage
    const existingSessionId = localStorage.getItem("smartHomeSessionId");
    
    if (existingSessionId) {
      // Verify the session exists and is active
      verifyExistingSession(existingSessionId);
    }
  }, []);

  const verifyExistingSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/verify-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      
      if (response.ok && data.isValid) {
        setIsValid(true);
        
        router.push(`/study`);
      } else {
        // Clear invalid session ID
        localStorage.removeItem("smartHomeSessionId");
        router.refresh();
      }
    } catch (error) {
      console.error('Error verifying session:', error);
      // Clear potentially corrupted ID
      localStorage.removeItem("smartHomeSessionId");
    } finally {
      setIsLoading(false);
    }
  };

  // No longer need the input change handler

  const startStudy = async () => {
    if (!isValid) return;
    
    setIsLoading(true);
    
    try {
      // Generate a unique session ID
      const sessionId = uuidv4();
      
      // Create session data
      const sessionData = {
        sessionId: sessionId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        userAgent: navigator.userAgent,
        screenSize: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        isCompleted: false,
        custom_data: customData // Add custom data from URL parameter
      };
      
      // Send session data to the backend
      const response = await fetch('/api/create-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        
        // If session already exists, use that one
        if (response.status === 409 && errorData.existingSessionId) {
          localStorage.setItem("smartHomeSessionId", errorData.existingSessionId);
          router.push(`/study`);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to create session');
      }
      
      const data = await response.json();
      
      // Save session ID to localStorage for persistence
      localStorage.setItem("smartHomeSessionId", sessionId);
      
      // Redirect to the first experiment scenario
      router.push("/study");
    } catch (error) {
      console.error('Error creating session:', error);
      setErrorMessage("Failed to create session. Please try again.");
    }
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="w-full p-4 sm:p-6 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image 
              src="/smart_home.png" 
              alt="Smart Home Icon" 
              width={40} 
              height={40}
              priority
            />
            <h1 className="text-xl sm:text-2xl font-bold">Virtual Smart Home Platform</h1>
          </div>
        </div>
      </header>

      <main className="flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sm:p-8">
          <h2 className="text-2xl font-semibold mb-6 text-center">Virtual Smart Home Study</h2>
          
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Welcome to our research study on smart home interactions. You'll explore various scenarios and provide feedback on your experience.
          </p>
          
          {customData ? (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                Your survey data has been received. Click Continue to begin the experiment.
              </p>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 rounded-lg">
              <p className="text-red-800 dark:text-red-300 text-sm">
                No survey data found. Please return to the survey and click the link provided there.
              </p>
            </div>
          )}
          
          <button
            onClick={startStudy}
            disabled={!isValid || isLoading}
            className={`w-full py-3 px-4 rounded-md text-white text-center font-medium transition ${
              isValid && !isLoading
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Proceed to Experiment"
            )}
          </button>
          
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            By proceeding, you agree to participate in this research study. Your interactions will be recorded anonymously for research purposes.
          </p>
        </div>
      </main>

      <footer className="w-full p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
          <p>© 2025 Virtual Smart Home Platform</p>
        </div>
      </footer>
    </div>
  );
}