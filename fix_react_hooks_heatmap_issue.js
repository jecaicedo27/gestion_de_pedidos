const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing React hooks issue in Colombia HeatMap component...');

// Create a fixed version of ColombiaHeatMap that properly handles React hooks
const fixedColombiaHeatMap = `import React, { useState, useEffect, useRef, useCallback } from 'react';
import authService from '../services/authService';

// Coordenadas aproximadas de las principales ciudades de Colombia
const COLOMBIA_CITIES_COORDINATES = {
  'Medellín': [-75.5636, 6.2442],
  'Bogotá': [-74.0817, 4.7110],
  'Cali': [-76.5225, 3.4516],
  'Barranquilla': [-74.7813, 10.9639],
  'Cartagena': [-75.5144, 10.3910],
  'Bucaramanga': [-73.1198, 7.1193],
  'Pereira': [-75.6967, 4.8133],
  'Santa Marta': [-74.1990, 11.2408],
  'Manizales': [-75.5072, 5.0689],
  'Ibagué': [-75.2322, 4.4389],
  'Pasto': [-77.2811, 1.2136],
  'Montería': [-75.8814, 8.7489],
  'Villavicencio': [-73.6267, 4.1420],
  'Valledupar': [-73.2515, 10.4631],
  'Popayán': [-76.6057, 2.4448],
  'Tunja': [-73.3676, 5.5353],
  'Florencia': [-75.6062, 1.6144],
  'Sincelejo': [-75.3976, 9.3047],
  'Riohacha': [-72.9072, 11.5444],
  'Yopal': [-72.3958, 5.3478],
  'Quibdó': [-76.6583, 5.6947],
  'Neiva': [-75.2819, 2.9273],
  'Armenia': [-75.6812, 4.5339],
  'Cúcuta': [-72.5078, 7.8939],
  'Palmira': [-76.3036, 3.5394],
  'Itagui': [-75.5989, 6.1851],
  'Envigado': [-75.5761, 6.1698],
  'Bello': [-75.5561, 6.3370],
  'Turbo': [-76.7275, 8.0955],
  'Duitama': [-73.0347, 5.8245],
  'Granada': [-75.2064, 6.1459],
  'Segovia': [-74.7058, 7.8103],
  'Caldas': [-75.6339, 6.0907],
  'Barrancabermeja': [-73.8553, 7.0653],
  'Ocaña': [-73.3547, 8.2409],
  'Remedios': [-74.6928, 7.0286],
  'Puerto Nare': [-74.6167, 6.1667],
  'Garzón': [-75.6264, 2.1961],
  'Mompós': [-74.4264, 9.2375],
  'La Unión': [-75.3664, 5.9747],
  'Urrao': [-76.1342, 6.3208],
  'Ciénaga': [-74.2458, 10.9608],
  'Jerusalén': [-75.7667, 5.3500],
  'Arboletes': [-76.4261, 8.8689],
  'El Bagre': [-74.8086, 7.5972]
};

const ColombiaHeatMap = ({ height = '700px', showControls = true }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [heatmapData, setHeatmapData] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeTab, setActiveTab] = useState('map');
  const [mapReady, setMapReady] = useState(false);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const leafletRef = useRef(null);

  // Memoize the fetch function to prevent re-renders
  const fetchHeatmapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = authService.getToken();
      if (!token) {
        throw new Error('No hay token de autenticación');
      }

      const response = await fetch(\`\${process.env.REACT_APP_API_URL || 'http://localhost:3001'}/api/heatmap/colombia-sales\`, {
        method: 'GET',
        headers: {
          'Authorization': \`Bearer \${token}\`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          authService.logout();
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
        throw new Error(\`Error \${response.status}: \${response.statusText}\`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Error al obtener datos del mapa de calor');
      }

      // Enriquecer los datos con coordenadas
      const enrichedCities = data.cities.map(city => ({
        ...city,
        coordinates: COLOMBIA_CITIES_COORDINATES[city.customer_city] || null
      })).filter(city => city.coordinates !== null);

      setHeatmapData({
        ...data,
        cities: enrichedCities
      });

    } catch (error) {
      console.error('Error fetching heatmap data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array since we don't depend on any props or state

  // Load Leaflet library
  const loadLeaflet = useCallback(async () => {
    if (leafletLoaded || leafletRef.current) return leafletRef.current;

    try {
      console.log('Loading Leaflet...');
      const leafletModule = await import('leaflet');
      await import('leaflet/dist/leaflet.css');
      
      leafletRef.current = leafletModule.default;
      setLeafletLoaded(true);
      console.log('Leaflet loaded successfully');
      return leafletRef.current;
    } catch (error) {
      console.error('Error loading Leaflet:', error);
      setError('Error al cargar la biblioteca de mapas');
      return null;
    }
  }, [leafletLoaded]);

  // Initialize map
  const initializeMap = useCallback(async () => {
    if (!mapContainerRef.current || mapReady || !heatmapData) return;

    try {
      console.log('Initializing map...');
      const L = await loadLeaflet();
      if (!L) return;

      // Clear any existing map
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Create map instance
      const map = L.map(mapContainerRef.current, {
        center: [4.5709, -74.2973], // Centro de Colombia
        zoom: 6,
        zoomControl: true,
        preferCanvas: true
      });

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
        minZoom: 5
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true);
      console.log('Map initialized successfully');

      // Add markers after a small delay to ensure map is fully rendered
      setTimeout(() => {
        updateMapMarkers();
      }, 100);

    } catch (error) {
      console.error('Error initializing map:', error);
      setError('Error al inicializar el mapa');
    }
  }, [heatmapData, mapReady, loadLeaflet]);

  // Update map markers
  const updateMapMarkers = useCallback(async () => {
    if (!mapInstanceRef.current || !heatmapData || !leafletRef.current) return;

    try {
      const L = leafletRef.current;
      
      // Clear existing markers
      markersRef.current.forEach(layer => {
        if (mapInstanceRef.current && mapInstanceRef.current.hasLayer(layer)) {
          mapInstanceRef.current.removeLayer(layer);
        }
      });
      markersRef.current = [];

      // Get filtered cities
      const filteredCities = getFilteredCities();

      // Add markers
      filteredCities.forEach(city => {
        const markerColor = getMarkerColor(city.performance_category);
        const markerSize = Math.max(8, Math.min(30, city.order_count / 3));

        const marker = L.circleMarker(
          [city.coordinates[1], city.coordinates[0]], 
          {
            radius: markerSize,
            fillColor: markerColor,
            color: '#fff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.9,
            className: 'heat-marker'
          }
        );

        // Create popup content
        const popupContent = \`
          <div style="min-width: 250px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
            <div style="background: linear-gradient(135deg, \${markerColor}, \${markerColor}dd); color: white; margin: -12px -12px 12px -12px; padding: 12px; border-radius: 6px 6px 0 0;">
              <h3 style="margin: 0; font-size: 16px; font-weight: 600;">
                📍 \${city.customer_city}
              </h3>
            </div>
            <div style="padding: 8px 0;">
              <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="
                  width: 16px;
                  height: 16px;
                  border-radius: 50%;
                  background-color: \${markerColor};
                  margin-right: 8px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                "></div>
                <span style="font-size: 13px; font-weight: 600; color: #666;">
                  \${city.performance_category === 'high' ? '🔥 Alto Rendimiento' :
                    city.performance_category === 'medium' ? '⚡ Rendimiento Medio' :
                    '👁️ Necesita Atención'}
                </span>
              </div>
              <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 8px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 13px;">
                  <div>
                    <div style="color: #666; font-size: 11px; margin-bottom: 2px;">PEDIDOS</div>
                    <div style="font-weight: 700; color: #1890ff; font-size: 16px;">\${city.order_count}</div>
                  </div>
                  <div>
                    <div style="color: #666; font-size: 11px; margin-bottom: 2px;">VENTAS TOTALES</div>
                    <div style="font-weight: 700; color: #52c41a; font-size: 14px;">\${formatCurrency(city.total_value)}</div>
                  </div>
                </div>
                <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e8e8e8;">
                  <div style="color: #666; font-size: 11px; margin-bottom: 2px;">TICKET PROMEDIO</div>
                  <div style="font-weight: 700; color: #faad14; font-size: 15px;">\${formatCurrency(city.total_value / city.order_count)}</div>
                </div>
              </div>
            </div>
          </div>
        \`;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'custom-popup'
        });

        // Add hover effects
        marker.on('mouseover', function() {
          this.setStyle({
            radius: markerSize * 1.2,
            weight: 4,
            fillOpacity: 1
          });
        });

        marker.on('mouseout', function() {
          this.setStyle({
            radius: markerSize,
            weight: 3,
            fillOpacity: 0.9
          });
        });

        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      });

    } catch (error) {
      console.error('Error updating markers:', error);
    }
  }, [heatmapData, selectedCategory]);

  // Helper functions
  const getMarkerColor = (category) => {
    const colors = {
      high: '#52c41a',
      medium: '#faad14',
      low: '#ff4d4f'
    };
    return colors[category] || '#d9d9d9';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getFilteredCities = () => {
    if (!heatmapData) return [];
    
    if (selectedCategory === 'all') {
      return heatmapData.cities;
    }
    
    return heatmapData.cities.filter(city => city.performance_category === selectedCategory);
  };

  // Effects
  useEffect(() => {
    fetchHeatmapData();
  }, [fetchHeatmapData]);

  useEffect(() => {
    if (heatmapData && activeTab === 'map' && !mapReady) {
      initializeMap();
    }
  }, [heatmapData, activeTab, mapReady, initializeMap]);

  useEffect(() => {
    if (mapReady && mapInstanceRef.current) {
      updateMapMarkers();
    }
  }, [selectedCategory, mapReady, updateMapMarkers]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const renderMap = () => {
    return (
      <div style={{ position: 'relative', height, width: '100%', minHeight: '700px' }}>
        <div 
          ref={mapContainerRef}
          style={{ 
            height: '100%', 
            width: '100%',
            backgroundColor: '#f5f5f5',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
          }}
        />
        
        {/* Legend */}
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '12px', color: '#333' }}>
            🗺️ Intensidad de Ventas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#52c41a',
                marginRight: '6px'
              }}></div>
              Alto Rendimiento
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#faad14',
                marginRight: '6px'
              }}></div>
              Rendimiento Medio
            </div>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '11px' }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#ff4d4f',
                marginRight: '6px'
              }}></div>
              Necesita Atención
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#666', marginTop: '6px', borderTop: '1px solid #eee', paddingTop: '4px' }}>
            💡 Tamaño = Volumen de pedidos
          </div>
        </div>

        {(!mapReady || loading) && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(245, 245, 245, 0.95)',
            borderRadius: '8px',
            zIndex: 1000
          }}>
            <div style={{ fontSize: '16px', marginBottom: '8px' }}>
              {loading ? '🌍 Cargando datos...' : '🗺️ Inicializando mapa...'}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {loading ? 'Obteniendo información del servidor' : 'Preparando visualización geográfica'}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStats = () => {
    if (!heatmapData) return null;

    const { summary, categorizedCities } = heatmapData;

    return (
      <div style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
              {summary?.totalOrders || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Pedidos Totales</div>
          </div>
          
          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#52c41a' }}>
              {formatCurrency(summary?.totalValue || 0)}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Ventas Totales</div>
          </div>
          
          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
              {heatmapData.cities?.length || 0}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>Ciudades con Ventas</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#52c41a' }}>
              🔥 Zonas de Alto Rendimiento
            </h4>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{categorizedCities?.high?.length || 0}</span>
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>ciudades</span>
            </div>
            {(categorizedCities?.high || []).slice(0, 5).map(city => (
              <div key={city.customer_city} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                <span>{city.customer_city}</span>
                <span style={{ fontWeight: 'bold' }}>{city.order_count} pedidos</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#faad14' }}>
              ⚡ Zonas de Rendimiento Medio
            </h4>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{categorizedCities?.medium?.length || 0}</span>
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>ciudades</span>
            </div>
            {(categorizedCities?.medium || []).slice(0, 5).map(city => (
              <div key={city.customer_city} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                <span>{city.customer_city}</span>
                <span style={{ fontWeight: 'bold' }}>{city.order_count} pedidos</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#ff4d4f' }}>
              👁️ Zonas que Necesitan Atención
            </h4>
            <div style={{ marginBottom: '12px' }}>
              <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{categorizedCities?.low?.length || 0}</span>
              <span style={{ marginLeft: '8px', fontSize: '14px' }}>ciudades</span>
            </div>
            {(categorizedCities?.low || []).slice(0, 5).map(city => (
              <div key={city.customer_city} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                <span>{city.customer_city}</span>
                <span style={{ fontWeight: 'bold' }}>{city.order_count} pedidos</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (loading && !heatmapData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <div>
          <div style={{ fontSize: '16px', marginBottom: '8px' }}>🌍 Cargando mapa de calor de ventas...</div>
          <div style={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>Obteniendo datos del servidor</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '24px', 
        border: '1px solid #ff4d4f', 
        borderRadius: '6px', 
        backgroundColor: '#fff2f0',
        color: '#a8071a',
        textAlign: 'center'
      }}>
        <h4>Error al cargar el mapa de calor</h4>
        <p>{error}</p>
        <button 
          onClick={fetchHeatmapData}
          style={{
            padding: '8px 16px',
            backgroundColor: '#1890ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      border: '1px solid #e0e0e0', 
      borderRadius: '12px', 
      overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
      background: 'white'
    }}>
      {showControls && (
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid #e0e0e0', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                🌍 Mapa de Calor - Distribución de Ventas por Ciudad
              </h3>
              <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
                Visualización geográfica de ventas en Colombia - Zonas de alta, media y baja performance
              </p>
            </div>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <button
                onClick={() => setActiveTab('map')}
                style={{
                  padding: '8px 16px',
                  marginRight: '8px',
                  border: activeTab === 'map' ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  backgroundColor: activeTab === 'map' ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'map' ? '600' : '400',
                  transition: 'all 0.2s ease'
                }}
              >
                🗺️ Mapa de Calor
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                style={{
                  padding: '8px 16px',
                  border: activeTab === 'stats' ? '2px solid white' : '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '6px',
                  backgroundColor: activeTab === 'stats' ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: activeTab === 'stats' ? '600' : '400',
                  transition: 'all 0.2s ease'
                }}
              >
                📊 Estadísticas
              </button>
            </div>
            
            {activeTab === 'map' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: '500' }}>🔍 Filtrar:</label>
                <select 
                  value={selectedCategory} 
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{ 
                    padding: '6px 12px', 
                    border: '1px solid rgba(255,255,255,
