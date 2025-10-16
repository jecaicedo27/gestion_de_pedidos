import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const StatCard = ({ 
  title, 
  value, 
  subtitle,
  icon, 
  color = 'blue', 
  clickable = false, 
  onClick,
  loading = false 
}) => {
  const navigate = useNavigate();
  
  const IconComponent = Icons[icon] || Icons.Package;
  
  const colorClasses = {
    blue: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-blue-500',
      iconBg: 'bg-blue-50',
      title: 'text-gray-600',
      value: 'text-gray-900',
      subtitle: 'text-blue-600',
      hover: 'hover:border-blue-300 hover:shadow-md'
    },
    yellow: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-yellow-500',
      iconBg: 'bg-yellow-50',
      title: 'text-gray-600',
      value: 'text-gray-900',
      subtitle: 'text-yellow-600',
      hover: 'hover:border-yellow-300 hover:shadow-md'
    },
    cyan: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-cyan-500',
      iconBg: 'bg-cyan-50',
      title: 'text-gray-600',
      value: 'text-gray-900',
      subtitle: 'text-cyan-600',
      hover: 'hover:border-cyan-300 hover:shadow-md'
    },
    orange: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-orange-500',
      iconBg: 'bg-orange-50',
      title: 'text-gray-600',
      value: 'text-gray-900',
      subtitle: 'text-orange-600',
      hover: 'hover:border-orange-300 hover:shadow-md'
    },
    green: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-green-500',
      iconBg: 'bg-green-50',
      title: 'text-gray-600',
      value: 'text-gray-900',
      subtitle: 'text-green-600',
      hover: 'hover:border-green-300 hover:shadow-md'
    },
    purple: {
      bg: 'bg-white',
      border: 'border-gray-200',
      icon: 'text-purple-500',
      iconBg: 'bg-purple-50',
      title: 'text-gray-600',
      value: 'text-gray-900',
      subtitle: 'text-purple-600',
      hover: 'hover:border-purple-300 hover:shadow-md'
    }
  };

  const classes = colorClasses[color];

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`
        ${classes.bg} ${classes.border} border rounded-lg p-6 
        ${clickable ? `cursor-pointer ${classes.hover} transition-all duration-200` : ''}
      `}
      onClick={handleClick}
    >
      <div className="flex flex-col items-center text-center">
        {/* Título */}
        <h3 className={`text-lg font-medium ${classes.title} mb-4`}>
          {title}
        </h3>
        
        {/* Valor principal */}
        <div className="mb-4">
          {loading ? (
            <div className="animate-pulse">
              <div className="h-12 bg-gray-200 rounded w-16 mx-auto"></div>
            </div>
          ) : (
            <div className={`text-4xl font-bold ${classes.value}`}>
              {value}
            </div>
          )}
        </div>
        
        {/* Subtítulo */}
        <div className={`text-sm font-medium ${classes.subtitle} mb-4`}>
          {subtitle}
        </div>
        
        {/* Ícono */}
        <div className={`${classes.iconBg} p-3 rounded-full`}>
          <IconComponent className={`w-8 h-8 ${classes.icon}`} />
        </div>
      </div>
    </div>
  );
};

export default StatCard;
