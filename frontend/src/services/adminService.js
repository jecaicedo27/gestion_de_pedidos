import api from './api';

const getExecutiveStats = async (params = {}) => {
    try {
        const queryParams = { ...params, _t: Date.now() };
        const response = await api.get('/admin/executive-stats', { params: queryParams });
        return response.data;
    } catch (error) {
        console.error('Error fetching executive stats:', error);
        throw error;
    }
};

const getAdvancedStats = async (params = {}) => {
    try {
        const response = await api.get('/admin/advanced-stats', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching advanced stats:', error);
        throw error;
    }
};

const getClusterCustomers = async (clusterType, dateRange = {}) => {
    try {
        const params = {};
        if (dateRange.startDate) params.startDate = dateRange.startDate;
        if (dateRange.endDate) params.endDate = dateRange.endDate;

        const response = await api.get(`/admin/cluster/${clusterType}/customers`, { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching cluster customers:', error);
        throw error;
    }
};

const getShippingStats = async (params = {}) => {
    try {
        const response = await api.get('/admin/shipping-stats', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching shipping stats:', error);
        throw error;
    }
};

const getProfitabilityTrend = async (params = {}) => {
    try {
        const response = await api.get('/admin/profitability-trend', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching profitability trend:', error);
        throw error;
    }
};

const getInventoryValueHistory = async () => {
    try {
        const response = await api.get('/admin/inventory-value-history');
        return response.data;
    } catch (error) {
        console.error('Error fetching inventory value history:', error);
        throw error;
    }
};

const getInventoryTurnoverHistory = async () => {
    try {
        const response = await api.get('/admin/inventory-turnover-history');
        return response.data;
    } catch (error) {
        console.error('Error fetching inventory turnover history:', error);
        throw error;
    }
};

const getCategoryStats = async (params = {}) => {
    try {
        const response = await api.get('/admin/category-stats', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching category stats:', error);
        throw error;
    }
};

const getCategoryTrend = async (params = {}) => {
    try {
        const response = await api.get('/admin/category-trend', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching category trend:', error);
        throw error;
    }
};

const getCategoryProfitabilityTrend = async (params = {}) => {
    try {
        const response = await api.get('/admin/category-profitability-trend', { params });
        return response.data;
    } catch (error) {
        console.error('Error fetching category profitability trend:', error);
        throw error;
    }
};

const adminService = {
    getExecutiveStats,
    getInventoryValueHistory,
    getInventoryTurnoverHistory,
    getAdvancedStats,
    getClusterCustomers,
    getShippingStats,
    getProfitabilityTrend,
    getCategoryStats,
    getCategoryTrend,
    getCategoryProfitabilityTrend
};

export default adminService;
