import React from 'react';

const LoadingSpinner = ({ size = 'md', text = 'Cargando...', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  };

  return (
    <div className={`flex flex-col items-center justify-center p-8 ${className}`}>
      <div
        className={`${sizeClasses[size]} border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin`}
      />
      {text && (
        <p className="mt-4 text-sm text-gray-600 animate-pulse">{text}</p>
      )}
    </div>
  );
};

// Componente para pantalla completa de carga
export const FullScreenLoader = ({ text = 'Cargando aplicación...' }) => {
  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
      <LoadingSpinner size="xl" text={text} />
    </div>
  );
};

// Componente para overlay de carga
export const LoadingOverlay = ({ text = 'Procesando...', show = true }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
      <div className="bg-white rounded-lg p-8 shadow-lg">
        <LoadingSpinner size="lg" text={text} />
      </div>
    </div>
  );
};

export default LoadingSpinner;
