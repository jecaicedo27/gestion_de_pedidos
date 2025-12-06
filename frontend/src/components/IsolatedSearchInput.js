import React from 'react';
import * as Icons from 'lucide-react';

// WRAPPER COMPLETAMENTE AISLADO - NUNCA SE RE-RENDERIZA
class IsolatedSearchInput extends React.Component {
  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.timeoutRef = null;
    this.focusIntervalRef = null;
    this.mounted = false;
    this.userTyping = false;
  }

  componentDidMount() {
    this.mounted = true;
    if (this.inputRef.current) {
      this.inputRef.current.value = this.props.initialValue || '';
    }

    // Mantener foco agresivamente
    this.startFocusProtection();
  }

  componentWillUnmount() {
    this.mounted = false;
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }
    if (this.focusIntervalRef) {
      clearInterval(this.focusIntervalRef);
    }
  }

  // NUNCA se actualiza - evita cualquier re-render
  shouldComponentUpdate() {
    return false;
  }

  startFocusProtection = () => {
    // Protección agresiva del foco cada 100ms
    this.focusIntervalRef = setInterval(() => {
      if (this.mounted && this.inputRef.current && this.userTyping) {
        const activeElement = document.activeElement;
        if (activeElement !== this.inputRef.current) {
          this.inputRef.current.focus();
        }
      }
    }, 100);
  }

  handleInputChange = (e) => {
    const value = e.target.value;
    this.userTyping = true;

    // Limpiar timeout anterior
    if (this.timeoutRef) {
      clearTimeout(this.timeoutRef);
    }

    // Establecer nuevo timeout
    this.timeoutRef = setTimeout(() => {
      this.userTyping = false;
      if (this.mounted && this.props.onSearch && typeof this.props.onSearch === 'function') {
        this.props.onSearch(value);

        // Devolver el foco al input después de la búsqueda
        setTimeout(() => {
          if (this.inputRef.current) {
            this.inputRef.current.focus();
          }
        }, 50);
      }
    }, 500);
  }

  handleFocus = () => {
    this.userTyping = true;
  }

  handleBlur = () => {
    // Solo permitir blur si el usuario no está escribiendo
    setTimeout(() => {
      if (this.userTyping && this.inputRef.current) {
        this.inputRef.current.focus();
      }
    }, 10);
  }

  // Método público para enfocar el input desde el componente padre
  focusInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  render() {
    const { placeholder = "Buscar..." } = this.props;

    return (
      <div className="relative">
        <Icons.Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
        <input
          ref={this.inputRef}
          type="text"
          placeholder={placeholder}
          onChange={this.handleInputChange}
          onFocus={this.handleFocus}
          onBlur={this.handleBlur}
          autoComplete="off"
          spellCheck="false"
          className="pl-10 w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          style={{
            // Estilos inline para garantizar consistencia
            outline: 'none',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            paddingLeft: '2.5rem',
            paddingRight: '0.75rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            width: '100%',
            height: '2.5rem'
          }}
        />
      </div>
    );
  }
}

export default IsolatedSearchInput;
