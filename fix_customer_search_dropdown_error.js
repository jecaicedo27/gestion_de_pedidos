const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing CustomerSearchDropdown undefined length error...');

// Read the current CustomerSearchDropdown component
const dropdownPath = path.join('frontend', 'src', 'components', 'CustomerSearchDropdown.js');
const currentContent = fs.readFileSync(dropdownPath, 'utf8');

// Create an updated version with even more comprehensive safety checks
const fixedContent = `import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as Icons from 'lucide-react';
import { debounce } from 'lodash';
import { quotationService } from '../services/api';

const CustomerSearchDropdown = ({
  value = "",
  onChange,
  selectedCustomer,
  onSelectCustomer,
  placeholder = "Buscar cliente por nombre o documento...",
  className = "",
  disabled = false,
  showSyncButton = false,
  onSync = null,
  syncLoading = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [internalValue, setInternalValue] = useState(value || "");
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const listRef = useRef(null);

  // Safe array operations
  const safeCustomers = Array.isArray(customers) ? customers : [];
  const safeCustomersLength = safeCustomers.length || 0;

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchTerm) => {
      if (!searchTerm || searchTerm.trim().length < 2) {
        setCustomers([]);
        setIsOpen(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await quotationService.searchCustomers(searchTerm);
        if (data && data.success && Array.isArray(data.customers)) {
          setCustomers(data.customers);
          setIsOpen(data.customers.length > 0);
          setHighlightedIndex(-1);
        } else {
          setError((data && data.message) || 'Error en la búsqueda');
          setCustomers([]);
          setIsOpen(false);
        }
      } catch (err) {
        console.error('Error searching customers:', err);
        setError('Error conectando con el servidor');
        setCustomers([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  // Effect to trigger search when value changes
  useEffect(() => {
    const searchValue = value || internalValue || "";
    if (typeof searchValue === 'string' && searchValue.length >= 2) {
      debouncedSearch(searchValue);
    }
    return () => {
      if (debouncedSearch && typeof debouncedSearch.cancel === 'function') {
        debouncedSearch.cancel();
      }
    };
  }, [value, internalValue, debouncedSearch]);

  // Handle input changes
  const handleInputChange = (e) => {
    const newValue = e.target.value || "";
    
    // Update internal state
    setInternalValue(newValue);
    
    // Call onChange if provided
    if (typeof onChange === 'function') {
      onChange(newValue);
    }
    
    // Clear selected customer if input changes
    if (selectedCustomer && newValue !== (selectedCustomer.name || "")) {
      if (typeof onSelectCustomer === 'function') {
        onSelectCustomer(null);
      }
    }
  };

  // Handle customer selection
  const handleSelectCustomer = (customer) => {
    if (typeof onSelectCustomer === 'function') {
      onSelectCustomer(customer);
    }
    const customerName = (customer && customer.name) || "";
    setInternalValue(customerName);
    if (typeof onChange === 'function') {
      onChange(customerName);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    if (inputRef.current && typeof inputRef.current.blur === 'function') {
      inputRef.current.blur();
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen || safeCustomersLength === 0) {
      if (e.key === 'ArrowDown' && safeCustomersLength > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < (safeCustomersLength - 1) ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < safeCustomersLength) {
          handleSelectCustomer(safeCustomers[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setHighlightedIndex(-1);
        if (inputRef.current && typeof inputRef.current.blur === 'function') {
          inputRef.current.blur();
        }
        break;
    }
  };

  // Handle input focus
  const handleFocus = () => {
    const searchValue = value || internalValue || "";
    if (safeCustomersLength > 0 && searchValue.length >= 2) {
      setIsOpen(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current && 
        typeof dropdownRef.current.contains === 'function' &&
        !dropdownRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current && safeCustomersLength > 0) {
      const listElement = listRef.current;
      if (listElement && listElement.children && listElement.children[highlightedIndex]) {
        const highlightedElement = listElement.children[highlightedIndex];
        if (highlightedElement && typeof highlightedElement.scrollIntoView === 'function') {
          highlightedElement.scrollIntoView({
            block: 'nearest',
            behavior: 'smooth'
          });
        }
      }
    }
  }, [highlightedIndex, safeCustomersLength]);

  // Highlight search term in text
  const highlightText = (text, searchTerm) => {
    if (!text || !searchTerm || !searchTerm.trim()) return text;
    
    try {
      const regex = new RegExp(\`(\${searchTerm.trim()})\`, 'gi');
      const parts = text.split(regex);
      
      return parts.map((part, index) =>
        regex.test(part) ? (
          <mark key={index} className="bg-yellow-200 text-yellow-900 font-medium">
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch (error) {
      console.error('Error highlighting text:', error);
      return text;
    }
  };

  const currentValue = value || internalValue || "";
  const showError = error && !loading;
  const showLoading = loading && safeCustomersLength === 0;
  const showNoResults = !loading && safeCustomersLength === 0 && currentValue.length >= 2;

  return (
    <div className={\`relative \${className}\`} ref={dropdownRef}>
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={currentValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              disabled={disabled}
              className={\`w-full px-4 py-3 pr-12 border rounded-md focus:outline-none focus:ring-2 transition-all duration-200 \${
                selectedCustomer
                  ? 'border-green-300 bg-green-50 focus:ring-green-500 focus:border-green-500'
                  : 'border-gray-300 bg-white focus:ring-blue-500 focus:border-blue-500'
              } \${
                disabled ? 'bg-gray-100 cursor-not-allowed' : ''
              } \${
                showError ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : ''
              }\`}
              placeholder={placeholder}
              autoComplete="off"
            />
            
            {/* Status icons */}
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
              {loading && (
                <Icons.Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
              )}
              {selectedCustomer && !loading && (
                <Icons.CheckCircle className="w-5 h-5 text-green-500" />
              )}
              {showError && (
                <Icons.AlertCircle className="w-5 h-5 text-red-500" />
              )}
              {!loading && !selectedCustomer && !error && currentValue.length > 0 && (
                <Icons.Search className="w-5 h-5 text-gray-400" />
              )}
            </div>
          </div>
          
          {/* Error message */}
          {showError && (
            <div className="absolute mt-1 text-sm text-red-600 flex items-center">
              <Icons.AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </div>
          )}
        </div>

        {/* Sync button */}
        {showSyncButton && typeof onSync === 'function' && (
          <button
            onClick={onSync}
            disabled={syncLoading || disabled}
            className="inline-flex items-center px-4 py-3 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 transition-colors duration-200"
            title="Sincronizar clientes desde SIIGO"
          >
            {syncLoading ? (
              <Icons.Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Icons.RefreshCw className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-hidden">
          {showLoading && (
            <div className="px-4 py-8 text-center">
              <Icons.Loader2 className="w-6 h-6 mx-auto mb-2 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-600">Buscando clientes...</p>
            </div>
          )}

          {showNoResults && (
            <div className="px-4 py-8 text-center">
              <Icons.UserX className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">No se encontraron clientes</p>
              <p className="text-xs text-gray-500 mt-1">
                Prueba con un término de búsqueda diferente
              </p>
            </div>
          )}

          {safeCustomersLength > 0 && (
            <div 
              ref={listRef}
              className="max-h-64 overflow-y-auto"
            >
              {safeCustomers.map((customer, index) => {
                if (!customer) return null;
                
                return (
                  <button
                    key={customer.id || index}
                    onClick={() => handleSelectCustomer(customer)}
                    className={\`w-full px-4 py-3 text-left transition-colors duration-150 border-b border-gray-100 last:border-b-0 \${
                      index === highlightedIndex
                        ? 'bg-blue-50 border-blue-200'
                        : 'hover:bg-gray-50'
                    }\`}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {highlightText(customer.name || 'Sin nombre', currentValue)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 flex items-center space-x-2">
                          <span className="flex items-center">
                            <Icons.FileText className="w-3 h-3 mr-1" />
                            {highlightText(customer.identification || 'Sin documento', currentValue)}
                          </span>
                          {customer.email && (
                            <span className="flex items-center">
                              <Icons.Mail className="w-3 h-3 mr-1" />
                              <span className="truncate max-w-32">{highlightText(customer.email, currentValue)}</span>
                            </span>
                          )}
                        </div>
                        {customer.phone && (
                          <div className="text-xs text-gray-500 mt-1 flex items-center">
                            <Icons.Phone className="w-3 h-3 mr-1" />
                            {customer.phone}
                          </div>
                        )}
                      </div>
                      <div className="ml-2 flex-shrink-0">
                        {customer.siigo_id && (
                          <div className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            <Icons.Database className="w-3 h-3 mr-1" />
                            SIIGO
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Footer with help text */}
          {safeCustomersLength > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
              <p className="text-xs text-gray-500 flex items-center justify-between">
                <span>Use las flechas ↑↓ para navegar</span>
                <span>Enter para seleccionar • Esc para cerrar</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Selected customer info */}
      {selectedCustomer && !error && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-medium text-green-900 flex items-center">
                <Icons.CheckCircle className="w-4 h-4 mr-2" />
                Cliente Seleccionado
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-green-700 font-medium">Nombre:</span>
                  <div className="text-green-800 font-medium">{selectedCustomer.name || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Documento:</span>
                  <div className="text-green-800">{selectedCustomer.identification || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Email:</span>
                  <div className="text-green-800 truncate">{selectedCustomer.email || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-green-700 font-medium">Teléfono:</span>
                  <div className="text-green-800">{selectedCustomer.phone || 'N/A'}</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                if (typeof onSelectCustomer === 'function') {
                  onSelectCustomer(null);
                }
                setInternalValue('');
                if (typeof onChange === 'function') {
                  onChange('');
                }
                if (inputRef.current && typeof inputRef.current.focus === 'function') {
                  inputRef.current.focus();
                }
              }}
              className="text-green-700 hover:text-green-900 p-1 rounded hover:bg-green-100 transition-colors"
              title="Limpiar selección"
            >
              <Icons.X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSearchDropdown;`;

// Write the fixed content
fs.writeFileSync(dropdownPath, fixedContent, 'utf8');

console.log('✅ CustomerSearchDropdown component updated with comprehensive safety checks');
console.log('');
console.log('🔧 Changes made:');
console.log('   - Added safeCustomers and safeCustomersLength variables for all array operations');
console.log('   - Protected all .length property accesses with safe defaults');
console.log('   - Added comprehensive null/undefined checks for all object property access');
console.log('   - Added type checking for function calls');
console.log('   - Protected DOM element access with function existence checks');
console.log('   - Added try-catch for regex operations in highlightText');
console.log('   - Ensured all state variables have safe default values');
console.log('');
console.log('🚀 The component should now handle all edge cases without throwing undefined errors.');
