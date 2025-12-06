import React, { useState } from 'react';
import * as Icons from 'lucide-react';
import toast from 'react-hot-toast';
import whapifyApi from '../api/whapify';

const SendMessageModal = ({ isOpen, onClose, customer }) => {
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen || !customer) return null;

    const handleSend = async () => {
        if (!message.trim()) {
            toast.error('Please enter a message');
            return;
        }

        try {
            setLoading(true);
            await whapifyApi.sendMessage(customer.phone, customer.name, message);
            toast.success('Message sent successfully');
            setMessage('');
            onClose();
        } catch (error) {
            console.error('Error sending message:', error);
            toast.error(error.message || 'Failed to send message');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-medium text-gray-900 flex items-center">
                            <Icons.MessageSquare className="w-5 h-5 mr-2 text-green-600" />
                            Send WhatsApp Message
                        </h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-2">
                            To: <span className="font-medium text-gray-900">{customer.name}</span> ({customer.phone})
                        </p>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Type your message here..."
                            className="w-full h-32 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                        />
                    </div>

                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSend}
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 flex items-center disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Icons.Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Icons.Send className="w-4 h-4 mr-2" />
                                    Send Message
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SendMessageModal;
