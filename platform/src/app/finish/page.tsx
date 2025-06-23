"use client";

import Image from "next/image";

export default function CompletionPage() {
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
          <h2 className="text-2xl font-semibold mb-6 text-center">Study Completed</h2>
          
          <div className="mb-6 flex flex-col items-center">
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3 mb-4">
              <svg className="h-12 w-12 text-green-600 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-center text-gray-600 dark:text-gray-300 mb-6">
              Thank you for participating in our virtual smart home study! Your contributions will help improve future smart home interfaces.
            </p>
          </div>
          
          
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Your data has been recorded anonymously and will be used for research purposes only. Thank you for your participation.
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