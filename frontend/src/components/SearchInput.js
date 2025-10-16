import React, { useState, useRef } from 'react';
import * as Icons from 'lucide-react';

const SearchInput = ({ 
  value, 
  onChange, 
  placeholder = "Buscar...", 
  className = "",
  onClear
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
    // NO auto-focus después de limpiar para evitar interferencias
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Escape') {
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyPress}
          placeholder={placeholder}
          className={`w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
            isFocused ? 'ring-2 ring-blue-500' : ''
          }`}
        />
        
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icons.Search className="h-4 w-4 text-gray-400" />
        </div>
        
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Icons.X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchInput;