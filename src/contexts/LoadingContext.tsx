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

  console.log('[LoadingSpinner] Rendering with PUBLIC_URL:', PUBLIC_URL);
  console.log('[LoadingSpinner] PUBLIC_URL trimmed:', (PUBLIC_URL || '').trim());

  // Just use the PUBLIC_URL directly - it's already correct
  const imgSrc = `${PUBLIC_URL}/assets/addmoments-loader.gif`;
  console.log('[LoadingSpinner] Image src:', imgSrc);

  return (
    <div className={`flex items-center justify-center ${className}`} style={{ minHeight: 'calc(100vh - 200px)', backgroundColor: 'white' }}>
      <div style={{ textAlign: 'center' }}>
        <img
          src={imgSrc}
          alt="Loading..."
          onError={(e) => {
            console.error('Failed to load loader image:', e.currentTarget.src);
            (e.target as HTMLImageElement).style.display = 'none';
          }}
          onLoad={() => {
            console.log('[LoadingSpinner] Image loaded successfully');
          }}
          style={{ maxWidth: '200px', width: '100%' }}
        />
        <p style={{ color: '#333', marginTop: '20px' }}>Loading...</p>
      </div>
    </div>
  );
};
