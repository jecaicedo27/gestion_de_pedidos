import React, { useMemo, useState, useEffect, useRef } from 'react';
import { X, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import { siigoService } from '../services/api';

const computeNitCheckDigit = (nit) => {
  try {
    const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
    const digits = String(nit || '').replace(/\D/g, '').split('').reverse();
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      const w = weights[i] || 0;
      sum += parseInt(digits[i], 10) * w;
    }
    const mod = sum % 11;
    return mod > 1 ? (11 - mod) : mod;
  } catch {
    return '';
  }
};

const CreateSiigoCustomerModal = ({ open = false, onClose, onCreated }) => {
  const [personType, setPersonType] = useState('Person'); // Person | Company
  const [idType, setIdType] = useState('CC'); // CC | NIT
  const [identification, setIdentification] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Autocomplete de ciudades SIIGO
  const [cityQuery, setCityQuery] = useState('Medellín');
  const [cityOptions, setCityOptions] = useState([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState(null);
  const searchTimer = useRef(null);

  const dv = useMemo(() => (idType === 'NIT' ? computeNitCheckDigit(identification) : ''), [idType, identification]);

  // Búsqueda con debounce de ciudades por nombre/código
  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = (cityQuery || '').trim();
      if (q.length < 2) {
        setCityOptions([]);
        return;
      }
      try {
        setCityLoading(true);
        const resp = await siigoService.searchCities(q);
        const list = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || []);
        setCityOptions(list || []);
      } catch {
        setCityOptions([]);
      } finally {
        setCityLoading(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [cityQuery, open]);

  if (!open) return null;

  const validate = () => {
    if (!identification || !String(identification).trim()) {
      toast.error('Identificación requerida');
      return false;
    }
    if (personType === 'Person') {
      if (!firstName.trim()) {
        toast.error('Nombres requeridos');
        return false;
      }
    } else {
      if (!companyName.trim()) {
        toast.error('Razón social requerida');
        return false;
      }
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error('Email inválido');
      return false;
    }
    if (!address.trim()) {
      toast.error('Dirección requerida');
      return false;
    }
    if (!selectedCity && !cityQuery.trim()) {
      toast.error('Ciudad requerida');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      let cityForPayload = selectedCity;
      if (!cityForPayload && cityQuery) {
        try {
          const resp = await siigoService.searchCities(cityQuery.trim());
          const list = Array.isArray(resp?.data) ? resp.data : (resp?.data?.data || []);
          if (list && list.length) {
            cityForPayload = { state_code: String(list[0].state_code), city_code: String(list[0].city_code) };
          }
        } catch { }
      }
      if (!cityForPayload) {
        toast.error('Selecciona una ciudad válida (usa el listado)');
        setSubmitting(false);
        return;
      }

      const payload = {
        person_type: personType,
        id_type: idType,
        identification: String(identification).replace(/\s+/g, ''),
        first_name: personType === 'Person' ? firstName : undefined,
        last_name: personType === 'Person' ? lastName : undefined,
        company_name: personType === 'Company' ? companyName : undefined,
        email: email.trim(),
        phone: phone,
        city: { state_code: cityForPayload.state_code, city_code: cityForPayload.city_code },
        direccion: address
      };

      const resp = await siigoService.createCustomer(payload);
      if (resp?.success && resp?.data) {
        toast.success(resp.message || 'Cliente creado en SIIGO');
        onCreated && onCreated(resp.data);
      } else {
        const msg = resp?.message || 'No se pudo crear el cliente';
        toast.error(msg);
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e.message || 'Error creando el cliente';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-green-600" />
            <h3 className="text-base font-semibold text-gray-900">Crear cliente en SIIGO</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Tipo</label>
              <select
                value={personType}
                onChange={(e) => setPersonType(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="Person">Persona</option>
                <option value="Company">Empresa</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Tipo de identificación</label>
              <select
                value={idType}
                onChange={(e) => setIdType(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="CC">Cédula</option>
                <option value="NIT">NIT</option>
              </select>
            </div>

            <div className="md:col-span- id-row grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700">
                  {idType === 'NIT' ? 'NIT' : 'Cédula'}
                </label>
                <input
                  type="text"
                  value={identification}
                  onChange={(e) => setIdentification(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  placeholder={idType === 'NIT' ? '901234567' : '1234567890'}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">DV</label>
                <input
                  type="text"
                  value={idType === 'NIT' ? String(dv) : ''}
                  readOnly
                  className="mt-1 w-full border border-gray-200 bg-gray-50 rounded px-2 py-1.5 text-sm"
                  placeholder="-"
                />
              </div>
            </div>

            {personType === 'Person' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Nombres</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="Juan"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Apellidos</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                    placeholder="Pérez"
                  />
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700">Razón social</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                  placeholder="Empresa S.A.S."
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700">Correo electrónico</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="correo@dominio.com"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Teléfono</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="3001234567"
              />
            </div>

            <div className="relative">
              <label className="block text-xs font-medium text-gray-700">Ciudad (códigos SIIGO)</label>
              <input
                type="text"
                value={cityQuery}
                onChange={(e) => {
                  setCityQuery(e.target.value);
                  setSelectedCity(null);
                }}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="Escribe para buscar (ej. Medellín)"
              />
              {cityLoading && <div className="absolute right-2 top-8 text-xs text-gray-500">Cargando…</div>}
              {Array.isArray(cityOptions) && cityOptions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow max-h-40 overflow-auto">
                  {cityOptions.map((opt, idx) => (
                    <button
                      key={`${opt.state_code}-${opt.city_code}-${idx}`}
                      type="button"
                      className="w-full text-left px-2 py-1.5 hover:bg-gray-50 text-sm"
                      onClick={() => {
                        setSelectedCity({ state_code: String(opt.state_code), city_code: String(opt.city_code) });
                        setCityQuery(`${opt.city_name} (${opt.city_code} - ${opt.state_code})`);
                      }}
                    >
                      {opt.city_name} — {opt.state_name} · {opt.city_code}/{opt.state_code}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-1 text-[11px] text-gray-500">
                Debe enviarse state_code y city_code según documentación de SIIGO.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700">Dirección</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                placeholder="Calle 10 # 20 - 30"
              />
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t flex justify-end gap-2">
          <button
            className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            className="px-3 py-1.5 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            onClick={handleSubmit}
            disabled={submitting}
          >
            <UserPlus className="w-4 h-4" />
            {submitting ? 'Creando...' : 'Crear en SIIGO'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateSiigoCustomerModal;
