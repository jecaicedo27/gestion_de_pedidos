import authService from '../services/authService';

const API_URL = '/api/whapify';

const whapifyApi = {
    sendMessage: async (phone, name, message) => {
        const token = authService.getToken();
        const response = await fetch(`${API_URL}/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ phone, name, message })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error sending message');
        }

        return data;
    }
};

export default whapifyApi;
