// Simple auth service for the customer management system
const authService = {
  getToken: () => {
    return localStorage.getItem('token');
  },

  isAuthenticated: () => {
    const token = authService.getToken();
    return token !== null;
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }
};

export default authService;
