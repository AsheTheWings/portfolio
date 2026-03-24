"use client";

import React, { createContext, useContext, useState, useRef, useCallback, ReactNode } from 'react';

export interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  finalAssetId?: string;
  completedData?: unknown;
}

interface GlobalUploadContextType {
  uploadingFiles: UploadingFile[];
  addUploadingFiles: (files: UploadingFile[]) => void;
  updateUploadingFile: (id: string, updates: Partial<UploadingFile>) => void;
  removeUploadingFile: (id: string) => void;
  clearCompletedUploads: () => void;
  setXhrRef: (id: string, xhr: XMLHttpRequest) => void;
  removeXhrRef: (id: string) => void;
  abortUpload: (id: string) => void;
}

const GlobalUploadContext = createContext<GlobalUploadContextType | undefined>(undefined);

export const GlobalUploadProvider = ({ children }: { children: ReactNode }) => {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const xhrRefs = useRef<{ [key: string]: XMLHttpRequest }>({});

  const addUploadingFiles = useCallback((files: UploadingFile[]) => {
    setUploadingFiles(prev => [...prev, ...files]);
  }, []);

  const updateUploadingFile = useCallback((id: string, updates: Partial<UploadingFile>) => {
    setUploadingFiles(prev => 
      prev.map(file => file.id === id ? { ...file, ...updates } : file)
    );
  }, []);

  const removeUploadingFile = useCallback((id: string) => {
    setUploadingFiles(prev => prev.filter(file => file.id !== id));
  }, []);

  const clearCompletedUploads = useCallback(() => {
    setUploadingFiles(prev => prev.filter(file => file.status !== 'completed'));
  }, []);

  const setXhrRef = useCallback((id: string, xhr: XMLHttpRequest) => {
    xhrRefs.current[id] = xhr;
  }, []);

  const removeXhrRef = useCallback((id: string) => {
    delete xhrRefs.current[id];
  }, []);

  const abortUpload = useCallback((id: string) => {
    if (xhrRefs.current[id]) {
      xhrRefs.current[id].abort();
      delete xhrRefs.current[id];
    }
  }, []);

  const contextValue: GlobalUploadContextType = {
    uploadingFiles,
    addUploadingFiles,
    updateUploadingFile,
    removeUploadingFile,
    clearCompletedUploads,
    setXhrRef,
    removeXhrRef,
    abortUpload,
  };

  return (
    <GlobalUploadContext.Provider value={contextValue}>
      {children}
    </GlobalUploadContext.Provider>
  );
};

export const useGlobalUpload = () => {
  const context = useContext(GlobalUploadContext);
  if (context === undefined) {
    throw new Error("useGlobalUpload must be used within a GlobalUploadProvider");
  }
  return context;
};
