import React, { createContext, useContext, useState, ReactNode } from 'react';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  setLoadingTrue: () => void;
  setLoadingFalse: () => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

interface LoadingProviderProps {
  children: ReactNode;
}

export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const setLoading = (loading: boolean) => {
    setIsLoading(loading);
  };

  const setLoadingTrue = () => {
    setIsLoading(true);
  };

  const setLoadingFalse = () => {
    setIsLoading(false);
  };

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading, setLoadingTrue, setLoadingFalse }}>
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

interface LoadingSpinnerProps {
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ className = '' }) => {
  const PUBLIC_URL = process.env.PUBLIC_URL || '';
  const imgSrc = `${PUBLIC_URL}/assets/addmoments-loader.gif`;

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ minHeight: 'calc(100vh - 200px)', backgroundColor: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <img
          src={imgSrc}
          alt="Loading..."
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
          style={{ maxWidth: '200px', width: '100%' }}
        />
        <p style={{ color: '#333', marginTop: '20px' }}>Loading...</p>
      </div>
    </div>
  );
};
