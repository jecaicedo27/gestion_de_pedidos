const axios = require('axios');

class WhapifyService {
    constructor() {
        this.apiToken = process.env.WAPIFY_API_TOKEN;
        this.baseURL = process.env.WAPIFY_API_BASE_URL || 'https://ap.whapify.ai/api';

        this.api = axios.create({
            baseURL: this.baseURL,
            headers: {
                'X-ACCESS-TOKEN': this.apiToken,
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Format phone number to ensure it has country code
     * @param {string} phone 
     * @returns {string}
     */
    formatPhone(phone) {
        let clean = phone.replace(/\D/g, '');
        // Assume Colombia (57) if 10 digits and starts with 3
        if (clean.length === 10 && clean.startsWith('3')) {
            clean = '57' + clean;
        }
        return clean;
    }

    /**
     * Find a contact by phone number
     * @param {string} phone 
     * @returns {object|null} Contact object or null
     */
    async findContactByPhone(phone) {
        try {
            const cleanPhone = this.formatPhone(phone);

            const response = await this.api.get('/contacts/find_by_custom_field', {
                params: {
                    field_id: 'phone',
                    value: cleanPhone
                }
            });

            if (response.data && response.data.data && response.data.data.length > 0) {
                return response.data.data[0];
            }
            return null;
        } catch (error) {
            console.error('Error finding contact by phone:', error.response?.data || error.message);
            return null;
        }
    }

    /**
     * Create a new contact
     * @param {string} phone 
     * @param {string} name 
     * @returns {object} Created contact
     */
    async createContact(phone, name) {
        try {
            const cleanPhone = this.formatPhone(phone);
            const [firstName, ...lastNameParts] = (name || 'Cliente').split(' ');
            const lastName = lastNameParts.join(' ');

            const response = await this.api.post('/contacts', {
                phone: `+${cleanPhone}`,
                first_name: firstName,
                last_name: lastName || ''
            });

            if (response.data && response.data.data) {
                return response.data.data; // Usually returns array with created contact
            }
            throw new Error('Failed to create contact');
        } catch (error) {
            console.error('Error creating contact:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Ensure contact exists (find or create)
     * @param {string} phone 
     * @param {string} name 
     * @returns {object} Contact object
     */
    async ensureContact(phone, name) {
        let contact = await this.findContactByPhone(phone);
        if (!contact) {
            console.log(`Contact not found for ${phone}, creating...`);
            // Note: createContact might return an array or object depending on API
            const result = await this.createContact(phone, name);
            // Handle potential array return from create
            contact = Array.isArray(result) ? result[0] : result;
        }
        return contact;
    }

    /**
     * Send text message to contact
     * @param {number} contactId 
     * @param {string} text 
     * @returns {object} Response data
     */
    async sendMessage(contactId, text) {
        try {
            console.log('Whapify sendMessage payload:', {
                contactId,
                text
            });

            const response = await this.api.post(`/contacts/${contactId}/send/text`, {
                content: {
                    text: text,
                    channel: 'whatsapp'
                }
            });

            console.log('Whapify sendMessage response:', response.data);

            return response.data;
        } catch (error) {
            console.error('Error sending message:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Generate "Guía de Envío" message
     */
    generateGuiaEnvioMessage(orderData, shippingData) {
        return `📦 ¡Tu pedido está en tránsito!

Pedido: #${orderData.siigo_invoice_number || orderData.order_number}
Transportadora: ${shippingData.shipping_company}
Número de Guía: ${shippingData.guide_number}

Puedes rastrear tu pedido en:
🔗 ${shippingData.tracking_url}

¡Te llegará muy pronto! 🍦`;
    }

    /**
     * Generate "Entrega Confirmada" message
     */
    generatePedidoEntregadoMessage(orderData, deliveryData) {
        const deliveryDate = new Date().toLocaleDateString('es-CO');

        return `✅ ¡Entregado con éxito!

Tu pedido #${orderData.siigo_invoice_number || orderData.order_number} ha sido entregado.

💰 Monto cobrado: $${(deliveryData.amount_collected || 0).toLocaleString('es-CO')}
📅 Fecha: ${deliveryDate}

¡Esperamos que disfrutes tus productos! 🍦

¿Cómo calificarías nuestro servicio?
⭐ ⭐ ⭐ ⭐ ⭐`;
    }

    /**
     * Send "Guía de Envío" notification
     */
    async sendGuiaEnvioNotification(orderId, shippingData, imageUrl = null) {
        try {
            // Get order data (we need to query the DB here, so we need to import query)
            // But this service doesn't import query yet. 
            // For now, let's assume shippingService passes the data or we fetch it.
            // Since I can't easily add the DB import at the top without another tool call, 
            // I will assume the caller passes enough info or I will fetch it if I can.
            // Actually, shippingService passes orderId. I need to fetch order details.

            // Let's rely on the fact that I can add the require at the top in a separate step if needed,
            // or just use the passed data if I change the signature. 
            // But shippingService calls it with (orderId, shippingData, imageUrl).

            // I'll add the DB query helper inside this method using require to avoid top-level changes for now
            const { query } = require('../config/database');

            const orderResult = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!orderResult.length) throw new Error('Pedido no encontrado');

            const orderData = orderResult[0];
            const message = this.generateGuiaEnvioMessage(orderData, shippingData);

            const contact = await this.ensureContact(orderData.customer_phone, orderData.customer_name);
            if (!contact) throw new Error('No se pudo contactar al usuario en WhatsApp');

            return await this.sendMessage(contact.id, message);
        } catch (error) {
            console.error('Error sending guide notification:', error);
            throw error;
        }
    }

    /**
     * Send "Pedido Entregado" notification
     */
    async sendPedidoEntregadoNotification(orderId, deliveryData) {
        try {
            const { query } = require('../config/database');

            const orderResult = await query('SELECT * FROM orders WHERE id = ?', [orderId]);
            if (!orderResult.length) throw new Error('Pedido no encontrado');

            const orderData = orderResult[0];
            const message = this.generatePedidoEntregadoMessage(orderData, deliveryData);

            const contact = await this.ensureContact(orderData.customer_phone, orderData.customer_name);
            if (!contact) throw new Error('No se pudo contactar al usuario en WhatsApp');

            return await this.sendMessage(contact.id, message);
        } catch (error) {
            console.error('Error sending delivery notification:', error);
            throw error;
        }
    }
}

module.exports = new WhapifyService();
