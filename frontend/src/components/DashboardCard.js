import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const DashboardCard = ({ 
  title, 
  value, 
  icon, 
  color = 'primary', 
  clickable = false, 
  onClick,
  subtitle,
  trend,
  loading = false 
}) => {
  const navigate = useNavigate();
  
  const IconComponent = Icons[icon] || Icons.Circle;
  
  const colorClasses = {
    primary: 'bg-blue-100 text-blue-600 border-blue-200',
    success: 'bg-green-100 text-green-600 border-green-200',
    warning: 'bg-yellow-100 text-yellow-600 border-yellow-200',
    danger: 'bg-red-100 text-red-600 border-red-200',
    info: 'bg-cyan-100 text-cyan-600 border-cyan-200',
    secondary: 'bg-gray-100 text-gray-600 border-gray-200'
  };

  const handleClick = () => {
    if (clickable && onClick) {
      onClick();
    }
  };

  return (
    <div 
      className={`card ${clickable ? 'cursor-pointer hover:shadow-lg transition-shadow duration-200' : ''}`}
      onClick={handleClick}
    >
      <div className="card-content">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
                <IconComponent className="w-5 h-5" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">{title}</p>
                {subtitle && (
                  <p className="text-xs text-gray-500">{subtitle}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                {loading ? (
                  <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-20"></div>
                  </div>
                ) : (
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                )}
              </div>
              
              {trend && (
                <div className={`flex items-center text-sm ${
                  trend.type === 'up' ? 'text-green-600' : 
                  trend.type === 'down' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {trend.type === 'up' && <Icons.TrendingUp className="w-4 h-4 mr-1" />}
                  {trend.type === 'down' && <Icons.TrendingDown className="w-4 h-4 mr-1" />}
                  {trend.value}
                </div>
              )}
            </div>
          </div>
          
          {clickable && (
            <Icons.ChevronRight className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardCard;
