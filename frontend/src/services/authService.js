// Simple auth service for the customer management system
const authService = {
  getToken: () => {
    return localStorage.getItem('token');
  },

  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  },

  isAuthenticated: () => {
    const token = authService.getToken();
    return token !== null;
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  setCurrentUser: (user) => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    } else {
      localStorage.removeItem('user');
    }
  },

  // Añadir logout para que los componentes puedan usarlo en 401
  logout: () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (e) {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
};

export default authService;
