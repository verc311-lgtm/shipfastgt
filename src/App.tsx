import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, 
  Truck, 
  Shield, 
  Search, 
  Plus, 
  MapPin, 
  User, 
  TrendingUp, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  ClipboardList, 
  Sparkles, 
  Send, 
  RefreshCw, 
  SlidersHorizontal, 
  UserCheck
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

// Types definition
interface TrackingHistory {
  date: string;
  time: string;
  status: string;
  location: string;
  details: string;
}

interface Shipment {
  id: string;
  sender: string;
  receiver: string;
  origin: string;
  destination: string;
  status: 'Creado' | 'En Tránsito' | 'En Sucursal' | 'En Ruta' | 'Entregado' | 'Retrasado';
  serviceType: 'Express' | 'Estándar';
  weight: number; // in kg
  dimensions: string;
  lastUpdated: string;
  history: TrackingHistory[];
  signatureUrl?: string;
  signeeName?: string;
  notes?: string;
}

interface ChatMessage {
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
}

// Helper to generate IDs
const generateId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SF-${num}-GT`;
};

// Initial state data
const INITIAL_SHIPMENTS: Shipment[] = [
  {
    id: "SF-8219-GT",
    sender: "Distribuidora Industrial S.A.",
    receiver: "Comercializadora del Norte",
    origin: "Ciudad de Guatemala, Guatemala",
    destination: "Quetzaltenango, Quetzaltenango",
    status: "Entregado",
    serviceType: "Express",
    weight: 12.5,
    dimensions: "40x30x30 cm",
    lastUpdated: "2026-05-20 16:45",
    history: [
      { date: "2026-05-20", time: "16:45", status: "Entregado", location: "Quetzaltenango - Oficina Central", details: "Entregado y firmado por Ing. Mario Juárez." },
      { date: "2026-05-20", time: "09:30", status: "En Ruta", location: "Quetzaltenango", details: "Unidad asignada en reparto local." },
      { date: "2026-05-19", time: "22:15", status: "En Sucursal", location: "Sucursal Quetzaltenango", details: "Clasificación y recepción en almacén regional." },
      { date: "2026-05-19", time: "14:00", status: "En Tránsito", location: "Ruta Interamericana KM 84", details: "Transporte troncal principal en tránsito hacia Occidente." },
      { date: "2026-05-19", time: "09:00", status: "Creado", location: "Guatemala - Hub Central", details: "Paquete recolectado y documentado en oficina central." }
    ],
    signeeName: "Ing. Mario Juárez",
    notes: "Entregar en garita de seguridad de ser necesario."
  },
  {
    id: "SF-9843-GT",
    sender: "Droguería Médica Familiar",
    receiver: "Farmacias de la Antigua",
    origin: "Ciudad de Guatemala, Guatemala",
    destination: "La Antigua Guatemala, Sacatepéquez",
    status: "En Ruta",
    serviceType: "Express",
    weight: 3.2,
    dimensions: "25x20x15 cm",
    lastUpdated: "2026-05-21 08:00",
    history: [
      { date: "2026-05-21", time: "08:00", status: "En Ruta", location: "Antigua Guatemala", details: "Asignado a mensajero motorizado para entrega el día de hoy." },
      { date: "2026-05-20", time: "18:00", status: "En Sucursal", location: "Sucursal Antigua Guatemala", details: "Ingreso a oficina regional para clasificación final." },
      { date: "2026-05-20", time: "11:30", status: "En Tránsito", location: "Ruta Nacional 10 KM 28", details: "Unidad ligera en ruta de transferencia." },
      { date: "2026-05-20", time: "08:30", status: "Creado", location: "Guatemala - Hub Central", details: "Envío recibido en ventanilla de oficina central." }
    ],
    notes: "Medicamentos de cadena de frío parcial. Mantener en sombra."
  },
  {
    id: "SF-4912-GT",
    sender: "Zapatos El Quetzal",
    receiver: "Boutique Modas Huehue",
    origin: "Huehuetenango, Huehuetenango",
    destination: "Ciudad de Guatemala, Guatemala",
    status: "En Tránsito",
    serviceType: "Estándar",
    weight: 22.0,
    dimensions: "60x40x45 cm",
    lastUpdated: "2026-05-20 23:45",
    history: [
      { date: "2026-05-20", time: "23:45", status: "En Tránsito", location: "San Cristóbal Totonicapán", details: "Unidad consolidada de carga pesada en movimiento." },
      { date: "2026-05-20", time: "14:15", status: "En Sucursal", location: "Sucursal Huehuetenango", details: "Carga consolidada y paletizada en andén de salida." },
      { date: "2026-05-20", time: "10:00", status: "Creado", location: "Sucursal Huehuetenango", details: "Registro del cliente en sucursal del altiplano." }
    ]
  },
  {
    id: "SF-5011-GT",
    sender: "Corporación Agrícola Las Verapaces",
    receiver: "Fertilizantes del Sur",
    origin: "Cobán, Alta Verapaz",
    destination: "Escuintla, Escuintla",
    status: "Creado",
    serviceType: "Estándar",
    weight: 45.0,
    dimensions: "80x50x50 cm",
    lastUpdated: "2026-05-21 07:15",
    history: [
      { date: "2026-05-21", time: "07:15", status: "Creado", location: "Sucursal Cobán", details: "Programación de recolección en planta agroindustrial confirmada." }
    ],
    notes: "Producto empacado en sacos reforzados. Requiere estibado cuidadoso."
  },
  {
    id: "SF-7422-GT",
    sender: "Importadora Tecnológica S.A.",
    receiver: "Servicios Digitales de Oriente",
    origin: "Chimaltenango, Chimaltenango",
    destination: "Zacapa, Zacapa",
    status: "Retrasado",
    serviceType: "Express",
    weight: 1.8,
    dimensions: "20x15x10 cm",
    lastUpdated: "2026-05-20 15:30",
    history: [
      { date: "2026-05-20", time: "15:30", status: "Retrasado", location: "Ruta al Atlántico KM 42", details: "Retraso debido a bloqueo temporal de carretera por accidente vial." },
      { date: "2026-05-20", time: "10:00", status: "En Tránsito", location: "Guatemala - Hub Central", details: "Despacho de andén de transferencia con destino a Oriente." },
      { date: "2026-05-19", time: "17:00", status: "En Sucursal", location: "Sucursal Chimaltenango", details: "Paquete recibido y preparado para transferencia." },
      { date: "2026-05-19", time: "12:00", status: "Creado", location: "Sucursal Chimaltenango", details: "Ingreso formal de envío express." }
    ],
    notes: "Componentes electrónicos delicados."
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'client' | 'driver' | 'admin' | 'ai'>('client');
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);

  // Client Portal States
  const [searchTrackingId, setSearchTrackingId] = useState('');
  const [searchedShipment, setSearchedShipment] = useState<Shipment | null>(null);
  const [clientSearchError, setClientSearchError] = useState('');
  const [pickupSender, setPickupSender] = useState('');
  const [pickupReceiver, setPickupReceiver] = useState('');
  const [pickupOrigin, setPickupOrigin] = useState('');
  const [pickupDestination, setPickupDestination] = useState('');
  const [pickupService, setPickupService] = useState<'Express' | 'Estándar'>('Express');
  const [pickupWeight, setPickupWeight] = useState(1);
  const [pickupNotes, setPickupNotes] = useState('');
  const [pickupSuccessMsg, setPickupSuccessMsg] = useState('');

  // Driver View States
  const [activeDriverTaskId, setActiveDriverTaskId] = useState<string | null>(null);
  const [signeeName, setSigneeName] = useState('');
  const [signatureDone, setSignatureDone] = useState(false);
  const signatureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Admin View States
  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('todos');
  const [adminServiceFilter, setAdminServiceFilter] = useState<string>('todos');
  const [selectedAdminShipment, setSelectedAdminShipment] = useState<Shipment | null>(null);
  const [newShipmentModal, setNewShipmentModal] = useState(false);
  const [updateStatusVal, setUpdateStatusVal] = useState<'Creado' | 'En Tránsito' | 'En Sucursal' | 'En Ruta' | 'Entregado' | 'Retrasado'>('Creado');
  const [updateLocationVal, setUpdateLocationVal] = useState('');
  const [updateDetailsVal, setUpdateDetailsVal] = useState('');

  // New Shipment Creation states (Admin)
  const [adminSender, setAdminSender] = useState('');
  const [adminReceiver, setAdminReceiver] = useState('');
  const [adminOrigin, setAdminOrigin] = useState('');
  const [adminDestination, setAdminDestination] = useState('');
  const [adminService, setAdminService] = useState<'Express' | 'Estándar'>('Express');
  const [adminWeight, setAdminWeight] = useState(1);
  const [adminDimensions, setAdminDimensions] = useState('30x20x20 cm');
  const [adminNotes, setAdminNotes] = useState('');

  // AI Assistant States
  const [aiChat, setAiChat] = useState<ChatMessage[]>([
    { sender: 'ai', text: 'Bienvenido al Centro de Control de Inteligencia Artificial de ShipFast GT. Puedo ayudarte a buscar envíos, calcular estimaciones de entrega, optimizar rutas logísticas o simular estados. ¿En qué puedo asistirte hoy?', timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }
  ]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Auto-search default shipment for Client View for first load visualization
  useEffect(() => {
    if (shipments.length > 0) {
      setSearchedShipment(shipments[1]); // Preselect SF-9843-GT on load
      setSearchTrackingId(shipments[1].id);
    }
  }, []);

  // Client Search Handler
  const handleClientSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setClientSearchError('');
    const found = shipments.find(s => s.id.trim().toUpperCase() === searchTrackingId.trim().toUpperCase());
    if (found) {
      setSearchedShipment(found);
    } else {
      setSearchedShipment(null);
      setClientSearchError('Código de rastreo no encontrado. Verifique el formato (ej: SF-8219-GT).');
    }
  };

  // Client Pickup Form Submit
  const handleRequestPickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupSender || !pickupReceiver || !pickupOrigin || !pickupDestination) {
      alert('Por favor complete los campos requeridos de remitente, destinatario y rutas.');
      return;
    }

    const newId = generateId();
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const newShip: Shipment = {
      id: newId,
      sender: pickupSender,
      receiver: pickupReceiver,
      origin: pickupOrigin,
      destination: pickupDestination,
      status: 'Creado',
      serviceType: pickupService,
      weight: Number(pickupWeight),
      dimensions: "30x20x20 cm",
      lastUpdated: `${currentDate} ${currentTime}`,
      history: [
        {
          date: currentDate,
          time: currentTime,
          status: 'Creado',
          location: pickupOrigin.split(',')[0],
          details: 'Solicitud de recogida registrada por el cliente vía portal web.'
        }
      ],
      notes: pickupNotes
    };

    setShipments([newShip, ...shipments]);
    setPickupSuccessMsg(`¡Solicitud generada con éxito! Su código de rastreo asignado es: ${newId}`);
    
    // Reset form fields
    setPickupSender('');
    setPickupReceiver('');
    setPickupOrigin('');
    setPickupDestination('');
    setPickupWeight(1);
    setPickupNotes('');

    // Pre-fill search tracking for user convenience
    setSearchTrackingId(newId);
    setSearchedShipment(newShip);

    setTimeout(() => {
      setPickupSuccessMsg('');
    }, 8000);
  };

  // Driver Digital Signature Init/Draw Methods
  const initSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    let drawing = false;
    
    const startDrawing = (e: any) => {
      drawing = true;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || e.touches[0].clientX) - rect.left;
      const y = (e.clientY || e.touches[0].clientY) - rect.top;
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: any) => {
      if (!drawing) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      drawing = false;
      setSignatureDone(true);
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);
  };

  useEffect(() => {
    if (activeDriverTaskId && activeTab === 'driver') {
      // Small timeout to allow Modal/Canvas to mount in DOM
      setTimeout(initSignatureCanvas, 100);
    }
  }, [activeDriverTaskId, activeTab]);

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDone(false);
  };

  // Confirm Driver Delivery
  const handleDriverDeliveryConfirm = () => {
    if (!signeeName.trim()) {
      alert('Por favor ingrese el nombre del receptor que firma.');
      return;
    }
    if (!signatureDone) {
      alert('Por favor realice un trazo de firma en el panel digital.');
      return;
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    setShipments(prev => prev.map(s => {
      if (s.id === activeDriverTaskId) {
        return {
          ...s,
          status: 'Entregado',
          lastUpdated: `${currentDate} ${currentTime}`,
          signeeName: signeeName,
          signatureUrl: "MOCK_SIGNATURE_DATA_CAPTURED",
          history: [
            {
              date: currentDate,
              time: currentTime,
              status: 'Entregado',
              location: s.destination.split(',')[0],
              details: `Entregado al destinatario final y firmado digitalmente por: ${signeeName}.`
            },
            ...s.history
          ]
        };
      }
      return s;
    }));

    alert('Entrega confirmada y registrada en el sistema central.');
    setActiveDriverTaskId(null);
    setSigneeName('');
    setSignatureDone(false);
  };

  // Admin New Shipment Creation
  const handleAdminCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSender || !adminReceiver || !adminOrigin || !adminDestination) {
      alert('Complete todos los campos del envío corporativo.');
      return;
    }

    const newId = generateId();
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const newShip: Shipment = {
      id: newId,
      sender: adminSender,
      receiver: adminReceiver,
      origin: adminOrigin,
      destination: adminDestination,
      status: 'Creado',
      serviceType: adminService,
      weight: Number(adminWeight),
      dimensions: adminDimensions,
      lastUpdated: `${currentDate} ${currentTime}`,
      history: [
        {
          date: currentDate,
          time: currentTime,
          status: 'Creado',
          location: adminOrigin.split(',')[0],
          details: 'Orden de despacho logístico creada por el administrador central.'
        }
      ],
      notes: adminNotes
    };

    setShipments([newShip, ...shipments]);
    alert(`Envío corporativo ${newId} creado correctamente.`);
    setNewShipmentModal(false);

    // Reset fields
    setAdminSender('');
    setAdminReceiver('');
    setAdminOrigin('');
    setAdminDestination('');
    setAdminWeight(1);
    setAdminDimensions('30x20x20 cm');
    setAdminNotes('');
  };

  // Admin Update Status Event
  const handleAdminUpdateStatus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdminShipment) return;

    if (!updateLocationVal || !updateDetailsVal) {
      alert('Por favor ingrese la ubicación y los detalles de la bitácora logística.');
      return;
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const newHistoryEvent: TrackingHistory = {
      date: currentDate,
      time: currentTime,
      status: updateStatusVal,
      location: updateLocationVal,
      details: updateDetailsVal
    };

    setShipments(prev => prev.map(s => {
      if (s.id === selectedAdminShipment.id) {
        const updatedShip: Shipment = {
          ...s,
          status: updateStatusVal,
          lastUpdated: `${currentDate} ${currentTime}`,
          history: [newHistoryEvent, ...s.history]
        };
        setSelectedAdminShipment(updatedShip); // update current active panel state too
        return updatedShip;
      }
      return s;
    }));

    setUpdateLocationVal('');
    setUpdateDetailsVal('');
    alert('Bitácora y estado de envío actualizados en tiempo real.');
  };

  // AI Assistant Chat Processor
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    const userText = aiInput;
    const userMsg: ChatMessage = {
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };

    setAiChat(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      // AI Logic
      const lowerText = userText.toLowerCase();
      let aiText = '';

      // Check if it's querying a tracking ID inside our database
      const matchedShipment = shipments.find(s => 
        lowerText.includes(s.id.toLowerCase()) || 
        (s.id.split('-')[1] && lowerText.includes(s.id.split('-')[1]))
      );

      if (matchedShipment) {
        const currentHist = matchedShipment.history[0];
        aiText = `He localizado el envío **${matchedShipment.id}** en nuestro sistema logístico. 
        
- **Remitente:** ${matchedShipment.sender}
- **Destinatario:** ${matchedShipment.receiver}
- **Ruta:** de ${matchedShipment.origin} a ${matchedShipment.destination}
- **Estado Actual:** ${matchedShipment.status} (Actualizado el ${matchedShipment.lastUpdated})
- **Detalle de Ubicación:** ${currentHist.location} - ${currentHist.details}
- **Tipo de Envío:** Servicio ${matchedShipment.serviceType} (${matchedShipment.weight} Kg, ${matchedShipment.dimensions})

¿Deseas programar una alerta automática de cambio de estado para este paquete?`;
      } 
      // Route query simulation
      else if (lowerText.includes('ruta') || lowerText.includes('tránsito') || lowerText.includes('bloqueo') || lowerText.includes('tiempo')) {
        const delayedList = shipments.filter(s => s.status === 'Retrasado');
        const delayStr = delayedList.length > 0 
          ? `Actualmente tenemos reportado un retraso en la Ruta al Atlántico (KM 42) afectando al paquete: ${delayedList.map(s => s.id).join(', ')}.`
          : `No hay bloqueos activos ni alertas climáticas reportadas en las carreteras troncales principales de Guatemala.`;

        aiText = `**Análisis Logístico de Corredores Nacionales:**
        
1. **Ruta al Occidente (Interamericana CA-1):** Flujo normal. Tiempo estimado Guatemala - Quetzaltenango: 4.5 horas para unidades de carga intermedia.
2. **Ruta al Atlántico (CA-9 Norte):** ${delayStr}
3. **Autopista Palín-Escuintla (CA-9 Sur):** Tránsito fluido. Operación de básculas funcionando sin colas significativas.

*Recomendación para Despachos Express:* Desviar las rutas secundarias del altiplano por Chimaltenango vía libramiento para evitar tránsito denso de hora pico.`;
      }
      // General metrics questions
      else if (lowerText.includes('estadística') || lowerText.includes('rendimiento') || lowerText.includes('despacho') || lowerText.includes('métricas')) {
        const total = shipments.length;
        const delivered = shipments.filter(s => s.status === 'Entregado').length;
        const transit = shipments.filter(s => s.status === 'En Tránsito' || s.status === 'En Ruta').length;
        const delays = shipments.filter(s => s.status === 'Retrasado').length;
        const rate = ((delivered / total) * 100).toFixed(1);

        aiText = `**Resumen de Desempeño Operativo del Hub (ShipFast GT):**

- **Volumen Total Gestionado:** ${total} paquetes en base de datos local.
- **Tasa de Efectividad en Entrega:** ${rate}% de entregas exitosas.
- **En Cola de Distribución:** ${transit} unidades activas en red de tránsito.
- **En Alerta Crítica (Retrasos):** ${delays} incidentes activos de tráfico nacional.

Nuestros indicadores de servicio muestran un óptimo rendimiento en el corredor Metropolitano, pero se recomienda supervisar los tiempos de despacho del lote con destino al Altiplano Central.`;
      }
      else {
        // Attempt actual Gemini API call if key is available, else fallback
        const apiKey = ((import.meta as any).env?.VITE_GEMINI_API_KEY as string) || '';
        
        if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
          try {
            const aiInstance = new GoogleGenAI({ apiKey });
            const prompt = `Actúa como el despachador jefe de ShipFast GT, una empresa de logística formal y altamente eficiente en Guatemala. Responde la siguiente consulta de manera profesional, minimalista y concisa, en español: "${userText}". 
            Usa un tono corporativo formal. No uses emojis ni adornos innecesarios.`;
            
            const response = await aiInstance.models.generateContent({
              model: 'gemini-1.5-flash',
              contents: prompt,
            });
            
            aiText = response.text || 'Sin respuesta del despachador central.';
          } catch (apiErr: any) {
            console.error('Gemini API Error:', apiErr);
            aiText = `He procesado tu consulta logísticamente. El servidor reporta un estado operativo estable. Si deseas rastrear un envío, indícame su código de rastreo (ej: SF-9843-GT) o pregunta por las métricas de despacho del día.`;
          }
        } else {
          // Classic professional fallback assistant responses
          aiText = `Recibido. Como despachador jefe de ShipFast GT, confirmo que su consulta ha sido procesada en nuestro sistema inteligente. 

Para proporcionarle información específica, puede solicitar:
- **Rastreo de paquete:** Indique códigos como "SF-8219-GT" o "SF-7422-GT".
- **Estado de carreteras:** Pregunte por "rutas" o "bloqueos de carreteras".
- **Estado del hub:** Escriba "métricas" o "rendimiento de despacho".

¿Qué módulo o información de despacho desea que analicemos a continuación?`;
        }
      }

      setAiChat(prev => [...prev, {
        sender: 'ai',
        text: aiText,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    } catch (err) {
      console.error(err);
      setAiChat(prev => [...prev, {
        sender: 'ai',
        text: 'Error en conexión de red con el despachador inteligente. Intente de nuevo.',
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Filter shipments for Admin listing
  const filteredShipments = shipments.filter(s => {
    const matchesSearch = s.id.toLowerCase().includes(adminSearch.toLowerCase()) ||
                          s.sender.toLowerCase().includes(adminSearch.toLowerCase()) ||
                          s.receiver.toLowerCase().includes(adminSearch.toLowerCase()) ||
                          s.destination.toLowerCase().includes(adminSearch.toLowerCase());
    
    const matchesStatus = adminStatusFilter === 'todos' || s.status === adminStatusFilter;
    const matchesService = adminServiceFilter === 'todos' || s.serviceType === adminServiceFilter;

    return matchesSearch && matchesStatus && matchesService;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none">
      {/* Header section - Strict, Professional, Corporate Gray */}
      <header className="bg-brand-gray-dark text-white shadow-md border-b-2 border-brand-orange shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-brand-orange p-2 rounded-lg text-white">
              <Truck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-wider font-display text-white">SHIPFAST GT</h1>
              <p className="text-xs text-gray-400 font-medium tracking-tight">SISTEMA INTEGRAL DE LOGÍSTICA CORPORATIVA</p>
            </div>
          </div>

          {/* Navigation Control Tabs */}
          <nav className="flex space-x-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
            <button
              onClick={() => setActiveTab('client')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 uppercase tracking-wider flex items-center gap-2 ${
                activeTab === 'client' 
                  ? 'bg-brand-orange text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <User className="h-3.5 w-3.5" />
              Clientes
            </button>
            
            <button
              onClick={() => setActiveTab('driver')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 uppercase tracking-wider flex items-center gap-2 ${
                activeTab === 'driver' 
                  ? 'bg-brand-orange text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Repartidores
            </button>

            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 uppercase tracking-wider flex items-center gap-2 ${
                activeTab === 'admin' 
                  ? 'bg-brand-orange text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Operaciones
            </button>

            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all duration-200 uppercase tracking-wider flex items-center gap-2 ${
                activeTab === 'ai' 
                  ? 'bg-brand-orange text-white' 
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Asistente IA
            </button>
          </nav>
        </div>
      </header>

      {/* Main Dashboard Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
        
        {/* ==================== CLIENT TAB VIEW ==================== */}
        {activeTab === 'client' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Search Parcel & Timeline details - LEFT / MIDDLE COLUMN */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Search bar */}
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-xs">
                <h2 className="text-md font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-4 flex items-center gap-2">
                  <Search className="h-4 w-4 text-brand-orange" />
                  Rastreo Logístico de Envíos
                </h2>
                
                <form onSubmit={handleClientSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Ingrese el código de rastreo (ej: SF-9843-GT)"
                      value={searchTrackingId}
                      onChange={(e) => setSearchTrackingId(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange uppercase font-semibold text-brand-gray-dark"
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-brand-orange hover:bg-brand-orange-hover text-white px-6 py-2.5 text-sm font-semibold rounded-md transition duration-200 uppercase tracking-wider cursor-pointer"
                  >
                    Buscar
                  </button>
                </form>

                {clientSearchError && (
                  <p className="text-red-600 text-xs mt-2 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    {clientSearchError}
                  </p>
                )}
              </div>

              {/* Package Detail & Live Timeline */}
              {searchedShipment ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
                  
                  {/* Package title headers */}
                  <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Código de Guía</span>
                      <h3 className="text-lg font-extrabold text-brand-gray-dark font-display">{searchedShipment.id}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
                        searchedShipment.status === 'Entregado' ? 'bg-green-100 text-green-800' :
                        searchedShipment.status === 'Retrasado' ? 'bg-orange-100 text-brand-orange font-extrabold border border-brand-orange/30' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {searchedShipment.status}
                      </span>
                      <span className="bg-gray-800 text-white text-xs px-3 py-1 font-bold rounded-full uppercase">
                        Servicio {searchedShipment.serviceType}
                      </span>
                    </div>
                  </div>

                  {/* Quick specs grid */}
                  <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-gray-100 bg-gray-50/50">
                    <div>
                      <span className="text-2xs font-bold text-gray-400 uppercase block">Origen</span>
                      <span className="text-xs font-bold text-brand-gray-dark flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {searchedShipment.origin.split(',')[0]}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs font-bold text-gray-400 uppercase block">Destino</span>
                      <span className="text-xs font-bold text-brand-gray-dark flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 text-brand-orange" />
                        {searchedShipment.destination.split(',')[0]}
                      </span>
                    </div>
                    <div>
                      <span className="text-2xs font-bold text-gray-400 uppercase block">Peso Físico</span>
                      <span className="text-xs font-bold text-brand-gray-dark mt-0.5 block">{searchedShipment.weight} Kg</span>
                    </div>
                    <div>
                      <span className="text-2xs font-bold text-gray-400 uppercase block">Dimensiones</span>
                      <span className="text-xs font-bold text-brand-gray-dark mt-0.5 block">{searchedShipment.dimensions}</span>
                    </div>
                  </div>

                  {/* Additional info and details */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <span className="text-2xs font-bold text-gray-400 uppercase block">Remitente Registrado</span>
                        <span className="text-xs font-semibold text-brand-gray-dark block mt-0.5">{searchedShipment.sender}</span>
                      </div>
                      <div>
                        <span className="text-2xs font-bold text-gray-400 uppercase block">Receptor Consignatario</span>
                        <span className="text-xs font-semibold text-brand-gray-dark block mt-0.5">{searchedShipment.receiver}</span>
                      </div>
                    </div>
                    {searchedShipment.notes && (
                      <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
                        <span className="text-2xs font-bold text-gray-400 uppercase block">Instrucciones Especiales</span>
                        <p className="text-xs text-gray-600 mt-1">{searchedShipment.notes}</p>
                      </div>
                    )}
                    {searchedShipment.signeeName && (
                      <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded flex items-center gap-3">
                        <UserCheck className="h-5 w-5 text-green-600 shrink-0" />
                        <div>
                          <span className="text-2xs font-bold text-green-700 uppercase block">Comprobante de Entrega</span>
                          <p className="text-xs text-green-900 mt-0.5">Recibido por: <strong>{searchedShipment.signeeName}</strong></p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Real-time Timeline tracker */}
                  <div className="p-6">
                    <h4 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider mb-6 font-display">
                      Línea de Tiempo del Envío (Historial Operativo)
                    </h4>

                    <div className="relative border-l border-gray-200 ml-4 space-y-8 pb-4">
                      {searchedShipment.history.map((event, idx) => {
                        const isLatest = idx === 0;
                        const isRetrasado = event.status === 'Retrasado';
                        const isEntregado = event.status === 'Entregado';

                        return (
                          <div key={idx} className="relative pl-6">
                            
                            {/* Circle Indicator */}
                            <span className={`absolute -left-3.5 top-1 flex items-center justify-center rounded-full border-2 w-7 h-7 bg-white ${
                              isLatest 
                                ? isRetrasado 
                                  ? 'border-brand-orange text-brand-orange font-extrabold pulse-slow'
                                  : isEntregado
                                    ? 'border-green-600 text-green-600'
                                    : 'border-brand-orange text-brand-orange'
                                : 'border-gray-300 text-gray-400'
                            }`}>
                              {isEntregado ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : isRetrasado ? (
                                <AlertTriangle className="h-4 w-4" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                            </span>

                            {/* Event Contents */}
                            <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                              <div>
                                <span className={`text-xs font-bold ${
                                  isLatest 
                                    ? isRetrasado 
                                      ? 'text-brand-orange font-extrabold'
                                      : 'text-brand-gray-dark' 
                                    : 'text-gray-500'
                                }`}>
                                  {event.status} — {event.location}
                                </span>
                                <p className="text-xs text-gray-600 mt-0.5 max-w-lg">{event.details}</p>
                              </div>
                              <div className="text-2xs text-gray-400 font-semibold uppercase sm:text-right shrink-0 mt-1 sm:mt-0">
                                <div>{event.date}</div>
                                <div>{event.time} hrs</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="bg-gray-100 rounded-lg border border-dashed border-gray-300 p-12 text-center text-gray-500">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-brand-gray-dark">Búsqueda de Envíos ShipFast</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Ingrese una guía de rastreo válida en la barra superior para visualizar la bitácora logística del paquete.</p>
                </div>
              )}
            </div>

            {/* Request Pickup Card - RIGHT COLUMN */}
            <div className="lg:col-span-4">
              <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-xs">
                <h2 className="text-md font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-4 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-brand-orange" />
                  Solicitar Recogida
                </h2>
                <p className="text-xs text-gray-500 mb-6">
                  Programe la recogida de su paquete en su domicilio u oficina a nivel nacional. Un repartidor motorizado documentará la carga.
                </p>

                {pickupSuccessMsg && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 text-xs font-semibold rounded">
                    {pickupSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleRequestPickup} className="space-y-4">
                  <div>
                    <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Nombre Remitente *</label>
                    <input
                      type="text"
                      required
                      value={pickupSender}
                      onChange={(e) => setPickupSender(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      placeholder="Empresa o Persona"
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Dirección de Recogida (Origen) *</label>
                    <input
                      type="text"
                      required
                      value={pickupOrigin}
                      onChange={(e) => setPickupOrigin(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      placeholder="Ej: Calzada Roosevelt 12-40, Z.11, Guatemala"
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Contacto Consignatario *</label>
                    <input
                      type="text"
                      required
                      value={pickupReceiver}
                      onChange={(e) => setPickupReceiver(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      placeholder="Quién recibe el paquete"
                    />
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Dirección de Destino *</label>
                    <input
                      type="text"
                      required
                      value={pickupDestination}
                      onChange={(e) => setPickupDestination(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      placeholder="Ej: 5a Calle 3-12, Zona 1, Quetzaltenango"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Servicio</label>
                      <select
                        value={pickupService}
                        onChange={(e) => setPickupService(e.target.value as 'Express' | 'Estándar')}
                        className="w-full px-2 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      >
                        <option value="Express">Express (24h)</option>
                        <option value="Estándar">Estándar (48-72h)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Peso Aprox (Kg)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pickupWeight}
                        onChange={(e) => setPickupWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-2xs font-bold text-gray-500 uppercase block mb-1">Notas de Contenido / Detalles</label>
                    <textarea
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                      placeholder="Ej: Caja sellada con calzado..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                  >
                    Solicitar Recogida
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}

        {/* ==================== DRIVER TAB VIEW ==================== */}
        {activeTab === 'driver' && (
          <div className="flex justify-center items-start flex-1 min-h-0 py-4">
            
            {/* Mobile casing frame mockup */}
            <div className="w-full max-w-sm bg-brand-gray-dark p-3 rounded-[36px] shadow-2xl border-4 border-gray-700 flex flex-col my-auto" style={{ height: '620px' }}>
              
              {/* Screen Content */}
              <div className="bg-gray-100 flex-1 rounded-[28px] overflow-hidden flex flex-col relative">
                
                {/* Mobile Status Bar */}
                <div className="bg-brand-gray-dark px-6 py-1.5 flex justify-between text-white text-2xs font-bold shrink-0 tracking-widest">
                  <span>SHIPFAST MOBILE</span>
                  <span>08:45 AM</span>
                </div>

                {/* Handheld App Header */}
                <div className="bg-brand-gray-dark/95 text-white p-4 flex justify-between items-center border-b border-gray-800 shrink-0">
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-brand-orange" />
                    <span className="text-xs font-bold tracking-wide">OPERADOR: M-412</span>
                  </div>
                  <span className="bg-brand-orange text-white text-3xs px-2 py-0.5 font-bold rounded">ONLINE</span>
                </div>

                {/* Tasks List Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <div className="px-1 pt-1 flex justify-between items-center">
                    <span className="text-2xs font-extrabold text-gray-500 uppercase tracking-wider">Hojas de Ruta de Hoy</span>
                    <span className="bg-gray-300 text-brand-gray-dark text-3xs px-2 py-0.5 rounded-full font-bold">
                      {shipments.filter(s => s.status !== 'Entregado').length} Pendientes
                    </span>
                  </div>

                  {shipments.map(s => {
                    const isEntregado = s.status === 'Entregado';
                    if (isEntregado) return null; // Only show active delivery jobs for driver

                    return (
                      <div key={s.id} className="bg-white rounded-lg border border-gray-200 shadow-2xs p-3.5 space-y-2.5">
                        
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-extrabold text-brand-gray-dark block tracking-tight">{s.id}</span>
                            <span className="text-3xs font-semibold text-gray-400 uppercase tracking-tight block">
                              Servicio: {s.serviceType}
                            </span>
                          </div>
                          <span className={`text-4xs px-2 py-0.5 font-extrabold rounded-full uppercase border ${
                            s.status === 'Retrasado' 
                              ? 'bg-orange-50 border-brand-orange text-brand-orange' 
                              : 'bg-blue-50 border-blue-200 text-blue-800'
                          }`}>
                            {s.status}
                          </span>
                        </div>

                        <div className="space-y-1 text-3xs text-gray-600">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0"></span>
                            <span className="truncate"><strong>DE:</strong> {s.sender}</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-orange shrink-0 mt-1"></span>
                            <span className="line-clamp-2"><strong>A:</strong> {s.destination}</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex justify-end gap-2">
                          <button
                            onClick={() => {
                              // Simulate route update
                              const currentDate = new Date().toISOString().split('T')[0];
                              const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                              setShipments(prev => prev.map(ship => {
                                if (ship.id === s.id) {
                                  return {
                                    ...ship,
                                    status: 'En Ruta',
                                    lastUpdated: `${currentDate} ${currentTime}`,
                                    history: [
                                      {
                                        date: currentDate,
                                        time: currentTime,
                                        status: 'En Ruta',
                                        location: s.destination.split(',')[0],
                                        details: 'Unidad de reparto local iniciada en la zona asignada.'
                                      },
                                      ...ship.history
                                    ]
                                  };
                                }
                                return ship;
                              }));
                              alert('Envío marcado: En Ruta de Entrega.');
                            }}
                            disabled={s.status === 'En Ruta'}
                            className={`px-3 py-1.5 text-4xs font-bold rounded uppercase tracking-wider transition ${
                              s.status === 'En Ruta' 
                                ? 'bg-gray-100 text-gray-400 border border-gray-200' 
                                : 'bg-gray-800 hover:bg-brand-gray-dark text-white cursor-pointer'
                            }`}
                          >
                            En Ruta
                          </button>

                          <button
                            onClick={() => {
                              setActiveDriverTaskId(s.id);
                              setSigneeName('');
                              setSignatureDone(false);
                            }}
                            className="bg-brand-orange hover:bg-brand-orange-hover text-white px-3 py-1.5 text-4xs font-bold rounded uppercase tracking-wider transition cursor-pointer"
                          >
                            Entregar
                          </button>
                        </div>

                      </div>
                    );
                  })}

                  {shipments.filter(s => s.status !== 'Entregado').length === 0 && (
                    <div className="text-center py-12 text-gray-400">
                      <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-xs font-bold text-brand-gray-dark uppercase">¡Ruta completada!</p>
                      <p className="text-3xs text-gray-500 mt-1">No quedan hojas de despacho activas en el terminal.</p>
                    </div>
                  )}
                </div>

                {/* Handheld bottom footer */}
                <div className="bg-brand-gray-dark text-center py-3 text-white text-3xs font-semibold shrink-0">
                  SISTEMA REPARTIDOR HUEHUETENANGO / CENTRAL
                </div>

                {/* Digital Signature Overlay Modal */}
                {activeDriverTaskId && (
                  <div className="absolute inset-0 bg-brand-gray-dark/80 backdrop-blur-xs flex items-end z-20">
                    <div className="bg-white w-full rounded-t-2xl p-5 space-y-4 shadow-xl border-t-2 border-brand-orange animate-slide-up">
                      
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <span className="text-2xs font-extrabold text-brand-gray-dark uppercase">Confirmación de Entrega {activeDriverTaskId}</span>
                        <button 
                          onClick={() => setActiveDriverTaskId(null)}
                          className="text-gray-400 hover:text-brand-gray-dark text-xs font-bold cursor-pointer"
                        >
                          Cerrar
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Receptor Completo *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ingrese nombre legibe"
                            value={signeeName}
                            onChange={(e) => setSigneeName(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-4xs font-bold text-gray-500 uppercase block">Firma Digital del Receptor *</label>
                            <button
                              type="button"
                              onClick={clearSignatureCanvas}
                              className="text-brand-orange text-4xs font-bold uppercase cursor-pointer"
                            >
                              Limpiar
                            </button>
                          </div>

                          <div className="border border-gray-300 rounded overflow-hidden bg-gray-50">
                            <canvas 
                              ref={signatureCanvasRef} 
                              width="320" 
                              height="120"
                              className="w-full cursor-crosshair touch-none"
                            />
                          </div>
                          <p className="text-4xs text-gray-400 mt-1">Dibuje con el dedo o puntero sobre el lienzo gris.</p>
                        </div>
                      </div>

                      <button
                        onClick={handleDriverDeliveryConfirm}
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded transition uppercase tracking-wider cursor-pointer"
                      >
                        Confirmar Despacho
                      </button>

                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>
        )}

        {/* ==================== ADMIN OPERATIONS VIEW ==================== */}
        {activeTab === 'admin' && (
          <div className="space-y-6 flex-1 min-h-0 flex flex-col">
            
            {/* KPI Metrics Dashboard Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
              
              <div className="bg-white p-4 rounded-lg border-l-4 border-l-gray-900 border border-gray-200 shadow-2xs">
                <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider block">Registros Totales</span>
                <span className="text-xl font-black text-brand-gray-dark font-display block mt-1">
                  {shipments.length}
                </span>
                <span className="text-3xs text-gray-500 mt-1 block">Envíos cargados hoy</span>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-l-orange-500 border border-gray-200 shadow-2xs">
                <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider block">Despachos Express</span>
                <span className="text-xl font-black text-brand-orange font-display block mt-1">
                  {shipments.filter(s => s.serviceType === 'Express').length}
                </span>
                <span className="text-3xs text-gray-500 mt-1 block">Servicio alta prioridad</span>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-l-blue-600 border border-gray-200 shadow-2xs">
                <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider block">En Tránsito / Ruta</span>
                <span className="text-xl font-black text-blue-800 font-display block mt-1">
                  {shipments.filter(s => s.status === 'En Tránsito' || s.status === 'En Ruta').length}
                </span>
                <span className="text-3xs text-gray-500 mt-1 block">Mensajeros en movimiento</span>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-l-green-600 border border-gray-200 shadow-2xs">
                <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider block">Entregados Hoy</span>
                <span className="text-xl font-black text-green-700 font-display block mt-1">
                  {shipments.filter(s => s.status === 'Entregado').length}
                </span>
                <span className="text-3xs text-gray-500 mt-1 block">Tasa de éxito superior</span>
              </div>

              <div className="bg-white p-4 rounded-lg border-l-4 border-l-red-600 border border-gray-200 shadow-2xs">
                <span className="text-2xs font-extrabold text-gray-400 uppercase tracking-wider block">Incidentes / Retrasos</span>
                <span className="text-xl font-black text-red-600 font-display block mt-1">
                  {shipments.filter(s => s.status === 'Retrasado').length}
                </span>
                <span className="text-3xs text-red-600 font-bold mt-1 block">Bloqueos de carretera</span>
              </div>

            </div>

            {/* Split Panel: Left is density-rich shipments table, Right is operational update control */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0 items-start">
              
              {/* Density-Rich Table Listing - LEFT COLUMN */}
              <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col max-h-[600px] overflow-hidden">
                
                {/* Table search and filters panel header */}
                <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display">Monitoreo de Envíos</h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    
                    {/* Search query input */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar ID, Cliente..."
                        value={adminSearch}
                        onChange={(e) => setAdminSearch(e.target.value)}
                        className="pl-7 pr-3 py-1.5 text-2xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange w-36"
                      />
                      <Search className="h-3 w-3 text-gray-400 absolute left-2.5 top-2.5" />
                    </div>

                    {/* Status filter dropdown */}
                    <select
                      value={adminStatusFilter}
                      onChange={(e) => setAdminStatusFilter(e.target.value)}
                      className="px-2 py-1.5 text-2xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange bg-white"
                    >
                      <option value="todos">Todos Estados</option>
                      <option value="Creado">Creado</option>
                      <option value="En Tránsito">En Tránsito</option>
                      <option value="En Sucursal">En Sucursal</option>
                      <option value="En Ruta">En Ruta</option>
                      <option value="Entregado">Entregado</option>
                      <option value="Retrasado">Retrasado</option>
                    </select>

                    {/* Service filter dropdown */}
                    <select
                      value={adminServiceFilter}
                      onChange={(e) => setAdminServiceFilter(e.target.value)}
                      className="px-2 py-1.5 text-2xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange bg-white"
                    >
                      <option value="todos">Todos Servicios</option>
                      <option value="Express">Express</option>
                      <option value="Estándar">Estándar</option>
                    </select>

                    {/* Create New button */}
                    <button
                      onClick={() => setNewShipmentModal(true)}
                      className="bg-brand-orange hover:bg-brand-orange-hover text-white text-2xs font-bold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer transition"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nuevo Despacho
                    </button>

                  </div>
                </div>

                {/* Table wrapper scrolling */}
                <div className="overflow-x-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200 text-3xs font-extrabold text-gray-500 uppercase tracking-wider">
                        <th className="py-2.5 px-4">Guía ID</th>
                        <th className="py-2.5 px-3">Remitente</th>
                        <th className="py-2.5 px-3">Ruta Principal</th>
                        <th className="py-2.5 px-3">Estado</th>
                        <th className="py-2.5 px-3">Servicio</th>
                        <th className="py-2.5 px-3 text-right">Peso</th>
                        <th className="py-2.5 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-2xs font-semibold text-brand-gray-dark">
                      {filteredShipments.map((s) => {
                        const isActive = selectedAdminShipment && selectedAdminShipment.id === s.id;
                        return (
                          <tr 
                            key={s.id}
                            className={`hover:bg-gray-50/70 transition-all ${
                              isActive ? 'bg-orange-50/50' : ''
                            }`}
                          >
                            <td className="py-2 px-4 font-bold text-brand-orange uppercase">{s.id}</td>
                            <td className="py-2 px-3 truncate max-w-[120px]">{s.sender}</td>
                            <td className="py-2 px-3 truncate max-w-[150px]">
                              {s.origin.split(',')[0]} &rarr; {s.destination.split(',')[0]}
                            </td>
                            <td className="py-2 px-3">
                              <span className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                s.status === 'Entregado' ? 'bg-green-100 text-green-800' :
                                s.status === 'Retrasado' ? 'bg-red-100 text-red-800 font-extrabold border border-red-200' :
                                s.status === 'En Ruta' ? 'bg-blue-100 text-blue-800' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="py-2 px-3">{s.serviceType}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{s.weight} Kg</td>
                            <td className="py-2 px-4 text-center">
                              <button
                                onClick={() => {
                                  setSelectedAdminShipment(s);
                                  setUpdateStatusVal(s.status);
                                }}
                                className="border border-gray-300 hover:border-brand-gray-dark hover:bg-gray-800 hover:text-white text-gray-600 px-2 py-0.5 rounded text-4xs font-bold uppercase transition cursor-pointer"
                              >
                                Gestionar
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredShipments.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-gray-400 font-medium">
                            No se encontraron despachos con los filtros seleccionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Bitácora Logística Update controls - RIGHT COLUMN */}
              <div className="lg:col-span-4 space-y-6">
                
                {selectedAdminShipment ? (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
                    
                    {/* Header */}
                    <div className="bg-brand-gray-dark text-white p-4 border-b border-gray-800 flex justify-between items-center">
                      <div>
                        <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">ADMINISTRACIÓN DE GUÍA</span>
                        <h4 className="text-xs font-bold tracking-wider font-display text-white uppercase">{selectedAdminShipment.id}</h4>
                      </div>
                      <button 
                        onClick={() => setSelectedAdminShipment(null)}
                        className="text-gray-400 hover:text-white text-3xs uppercase font-extrabold cursor-pointer"
                      >
                        Cerrar panel
                      </button>
                    </div>

                    {/* Stats details summary */}
                    <div className="p-4 bg-gray-50 border-b border-gray-100 text-2xs space-y-1">
                      <div><span className="text-gray-400">Ruta:</span> <strong>{selectedAdminShipment.origin.split(',')[0]}</strong> a <strong>{selectedAdminShipment.destination.split(',')[0]}</strong></div>
                      <div><span className="text-gray-400">Remitente:</span> {selectedAdminShipment.sender}</div>
                      <div><span className="text-gray-400">Destinatario:</span> {selectedAdminShipment.receiver}</div>
                      <div><span className="text-gray-400">Última Actualización:</span> <span className="text-brand-orange font-bold">{selectedAdminShipment.lastUpdated}</span></div>
                    </div>

                    {/* Update logs form */}
                    <div className="p-4 border-b border-gray-100">
                      <h5 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider mb-3">Actualizar Bitácora en Tiempo Real</h5>
                      
                      <form onSubmit={handleAdminUpdateStatus} className="space-y-3">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nuevo Estado</label>
                            <select
                              value={updateStatusVal}
                              onChange={(e) => setUpdateStatusVal(e.target.value as any)}
                              className="w-full px-2 py-1 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange focus:border-brand-orange bg-white"
                            >
                              <option value="Creado">Creado</option>
                              <option value="En Tránsito">En Tránsito</option>
                              <option value="En Sucursal">En Sucursal</option>
                              <option value="En Ruta">En Ruta</option>
                              <option value="Entregado">Entregado</option>
                              <option value="Retrasado">Retrasado</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Ubicación Actual</label>
                            <input
                              type="text"
                              required
                              placeholder="Ej: Hub Central, Guatemala"
                              value={updateLocationVal}
                              onChange={(e) => setUpdateLocationVal(e.target.value)}
                              className="w-full px-2 py-1 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Detalles de Operación *</label>
                          <textarea
                            required
                            placeholder="Ingrese las observaciones técnicas o incidencias..."
                            rows={2}
                            value={updateDetailsVal}
                            onChange={(e) => setUpdateDetailsVal(e.target.value)}
                            className="w-full px-2 py-1 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded transition uppercase tracking-wider cursor-pointer"
                        >
                          Registrar en Bitácora
                        </button>
                      </form>
                    </div>

                    {/* Mini timeline list in admin */}
                    <div className="p-4 max-h-[220px] overflow-y-auto">
                      <h5 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider mb-3">Historial de Eventos</h5>
                      <div className="space-y-3">
                        {selectedAdminShipment.history.map((h, hIdx) => (
                          <div key={hIdx} className="border-l-2 border-brand-orange pl-3 text-3xs space-y-0.5">
                            <div className="flex justify-between font-bold text-brand-gray-dark">
                              <span>{h.status} — {h.location}</span>
                              <span className="text-gray-400 font-semibold">{h.date} {h.time}</span>
                            </div>
                            <p className="text-gray-500">{h.details}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="bg-gray-100 border border-dashed border-gray-300 p-8 rounded-lg text-center text-gray-400">
                    <SlidersHorizontal className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-brand-gray-dark uppercase">Centro de Operaciones</p>
                    <p className="text-3xs text-gray-500 mt-1 leading-relaxed">Seleccione un despacho de la tabla para visualizar la ficha técnica, registrar movimientos, cambiar estados o actualizar la bitácora logística.</p>
                  </div>
                )}

              </div>

            </div>

            {/* Create New Shipment Modal (Overlay) */}
            {newShipmentModal && (
              <div className="fixed inset-0 bg-brand-gray-dark/60 backdrop-blur-xs flex justify-center items-center z-40 p-4">
                <div className="bg-white w-full max-w-lg rounded-lg border border-gray-200 shadow-2xl overflow-hidden animate-zoom-in">
                  
                  {/* Modal Header */}
                  <div className="bg-brand-gray-dark text-white p-4 flex justify-between items-center border-b border-gray-800">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider font-display flex items-center gap-2">
                      <Plus className="h-4 w-4 text-brand-orange animate-pulse" />
                      Ingresar Nuevo Envío Corporativo
                    </h4>
                    <button 
                      onClick={() => setNewShipmentModal(false)}
                      className="text-gray-400 hover:text-white font-black text-xs cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>

                  {/* Modal Form */}
                  <form onSubmit={handleAdminCreateShipment} className="p-6 space-y-4">
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Remitente Corporativo *</label>
                        <input
                          type="text"
                          required
                          value={adminSender}
                          onChange={(e) => setAdminSender(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                          placeholder="Empresa remitente"
                        />
                      </div>
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Contacto Consignatario / Destinatario *</label>
                        <input
                          type="text"
                          required
                          value={adminReceiver}
                          onChange={(e) => setAdminReceiver(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                          placeholder="Persona/Entidad destino"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dirección de Origen Principal *</label>
                        <input
                          type="text"
                          required
                          value={adminOrigin}
                          onChange={(e) => setAdminOrigin(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                          placeholder="Ciudad Origen"
                        />
                      </div>
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dirección de Destino Principal *</label>
                        <input
                          type="text"
                          required
                          value={adminDestination}
                          onChange={(e) => setAdminDestination(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                          placeholder="Ciudad Destino"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio</label>
                        <select
                          value={adminService}
                          onChange={(e) => setAdminService(e.target.value as any)}
                          className="w-full px-2 py-1.5 text-2xs border border-gray-300 rounded bg-white focus:ring-1 focus:ring-brand-orange"
                        >
                          <option value="Express">Express</option>
                          <option value="Estándar">Estándar</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Peso Físico (Kg)</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={adminWeight}
                          onChange={(e) => setAdminWeight(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                        />
                      </div>

                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dimensiones</label>
                        <input
                          type="text"
                          required
                          value={adminDimensions}
                          onChange={(e) => setAdminDimensions(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                          placeholder="30x20x20 cm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Instrucciones de Carga / Observaciones Especiales</label>
                      <textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        rows={2}
                        className="w-full px-2.5 py-1.5 text-2xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange"
                        placeholder="Ej: Frágil, no apilar más de 3 cajas..."
                      />
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setNewShipmentModal(false)}
                        className="px-4 py-2 text-2xs border border-gray-300 rounded font-bold uppercase hover:bg-gray-100 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 text-2xs bg-brand-orange hover:bg-brand-orange-hover text-white rounded font-bold uppercase cursor-pointer"
                      >
                        Crear Despacho
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================== AI ASSISTANT VIEW ==================== */}
        {activeTab === 'ai' && (
          <div className="flex-1 min-h-0 bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col max-h-[620px] overflow-hidden">
            
            {/* AI Panel Header */}
            <div className="bg-brand-gray-dark text-white p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-brand-orange animate-pulse" />
                <div>
                  <h3 className="text-xs font-bold tracking-wider font-display uppercase">Centro de Despacho Inteligente</h3>
                  <p className="text-4xs text-gray-400 font-semibold tracking-tight uppercase">Simulador de Control de Rutas por IA (Gemini Model)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 text-3xs text-gray-400">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>CENTRAL OK</span>
                </div>
              </div>
            </div>

            {/* Quick action helper prompt cards */}
            <div className="p-3 bg-gray-50 border-b border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-2 shrink-0">
              <button 
                onClick={() => setAiInput("¿Cómo está la ruta hacia Quetzaltenango en tiempo real?")}
                className="bg-white border border-gray-200 hover:border-brand-orange hover:bg-orange-50/25 p-2 rounded text-left transition cursor-pointer"
              >
                <span className="text-4xs font-bold text-gray-400 uppercase tracking-wider block">CONSULTAR TRÁNSITO</span>
                <span className="text-3xs text-brand-gray-dark font-semibold mt-0.5 block truncate">Estado de ruta de Occidente</span>
              </button>

              <button 
                onClick={() => setAiInput(`Rastrear envío ${shipments[1].id}`)}
                className="bg-white border border-gray-200 hover:border-brand-orange hover:bg-orange-50/25 p-2 rounded text-left transition cursor-pointer"
              >
                <span className="text-4xs font-bold text-gray-400 uppercase tracking-wider block">LOCALIZAR GUÍA</span>
                <span className="text-3xs text-brand-gray-dark font-semibold mt-0.5 block truncate">Estado de guía {shipments[1].id}</span>
              </button>

              <button 
                onClick={() => setAiInput("Ver métricas de desempeño logístico global del Hub")}
                className="bg-white border border-gray-200 hover:border-brand-orange hover:bg-orange-50/25 p-2 rounded text-left transition cursor-pointer"
              >
                <span className="text-4xs font-bold text-gray-400 uppercase tracking-wider block">ANÁLISIS DE HUB</span>
                <span className="text-3xs text-brand-gray-dark font-semibold mt-0.5 block truncate">Métricas y tasa de efectividad</span>
              </button>
            </div>

            {/* Chat message logs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {aiChat.map((msg, idx) => {
                const isAI = msg.sender === 'ai';
                return (
                  <div 
                    key={idx} 
                    className={`flex ${isAI ? 'justify-start' : 'justify-end'} animate-fade-in`}
                  >
                    <div className={`max-w-xl rounded-lg p-3.5 shadow-2xs text-xs leading-relaxed space-y-1 ${
                      isAI 
                        ? 'bg-white border border-gray-200 text-brand-gray-dark active-accent-border' 
                        : 'bg-brand-gray-dark text-white'
                    }`}>
                      <div className="flex justify-between items-center text-4xs font-bold text-gray-400 mb-1">
                        <span className="uppercase tracking-wider">{isAI ? 'Despacho Inteligente IA' : 'Operador Central'}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      
                      {/* Text formatter support for Markdown headers/lists */}
                      <div className="space-y-2 whitespace-pre-wrap">
                        {msg.text.split('\n').map((line, lIdx) => {
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <h4 key={lIdx} className="font-extrabold text-brand-gray-dark pt-1 first:pt-0 uppercase tracking-wider text-2xs">{line.replace(/\*\*/g, '')}</h4>;
                          }
                          if (line.startsWith('- **') || line.startsWith('* **')) {
                            // Split bullet name and desc
                            const parts = line.split('**');
                            return (
                              <div key={lIdx} className="pl-4 relative flex items-start text-3xs mt-1">
                                <span className="absolute left-1.5 top-2 w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                <span><strong>{parts[1]}:</strong>{parts.slice(2).join('**')}</span>
                              </div>
                            );
                          }
                          if (line.startsWith('- ') || line.startsWith('* ')) {
                            return (
                              <div key={lIdx} className="pl-4 relative flex items-start text-3xs mt-1">
                                <span className="absolute left-1.5 top-2 w-1.5 h-1.5 rounded-full bg-brand-orange"></span>
                                <span>{line.substring(2)}</span>
                              </div>
                            );
                          }
                          return <p key={lIdx} className="text-3xs text-gray-700 leading-normal">{line}</p>;
                        })}
                      </div>

                    </div>
                  </div>
                );
              })}

              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-2xs text-3xs flex items-center space-x-2.5 active-accent-border">
                    <RefreshCw className="h-3.5 w-3.5 text-brand-orange animate-spin" />
                    <span className="text-gray-500 font-bold uppercase tracking-wider">Despachador analizando coordenadas logísticas...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Input send message bar */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2 shrink-0">
              <input
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Preguntar sobre despachos, carreteras o desempeño del Hub..."
                className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
              />
              <button
                type="submit"
                disabled={aiLoading}
                className="bg-brand-orange hover:bg-brand-orange-hover text-white px-5 py-2 rounded-md font-semibold text-xs tracking-wider uppercase flex items-center gap-1.5 transition cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Enviar
              </button>
            </form>

          </div>
        )}

      </main>

      {/* Footer System Info - Strict corporate */}
      <footer className="bg-brand-gray-dark text-gray-500 py-4 px-6 border-t border-gray-800 text-center text-4xs font-bold uppercase tracking-widest shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>&copy; 2026 SHIPFAST LOGISTICS GUATEMALA. TODOS LOS DERECHOS RESERVADOS.</span>
          <div className="flex items-center gap-3">
            <span>SISTEMA LOGÍSTICO V4.12</span>
            <span>|</span>
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-brand-orange" />
              CONEXIÓN CIFRADA TLS
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
