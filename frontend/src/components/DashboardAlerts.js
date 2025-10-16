import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';

const DashboardAlerts = ({ alerts, loading }) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-center py-8">
        <Icons.CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
        <p className="text-gray-600">No hay alertas pendientes</p>
        <p className="text-sm text-gray-500">Todo está funcionando correctamente</p>
      </div>
    );
  }

  const getAlertIcon = (type) => {
    switch (type) {
      case 'warning':
        return Icons.AlertTriangle;
      case 'danger':
        return Icons.AlertCircle;
      case 'info':
        return Icons.Info;
      case 'success':
        return Icons.CheckCircle;
      default:
        return Icons.Bell;
    }
  };

  const getAlertColors = (type) => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: 'text-yellow-600',
          title: 'text-yellow-800',
          message: 'text-yellow-700',
          button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
        };
      case 'danger':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: 'text-red-600',
          title: 'text-red-800',
          message: 'text-red-700',
          button: 'bg-red-100 hover:bg-red-200 text-red-800'
        };
      case 'info':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          icon: 'text-blue-600',
          title: 'text-blue-800',
          message: 'text-blue-700',
          button: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
        };
      case 'success':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: 'text-green-600',
          title: 'text-green-800',
          message: 'text-green-700',
          button: 'bg-green-100 hover:bg-green-200 text-green-800'
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: 'text-gray-600',
          title: 'text-gray-800',
          message: 'text-gray-700',
          button: 'bg-gray-100 hover:bg-gray-200 text-gray-800'
        };
    }
  };

  const handleAlertAction = (alert) => {
    if (alert.actionUrl) {
      navigate(alert.actionUrl);
    }
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, index) => {
        const IconComponent = getAlertIcon(alert.type);
        const colors = getAlertColors(alert.type);

        return (
          <div
            key={index}
            className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <IconComponent className={`w-5 h-5 ${colors.icon}`} />
              </div>
              
              <div className="ml-3 flex-1">
                <h4 className={`text-sm font-medium ${colors.title}`}>
                  {alert.title}
                </h4>
                <p className={`mt-1 text-sm ${colors.message}`}>
                  {alert.message}
                </p>
              </div>

              {alert.action && alert.actionUrl && (
                <div className="ml-4 flex-shrink-0">
                  <button
                    onClick={() => handleAlertAction(alert)}
                    className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md transition-colors duration-200 ${colors.button}`}
                  >
                    {alert.action}
                    <Icons.ArrowRight className="w-3 h-3 ml-1" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardAlerts;
