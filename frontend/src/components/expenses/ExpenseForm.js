
import React, { useState } from 'react';
import {
    Card, CardBody, Form, FormGroup, Label, Input, Button,
    Row, Col, Alert
} from 'reactstrap';
import api from '../../services/api';
import toast from 'react-hot-toast';

const ExpenseForm = ({ onSuccess, onCancel, initialData = null }) => {
    const [currentMode, setCurrentMode] = useState(initialData?.mode || (initialData?.payment_status === 'PAGADO' ? 'payment' : 'payment')); // Default to payment if new
    // If we are editing a Pending one, default is 'schedule'
    // BUT we need to sync this with initialData better.
    // Let's rely on payment_status from formData eventually.

    const isEditing = !!initialData?.id;
    const isPaymentMode = currentMode === 'payment';

    const getColombiaDate = () => {
        return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    };

    const [formData, setFormData] = useState({
        date: initialData?.date ? initialData.date.split('T')[0] : '',
        provider_name: initialData?.provider_name || '',
        provider_invoice_number: initialData?.provider_invoice_number || '',
        siigo_fc_number: initialData?.siigo_fc_number || '',
        amount: initialData?.amount || '',

        payment_date: initialData?.payment_date ? initialData.payment_date.split('T')[0] : getColombiaDate(),
        source: initialData?.source || (initialData?.payment_status === 'PAGADO' ? 'bancolombia' : ''),
        payment_status: initialData?.payment_status || 'PAGADO', // Default is paid for new ones usually
        siigo_status: initialData?.siigo_status || 'PENDIENTE',
        siigo_rp_number: initialData?.siigo_rp_number || '',

        cost_center: initialData?.cost_center || '',
        concept: initialData?.concept || '',
        description: initialData?.description || '',

        evidence: null,
        category: initialData?.category || ''
    });

    // Sync mode with payment_status changes
    const handlePaymentStatusChange = (e) => {
        const status = e.target.value;
        setFormData(prev => ({ ...prev, payment_status: status }));
        if (status === 'PAGADO') {
            setCurrentMode('payment');
        } else {
            setCurrentMode('schedule');
        }
    };

    // Initialize mode correctly
    React.useEffect(() => {
        if (initialData?.payment_status === 'PENDIENTE') {
            setCurrentMode('schedule');
        } else if (initialData?.payment_status === 'PAGADO') {
            setCurrentMode('payment');
        }
    }, [initialData]);

    const switchToPaymentMode = () => {
        setCurrentMode('payment');
        setFormData(prev => ({
            ...prev,
            payment_status: 'PAGADO',
            payment_date: getColombiaDate(),
            source: prev.source || 'bancolombia'
        }));
        toast.success('Modo cambiado a Registro de Pago');
    };

    // Set preview URL if editing and evidence exists (assuming we can't preview remote URL easily as Blob without fetch, 
    // but we can show a link or just "Existing File" placeholder. For now, we leave preview empty unless new file selected)
    // If we wanted to show existing image: 
    // const [previewUrl, setPreviewUrl] = useState(initialData?.evidence_url ? `${process.env.REACT_APP_API_URL}${initialData.evidence_url}` : null);
    // But let's stick to simple logic for now.
    const [previewUrl, setPreviewUrl] = useState(initialData?.evidence_url ? (initialData.evidence_url.startsWith('http') ? initialData.evidence_url : `${process.env.REACT_APP_API_URL}${initialData.evidence_url}`) : null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // COST CENTERS from Excel
    const COST_CENTERS = [
        'ADMINISTRACIÓN',
        'VENTAS Y PUBLICIDAD',
        'LOGISTICA Y DISTRIBUCIÓN',
        'CONTABILIDAD',
        'MANTENIMIENTO',
        'INNOVACION',
        'OTROS GASTOS',
        'PROVEEDOR',
        'TESORERIA'
    ];

    const EXPENSE_CATEGORIES = [
        'ARRIENDO',
        'EXTRA-EMPLEADOS',
        'MARCA',
        'PRODUCTO POPPING',
        'PRODUCTO FLAVOR',
        'PRODUCTO REVENTA',
        'SALARIO',
        'TRANSPORTE-CLIENTES',
        'TRANSPORTE-DISTRIBUIDORES',
        'DEVOLUCION DE FLETE',
        'DEVOLUCION DE PRODUCTO',
        'OTROS'
    ];

    const SOURCES = [
        { value: 'bancolombia', label: 'Bancolombia' },
        { value: 'mercadopago', label: 'Mercado Pago' },
        { value: 'caja_menor', label: 'Caja Menor' }
    ];

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setFormData(prev => ({ ...prev, evidence: file }));
        if (file) {
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            setPreviewUrl(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        // Validations
        // Validations
        // Ensure at least one date is present (Invoice Date OR Payment Date)
        const finalDate = formData.date || formData.payment_date;

        if (!finalDate) {
            setError('Debe registrar al menos una fecha (Factura o Pago).');
            return;
        }

        if (isPaymentMode && !formData.source) {
            setError('Para registrar un pago realizado, debe seleccionar la Fuente de dinero.');
            return;
        }

        if (!formData.amount || !formData.cost_center || !formData.category) {
            setError('Por favor complete todos los campos obligatorios (*).');
            return;
        }

        if (isPaymentMode && !previewUrl) {
            setError('Para registrar un pago realizado, ES OBLIGATORIO adjuntar el comprobante/evidencia.');
            return;
        }

        setLoading(true);
        const data = new FormData();
        // Append all fields
        // Append all fields
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && key !== 'evidence') { // Handle evidence and nulls
                data.append(key, formData[key]);
            }
        });

        // Force payment_status based on mode if creating new (sanity check)
        if (!isEditing) {
            data.set('payment_status', isPaymentMode ? 'PAGADO' : 'PENDIENTE');
        }

        if (formData.evidence) {
            data.append('evidence', formData.evidence);
        }



        try {
            if (isEditing) {
                await api.put(`/expenses/${initialData.id}`, data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Gasto actualizado exitosamente');
            } else {
                await api.post('/expenses', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success('Gasto registrado exitosamente');
            }

            if (onSuccess) onSuccess();
        } catch (err) {
            console.error(err);
            setError('Error al guardar el gasto. Intente nuevamente.');
            toast.error('Error al guardar');
        } finally {
            setLoading(false);
        }
    };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                setFormData(prev => ({ ...prev, evidence: blob }));
                setPreviewUrl(URL.createObjectURL(blob));
                toast.success('Imagen pegada del portapapeles');
                break;
            }
        }
    };

    return (
        <div onPaste={handlePaste} tabIndex="0" style={{ outline: 'none' }}>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <span className="text-muted text-sm"><small>Tip: Pega (Ctrl+V) el comprobante {isPaymentMode && '(*Obligatorio)'} en cualquier lugar</small></span>
                {!isPaymentMode && (
                    <Button color="success" size="sm" onClick={switchToPaymentMode}>
                        <i className="ni ni-money-coins mr-2" />
                        ¡REALIZAR PAGO AHORA!
                    </Button>
                )}
            </div>
            {error && <Alert color="danger">{error}</Alert>}
            <Form onSubmit={handleSubmit}>

                {/* EVIDENCIA (Moved to Top) */}
                <div className="mb-4">
                    {!previewUrl ? (
                        <div
                            className="border rounded p-4 text-center position-relative"
                            style={{ border: '2px dashed #dee2e6', backgroundColor: '#fcfcfc', cursor: 'pointer' }}
                            onClick={() => document.getElementById('evidenceFile').click()}
                        >
                            <Input type="file" name="evidence" id="evidenceFile" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
                            <i className="ni ni-cloud-upload-96 display-4 text-primary mb-2"></i>
                            <p className="small mb-0 text-muted font-weight-bold">
                                {isPaymentMode ? 'Evidencia de Pago Obligatoria (*)' : 'Click para subir evidencia o pega la imagen (Ctrl+V)'}
                            </p>
                        </div>
                    ) : (
                        <div className="text-center position-relative bg-light p-2 rounded border">
                            <img src={previewUrl} alt="Preview" className="img-fluid rounded shadow-sm" style={{ maxHeight: '200px' }} />
                            <Button size="sm" color="danger" className="position-absolute" style={{ top: '5px', right: '5px' }} onClick={() => { setPreviewUrl(null); setFormData(p => ({ ...p, evidence: null })); }}>
                                <i className="ni ni-fat-remove" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* SECCIÓN 1: CAUSACIÓN (SIIGO) - Removed bg-secondary */}
                <div className="border p-3 rounded mb-3 bg-white shadow-sm">
                    <h6 className="heading-small text-primary mb-3 border-bottom pb-2">1. Causación (Datos Factura)</h6>
                    <Row>
                        <Col md={3}>
                            <FormGroup>
                                <Label for="date" className="form-control-label text-xs">Fecha Factura</Label>
                                <Input bsSize="sm" type="date" name="date" id="date" value={formData.date} onChange={handleInputChange} />
                            </FormGroup>
                        </Col>
                        <Col md={9}>
                            <FormGroup>
                                <Label for="provider_name" className="form-control-label text-xs">Nombre del Proveedor</Label>
                                <Input bsSize="sm" type="text" name="provider_name" id="provider_name" placeholder="Ej: Google Cloud" value={formData.provider_name} onChange={handleInputChange} />
                            </FormGroup>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={4}>
                            <FormGroup>
                                <Label for="provider_invoice_number" className="form-control-label text-xs">Factura Proveedor</Label>
                                <Input bsSize="sm" type="text" name="provider_invoice_number" id="provider_invoice_number" placeholder="Ej: FE-123" value={formData.provider_invoice_number} onChange={handleInputChange} />
                            </FormGroup>
                        </Col>
                        <Col md={4}>
                            <FormGroup>
                                <Label for="siigo_fc_number" className="form-control-label text-xs">FC en Siigo</Label>
                                <Input bsSize="sm" type="text" name="siigo_fc_number" id="siigo_fc_number" placeholder="Ej: FC-1-4556" value={formData.siigo_fc_number} onChange={handleInputChange} />
                            </FormGroup>
                        </Col>
                        <Col md={4}>
                            <FormGroup>
                                <Label for="amount" className="form-control-label is-required text-xs">Valor Total</Label>
                                <Input bsSize="sm" type="number" step="0.01" name="amount" id="amount" placeholder="0" value={formData.amount} onChange={handleInputChange} required />
                            </FormGroup>
                        </Col>
                    </Row>
                </div>

                {/* SECCIÓN 2: SALIDA DE DINERO - Removed bg-secondary */}
                <div className="border p-3 rounded mb-3 bg-white shadow-sm">
                    <h6 className="heading-small text-primary mb-3 border-bottom pb-2">2. Salida de Dinero (Pago)</h6>
                    <Row>
                        <Col md={3}>
                            <FormGroup>
                                <Label for="payment_date" className="form-control-label text-xs">
                                    {isPaymentMode ? 'Fecha Real Pago' : 'Fecha Tentativa Pago'}
                                </Label>
                                <Input bsSize="sm" type="date" name="payment_date" id="payment_date" value={formData.payment_date} onChange={handleInputChange} />
                            </FormGroup>
                        </Col>
                        <Col md={4}>
                            <FormGroup>
                                <Label for="source" className="form-control-label text-xs">
                                    {isPaymentMode ? 'Banco / Fuente (*)' : 'Fuente (Opcional)'}
                                </Label>
                                <Input bsSize="sm" type="select" name="source" id="source" value={formData.source} onChange={handleInputChange}>
                                    <option value="">-- {isPaymentMode ? 'Seleccione' : 'Por Definir'} --</option>
                                    {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </Input>
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label for="siigo_status" className="form-control-label text-xs">Registro en Siigo</Label>
                                <Input bsSize="sm" type="select" name="siigo_status" id="siigo_status" value={formData.siigo_status} onChange={handleInputChange}>
                                    <option value="PENDIENTE">PENDIENTE</option>
                                    <option value="APLICADO">APLICADO</option>
                                </Input>
                            </FormGroup>
                        </Col>
                        <Col md={2}>
                            <FormGroup>
                                <Label for="siigo_rp_number" className="form-control-label text-xs">RP en Siigo</Label>
                                <Input bsSize="sm" type="text" name="siigo_rp_number" id="siigo_rp_number" placeholder="RP-..." value={formData.siigo_rp_number} onChange={handleInputChange} />
                            </FormGroup>
                        </Col>
                        <Col md={3}>
                            <FormGroup>
                                <Label for="payment_status" className="form-control-label text-xs">Estado Pago</Label>
                                <Input bsSize="sm" type="select" name="payment_status" id="payment_status" value={formData.payment_status} onChange={handlePaymentStatusChange}>
                                    <option value="PENDIENTE">PENDIENTE</option>
                                    <option value="PAGADO">PAGADO</option>
                                </Input>
                            </FormGroup>
                        </Col>
                    </Row>
                </div>

                {/* SECCIÓN 3: CLASIFICACIÓN */}
                <h6 className="heading-small text-primary mb-3 mt-3 border-bottom pb-2">3. Clasificación</h6>
                <Row>
                    <Col md={4}>
                        <FormGroup>
                            <Label for="cost_center" className="form-control-label is-required">Centro de Costo</Label>
                            <Input type="select" name="cost_center" id="cost_center" value={formData.cost_center} onChange={handleInputChange} required>
                                <option value="">Seleccione...</option>
                                {COST_CENTERS.map(c => <option key={c} value={c}>{c}</option>)}
                            </Input>
                        </FormGroup>
                    </Col>
                    <Col md={4}>
                        <FormGroup>
                            <Label for="category" className="form-control-label is-required">Tipo de Gasto</Label>
                            <Input type="select" name="category" id="category" value={formData.category} onChange={handleInputChange} required>
                                <option value="">Seleccione...</option>
                                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </Input>
                        </FormGroup>
                    </Col>
                    <Col md={4}>
                        <FormGroup>
                            <Label for="concept" className="form-control-label">Concepto de Compra</Label>
                            <Input type="text" name="concept" id="concept" placeholder="Detalle del gasto..." value={formData.concept} onChange={handleInputChange} />
                        </FormGroup>
                    </Col>
                </Row>
                <Row>
                    <Col md={12}>
                        <FormGroup>
                            <Label for="description" className="form-control-label text-xs">Notas Administrativas / Seguimiento (Observaciones)</Label>
                            <Input type="textarea" name="description" id="description" rows="3" placeholder="Observaciones de pago, novedades, etc." value={formData.description} onChange={handleInputChange} />
                        </FormGroup>
                    </Col>
                </Row>




                <div className="text-right">
                    {onCancel && (
                        <Button color="secondary" type="button" onClick={onCancel} className="mr-2" disabled={loading}>
                            Cancelar
                        </Button>
                    )}
                    <Button color={isPaymentMode ? "success" : "warning"} type="submit" disabled={loading}>
                        {loading ? 'Guardando...' : (isEditing ? 'Actualizar Gasto' : (isPaymentMode ? 'Confirmar Pago' : 'Programar Pago'))}
                    </Button>
                </div>
            </Form>
        </div >
    );
};

export default ExpenseForm;
