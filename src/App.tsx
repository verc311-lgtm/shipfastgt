import React, { useState, useEffect, useRef } from 'react';
import { db } from './supabaseClient';
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
  UserCheck,
  DollarSign,
  Building,
  Settings,
  FileText,
  Users,
  Printer,
  Trash2,
  Layers,
  Database,
  Wallet,
  Check,
  FileSpreadsheet,
  X,
  Bell,
  UploadCloud,
  PlusCircle
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
  lockerId: string; // Links package to client locker ID
  sender: string;
  receiver: string;
  origin: string;
  destination: string;
  status: 'Creado' | 'En Tránsito' | 'En Sucursal' | 'En Ruta' | 'Entregado' | 'Retrasado';
  serviceType: 'Express' | 'Estándar';
  weight: number; // in Lbs
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

interface PreAlert {
  id: string;
  lockerId: string;
  sender: string;
  description: string;
  weightEst: number;
  status: 'Pendiente' | 'Recibido';
  dateCreated: string;
}

interface UserProfile {
  lockerId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: string;
  password?: string;
}

// Helper to generate package IDs
const generatePackageId = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `SF-${num}-GT`;
};

// Default system users
const DEFAULT_USERS: UserProfile[] = [
  {
    lockerId: "ADMIN-01",
    name: "Administrador Central",
    email: "admin@shipfast.gt",
    phone: "+502 2222-0000",
    address: "Hub Central, Guatemala",
    role: "admin",
    password: "admin"
  }
];

const INITIAL_PRE_ALERTS: PreAlert[] = [];

// Initial state data
const INITIAL_SHIPMENTS: Shipment[] = [];

export default function App() {
  // Session Authentication state
  const [users, setUsers] = useState<UserProfile[]>(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Active view router within profiles
  // If currentUser is null: landing/access page is shown.
  // If currentUser is client: activeTab controls: 'my-locker' | 'pickup-request' | 'quote' | 'ai-support'
  // If currentUser is admin: activeTab controls: 'admin-dashboard' | 'driver-terminal' | 'ai-chat'
  const [activeTab, setActiveTab] = useState<string>('my-locker');

  // Unified Access Landing Page States
  const [accessTab, setAccessTab] = useState<'login' | 'signup' | 'quote'>('login');
  
  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Sign-Up fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('+502 '); // default prefix +502
  const [signupAddress, setSignupAddress] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupSuccessLocker, setSignupSuccessLocker] = useState<string | null>(null);

  // Quote Calculator fields
  const [quoteOrigin, setQuoteOrigin] = useState('Guatemala');
  const [quoteDestination, setQuoteDestination] = useState('Quetzaltenango');
  const [quoteService, setQuoteService] = useState<'Express' | 'Estándar' | 'Laredo' | 'Mexico' | 'Shein'>('Express');
  const [quoteWeight, setQuoteWeight] = useState(1);
  const [calculatedQuote, setCalculatedQuote] = useState<{
    base: number;
    weightCost: number;
    total: number;
    days: string;
    route: string;
  } | null>(null);

  // Shipments state
  const [shipments, setShipments] = useState<Shipment[]>(INITIAL_SHIPMENTS);

  // Client Portal States
  const [clientSearchId, setClientSearchId] = useState('');
  const [searchedShipment, setSearchedShipment] = useState<Shipment | null>(null);
  const [clientSearchError, setClientSearchError] = useState('');
  
  // Client Pickup Form States
  const [pickupReceiver, setPickupReceiver] = useState('');
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
  const [adminSubTab, setAdminSubTab] = useState<string>('portal');
  const [preAlerts, setPreAlerts] = useState<PreAlert[]>(INITIAL_PRE_ALERTS);

  // Client Pre-Alert Modal States
  const [isClientPreAlertModalOpen, setIsClientPreAlertModalOpen] = useState(false);
  const [clientPreAlertTracking, setClientPreAlertTracking] = useState('');
  const [clientPreAlertBodega, setClientPreAlertBodega] = useState('Sin bodega');
  const [clientPreAlertValue, setClientPreAlertValue] = useState('');
  const [clientPreAlertInsurance, setClientPreAlertInsurance] = useState('Sin seguro');
  const [clientPreAlertFileName, setClientPreAlertFileName] = useState('');

  // Bulk Upload Mayor States
  const [bulkFileText, setBulkFileText] = useState('');
  const [bulkSender, setBulkSender] = useState('Distribuidora El Quetzal S.A.');
  const [bulkLocker, setBulkLocker] = useState('');

  // Warehouse Receipt States
  const [warehouseLocker, setWarehouseLocker] = useState('');
  const [warehouseWeightInput, setWarehouseWeightInput] = useState(2.0);
  const [warehouseNotes, setWarehouseNotes] = useState('');
  const [warehouseBodega, setWarehouseBodega] = useState<'Laredo' | 'Mexico'>('Laredo');
  const [isSheinPackage, setIsSheinPackage] = useState(false);
  const [expandedWarehouseGroup, setExpandedWarehouseGroup] = useState<string | null>(null);
  const [expandedConsolidadoGuide, setExpandedConsolidadoGuide] = useState<string | null>(null);
  const [masterGuideSearch, setMasterGuideSearch] = useState('');
  const [consolidadoStatusFilter, setConsolidadoStatusFilter] = useState('Todos');
  const [consolidadoOriginFilter, setConsolidadoOriginFilter] = useState('Todos');

  // Consolidation States
  const [consolidatedGuides, setConsolidatedGuides] = useState<any[]>([]);

  // Finance & Invoices
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceLocker, setInvoiceLocker] = useState('');
  const [invoiceConcept, setInvoiceConcept] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(120.00);

  // Payments
  const [paymentsLog, setPaymentsLog] = useState<any[]>([]);
  const [paymentLocker, setPaymentLocker] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [paymentAmount, setPaymentAmount] = useState(57.40);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Expenses
  const [expensesLog, setExpensesLog] = useState<any[]>([]);
  const [expenseCategory, setExpenseCategory] = useState('Combustible');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(150.00);

  interface RatesSettings {
    baseEstandar: number;
    baseExpress: number;
    pesoEstandar: number;
    pesoExpress: number;
    laredoRate: number;
    mexicoRate: number;
    sheinRate: number;
  }

  // System Rates
  const [ratesSettings, setRatesSettings] = useState<RatesSettings>(() => {
    const saved = localStorage.getItem('ratesSettings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return {
      baseEstandar: 20,
      baseExpress: 35,
      pesoEstandar: 4,
      pesoExpress: 7,
      laredoRate: 60,
      mexicoRate: 30,
      sheinRate: 30
    };
  });

  useEffect(() => {
    localStorage.setItem('ratesSettings', JSON.stringify(ratesSettings));
  }, [ratesSettings]);

  // Branches
  const [branchesList, setBranchesList] = useState<any[]>([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchRegion, setNewBranchRegion] = useState('Metropolitana');
  const [newBranchManager, setNewBranchManager] = useState('');

  // General System Settings
  const [systemSettings, setSystemSettings] = useState({
    siteName: "ShipFast Logistics Guatemala",
    defaultPrefix: "+502",
    operatingHours: "08:00 - 18:00",
    allowSelfRegistration: true,
    sandboxMode: true
  });

  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState<string>('todos');
  const [adminServiceFilter, setAdminServiceFilter] = useState<string>('todos');
  const [selectedAdminShipment, setSelectedAdminShipment] = useState<Shipment | null>(null);
  const [newShipmentModal, setNewShipmentModal] = useState(false);
  const [newShipmentModalMode, setNewShipmentModalMode] = useState<'individual' | 'bulk'>('bulk');
  const [bulkRows, setBulkRows] = useState<any[]>([
    { id: 'row-1', bodega: 'Laredo', trackingNumber: '', lockerId: '', weight: 0.00, pieces: 1, isShein: false, saved: false }
  ]);
  const [bulkAutoSave, setBulkAutoSave] = useState(false);
  const [activeAutocompleteRow, setActiveAutocompleteRow] = useState<string | null>(null);
  const [bulkPrintSticker, setBulkPrintSticker] = useState<any | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [printProgress, setPrintProgress] = useState(0);
  const [printStatusText, setPrintStatusText] = useState('');
  const [printSuccess, setPrintSuccess] = useState(false);
  const [updateStatusVal, setUpdateStatusVal] = useState<'Creado' | 'En Tránsito' | 'En Sucursal' | 'En Ruta' | 'Entregado' | 'Retrasado'>('Creado');
  const [updateLocationVal, setUpdateLocationVal] = useState('');
  const [updateDetailsVal, setUpdateDetailsVal] = useState('');

  // New Shipment Creation fields (Admin)
  const [adminSender, setAdminSender] = useState('');
  const [adminReceiver, setAdminReceiver] = useState('');
  const [adminLockerLink, setAdminLockerLink] = useState('');
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

  // Load data from Supabase on mount
  useEffect(() => {
    async function loadData() {
      // 1. Load profiles
      const profilesList = await db.getProfiles();
      if (profilesList.length > 0) {
        setUsers(profilesList);
      }
      
      // 2. Load shipments
      const dbShipments = await db.getShipments();
      if (dbShipments.length > 0) {
        setShipments(dbShipments);
      }
      
      // 3. Load pre-alerts
      const dbPreAlerts = await db.getPreAlerts();
      if (dbPreAlerts.length > 0) {
        setPreAlerts(dbPreAlerts);
      }
      
      // 4. Load consolidated guides
      const dbConsolidated = await db.getConsolidatedGuides();
      if (dbConsolidated.length > 0) {
        setConsolidatedGuides(dbConsolidated);
      }
      
      // 5. Load invoices
      const dbInvoices = await db.getInvoices();
      if (dbInvoices.length > 0) {
        setInvoices(dbInvoices);
      }
      
      // 6. Load payments log
      const dbPayments = await db.getPayments();
      if (dbPayments.length > 0) {
        setPaymentsLog(dbPayments);
      }
      
      // 7. Load expenses log
      const dbExpenses = await db.getExpenses();
      if (dbExpenses.length > 0) {
        setExpensesLog(dbExpenses);
      }
      
      // 8. Load branches list
      const dbBranches = await db.getBranches();
      if (dbBranches.length > 0) {
        setBranchesList(dbBranches);
      }
    }
    
    loadData();
  }, []);

  // Set initial default tab when user changes
  useEffect(() => {
    if (currentUser) {
      if (currentUser.role === 'admin') {
        setActiveTab('admin-dashboard');
      } else {
        setActiveTab('my-locker');
        // Pre-select first package for the client tracking preview
        const clientPackages = shipments.filter(s => s.lockerId === currentUser.lockerId);
        if (clientPackages.length > 0) {
          setSearchedShipment(clientPackages[0]);
          setClientSearchId(clientPackages[0].id);
        } else {
          setSearchedShipment(null);
          setClientSearchId('');
        }
      }
    }
  }, [currentUser]);

  // Handle Login
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const found = users.find(u => 
      (u.lockerId.trim().toUpperCase() === loginIdentifier.trim().toUpperCase() || 
       u.email.trim().toLowerCase() === loginIdentifier.trim().toLowerCase()) && 
      u.password === loginPassword
    );

    if (found) {
      setCurrentUser(found);
      setLoginIdentifier('');
      setLoginPassword('');
    } else {
      setLoginError('Credenciales incorrectas. Verifique su número de casillero (ej: SFG0) o correo y contraseña.');
    }
  };

  // Handle Registration
  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupName.trim() || !signupEmail.trim() || !signupAddress.trim() || !signupPassword.trim()) {
      alert('Por favor complete todos los campos obligatorios.');
      return;
    }

    // Phone validation & format
    let cleanPhone = signupPhone.trim();
    if (!cleanPhone.startsWith('+502')) {
      cleanPhone = '+502 ' + cleanPhone.replace('+502', '').trim();
    }

    // Calculate sequential locker ID starting at SFG0, SFG1...
    // Count existing client users to determine index
    const clientCount = users.filter(u => u.role === 'client').length;
    const generatedLockerId = `SFG${clientCount}`;

    const newProfile: UserProfile = {
      lockerId: generatedLockerId,
      name: signupName,
      email: signupEmail.trim(),
      phone: cleanPhone,
      address: signupAddress,
      role: 'client',
      password: signupPassword
    };

    // Save to Supabase
    db.upsertProfile(newProfile);

    setUsers([...users, newProfile]);
    setSignupSuccessLocker(generatedLockerId);

    // Reset fields
    setSignupName('');
    setSignupEmail('');
    setSignupPhone('+502 ');
    setSignupAddress('');
    setSignupPassword('');
  };

  // Handle Quote Calculation
  const handleCalculateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Pricing formulas
    let base = 0;
    let weightCost = 0;
    let days = '48 a 72 Horas';

    if (quoteService === 'Express') {
      base = ratesSettings.baseExpress;
      weightCost = quoteWeight * ratesSettings.pesoExpress;
      days = '24 Horas';
    } else if (quoteService === 'Estándar') {
      base = ratesSettings.baseEstandar;
      weightCost = quoteWeight * ratesSettings.pesoEstandar;
      days = '48 a 72 Horas';
    } else if (quoteService === 'Laredo') {
      base = 0;
      weightCost = quoteWeight * ratesSettings.laredoRate;
      days = '3 a 5 Días Hábiles';
    } else if (quoteService === 'Mexico') {
      base = 0;
      weightCost = quoteWeight * ratesSettings.mexicoRate;
      days = '2 a 4 Días Hábiles';
    } else if (quoteService === 'Shein') {
      base = ratesSettings.sheinRate;
      weightCost = 0;
      days = '4 a 6 Días Hábiles';
    }
    const total = base + weightCost;
    
    // Route guidelines
    let route = 'Conexión vial primaria Hub Central';
    if (quoteDestination === 'Quetzaltenango' || quoteDestination === 'Huehuetenango') {
      route = 'Corredor Occidente (Carretera Interamericana CA-1)';
    } else if (quoteDestination === 'Cobán' || quoteDestination === 'Zacapa') {
      route = 'Corredor Atlántico-Verapaz (Ruta CA-9 Norte / CA-14)';
    } else if (quoteDestination === 'Escuintla') {
      route = 'Corredor Sur (Autopista CA-9 Sur)';
    }

    setCalculatedQuote({
      base,
      weightCost,
      total,
      days,
      route
    });
  };

  // Logout Handler
  const handleLogout = () => {
    setCurrentUser(null);
    setAccessTab('login');
    setSignupSuccessLocker(null);
  };

  // Client Specific Shipment Search
  const handleClientSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setClientSearchError('');
    if (!currentUser) return;

    const found = shipments.find(s => 
      s.id.trim().toUpperCase() === clientSearchId.trim().toUpperCase() && 
      s.lockerId === currentUser.lockerId
    );

    if (found) {
      setSearchedShipment(found);
    } else {
      setSearchedShipment(null);
      setClientSearchError('Guía de rastreo no encontrada en tu casillero o corresponde a otro usuario.');
    }
  };

  // Client Pickup Form Submit
  const handleRequestPickup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!pickupReceiver || !pickupDestination) {
      alert('Por favor complete los campos obligatorios de contacto y dirección.');
      return;
    }

    const newId = generatePackageId();
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const newShip: Shipment = {
      id: newId,
      lockerId: currentUser.lockerId,
      sender: currentUser.name,
      receiver: pickupReceiver,
      origin: currentUser.address,
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
          location: currentUser.address.split(',')[0],
          details: 'Solicitud de recogida registrada por el cliente vía portal web.'
        }
      ],
      notes: pickupNotes
    };

    // Save to Supabase
    db.upsertShipment(newShip);

    setShipments([newShip, ...shipments]);
    setPickupSuccessMsg(`¡Solicitud generada con éxito! Su código de rastreo asignado es: ${newId}`);
    
    // Reset fields
    setPickupReceiver('');
    setPickupDestination('');
    setPickupWeight(1);
    setPickupNotes('');

    // Pre-fill tracking for user convenience
    setClientSearchId(newId);
    setSearchedShipment(newShip);

    setTimeout(() => {
      setPickupSuccessMsg('');
    }, 8000);
  };

  // Client Pre-Alert Submission Handler
  const handleCreateClientPreAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!clientPreAlertTracking.trim()) {
      alert('Por favor ingresa un número de tracking válido.');
      return;
    }
    
    const declaredVal = parseFloat(clientPreAlertValue) || 0;
    if (clientPreAlertValue.trim() && (isNaN(declaredVal) || declaredVal < 0)) {
      alert('Por favor ingresa un valor declarado válido.');
      return;
    }

    const newPreAlert: PreAlert & { declaredValue?: number; insurance?: string; invoiceFileName?: string } = {
      id: clientPreAlertTracking.trim().toUpperCase(),
      lockerId: currentUser.lockerId,
      sender: 'Compra Online',
      description: `Origen: ${clientPreAlertBodega} | Valor: $${declaredVal.toFixed(2)} | Seguro: ${clientPreAlertInsurance}${clientPreAlertFileName ? ` | Factura: ${clientPreAlertFileName}` : ''}`,
      weightEst: 1.0,
      status: 'Pendiente',
      dateCreated: new Date().toISOString().split('T')[0],
      declaredValue: declaredVal,
      insurance: clientPreAlertInsurance,
      invoiceFileName: clientPreAlertFileName
    };

    // Save to Supabase
    db.upsertPreAlert(newPreAlert);

    setPreAlerts(prev => [newPreAlert, ...prev]);

    // Reset Form fields
    setClientPreAlertTracking('');
    setClientPreAlertBodega('Sin bodega');
    setClientPreAlertValue('');
    setClientPreAlertInsurance('Sin seguro');
    setClientPreAlertFileName('');
    setIsClientPreAlertModalOpen(false);

    alert(`¡Pre-Alerta registrada con éxito!\nEl paquete con tracking "${newPreAlert.id}" ha sido documentado. El equipo de ShipFast en ${clientPreAlertBodega === 'Sin bodega' ? 'Laredo o México' : clientPreAlertBodega} estará pendiente de su arribo.`);
  };

  // Driver Digital Signature Canvas
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
    if (activeDriverTaskId && activeTab === 'driver-terminal') {
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

  const handleDriverDeliveryConfirm = () => {
    if (!signeeName.trim()) {
      alert('Por favor ingrese el nombre del receptor.');
      return;
    }
    if (!signatureDone) {
      alert('Por favor realice un trazo de firma en el panel digital.');
      return;
    }

    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const targetShipment = shipments.find(s => s.id === activeDriverTaskId);
    if (targetShipment) {
      const updatedShipment = {
        ...targetShipment,
        status: 'Entregado' as const,
        lastUpdated: `${currentDate} ${currentTime}`,
        signeeName: signeeName,
        signatureUrl: "MOCK_SIGNATURE_CAPTURED",
        history: [
          {
            date: currentDate,
            time: currentTime,
            status: 'Entregado' as const,
            location: targetShipment.destination.split(',')[0],
            details: `Entregado al destinatario final y firmado digitalmente por: ${signeeName}.`
          },
          ...targetShipment.history
        ]
      };
      db.upsertShipment(updatedShipment);
    }

    setShipments(prev => prev.map(s => {
      if (s.id === activeDriverTaskId) {
        return {
          ...s,
          status: 'Entregado',
          lastUpdated: `${currentDate} ${currentTime}`,
          signeeName: signeeName,
          signatureUrl: "MOCK_SIGNATURE_CAPTURED",
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

  // Bulk Multi-Entry spreadsheet operations
  const handleKeyDownOnRow = (e: React.KeyboardEvent, index: number, rowId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      
      const row = bulkRows[index];
      
      // Auto save if enabled and row is not already saved
      if (bulkAutoSave && row && !row.saved) {
        if (row.trackingNumber.trim() && row.lockerId.trim()) {
          saveBulkRow(rowId);
        }
      }
      
      // Focus transition or row addition
      if (index === bulkRows.length - 1) {
        const newId = 'row-' + Math.random().toString(36).substring(2, 9);
        setBulkRows(prev => [
          ...prev,
          { id: newId, bodega: prev[prev.length - 1]?.bodega || 'Laredo', trackingNumber: '', lockerId: '', weight: 0.00, pieces: 1, isShein: false, saved: false }
        ]);
        
        setTimeout(() => {
          const nextInput = document.getElementById(`bulk-tracking-${index + 1}`);
          if (nextInput) nextInput.focus();
        }, 50);
      } else {
        const nextInput = document.getElementById(`bulk-tracking-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const addBulkRow = () => {
    const newId = 'row-' + Math.random().toString(36).substring(2, 9);
    setBulkRows(prev => [
      ...prev,
      { id: newId, bodega: prev[prev.length - 1]?.bodega || 'Laredo', trackingNumber: '', lockerId: '', weight: 0.00, pieces: 1, isShein: false, saved: false }
    ]);
  };

  const deleteBulkRow = (rowId: string) => {
    if (bulkRows.length <= 1) {
      setBulkRows([{ id: 'row-1', bodega: 'Laredo', trackingNumber: '', lockerId: '', weight: 0.00, pieces: 1, isShein: false, saved: false }]);
      return;
    }
    setBulkRows(prev => prev.filter(r => r.id !== rowId));
  };

  const updateBulkRow = (rowId: string, field: string, value: any) => {
    setBulkRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      return { ...r, [field]: value };
    }));
  };

  const saveBulkRow = (rowId: string) => {
    const row = bulkRows.find(r => r.id === rowId);
    if (!row) return;

    if (!row.trackingNumber.trim()) {
      alert('Por favor ingrese el Tracking Number.');
      return;
    }

    // Validate locker ID
    const matchedClient = users.find(u => u.role === 'client' && u.lockerId.toUpperCase() === row.lockerId.toUpperCase().trim());
    if (!matchedClient) {
      alert(`El Casillero "${row.lockerId}" no es válido. Busque y seleccione un cliente existente.`);
      return;
    }

    if (row.saved) {
      alert('Esta fila ya ha sido guardada.');
      return;
    }

    // Generate package ID and date
    const newId = generatePackageId();
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    // Use weight directly in Lbs
    const weightLbs = row.weight;

    // Calculate flete based on warehouse and Shein package classification
    const isShein = !!row.isShein || row.trackingNumber.toLowerCase().includes('shein');
    const fleteTotal = isShein
      ? ratesSettings.sheinRate
      : Number((row.bodega === 'Laredo' ? weightLbs * ratesSettings.laredoRate : weightLbs * ratesSettings.mexicoRate).toFixed(2));

    const newShip: Shipment = {
      id: newId,
      lockerId: matchedClient.lockerId,
      sender: `Distribuidor ${row.bodega}`,
      receiver: matchedClient.name,
      origin: row.bodega,
      destination: matchedClient.address || "Ciudad de Guatemala, GT",
      status: 'En Sucursal', // checked-in at branch
      serviceType: 'Express',
      weight: weightLbs,
      dimensions: "N/A (Carga Consolidada)",
      lastUpdated: `${currentDate} ${currentTime}`,
      history: [
        {
          date: currentDate,
          time: currentTime,
          status: 'En Sucursal',
          location: row.bodega,
          details: `Paquete recibido físicamente en bodega de ${row.bodega}. Peso registrado: ${row.weight} Lbs.`
        }
      ],
      notes: isShein ? `Ingreso rápido Shein. Tracking original: ${row.trackingNumber}.` : `Ingreso secuencial rápido. Tracking original: ${row.trackingNumber}.`
    };

    // Auto-create invoice
    const invoiceId = `FAC-${1000 + invoices.length + 1}`;
    const newInvoice = {
      id: invoiceId,
      lockerId: matchedClient.lockerId,
      date: currentDate,
      concept: isShein
        ? `Flete Especial Bolsa Shein ${newId}`
        : `Flete Bodega ${row.bodega} ${newId} (${row.weight} Lbs)`,
      amount: fleteTotal,
      paymentStatus: 'Pendiente'
    };

    // Save to Supabase
    db.upsertShipment(newShip);
    db.upsertInvoice(newInvoice);

    setShipments(prev => [newShip, ...prev]);
    setInvoices(prev => [...prev, newInvoice]);

    // Mark row as saved
    setBulkRows(prev => prev.map(r => r.id === rowId ? { ...r, saved: true } : r));
    alert(`Paquete con Tracking ${row.trackingNumber} guardado correctamente (Guía: ${newId}).`);
  };

  const saveAllBulkRows = () => {
    const unsavedRows = bulkRows.filter(r => !r.saved);
    if (unsavedRows.length === 0) {
      alert('No hay filas pendientes de guardar.');
      return;
    }

    // Validate all unsaved rows first
    for (const row of unsavedRows) {
      if (!row.trackingNumber.trim()) {
        alert(`Fila con índice #${bulkRows.indexOf(row) + 1} no tiene Tracking Number.`);
        return;
      }
      const matchedClient = users.find(u => u.role === 'client' && u.lockerId.toUpperCase() === row.lockerId.toUpperCase().trim());
      if (!matchedClient) {
        alert(`Fila con índice #${bulkRows.indexOf(row) + 1} tiene un Casillero inválido (${row.lockerId}).`);
        return;
      }
    }

    // Save each row
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const newShipmentsList: Shipment[] = [];
    const newInvoicesList: any[] = [];
    let invoiceCounter = invoices.length;

    const updatedRows = bulkRows.map((row) => {
      if (row.saved) return row;

      const matchedClient = users.find(u => u.role === 'client' && u.lockerId.toUpperCase() === row.lockerId.toUpperCase().trim())!;
      const newId = generatePackageId();
      const weightLbs = row.weight;
      
      const isShein = !!row.isShein || row.trackingNumber.toLowerCase().includes('shein');
      const fleteTotal = isShein
        ? ratesSettings.sheinRate
        : Number((row.bodega === 'Laredo' ? weightLbs * ratesSettings.laredoRate : weightLbs * ratesSettings.mexicoRate).toFixed(2));

      const newShip: Shipment = {
        id: newId,
        lockerId: matchedClient.lockerId,
        sender: `Distribuidor ${row.bodega}`,
        receiver: matchedClient.name,
        origin: row.bodega,
        destination: matchedClient.address || "Ciudad de Guatemala, GT",
        status: 'En Sucursal',
        serviceType: 'Express',
        weight: weightLbs,
        dimensions: "N/A (Carga Consolidada)",
        lastUpdated: `${currentDate} ${currentTime}`,
        history: [
          {
            date: currentDate,
            time: currentTime,
            status: 'En Sucursal',
            location: row.bodega,
            details: `Paquete recibido físicamente en bodega de ${row.bodega}. Peso registrado: ${row.weight} Lbs.`
          }
        ],
        notes: isShein ? `Ingreso rápido Shein por lote. Tracking original: ${row.trackingNumber}.` : `Ingreso rápido por lote. Tracking original: ${row.trackingNumber}.`
      };

      invoiceCounter++;
      const invoiceId = `FAC-${1000 + invoiceCounter}`;
      const newInvoice = {
        id: invoiceId,
        lockerId: matchedClient.lockerId,
        date: currentDate,
        concept: isShein
          ? `Flete Especial Bolsa Shein ${newId}`
          : `Flete Bodega ${row.bodega} ${newId} (${row.weight} Lbs)`,
        amount: fleteTotal,
        paymentStatus: 'Pendiente'
      };

      newShipmentsList.push(newShip);
      newInvoicesList.push(newInvoice);

      return { ...row, saved: true };
    });

    // Save to Supabase
    if (newShipmentsList.length > 0) {
      db.upsertShipments(newShipmentsList);
      for (const inv of newInvoicesList) {
        db.upsertInvoice(inv);
      }
    }

    setShipments(prev => [...newShipmentsList, ...prev]);
    setInvoices(prev => [...prev, ...newInvoicesList]);
    setBulkRows(updatedRows);

    alert(`¡Ingreso por lote completado! Se guardaron exitosamente ${newShipmentsList.length} paquetes y se generaron sus facturas.`);
  };

  const handleSimulatePrint = () => {
    if (!bulkPrintSticker) return;
    setIsPrinting(true);
    setPrintSuccess(false);
    setPrintProgress(5);
    setPrintStatusText('Estableciendo conexión con Zebra GK420d (USB)...');
    
    setTimeout(() => {
      setPrintProgress(20);
      setPrintStatusText('Verificando estado de la bobina de etiquetas térmicas...');
      
      setTimeout(() => {
        setPrintProgress(45);
        setPrintStatusText('Generando código binario ZPL II...');
        
        setTimeout(() => {
          setPrintProgress(75);
          setPrintStatusText('Enviando ráfaga de datos a la cola de impresión...');
          
          setTimeout(() => {
            setPrintProgress(95);
            setPrintStatusText('Zebra GK420d: Alimentando papel y quemando píxeles...');
            
            setTimeout(() => {
              setPrintProgress(100);
              setPrintStatusText('¡Guía impresa correctamente!');
              setPrintSuccess(true);
              
              setTimeout(() => {
                setIsPrinting(false);
                setPrintSuccess(false);
                setPrintProgress(0);
                setPrintStatusText('');
                setBulkPrintSticker(null);
              }, 1200);
            }, 800);
          }, 800);
        }, 800);
      }, 800);
    }, 700);
  };

  // Admin Create Shipment
  const handleAdminCreateShipment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminSender || !adminReceiver || !adminOrigin || !adminDestination) {
      alert('Complete todos los campos del envío corporativo.');
      return;
    }

    const newId = generatePackageId();
    const currentDate = new Date().toISOString().split('T')[0];
    const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

    const newShip: Shipment = {
      id: newId,
      lockerId: adminLockerLink,
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

    // Save to Supabase
    db.upsertShipment(newShip);

    setShipments([newShip, ...shipments]);
    alert(`Envío corporativo ${newId} creado correctamente.`);
    setNewShipmentModal(false);

    // Reset
    setAdminSender('');
    setAdminReceiver('');
    setAdminLockerLink('');
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
        db.upsertShipment(updatedShip);
        setSelectedAdminShipment(updatedShip);
        return updatedShip;
      }
      return s;
    }));

    setUpdateLocationVal('');
    setUpdateDetailsVal('');
    alert('Bitácora y estado de envío actualizados en tiempo real.');
  };

  // AI Assistant Chat Handler
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
      const lowerText = userText.toLowerCase();
      let aiText = '';

      // Check for tracking queries
      const matchedShipment = shipments.find(s => 
        lowerText.includes(s.id.toLowerCase()) || 
        (s.id.split('-')[1] && lowerText.includes(s.id.split('-')[1]))
      );

      if (matchedShipment) {
        const currentHist = matchedShipment.history[0];
        aiText = `He localizado el envío **${matchedShipment.id}** en nuestro sistema logístico. 
        
- **Remitente:** ${matchedShipment.sender}
- **Destinatario:** ${matchedShipment.receiver}
- **Casillero Destino:** ${matchedShipment.lockerId}
- **Ruta:** de ${matchedShipment.origin} a ${matchedShipment.destination}
- **Estado Actual:** ${matchedShipment.status} (Actualizado el ${matchedShipment.lastUpdated})
- **Detalle de Ubicación:** ${currentHist.location} - ${currentHist.details}
- **Tipo de Envío:** Servicio ${matchedShipment.serviceType} (${matchedShipment.weight} Lbs, ${matchedShipment.dimensions})

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
                          s.destination.toLowerCase().includes(adminSearch.toLowerCase()) ||
                          s.lockerId.toLowerCase().includes(adminSearch.toLowerCase());
    
    const matchesStatus = adminStatusFilter === 'todos' || s.status === adminStatusFilter;
    const matchesService = adminServiceFilter === 'todos' || s.serviceType === adminServiceFilter;

    return matchesSearch && matchesStatus && matchesService;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans select-none">
      
      {/* ==================== NO AUTHENTICATED USER: ACCESO LANDING PAGE ==================== */}
      {currentUser === null ? (
        <div className="flex-1 flex flex-col">
          
          {/* Landing Header */}
          <header className="bg-brand-gray-dark text-white border-b-2 border-brand-orange py-4 px-6 shrink-0 shadow-sm">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className="bg-brand-orange p-2 rounded-lg text-white">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-md font-bold tracking-wider font-display text-white">SHIPFAST GT</h1>
                  <p className="text-4xs text-gray-400 font-medium tracking-tight">SISTEMA INTEGRAL DE LOGÍSTICA CORPORATIVA</p>
                </div>
              </div>
              <span className="text-4xs text-gray-500 font-bold uppercase tracking-widest hidden sm:inline">Portal de Entrada Nacional</span>
            </div>
          </header>

          {/* Landing Body Content */}
          <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto">
            
            {/* Left Column: Visual branding and corporate values */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <span className="bg-brand-orange/10 text-brand-orange text-3xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider border border-brand-orange/20">
                  Infraestructura Logística de Vanguardia
                </span>
                <h2 className="text-3xl sm:text-4xl font-extrabold text-brand-gray-dark font-display tracking-tight leading-none mt-4">
                  Tu Casillero Nacional y Logística en Guatemala.
                </h2>
                <p className="text-sm text-gray-600 mt-4 leading-relaxed max-w-xl">
                  Transmitimos solidez, eficiencia y seguridad a través de andenes distribuidos estratégicamente. Organiza despachos, calcula fletes interactivos y rastrea mercadería con control operativo riguroso.
                </p>
              </div>

              {/* Grid indicators */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-1.5">
                  <Shield className="h-5 w-5 text-brand-orange" />
                  <h4 className="text-2xs font-extrabold text-brand-gray-dark uppercase tracking-wider font-display">Seguridad Rigurosa</h4>
                  <p className="text-4xs text-gray-500 leading-normal">Trazabilidad absoluta en andenes con bitácora registrada al minuto.</p>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-1.5">
                  <Truck className="h-5 w-5 text-brand-orange" />
                  <h4 className="text-2xs font-extrabold text-brand-gray-dark uppercase tracking-wider font-display">Despacho Express</h4>
                  <p className="text-4xs text-gray-500 leading-normal">Entrega optimizada de 24 horas hacia cabeceras y oficinas locales.</p>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs space-y-1.5">
                  <Sparkles className="h-5 w-5 text-brand-orange" />
                  <h4 className="text-2xs font-extrabold text-brand-gray-dark uppercase tracking-wider font-display">Asistente Inteligente</h4>
                  <p className="text-4xs text-gray-500 leading-normal">Optimización de despachos mediante soporte logístico inteligente.</p>
                </div>
              </div>
            </div>

            {/* Right Column: Access card (Login, Registration, Pricing Quote tabs) */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden flex flex-col">
                
                {/* Tabs selection menu */}
                <div className="bg-brand-gray-dark p-1 flex border-b border-gray-800 shrink-0">
                  <button
                    onClick={() => { setAccessTab('login'); setSignupSuccessLocker(null); }}
                    className={`flex-1 text-center py-2 text-3xs font-extrabold uppercase tracking-wider rounded transition-all duration-200 ${
                      accessTab === 'login' 
                        ? 'bg-brand-orange text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Iniciar Sesión
                  </button>
                  <button
                    onClick={() => { setAccessTab('signup'); setSignupSuccessLocker(null); }}
                    className={`flex-1 text-center py-2 text-3xs font-extrabold uppercase tracking-wider rounded transition-all duration-200 ${
                      accessTab === 'signup' 
                        ? 'bg-brand-orange text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Registrarse
                  </button>
                  <button
                    onClick={() => { setAccessTab('quote'); setSignupSuccessLocker(null); }}
                    className={`flex-1 text-center py-2 text-3xs font-extrabold uppercase tracking-wider rounded transition-all duration-200 ${
                      accessTab === 'quote' 
                        ? 'bg-brand-orange text-white' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    Cotizar
                  </button>
                </div>

                {/* Tab content wrappers */}
                <div className="p-6 flex-1 min-h-[380px] flex flex-col justify-center">

                  {/* ==================== LOGIN TAB ==================== */}
                  {accessTab === 'login' && (
                    <form onSubmit={handleLoginSubmit} className="space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">Acceso de Usuarios</h3>
                        <p className="text-4xs text-gray-500">Ingrese su identificador de casillero (ej: SFG0) o correo registrado.</p>
                      </div>

                      {loginError && (
                        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-4xs font-bold rounded flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {loginError}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Casillero o Correo Electrónico *</label>
                          <input
                            type="text"
                            required
                            placeholder="Ej: SFG0 o juan@shipfast.gt"
                            value={loginIdentifier}
                            onChange={(e) => setLoginIdentifier(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                          />
                        </div>

                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Contraseña *</label>
                          <input
                            type="password"
                            required
                            placeholder="Contraseña"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                      >
                        Ingresar al Sistema
                      </button>


                    </form>
                  )}

                  {/* ==================== SIGNUP TAB ==================== */}
                  {accessTab === 'signup' && (
                    <div className="flex-1 flex flex-col justify-center">
                      {!signupSuccessLocker ? (
                        <form onSubmit={handleSignupSubmit} className="space-y-4">
                          <div>
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">Crear Casillero Gratis</h3>
                            <p className="text-4xs text-gray-500">Obtenga una dirección física de recepción con asignación de código único.</p>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Completo *</label>
                              <input
                                type="text"
                                required
                                placeholder="Nombre y Apellido"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Correo Electrónico *</label>
                                <input
                                  type="email"
                                  required
                                  placeholder="usuario@dominio.com"
                                  value={signupEmail}
                                  onChange={(e) => setSignupEmail(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                                />
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Número de Teléfono *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="+502 0000-0000"
                                  value={signupPhone}
                                  onChange={(e) => setSignupPhone(e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange font-semibold"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dirección de Entrega / Envío *</label>
                              <input
                                type="text"
                                required
                                placeholder="Ej: Calzada San Juan 10-20, Zona 7, Guatemala"
                                value={signupAddress}
                                onChange={(e) => setSignupAddress(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              />
                            </div>

                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Crear Contraseña *</label>
                              <input
                                type="password"
                                required
                                placeholder="Min. 4 caracteres"
                                value={signupPassword}
                                onChange={(e) => setSignupPassword(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              />
                            </div>
                          </div>

                          <button
                            type="submit"
                            className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                          >
                            Crear Casillero
                          </button>
                        </form>
                      ) : (
                        <div className="text-center space-y-4 py-4 animate-zoom-in">
                          <div className="bg-green-100 text-green-700 w-12 h-12 rounded-full flex items-center justify-center mx-auto">
                            <UserCheck className="h-6 w-6" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-brand-gray-dark uppercase tracking-wider font-display">¡Casillero Creado Exitosamente!</h3>
                            <p className="text-4xs text-gray-500 mt-1">Tu cuenta ha sido registrada y documentada en el Hub Central.</p>
                          </div>

                          <div className="bg-gray-100 p-4 rounded-lg border border-gray-200 max-w-xs mx-auto">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-wider block">Código Único de Identificación</span>
                            <span className="text-lg font-black text-brand-orange font-display tracking-widest block mt-1">{signupSuccessLocker}</span>
                          </div>

                          <p className="text-4xs text-gray-500 leading-normal max-w-xs mx-auto">
                            Usa tu nuevo código de casillero **{signupSuccessLocker}** o tu correo electrónico con tu contraseña para acceder al portal.
                          </p>

                          <button
                            onClick={() => {
                              setLoginIdentifier(signupSuccessLocker);
                              setAccessTab('login');
                              setSignupSuccessLocker(null);
                            }}
                            className="bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold px-6 py-2 rounded uppercase tracking-wider cursor-pointer transition"
                          >
                            Iniciar Sesión Ahora
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ==================== QUOTE TAB ==================== */}
                  {accessTab === 'quote' && (
                    <form onSubmit={handleCalculateQuote} className="space-y-4">
                      <div>
                        <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">Cotizador Tarifario de Envíos</h3>
                        <p className="text-4xs text-gray-500">Obtenga cotizaciones instantáneas de fletes nacionales en Quetzales.</p>
                      </div>

                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Origen del Envío</label>
                            <select
                              value={quoteOrigin}
                              onChange={(e) => setQuoteOrigin(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            >
                              <option value="Guatemala">Ciudad de Guatemala</option>
                              <option value="Antigua">Antigua Guatemala</option>
                              <option value="Quetzaltenango">Quetzaltenango</option>
                              <option value="Cobán">Cobán</option>
                              <option value="Huehuetenango">Huehuetenango</option>
                              <option value="Escuintla">Escuintla</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Destino del Envío</label>
                            <select
                              value={quoteDestination}
                              onChange={(e) => setQuoteDestination(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            >
                              <option value="Quetzaltenango">Quetzaltenango</option>
                              <option value="Guatemala">Ciudad de Guatemala</option>
                              <option value="Antigua">Antigua Guatemala</option>
                              <option value="Cobán">Cobán</option>
                              <option value="Huehuetenango">Huehuetenango</option>
                              <option value="Escuintla">Escuintla</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio de Envío</label>
                            <select
                              value={quoteService}
                              onChange={(e) => setQuoteService(e.target.value as any)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            >
                              <option value="Express">Express Local (24h)</option>
                              <option value="Estándar">Estándar Local (48-72h)</option>
                              <option value="Laredo">Importación Laredo 🇺🇸 (Q{ratesSettings.laredoRate}/Lb)</option>
                              <option value="Mexico">Importación México 🇲🇽 (Q{ratesSettings.mexicoRate}/Lb)</option>
                              <option value="Shein">Especial Bolsa Shein 🛍️ (Q{ratesSettings.sheinRate})</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Peso Estimado (Lbs)</label>
                            <input
                              type="number"
                              min="1"
                              max="200"
                              required
                              value={quoteWeight}
                              onChange={(e) => setQuoteWeight(Number(e.target.value))}
                              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            />
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                      >
                        Calcular Tarifa
                      </button>

                      {/* Display Quotation Result */}
                      {calculatedQuote && (
                        <div className="p-4 bg-orange-50/50 border border-brand-orange/20 rounded-lg space-y-2 mt-4 animate-zoom-in">
                          <div className="flex justify-between items-center pb-1.5 border-b border-brand-orange/10">
                            <span className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider">Detalle del Flete</span>
                            <span className="text-2xs font-bold text-brand-orange">{calculatedQuote.days}</span>
                          </div>

                          <div className="text-4xs text-gray-600 space-y-1">
                            <div className="flex justify-between"><span>Cargo Base ({quoteService}):</span> <span className="font-semibold">Q {calculatedQuote.base.toFixed(2)}</span></div>
                            <div className="flex justify-between"><span>Cargo por Peso ({quoteWeight} Lbs):</span> <span className="font-semibold">Q {calculatedQuote.weightCost.toFixed(2)}</span></div>
                            <div className="flex justify-between text-2xs font-extrabold text-brand-gray-dark pt-1 border-t border-brand-orange/10">
                              <span>TOTAL ESTIMADO:</span>
                              <span className="text-brand-orange">Q {calculatedQuote.total.toFixed(2)}</span>
                            </div>
                          </div>

                          <div className="pt-2 text-4xs text-gray-500 leading-normal flex items-start gap-1">
                            <MapPin className="h-3 w-3 shrink-0 text-brand-orange mt-0.5" />
                            <span><strong>Ruta Operativa:</strong> {calculatedQuote.route}</span>
                          </div>
                        </div>
                      )}
                    </form>
                  )}

                </div>
              </div>
            </div>

          </div>

          {/* Landing Footer */}
          <footer className="bg-brand-gray-dark text-gray-500 py-4 px-6 border-t border-gray-800 text-center text-4xs font-bold uppercase tracking-widest shrink-0">
            <span>&copy; 2026 SHIPFAST LOGISTICS GUATEMALA. PORTAL DE ACCESO CORPORATIVO.</span>
          </footer>

        </div>
      ) : (
        
        // ==================== AUTHENTICATED SYSTEM: CLIENT OR ADMIN PANELS ====================
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Authenticated Dashboard Header */}
          <header className="bg-brand-gray-dark text-white shadow-md border-b-2 border-brand-orange shrink-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row justify-between items-center gap-4">
              
              {/* Logo block */}
              <div className="flex items-center space-x-3">
                <div className="bg-brand-orange p-2 rounded-lg text-white">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold tracking-wider font-display text-white">SHIPFAST GT</h1>
                  <p className="text-4xs text-gray-400 font-medium tracking-tight">SISTEMA INTEGRAL DE LOGÍSTICA CORPORATIVA</p>
                </div>
              </div>

              {/* Center User Session info & Logout */}
              <div className="bg-gray-800 px-4 py-1.5 rounded-lg border border-gray-700 text-3xs font-semibold flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-brand-orange" />
                  <span className="text-gray-300">
                    HOLA, <strong className="text-white uppercase">{currentUser.name}</strong> 
                    {currentUser.role === 'client' && ` (CASILLERO: ${currentUser.lockerId})`}
                  </span>
                </div>
                <span className="text-gray-600">|</span>
                <button
                  onClick={handleLogout}
                  className="text-brand-orange hover:text-brand-orange-hover uppercase font-bold tracking-wider cursor-pointer"
                >
                  Cerrar Sesión
                </button>
              </div>

              {/* Navigation Tabs - Role Based */}
              <nav className="flex space-x-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
                {currentUser.role === 'client' ? (
                  <>
                    <button
                      onClick={() => setActiveTab('my-locker')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'my-locker' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <Package className="h-3.5 w-3.5" />
                      Mis Envíos
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsClientPreAlertModalOpen(true)}
                      className="px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer active:scale-98"
                    >
                      <PlusCircle className="h-3.5 w-3.5 animate-pulse" />
                      Pre-Alertar 🚀
                    </button>
                    <button
                      onClick={() => setActiveTab('pickup-request')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'pickup-request' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Pedir Recogida
                    </button>
                    <button
                      onClick={() => setActiveTab('quote')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'quote' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Cotizar Flete
                    </button>
                    <button
                      onClick={() => setActiveTab('ai-support')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'ai-support' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Soporte IA
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setActiveTab('admin-dashboard')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'admin-dashboard' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <TrendingUp className="h-3.5 w-3.5" />
                      Operaciones
                    </button>
                    <button
                      onClick={() => setActiveTab('driver-terminal')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'driver-terminal' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Repartidores
                    </button>
                    <button
                      onClick={() => setActiveTab('ai-chat')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 ${
                        activeTab === 'ai-chat' 
                          ? 'bg-brand-orange text-white' 
                          : 'text-gray-300 hover:text-white hover:bg-gray-700'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Asistente IA
                    </button>
                  </>
                )}
              </nav>

            </div>
          </header>

          {/* Authenticated Body Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col min-h-0">
            
            {/* ==================== CLIENT: MY LOCKER TAB ==================== */}
            {currentUser.role === 'client' && activeTab === 'my-locker' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start flex-1 min-h-0">
                
                {/* Locker Profile Banner - LEFT COLUMN */}
                <div className="lg:col-span-4 space-y-4">
                  
                  {/* Locker Specs Card */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs space-y-4">
                    <div className="border-b border-gray-100 pb-3">
                      <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">IDENTIFICACIÓN DE CASILLERO</span>
                      <h3 className="text-xl font-black text-brand-orange font-display tracking-wider">{currentUser.lockerId}</h3>
                    </div>

                    <div className="space-y-2 text-2xs text-brand-gray-dark">
                      <div><span className="text-gray-400 block uppercase font-bold text-3xs">Nombre de Cuenta:</span> <strong>{currentUser.name}</strong></div>
                      <div><span className="text-gray-400 block uppercase font-bold text-3xs">Correo de Notificaciones:</span> {currentUser.email}</div>
                      <div><span className="text-gray-400 block uppercase font-bold text-3xs">Teléfono Registrado:</span> {currentUser.phone}</div>
                      <div><span className="text-gray-400 block uppercase font-bold text-3xs">Dirección de Entrega:</span> {currentUser.address}</div>
                    </div>

                    <div className="p-3 bg-gray-50 border border-gray-200 rounded text-4xs text-gray-500 leading-relaxed">
                      <strong>Instrucciones de Despacho:</strong> Para tus envíos corporativos nacionales, solicita que se coloquen con destino al Hub Central indicando tu número de casillero <strong>{currentUser.lockerId}</strong>.
                    </div>
                  </div>

                  {/* Tracking lookup form */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs">
                    <h4 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-3 flex items-center gap-1.5">
                      <Search className="h-4 w-4 text-brand-orange" />
                      Buscar Guía Interna
                    </h4>
                    
                    <form onSubmit={handleClientSearch} className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="Ej: SF-8219-GT"
                        value={clientSearchId}
                        onChange={(e) => setClientSearchId(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange uppercase font-semibold text-brand-gray-dark"
                      />
                      <button
                        type="submit"
                        className="bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-bold px-4 py-1.5 rounded uppercase tracking-wider transition cursor-pointer"
                      >
                        Buscar
                      </button>
                    </form>

                    {clientSearchError && (
                      <p className="text-red-600 text-4xs font-bold mt-2 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {clientSearchError}
                      </p>
                    )}
                  </div>

                  {/* Pre-Alerts Status Panel */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display flex items-center gap-1.5">
                        <Bell className="h-4 w-4 text-indigo-500" />
                        Mis Pre-Alertas
                      </h4>
                      <button
                        onClick={() => setIsClientPreAlertModalOpen(true)}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-5xs font-black px-2 py-1 rounded uppercase tracking-wider transition cursor-pointer active:scale-95"
                      >
                        + Nueva
                      </button>
                    </div>
                    
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                      {preAlerts.filter(pa => pa.lockerId === currentUser.lockerId).map(pa => (
                        <div key={pa.id} className="p-2.5 bg-gray-50/80 border border-gray-100 rounded text-4xs space-y-1 relative overflow-hidden font-mono">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500"></div>
                          <div className="flex justify-between items-center font-bold">
                            <span className="text-indigo-600 select-all font-black">{pa.id}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                              pa.status === 'Recibido' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {pa.status}
                            </span>
                          </div>
                          <div className="text-gray-500 font-sans leading-tight">
                            {pa.description}
                          </div>
                          <div className="text-[8px] text-gray-400 font-semibold uppercase flex justify-between pt-0.5 border-t border-gray-100/50 mt-1 font-sans">
                            <span>Creación: {pa.dateCreated}</span>
                            <span>Est: {pa.weightEst} Lbs</span>
                          </div>
                        </div>
                      ))}
                      {preAlerts.filter(pa => pa.lockerId === currentUser.lockerId).length === 0 && (
                        <p className="text-4xs text-gray-400 italic text-center py-4">No tienes pre-alertas creadas en este momento.</p>
                      )}
                    </div>
                  </div>

                </div>

                {/* Package listings / timelines tracker - RIGHT COLUMN */}
                <div className="lg:col-span-8 space-y-6">
                  
                  {searchedShipment ? (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
                      
                      {/* Title Specs */}
                      <div className="bg-gray-100 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <span className="text-3xs font-bold text-gray-500 uppercase tracking-wider block">ID DE SEGUIMIENTO</span>
                          <h4 className="text-md font-extrabold text-brand-gray-dark font-display">{searchedShipment.id}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 text-3xs font-bold uppercase rounded-full ${
                            searchedShipment.status === 'Entregado' ? 'bg-green-100 text-green-800' :
                            searchedShipment.status === 'Retrasado' ? 'bg-orange-100 text-brand-orange font-extrabold border border-brand-orange/30 animate-pulse' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {searchedShipment.status}
                          </span>
                          <span className="bg-brand-gray-dark text-white text-3xs px-3 py-1 font-bold rounded-full uppercase">
                            Servicio {searchedShipment.serviceType}
                          </span>
                        </div>
                      </div>

                      {/* Specs info */}
                      <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-b border-gray-100 bg-gray-50/50">
                        <div>
                          <span className="text-4xs font-bold text-gray-400 uppercase block">Origen</span>
                          <span className="text-xs font-bold text-brand-gray-dark flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            {searchedShipment.origin.split(',')[0]}
                          </span>
                        </div>
                        <div>
                          <span className="text-4xs font-bold text-gray-400 uppercase block">Destino Final</span>
                          <span className="text-xs font-bold text-brand-gray-dark flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3.5 w-3.5 text-brand-orange" />
                            {searchedShipment.destination.split(',')[0]}
                          </span>
                        </div>
                        <div>
                          <span className="text-4xs font-bold text-gray-400 uppercase block">Carga / Peso</span>
                          <span className="text-xs font-bold text-brand-gray-dark mt-0.5 block">{searchedShipment.weight} Lbs</span>
                        </div>
                        <div>
                          <span className="text-4xs font-bold text-gray-400 uppercase block">Último Tránsito</span>
                          <span className="text-xs font-bold text-brand-gray-dark mt-0.5 block truncate">{searchedShipment.lastUpdated.split(' ')[1]} hrs</span>
                        </div>
                      </div>

                      {/* History timeline log */}
                      <div className="p-6">
                        <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider mb-6 font-display">
                          Bitácora y Despacho en Ruta
                        </h4>

                        <div className="relative border-l border-gray-200 ml-4 space-y-6 pb-2">
                          {searchedShipment.history.map((event, idx) => {
                            const isLatest = idx === 0;
                            const isRetrasado = event.status === 'Retrasado';
                            const isEntregado = event.status === 'Entregado';

                            return (
                              <div key={idx} className="relative pl-6">
                                
                                <span className={`absolute -left-3 top-0.5 flex items-center justify-center rounded-full border w-6 h-6 bg-white ${
                                  isLatest 
                                    ? isRetrasado 
                                      ? 'border-brand-orange text-brand-orange font-extrabold pulse-slow'
                                      : isEntregado
                                        ? 'border-green-600 text-green-600'
                                        : 'border-brand-orange text-brand-orange'
                                    : 'border-gray-300 text-gray-400'
                                }`}>
                                  {isEntregado ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : isRetrasado ? (
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                  ) : (
                                    <Clock className="h-3 w-3" />
                                  )}
                                </span>

                                <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                                  <div>
                                    <span className={`text-2xs font-extrabold ${
                                      isLatest 
                                        ? isRetrasado 
                                          ? 'text-brand-orange'
                                          : 'text-brand-gray-dark' 
                                        : 'text-gray-500'
                                    }`}>
                                      {event.status} — {event.location}
                                    </span>
                                    <p className="text-3xs text-gray-600 mt-0.5 max-w-lg leading-normal">{event.details}</p>
                                  </div>
                                  <div className="text-4xs text-gray-400 font-bold uppercase shrink-0 mt-1 sm:mt-0">
                                    {event.date} {event.time} hrs
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500 shadow-2xs">
                      <Package className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-brand-gray-dark uppercase">Tus Despachos ShipFast</p>
                      <p className="text-4xs text-gray-500 mt-1 max-w-xs mx-auto">Selecciona una guía activa en tu casillero para desplegar la bitácora logística del flete.</p>
                      
                      {/* Quick index selector of packages belonging to client */}
                      <div className="mt-6 border-t border-gray-100 pt-4">
                        <span className="text-4xs font-bold text-gray-400 uppercase tracking-wider block mb-3">Historial de Envíos en tu Casillero ({currentUser.lockerId}):</span>
                        <div className="flex flex-wrap justify-center gap-2">
                          {shipments.filter(s => s.lockerId === currentUser.lockerId).map(s => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSearchedShipment(s);
                                setClientSearchId(s.id);
                              }}
                              className="bg-gray-100 border border-gray-200 hover:border-brand-orange hover:bg-orange-50/30 px-3 py-1.5 rounded text-3xs font-extrabold text-brand-gray-dark cursor-pointer transition uppercase"
                            >
                              {s.id} ({s.status})
                            </button>
                          ))}
                          {shipments.filter(s => s.lockerId === currentUser.lockerId).length === 0 && (
                            <span className="text-3xs text-gray-400 italic">No posees paquetes documentados en este momento.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}

            {/* ==================== CLIENT: REQUEST PICKUP TAB ==================== */}
            {currentUser.role === 'client' && activeTab === 'pickup-request' && (
              <div className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-lg border border-gray-200 shadow-xs flex flex-col">
                <h2 className="text-md font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-2 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-brand-orange" />
                  Solicitar Recogida
                </h2>
                <p className="text-xs text-gray-500 mb-6 leading-relaxed">
                  Programe un recolector a su domicilio. La dirección de recolección y su contacto se autocompletarán de su perfil de casillero <strong>{currentUser.lockerId}</strong>.
                </p>

                {pickupSuccessMsg && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 text-2xs font-bold rounded">
                    {pickupSuccessMsg}
                  </div>
                )}

                <form onSubmit={handleRequestPickup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border border-gray-200 text-2xs text-brand-gray-dark shrink-0">
                    <div>
                      <span className="text-4xs font-bold text-gray-400 uppercase block">Remitente (Prefijado)</span>
                      <strong>{currentUser.name}</strong>
                    </div>
                    <div>
                      <span className="text-4xs font-bold text-gray-400 uppercase block">Dirección Recogida (Origen)</span>
                      <strong className="truncate block">{currentUser.address}</strong>
                    </div>
                  </div>

                  <div>
                    <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Completo Destinatario *</label>
                    <input
                      type="text"
                      required
                      value={pickupReceiver}
                      onChange={(e) => setPickupReceiver(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      placeholder="Quién recibe el paquete"
                    />
                  </div>

                  <div>
                    <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dirección de Destino Final *</label>
                    <input
                      type="text"
                      required
                      value={pickupDestination}
                      onChange={(e) => setPickupDestination(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      placeholder="Ej: 5a Calle 3-12, Zona 1, Quetzaltenango"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio</label>
                      <select
                        value={pickupService}
                        onChange={(e) => setPickupService(e.target.value as any)}
                        className="w-full px-2 py-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      >
                        <option value="Express">Express (24h)</option>
                        <option value="Estándar">Estándar (48-72h)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Peso Aprox (Lbs)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={pickupWeight}
                        onChange={(e) => setPickupWeight(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Notas de Carga / Instrucciones Especiales</label>
                    <textarea
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                      placeholder="Ej: Mercadería frágil en caja sellada..."
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
            )}

            {/* ==================== CLIENT: QUOTE TAB ==================== */}
            {currentUser.role === 'client' && activeTab === 'quote' && (
              <div className="max-w-xl mx-auto bg-white p-6 sm:p-8 rounded-lg border border-gray-200 shadow-xs flex flex-col">
                <form onSubmit={handleCalculateQuote} className="space-y-4">
                  <div>
                    <h2 className="text-md font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1 flex items-center gap-1.5">
                      <SlidersHorizontal className="h-4 w-4 text-brand-orange" />
                      Cotizador Tarifario de Envíos
                    </h2>
                    <p className="text-xs text-gray-500">Consulte el costo de flete estimado para sus envíos nacionales en Quetzales.</p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Origen del Envío</label>
                        <select
                          value={quoteOrigin}
                          onChange={(e) => setQuoteOrigin(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        >
                          <option value="Guatemala">Ciudad de Guatemala</option>
                          <option value="Antigua">Antigua Guatemala</option>
                          <option value="Quetzaltenango">Quetzaltenango</option>
                          <option value="Cobán">Cobán</option>
                          <option value="Huehuetenango">Huehuetenango</option>
                          <option value="Escuintla">Escuintla</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Destino del Envío</label>
                        <select
                          value={quoteDestination}
                          onChange={(e) => setQuoteDestination(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        >
                          <option value="Quetzaltenango">Quetzaltenango</option>
                          <option value="Guatemala">Ciudad de Guatemala</option>
                          <option value="Antigua">Antigua Guatemala</option>
                          <option value="Cobán">Cobán</option>
                          <option value="Huehuetenango">Huehuetenango</option>
                          <option value="Escuintla">Escuintla</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio de Envío</label>
                        <select
                          value={quoteService}
                          onChange={(e) => setQuoteService(e.target.value as any)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        >
                          <option value="Express">Express Local (24h)</option>
                          <option value="Estándar">Estándar Local (48-72h)</option>
                          <option value="Laredo">Importación Laredo 🇺🇸 (Q{ratesSettings.laredoRate}/Lb)</option>
                          <option value="Mexico">Importación México 🇲🇽 (Q{ratesSettings.mexicoRate}/Lb)</option>
                          <option value="Shein">Especial Bolsa Shein 🛍️ (Q{ratesSettings.sheinRate})</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Peso Estimado (Lbs)</label>
                        <input
                          type="number"
                          min="1"
                          max="200"
                          required
                          value={quoteWeight}
                          onChange={(e) => setQuoteWeight(Number(e.target.value))}
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                  >
                    Calcular Tarifa
                  </button>

                  {calculatedQuote && (
                    <div className="p-4 bg-orange-50/50 border border-brand-orange/20 rounded-lg space-y-2 mt-4 animate-zoom-in">
                      <div className="flex justify-between items-center pb-1.5 border-b border-brand-orange/10">
                        <span className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider">Detalle del Flete</span>
                        <span className="text-2xs font-bold text-brand-orange">{calculatedQuote.days}</span>
                      </div>

                      <div className="text-4xs text-gray-600 space-y-1">
                        <div className="flex justify-between"><span>Cargo Base ({quoteService}):</span> <span className="font-semibold">Q {calculatedQuote.base.toFixed(2)}</span></div>
                        <div className="flex justify-between"><span>Cargo por Peso ({quoteWeight} Lbs):</span> <span className="font-semibold">Q {calculatedQuote.weightCost.toFixed(2)}</span></div>
                        <div className="flex justify-between text-2xs font-extrabold text-brand-gray-dark pt-1 border-t border-brand-orange/10">
                          <span>TOTAL ESTIMADO:</span>
                          <span className="text-brand-orange">Q {calculatedQuote.total.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="pt-2 text-4xs text-gray-500 leading-normal flex items-start gap-1">
                        <MapPin className="h-3 w-3 shrink-0 text-brand-orange mt-0.5" />
                        <span><strong>Ruta Operativa:</strong> {calculatedQuote.route}</span>
                      </div>
                    </div>
                  )}
                </form>
              </div>
            )}

            {/* ==================== CLIENT: AI SUPPORT TAB ==================== */}
            {currentUser.role === 'client' && activeTab === 'ai-support' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col flex-1 min-h-0 max-h-[600px] overflow-hidden">
                <div className="bg-brand-gray-dark text-white p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-brand-orange animate-pulse" />
                    <div>
                      <h3 className="text-xs font-bold tracking-wider font-display uppercase">Soporte Inteligente ShipFast</h3>
                      <p className="text-4xs text-gray-400 font-semibold uppercase">Resuelve tus consultas sobre entregas y rutas automáticamente</p>
                    </div>
                  </div>
                  <span className="bg-brand-orange text-white text-4xs px-2.5 py-0.5 font-bold rounded">AI AGENT</span>
                </div>

                {/* Chat content list */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                  {aiChat.map((msg, idx) => {
                    const isAI = msg.sender === 'ai';
                    return (
                      <div key={idx} className={`flex ${isAI ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                        <div className={`max-w-xl rounded-lg p-3.5 shadow-2xs text-xs leading-relaxed space-y-1 ${
                          isAI 
                            ? 'bg-white border border-gray-200 text-brand-gray-dark active-accent-border' 
                            : 'bg-brand-gray-dark text-white'
                        }`}>
                          <div className="flex justify-between items-center text-4xs font-bold text-gray-400 mb-1">
                            <span className="uppercase tracking-wider">{isAI ? 'Soporte ShipFast' : 'Mi Usuario'}</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          
                          <div className="space-y-2 whitespace-pre-wrap">
                            {msg.text.split('\n').map((line, lIdx) => {
                              if (line.startsWith('**') && line.endsWith('**')) {
                                return <h4 key={lIdx} className="font-extrabold text-brand-gray-dark pt-1 first:pt-0 uppercase tracking-wider text-2xs">{line.replace(/\*\*/g, '')}</h4>;
                              }
                              if (line.startsWith('- **') || line.startsWith('* **')) {
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
                        <span className="text-gray-500 font-bold uppercase tracking-wider">Analizando consulta en el Hub...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Chat input */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Escribe tu consulta o pide buscar un envío..."
                    className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
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

            {/* ==================== ADMIN: OPERATIONS DASHBOARD TAB ==================== */}
            {currentUser.role === 'admin' && activeTab === 'admin-dashboard' && (() => {
              // We derive the active Category based on the current adminSubTab state
              const getCategoryOfSubTab = (subTab: string) => {
                if (['portal'].includes(subTab)) return 'resumen';
                if (['registro-paquetes', 'cliente-mayor', 'pre-alertas'].includes(subTab)) return 'logistica';
                if (['warehouse', 'consolidado'].includes(subTab)) return 'almacen';
                if (['facturacion', 'pagos', 'gastos'].includes(subTab)) return 'finanzas';
                if (['reportes', 'sucursales', 'usuarios', 'tarifas', 'ajustes'].includes(subTab)) return 'sistema';
                return 'resumen';
              };
              
              const activeCategory = getCategoryOfSubTab(adminSubTab);

              // Categories mapping
              const categories = [
                { id: 'resumen', label: 'Resumen', icon: TrendingUp, char: '📊' },
                { id: 'logistica', label: 'Logística', icon: Truck, char: '📦' },
                { id: 'almacen', label: 'Almacén', icon: Building, char: '🏢' },
                { id: 'finanzas', label: 'Finanzas', icon: DollarSign, char: '💰' },
                { id: 'sistema', label: 'Sistema', icon: Settings, char: '⚙️' },
              ];

              // Sub-tabs mapping per category
              const subTabsConfig: Record<string, { id: string; label: string; icon: any }[]> = {
                resumen: [
                  { id: 'portal', label: 'Dashboard Portal', icon: Database },
                ],
                logistica: [
                  { id: 'registro-paquetes', label: 'Registro de Paquetes', icon: FileText },
                  { id: 'cliente-mayor', label: 'Registro Cliente Mayor', icon: Users },
                  { id: 'pre-alertas', label: 'Pre-alertas Clientes', icon: Clock },
                ],
                almacen: [
                  { id: 'warehouse', label: 'Control de Warehouse', icon: Package },
                  { id: 'consolidado', label: 'Historial de Consolidados', icon: Layers },
                ],
                finanzas: [
                  { id: 'facturacion', label: 'Facturación / Fletes', icon: FileSpreadsheet },
                  { id: 'pagos', label: 'Registro de Pagos', icon: Wallet },
                  { id: 'gastos', label: 'Registro de Gastos', icon: TrendingUp },
                ],
                sistema: [
                  { id: 'reportes', label: 'Reportes de Sistema', icon: TrendingUp },
                  { id: 'sucursales', label: 'Sedes y Sucursales', icon: Building },
                  { id: 'usuarios', label: 'Usuarios y Operadores', icon: Users },
                  { id: 'tarifas', label: 'Configuración Tarifaria', icon: SlidersHorizontal },
                  { id: 'ajustes', label: 'Ajustes de Sistema', icon: Settings },
                ],
              };

              // Financial Calculations (Fixed Values, in Quetzales Q)
              const totalPaidRevenues = invoices
                .filter(i => i.paymentStatus === 'Pagado')
                .reduce((acc, curr) => acc + curr.amount, 0);
              const totalExpenses = expensesLog.reduce((acc, curr) => acc + curr.amount, 0);
              const netCashLedger = totalPaidRevenues - totalExpenses;

              // Helper variables for bulk upload mayor demo manifest
              const defaultBulkManifest = `# Manifiesto de Carga Corporativa - Distribuidora El Quetzal S.A.
Carlos Monterroso,Ciudad de Guatemala,Express,4.5,Mercadería frágil repuestos
Ana Sofía Méndez,Quetzaltenango,Estándar,12.0,Caja grande herramientas
Inversiones Altiplano,Huehuetenango,Estándar,35.0,Sacos insumos industriales
Droguería La Unión,Cobán,Express,2.8,Medicina mantener refrigerado
Pedro Asturias,Antigua Guatemala,Express,1.5,Documentación legal urgente`;

              return (
                <div className="space-y-6 flex-1 min-h-0 flex flex-col">
                  
                  {/* ==================== DOUBLE-LEVEL TOP NAVIGATION BAR ==================== */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden shrink-0">
                    
                    {/* Level 1: Category Groups */}
                    <div className="bg-brand-gray-dark px-4 py-2 flex flex-wrap gap-2 border-b border-gray-800">
                      {categories.map(cat => {
                        const CategoryIcon = cat.icon;
                        const isCatActive = activeCategory === cat.id;
                        return (
                          <button
                            key={cat.id}
                            onClick={() => {
                              // Auto-select the first sub-tab of this category
                              const firstSubTab = subTabsConfig[cat.id][0].id;
                              setAdminSubTab(firstSubTab);
                            }}
                            className={`flex items-center space-x-2 px-4 py-2 text-2xs font-extrabold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                              isCatActive 
                                ? 'bg-brand-orange text-white' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
                            }`}
                          >
                            <CategoryIcon className="h-3.5 w-3.5 shrink-0" />
                            <span>{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Level 2: Sub-Tabs for active category */}
                    <div className="bg-gray-50 px-4 py-2 flex flex-wrap gap-1 border-t border-gray-100">
                      {subTabsConfig[activeCategory].map(tab => {
                        const TabIcon = tab.icon;
                        const isTabActive = adminSubTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setAdminSubTab(tab.id)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 text-3xs font-extrabold uppercase tracking-widest rounded transition-all cursor-pointer border ${
                              isTabActive 
                                ? 'bg-white border-brand-orange text-brand-orange shadow-3xs' 
                                : 'bg-transparent border-transparent text-gray-500 hover:text-brand-gray-dark hover:bg-gray-100/50'
                            }`}
                          >
                            <TabIcon className="h-3 w-3" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>

                  </div>

                  {/* ==================== SUB-TABS RENDER ENGINE ==================== */}
                  <div className="flex-1 min-h-0 overflow-y-auto pb-6">

                    {/* ==================== 1. PORTAL (DASHBOARD) ==================== */}
                    {adminSubTab === 'portal' && (
                      <div className="space-y-6">
                        
                        {/* High-density operational KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                          <div className="bg-white p-4 rounded-lg border-l-4 border-l-gray-900 border border-gray-200 shadow-2xs">
                            <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-widest block">Guías Totales</span>
                            <span className="text-xl font-black text-brand-gray-dark font-display block mt-1">{shipments.length}</span>
                            <span className="text-4xs text-gray-500 mt-1 block">Envíos registrados</span>
                          </div>

                          <div className="bg-white p-4 rounded-lg border-l-4 border-l-orange-500 border border-gray-200 shadow-2xs">
                            <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-widest block">Servicios Express</span>
                            <span className="text-xl font-black text-brand-orange font-display block mt-1">
                              {shipments.filter(s => s.serviceType === 'Express').length}
                            </span>
                            <span className="text-4xs text-gray-500 mt-1 block">Despachos de alta velocidad</span>
                          </div>

                          <div className="bg-white p-4 rounded-lg border-l-4 border-l-blue-600 border border-gray-200 shadow-2xs">
                            <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-widest block">En Tránsito / Ruta</span>
                            <span className="text-xl font-black text-blue-800 font-display block mt-1">
                              {shipments.filter(s => s.status === 'En Tránsito' || s.status === 'En Ruta').length}
                            </span>
                            <span className="text-4xs text-gray-500 mt-1 block">Unidades en movimiento</span>
                          </div>

                          <div className="bg-white p-4 rounded-lg border-l-4 border-l-green-600 border border-gray-200 shadow-2xs">
                            <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-widest block">Entregados</span>
                            <span className="text-xl font-black text-green-700 font-display block mt-1">
                              {shipments.filter(s => s.status === 'Entregado').length}
                            </span>
                            <span className="text-4xs text-gray-500 mt-1 block">Tasa de éxito superior</span>
                          </div>

                          <div className="bg-white p-4 rounded-lg border-l-4 border-l-red-600 border border-gray-200 shadow-2xs">
                            <span className="text-4xs font-extrabold text-gray-400 uppercase tracking-widest block">Retrasos / Alertas</span>
                            <span className="text-xl font-black text-red-600 font-display block mt-1">
                              {shipments.filter(s => s.status === 'Retrasado').length}
                            </span>
                            <span className="text-4xs text-red-600 font-extrabold mt-1 block">Incidentes viales</span>
                          </div>
                        </div>

                        {/* Financial Ledger Balance (Q) & Warehouse Occupancy */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                          
                          {/* Financial Summary Card */}
                          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display border-b border-gray-100 pb-2">📊 Estado Financiero de Caja (Fijos en Q)</h3>
                            
                            <div className="space-y-2 text-2xs">
                              <div className="flex justify-between items-center text-gray-600">
                                <span>Ingresos por Fletes Cobrados:</span>
                                <strong className="text-green-700 font-bold font-mono">Q {totalPaidRevenues.toFixed(2)}</strong>
                              </div>
                              <div className="flex justify-between items-center text-gray-600">
                                <span>Gastos Operativos Totales:</span>
                                <strong className="text-red-600 font-bold font-mono">Q {totalExpenses.toFixed(2)}</strong>
                              </div>
                              
                              <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between items-center text-xs font-black">
                                <span className="text-brand-gray-dark">SALDO LÍQUIDO NETO:</span>
                                <span className={`font-mono ${netCashLedger >= 0 ? 'text-brand-orange' : 'text-red-600'}`}>
                                  Q {netCashLedger.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            
                            <p className="text-4xs text-gray-400 leading-normal bg-gray-50 p-2.5 rounded border border-gray-100">
                              Valores de facturación y gastos directos sin cálculos de IVA. Todas las operaciones reflejadas en Quetzales.
                            </p>
                          </div>

                          {/* Warehouse Capacity Card */}
                          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-4">
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display border-b border-gray-100 pb-2">🏢 Capacidad de Bodega Central</h3>
                            
                            <div className="space-y-3">
                              <div className="flex justify-between text-2xs font-bold text-gray-600">
                                <span>Capacidad Utilizada</span>
                                <span className="text-brand-orange">68% Ocupado</span>
                              </div>
                              
                              {/* Sleek Progress Bar */}
                              <div className="w-full bg-gray-100 rounded-full h-3.5 border border-gray-200 overflow-hidden">
                                <div 
                                  className="bg-gradient-to-r from-brand-gray-dark to-brand-orange h-full rounded-full transition-all duration-500" 
                                  style={{ width: '68%' }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-4xs text-gray-500 pt-1">
                                <div>&bull; Racks Activos: <strong>4 (A-D)</strong></div>
                                <div>&bull; Bins Ocupados: <strong>27 / 40</strong></div>
                                <div>&bull; Capacidad Libre: <strong>32%</strong></div>
                                <div>&bull; Carga en Lbs: <strong>{shipments.filter(s => s.status === 'En Sucursal').reduce((acc, curr) => acc + curr.weight, 0).toFixed(1)} Lbs</strong></div>
                              </div>
                            </div>
                          </div>

                          {/* Critical System Notifications */}
                          <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-3">
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display border-b border-gray-100 pb-2">🚨 Alertas del Hub Central</h3>
                            
                            <div className="space-y-2 max-h-[140px] overflow-y-auto">
                              <div className="p-2 bg-orange-50 border border-brand-orange/20 rounded flex items-center space-x-2 text-4xs text-brand-orange font-bold">
                                <AlertTriangle className="h-4 w-4 text-brand-orange shrink-0 animate-pulse" />
                                <span>Pre-alerta pendiente de ingreso: Repuestos de laptop (2.5 Lbs) de Amazon US.</span>
                              </div>
                              <div className="p-2 bg-red-50 border border-red-200 rounded flex items-center space-x-2 text-4xs text-red-800 font-bold">
                                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                                <span>Bloqueo Carretera: Ruta al Atlántico KM 42 reporta retrasos en tránsito.</span>
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Recent Activity Log */}
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs">
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display border-b border-gray-100 pb-3 mb-4">📜 Historial Operativo Reciente</h3>
                          <div className="space-y-3 max-h-[220px] overflow-y-auto">
                            <div className="border-l-2 border-brand-orange pl-3 text-4xs space-y-1">
                              <div className="flex justify-between font-bold text-brand-gray-dark">
                                <span>FACTURA EMITIDA Y COBRADA</span>
                                <span className="text-gray-400 font-semibold">2026-05-21 08:30</span>
                              </div>
                              <p className="text-gray-500">Recibo de pago FAC-1001 registrado bajo el método Transferencia Bancaria por Q 122.50.</p>
                            </div>
                            <div className="border-l-2 border-brand-gray-dark pl-3 text-4xs space-y-1">
                              <div className="flex justify-between font-bold text-brand-gray-dark">
                                <span>RECEPCIÓN DE PAQUETE EN WAREHOUSE</span>
                                <span className="text-gray-400 font-semibold">2026-05-21 08:15</span>
                              </div>
                              <p className="text-gray-500">Carga recepcionada e ingresada en Bodega Laredo para casillero SFG0 con peso de 2.5 Lbs.</p>
                            </div>
                            <div className="border-l-2 border-blue-600 pl-3 text-4xs space-y-1">
                              <div className="flex justify-between font-bold text-brand-gray-dark">
                                <span>DESPACHO EN RUTA</span>
                                <span className="text-gray-400 font-semibold">2026-05-21 08:00</span>
                              </div>
                              <p className="text-gray-500">Envío SF-9843-GT asignado a mensajero motorizado con destino final Antigua Guatemala.</p>
                            </div>
                          </div>
                        </div>

                      </div>
                    )}

                    {/* ==================== 2. REGISTRO DE PAQUETES (`registro-paquetes`) ==================== */}
                    {adminSubTab === 'registro-paquetes' && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        
                        {/* Shipment listing table - LEFT COLUMN */}
                        <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col max-h-[600px] overflow-hidden">
                          
                          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-center gap-3 shrink-0">
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display shrink-0">Monitoreo General de Envíos</h3>
                            
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                              <div className="relative">
                                <input
                                  type="text"
                                  placeholder="Buscar ID, Casillero..."
                                  value={adminSearch}
                                  onChange={(e) => setAdminSearch(e.target.value)}
                                  className="pl-7 pr-3 py-1.5 text-3xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange w-36"
                                />
                                <Search className="h-3 w-3 text-gray-400 absolute left-2.5 top-2.5" />
                              </div>

                              <select
                                value={adminStatusFilter}
                                onChange={(e) => setAdminStatusFilter(e.target.value)}
                                className="px-2 py-1.5 text-3xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                              >
                                <option value="todos">Todos Estados</option>
                                <option value="Creado">Creado</option>
                                <option value="En Tránsito">En Tránsito</option>
                                <option value="En Sucursal">En Sucursal</option>
                                <option value="En Ruta">En Ruta</option>
                                <option value="Entregado">Entregado</option>
                                <option value="Retrasado">Retrasado</option>
                              </select>

                              <select
                                value={adminServiceFilter}
                                onChange={(e) => setAdminServiceFilter(e.target.value)}
                                className="px-2 py-1.5 text-3xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                              >
                                <option value="todos">Todos Servicios</option>
                                <option value="Express">Express</option>
                                <option value="Estándar">Estándar</option>
                              </select>

                              <button
                                onClick={() => setNewShipmentModal(true)}
                                className="bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-bold px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer transition uppercase tracking-wider"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Nuevo Despacho
                              </button>
                            </div>
                          </div>

                          <div className="overflow-x-auto flex-1">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                  <th className="py-2.5 px-4">Guía ID</th>
                                  <th className="py-2.5 px-3">Casillero</th>
                                  <th className="py-2.5 px-3">Remitente</th>
                                  <th className="py-2.5 px-3">Ruta</th>
                                  <th className="py-2.5 px-3">Estado</th>
                                  <th className="py-2.5 px-3">Servicio</th>
                                  <th className="py-2.5 px-4 text-center">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                {filteredShipments.map((s) => {
                                  const isActive = selectedAdminShipment && selectedAdminShipment.id === s.id;
                                  return (
                                    <tr 
                                      key={s.id}
                                      className={`hover:bg-gray-50/70 transition-all ${isActive ? 'bg-orange-50/50' : ''}`}
                                    >
                                      <td className="py-2 px-4 font-bold text-brand-orange uppercase">{s.id}</td>
                                      <td className="py-2 px-3 font-mono text-gray-500">{s.lockerId}</td>
                                      <td className="py-2 px-3 truncate max-w-[120px]">{s.sender}</td>
                                      <td className="py-2 px-3 truncate max-w-[150px]">
                                        {s.origin.split(',')[0]} &rarr; {s.destination.split(',')[0]}
                                      </td>
                                      <td className="py-2 px-3">
                                        <span className={`px-2 py-0.5 rounded text-4xs font-bold uppercase ${
                                          s.status === 'Entregado' ? 'bg-green-100 text-green-800' :
                                          s.status === 'Retrasado' ? 'bg-red-100 text-red-800 font-extrabold border border-red-200 animate-pulse' :
                                          s.status === 'En Ruta' ? 'bg-blue-100 text-blue-800' :
                                          'bg-gray-100 text-gray-700'
                                        }`}>
                                          {s.status}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3">{s.serviceType}</td>
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

                        {/* Bitácora Logística Update Controls - RIGHT COLUMN */}
                        <div className="lg:col-span-4 space-y-6">
                          {selectedAdminShipment ? (
                            <div className="bg-white rounded-lg border border-gray-200 shadow-xs overflow-hidden">
                              
                              <div className="bg-brand-gray-dark text-white p-4 border-b border-gray-800 flex justify-between items-center">
                                <div>
                                  <span className="text-4xs font-bold text-gray-400 uppercase block">ADMINISTRACIÓN DE GUÍA</span>
                                  <h4 className="text-xs font-bold tracking-wider font-display text-white uppercase">{selectedAdminShipment.id}</h4>
                                </div>
                                <button 
                                  onClick={() => setSelectedAdminShipment(null)}
                                  className="text-gray-400 hover:text-white text-3xs uppercase font-extrabold cursor-pointer"
                                >
                                  Cerrar
                                </button>
                              </div>

                              <div className="p-4 bg-gray-50 border-b border-gray-100 text-3xs space-y-1 shrink-0">
                                <div><span className="text-gray-400">Casillero Asignado:</span> <strong className="font-mono text-brand-orange">{selectedAdminShipment.lockerId}</strong></div>
                                <div><span className="text-gray-400">Ruta:</span> <strong>{selectedAdminShipment.origin.split(',')[0]}</strong> a <strong>{selectedAdminShipment.destination.split(',')[0]}</strong></div>
                                <div><span className="text-gray-400">Destinatario:</span> {selectedAdminShipment.receiver}</div>
                              </div>

                              <div className="p-4 border-b border-gray-100">
                                <h5 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider mb-3">Registrar Bitácora en Ruta</h5>
                                
                                <form onSubmit={handleAdminUpdateStatus} className="space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nuevo Estado</label>
                                      <select
                                        value={updateStatusVal}
                                        onChange={(e) => setUpdateStatusVal(e.target.value as any)}
                                        className="w-full px-2 py-1 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
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
                                        className="w-full px-2 py-1 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                      />
                                    </div>
                                  </div>

                                  <div>
                                    <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Detalles de Operación *</label>
                                    <textarea
                                      required
                                      placeholder="Observaciones técnicas o incidencias..."
                                      rows={2}
                                      value={updateDetailsVal}
                                      onChange={(e) => setUpdateDetailsVal(e.target.value)}
                                      className="w-full px-2 py-1 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
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

                              <div className="p-4 max-h-[180px] overflow-y-auto">
                                <h5 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider mb-2">Historial de Eventos</h5>
                                <div className="space-y-3">
                                  {selectedAdminShipment.history.map((h, hIdx) => (
                                    <div key={hIdx} className="border-l-2 border-brand-orange pl-3 text-4xs space-y-0.5">
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
                            <div className="bg-gray-100 border border-dashed border-gray-300 p-8 rounded-lg text-center text-gray-400 shadow-2xs">
                              <SlidersHorizontal className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                              <p className="text-xs font-bold text-brand-gray-dark uppercase">Centro de Operaciones</p>
                              <p className="text-4xs text-gray-500 mt-1 leading-relaxed">Seleccione un despacho de la tabla para visualizar la ficha técnica, registrar movimientos, cambiar estados o actualizar la bitácora logística.</p>
                            </div>
                          )}
                        </div>

                      </div>
                    )}

                    {/* ==================== 3. REGISTRO CLIENTE MAYOR (`cliente-mayor`) ==================== */}
                    {adminSubTab === 'cliente-mayor' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">📦 Carga Masiva de Clientes Mayoristas (Manifiesto Corporativo)</h3>
                          <p className="text-4xs text-gray-500">Suba múltiples despachos de una sola vez vinculados a una cuenta corporativa. Ideal para distribuidores que despachan lotes masivos de mercadería.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                          
                          {/* Instructions & Template load */}
                          <div className="lg:col-span-8 space-y-4">
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Seleccionar Cliente Mayorista *</label>
                              <select
                                value={bulkLocker}
                                onChange={(e) => {
                                  setBulkLocker(e.target.value);
                                  const matchingUser = users.find(u => u.lockerId === e.target.value);
                                  if (matchingUser) setBulkSender(matchingUser.name);
                                }}
                                className="px-3 py-2 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono text-brand-orange font-bold"
                              >
                                {users.filter(u => u.role === 'client').map(u => (
                                  <option key={u.lockerId} value={u.lockerId}>{u.lockerId} &mdash; {u.name}</option>
                                ))}
                              </select>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <label className="text-4xs font-bold text-gray-500 uppercase block">Carga de Manifiesto en Formato CSV *</label>
                                <button
                                  type="button"
                                  onClick={() => setBulkFileText(defaultBulkManifest)}
                                  className="text-brand-orange text-4xs font-extrabold uppercase hover:underline cursor-pointer"
                                >
                                  Cargar Lote de Demostración
                                </button>
                              </div>
                              <textarea
                                value={bulkFileText}
                                onChange={(e) => setBulkFileText(e.target.value)}
                                rows={8}
                                placeholder="Destinatario,Destino,Servicio,PesoLbs,Notas"
                                className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-3xs focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              />
                              <p className="text-4xs text-gray-400 mt-1">El formato de datos debe ser: Destinatario,Destino,Servicio (Express/Estándar),Peso (Lbs),Notas</p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                if (!bulkFileText.trim()) {
                                  alert('Por favor ingrese el manifiesto en formato de líneas CSV.');
                                  return;
                                }

                                const rows = bulkFileText.split('\n');
                                let addedCount = 0;
                                const newInvoices: any[] = [];
                                const newShipmentsList: Shipment[] = [];
                                const currentDate = new Date().toISOString().split('T')[0];
                                const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                                rows.forEach(row => {
                                  if (row.startsWith('#') || !row.trim()) return; // skip comments / empty rows
                                  const cols = row.split(',');
                                  if (cols.length >= 4) {
                                    const receiverName = cols[0].trim();
                                    const destinationCity = cols[1].trim();
                                    const serviceType = (cols[2].trim() === 'Estándar' ? 'Estándar' : 'Express') as 'Express' | 'Estándar';
                                    const weightLbs = Number(cols[3].trim()) || 1.0;
                                    const notesText = cols[4] ? cols[4].trim() : 'Carga de lote mayorista';

                                    const generatedId = `SF-${Math.floor(1000 + Math.random() * 9000)}-GT`;
                                    
                                    // Calculate flete
                                    const baseVal = serviceType === 'Express' ? ratesSettings.baseExpress : ratesSettings.baseEstandar;
                                    const extraWeightVal = weightLbs * (serviceType === 'Express' ? ratesSettings.pesoExpress : ratesSettings.pesoEstandar);
                                    const fleteTotal = baseVal + extraWeightVal;

                                    const newShipment: Shipment = {
                                      id: generatedId,
                                      lockerId: bulkLocker,
                                      sender: bulkSender,
                                      receiver: receiverName,
                                      origin: 'Miami Hub, FL',
                                      destination: destinationCity + ', Guatemala',
                                      status: 'Creado',
                                      serviceType: serviceType,
                                      weight: weightLbs,
                                      dimensions: '30x20x20 cm',
                                      lastUpdated: `${currentDate} ${currentTime}`,
                                      history: [
                                        {
                                          date: currentDate,
                                          time: currentTime,
                                          status: 'Creado',
                                          location: 'Miami Hub, FL',
                                          details: 'Manifiesto cargado en lote corporativo por el administrador central.'
                                        }
                                      ],
                                      notes: notesText
                                    };

                                    newShipmentsList.push(newShipment);

                                    // Auto-create invoice
                                    const invoiceId = `FAC-${1000 + invoices.length + addedCount + 1}`;
                                    newInvoices.push({
                                      id: invoiceId,
                                      lockerId: bulkLocker,
                                      date: currentDate,
                                      concept: `Flete ${serviceType} ${generatedId} (${weightLbs} Lbs)`,
                                      amount: fleteTotal,
                                      paymentStatus: 'Pendiente'
                                    });

                                    addedCount++;
                                  }
                                });

                                if (newShipmentsList.length > 0) {
                                  // Save to Supabase
                                  db.upsertShipments(newShipmentsList);
                                  for (const inv of newInvoices) {
                                    db.upsertInvoice(inv);
                                  }

                                  setShipments(prev => [...newShipmentsList, ...prev]);
                                  setInvoices(prev => [...prev, ...newInvoices]);
                                  alert(`Se procesaron y cargaron exitosamente ${addedCount} envíos y se crearon sus facturas correspondientes bajo el casillero ${bulkLocker}.`);
                                  setBulkFileText('');
                                  setAdminSubTab('registro-paquetes');
                                } else {
                                  alert('No se pudieron procesar filas válidas. Verifique el formato.');
                                }
                              }}
                              className="bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold px-6 py-2 rounded uppercase tracking-wider cursor-pointer transition shadow-2xs"
                            >
                              Procesar y Cargar Lote Corporativo
                            </button>
                          </div>

                          {/* Info Sidebar card */}
                          <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg text-3xs space-y-3 leading-relaxed text-gray-600">
                            <h4 className="font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Directrices de Manifiesto</h4>
                            <p>El sistema soporta la ingesta masiva de guías mediante la separación de valores por comas (CSV). Al procesar:</p>
                            <ul className="list-disc pl-4 space-y-1.5">
                              <li>Se asignará un código correlativo **SF-XXXX-GT** a cada guía.</li>
                              <li>Los paquetes se asociarán al casillero seleccionado en el combo superior.</li>
                              <li>Se generarán facturas **individuales** automáticas en Quetzales (Q) sin recargos.</li>
                            </ul>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ==================== 4. PRE-ALERTAS DE CLIENTES (`pre-alertas`) ==================== */}
                    {adminSubTab === 'pre-alertas' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-4">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">🕒 Pre-alertas Declaradas por Clientes</h3>
                          <p className="text-4xs text-gray-500">Buzón de recepción internacional. Cuando el cliente compra en tiendas online, declara su paquete antes de que llegue a nuestras bodegas en Laredo (USA) o México.</p>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                <th className="py-2.5 px-4">Pre-Alerta ID</th>
                                <th className="py-2.5 px-3">Casillero</th>
                                <th className="py-2.5 px-3">Tienda / Remitente</th>
                                <th className="py-2.5 px-3">Descripción Contenido</th>
                                <th className="py-2.5 px-3 text-center">Peso Est. (Lbs)</th>
                                <th className="py-2.5 px-3">Fecha Declaración</th>
                                <th className="py-2.5 px-3">Estado</th>
                                <th className="py-2.5 px-4 text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                              {preAlerts.map(pa => (
                                <tr key={pa.id} className="hover:bg-gray-50/50">
                                  <td className="py-3 px-4 font-bold text-brand-orange uppercase">{pa.id}</td>
                                  <td className="py-3 px-3 font-mono text-gray-500">{pa.lockerId}</td>
                                  <td className="py-3 px-3 font-bold">{pa.sender}</td>
                                  <td className="py-3 px-3 italic">{pa.description}</td>
                                  <td className="py-3 px-3 text-center font-mono">{pa.weightEst} Lbs</td>
                                  <td className="py-3 px-3 font-mono">{pa.dateCreated}</td>
                                  <td className="py-3 px-3">
                                    <span className={`px-2 py-0.5 rounded text-4xs font-extrabold uppercase border ${
                                      pa.status === 'Recibido' 
                                        ? 'bg-green-50 border-green-200 text-green-700' 
                                        : 'bg-orange-50 border-orange-200 text-brand-orange animate-pulse'
                                    }`}>
                                      {pa.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {pa.status === 'Pendiente' ? (
                                      <div className="flex gap-1.5 justify-center">
                                        <button
                                          onClick={() => {
                                            // Set received status
                                            setPreAlerts(prev => prev.map(item => item.id === pa.id ? { ...item, status: 'Recibido' } : item));
                                            
                                            // Add package to shipments
                                            const matchingUser = users.find(u => u.lockerId === pa.lockerId);
                                            const clientName = matchingUser ? matchingUser.name : 'Cliente Registrado';
                                            const generatedId = `SF-${Math.floor(1000 + Math.random() * 9000)}-GT`;
                                            const currentDate = new Date().toISOString().split('T')[0];
                                            const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                                            // Calculate Laredo / Shein rate
                                            const isShein = pa.description.toLowerCase().includes('shein');
                                            const flete = isShein
                                              ? ratesSettings.sheinRate
                                              : pa.weightEst * ratesSettings.laredoRate;

                                            const newShip: Shipment = {
                                              id: generatedId,
                                              lockerId: pa.lockerId,
                                              sender: pa.sender,
                                              receiver: clientName,
                                              origin: 'Laredo',
                                              destination: matchingUser ? matchingUser.address : 'Guatemala',
                                              status: 'En Sucursal', // checked-in at Laredo warehouse
                                              serviceType: 'Express',
                                              weight: pa.weightEst,
                                              dimensions: '20x20x15 cm',
                                              lastUpdated: `${currentDate} ${currentTime}`,
                                              history: [
                                                {
                                                  date: currentDate,
                                                  time: currentTime,
                                                  status: 'En Sucursal',
                                                  location: 'Bodega Laredo',
                                                  details: isShein
                                                    ? `Carga pre-alertada (Bolsa Shein) recibida físicamente en bodega de Laredo.`
                                                    : `Carga pre-alertada recibida físicamente en bodega de Laredo. Peso registrado: ${pa.weightEst} Lbs.`
                                                }
                                              ],
                                              notes: pa.description
                                            };

                                            const invoiceId = `FAC-${1000 + invoices.length + 1}`;
                                            const newInvoice = {
                                              id: invoiceId,
                                              lockerId: pa.lockerId,
                                              date: currentDate,
                                              concept: isShein
                                                ? `Flete Especial Bolsa Shein ${generatedId}`
                                                : `Cargo Flete Almacén Laredo ${generatedId} (${pa.weightEst} Lbs)`,
                                              amount: flete,
                                              paymentStatus: 'Pendiente'
                                            };

                                            // Save to Supabase
                                            db.upsertPreAlert({ ...pa, status: 'Recibido' });
                                            db.upsertShipment(newShip);
                                            db.upsertInvoice(newInvoice);

                                            setShipments([newShip, ...shipments]);

                                            // Generate invoice
                                            setInvoices(prev => [
                                              newInvoice,
                                              ...prev
                                            ]);

                                            alert(`Paquete pre-alertado registrado como recibido en Bodega Laredo. Se ha asignado la guía: ${generatedId} y se ha creado una factura de flete por Q ${flete.toFixed(2)}.`);
                                          }}
                                          className="bg-brand-orange hover:bg-brand-orange-hover text-white px-2 py-0.5 rounded text-4xs font-black uppercase transition cursor-pointer shadow-3xs flex items-center gap-0.5"
                                        >
                                          Laredo 🇺🇸
                                        </button>
                                        <button
                                          onClick={() => {
                                            // Set received status
                                            setPreAlerts(prev => prev.map(item => item.id === pa.id ? { ...item, status: 'Recibido' } : item));
                                            
                                            // Add package to shipments
                                            const matchingUser = users.find(u => u.lockerId === pa.lockerId);
                                            const clientName = matchingUser ? matchingUser.name : 'Cliente Registrado';
                                            const generatedId = `SF-${Math.floor(1000 + Math.random() * 9000)}-GT`;
                                            const currentDate = new Date().toISOString().split('T')[0];
                                            const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                                            // Calculate Mexico / Shein rate
                                            const isShein = pa.description.toLowerCase().includes('shein');
                                            const flete = isShein
                                              ? ratesSettings.sheinRate
                                              : pa.weightEst * ratesSettings.mexicoRate;

                                            const newShip: Shipment = {
                                              id: generatedId,
                                              lockerId: pa.lockerId,
                                              sender: pa.sender,
                                              receiver: clientName,
                                              origin: 'Mexico',
                                              destination: matchingUser ? matchingUser.address : 'Guatemala',
                                              status: 'En Sucursal', // checked-in at Mexico warehouse
                                              serviceType: 'Express',
                                              weight: pa.weightEst,
                                              dimensions: '20x20x15 cm',
                                              lastUpdated: `${currentDate} ${currentTime}`,
                                              history: [
                                                {
                                                  date: currentDate,
                                                  time: currentTime,
                                                  status: 'En Sucursal',
                                                  location: 'Bodega México',
                                                  details: isShein
                                                    ? `Carga pre-alertada (Bolsa Shein) recibida físicamente en bodega de México.`
                                                    : `Carga pre-alertada recibida físicamente en bodega de México. Peso registrado: ${pa.weightEst} Lbs.`
                                                }
                                              ],
                                              notes: pa.description
                                            };

                                            const invoiceId = `FAC-${1000 + invoices.length + 1}`;
                                            const newInvoice = {
                                              id: invoiceId,
                                              lockerId: pa.lockerId,
                                              date: currentDate,
                                              concept: isShein
                                                ? `Flete Especial Bolsa Shein ${generatedId}`
                                                : `Cargo Flete Almacén México ${generatedId} (${pa.weightEst} Lbs)`,
                                              amount: flete,
                                              paymentStatus: 'Pendiente'
                                            };

                                            // Save to Supabase
                                            db.upsertPreAlert({ ...pa, status: 'Recibido' });
                                            db.upsertShipment(newShip);
                                            db.upsertInvoice(newInvoice);

                                            setShipments([newShip, ...shipments]);

                                            // Generate invoice
                                            setInvoices(prev => [
                                              newInvoice,
                                              ...prev
                                            ]);

                                            alert(`Paquete pre-alertado registrado como recibido en Bodega México. Se ha asignado la guía: ${generatedId} y se ha creado una factura de flete por Q ${flete.toFixed(2)}.`);
                                          }}
                                          className="bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-0.5 rounded text-4xs font-black uppercase transition cursor-pointer shadow-3xs flex items-center gap-0.5"
                                        >
                                          México 🇲🇽
                                        </button>
                                      </div>
                                    ) : (
                                      <span className="text-gray-400 text-4xs font-bold uppercase flex items-center justify-center gap-0.5">
                                        <Check className="h-3 w-3 text-green-500" />
                                        Completado
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}

                              {preAlerts.length === 0 && (
                                <tr>
                                  <td colSpan={8} className="text-center py-10 text-gray-400 font-medium">
                                    No hay pre-alertas declaradas en el sistema.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* ==================== 5. WAREHOUSE RECEPCIÓN Y BASCULA (`warehouse`) ==================== */}
                    {adminSubTab === 'warehouse' && (() => {
                      // We build a thermal barcode representation dynamically
                      const barcodeLines = [
                        3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6
                      ];

                      const handleAutoDispatch = (lockerId: string, origin: 'Laredo' | 'Mexico', groupShipments: Shipment[], totalWeight: number, estimatedFlete: number) => {
                        const currentDate = new Date().toISOString().split('T')[0];
                        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
                        
                        const shortcode = origin === 'Laredo' ? 'LRD' : 'MEX';
                        const randomNum = Math.floor(100 + Math.random() * 900);
                        const masterWaybillId = `SF-CONS-${lockerId}-${shortcode}-${randomNum}`;
                        
                        // 1. Transition all grouped packages to 'En Tránsito'
                        const shipmentIds = groupShipments.map(s => s.id);
                        const updatedShipments = groupShipments.map(s => {
                          return {
                            ...s,
                            status: 'En Tránsito' as const,
                            lastUpdated: `${currentDate} ${currentTime}`,
                            history: [
                              {
                                date: currentDate,
                                time: currentTime,
                                status: 'En Tránsito' as const,
                                location: `Ruta Troncal desde Bodega ${origin}`,
                                details: `Despachado en lote automático. Consolidado bajo Guía Madre ${masterWaybillId}.`
                              },
                              ...s.history
                            ]
                          };
                        });

                        // 2. Append Master Guide to consolidatedGuides state
                        const newGuide = {
                          id: masterWaybillId,
                          date: currentDate,
                          origin: origin,
                          destination: 'Guatemala Central',
                          status: 'En Tránsito',
                          itemsCount: groupShipments.length,
                          totalWeight: totalWeight,
                          notes: `Consolidación Automática del cliente ${lockerId} desde Bodega ${origin}.`
                        };

                        // 3. Issue a consolidated billing invoice (flete) in Quetzales to invoices state
                        const invoiceId = `FAC-${Math.floor(1000 + Math.random() * 9000)}`;
                        const newInvoice = {
                          id: invoiceId,
                          lockerId: lockerId,
                          date: currentDate,
                          concept: `Flete Consolidado - ${groupShipments.length} Paquetes desde Bodega ${origin}`,
                          amount: estimatedFlete,
                          paymentStatus: 'Pendiente'
                        };

                        // Save to Supabase
                        db.upsertShipments(updatedShipments);
                        db.upsertConsolidatedGuide(newGuide);
                        db.upsertInvoice(newInvoice);

                        setShipments(prev => prev.map(s => {
                          if (shipmentIds.includes(s.id)) {
                            return {
                              ...s,
                              status: 'En Tránsito',
                              lastUpdated: `${currentDate} ${currentTime}`,
                              history: [
                                {
                                  date: currentDate,
                                  time: currentTime,
                                  status: 'En Tránsito',
                                  location: `Ruta Troncal desde Bodega ${origin}`,
                                  details: `Despachado en lote automático. Consolidado bajo Guía Madre ${masterWaybillId}.`
                                },
                                ...s.history
                              ]
                            };
                          }
                          return s;
                        }));

                        setConsolidatedGuides(prev => [newGuide, ...prev]);
                        setInvoices(prev => [newInvoice, ...prev]);

                        alert(`¡Consolidado despachado exitosamente!\n\n- Guía Madre: ${masterWaybillId}\n- Cliente: ${lockerId}\n- Paquetes: ${groupShipments.length}\n- Peso total: ${totalWeight.toFixed(1)} Lbs\n- Factura flete emitida: ${invoiceId} por Q ${estimatedFlete.toFixed(2)}`);
                        
                        setAdminSubTab('consolidado');
                      };

                      const handleWarehouseCheckIn = (e: React.FormEvent) => {
                        e.preventDefault();
                        if (!warehouseNotes.trim()) {
                          alert('Por favor ingrese una descripción detallada para el contenido del paquete.');
                          return;
                        }

                        const generatedId = `SF-${Math.floor(1000 + Math.random() * 9000)}-GT`;
                        const currentDate = new Date().toISOString().split('T')[0];
                        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                        // Calculate live flete based on warehouse and Shein package classification
                        const matchingUser = users.find(u => u.lockerId === warehouseLocker);
                        const clientName = matchingUser ? matchingUser.name : 'Cliente';
                        const isShein = isSheinPackage || warehouseNotes.toLowerCase().includes('shein');
                        const fleteTotal = isShein
                          ? ratesSettings.sheinRate
                          : (warehouseBodega === 'Laredo'
                            ? warehouseWeightInput * ratesSettings.laredoRate
                            : warehouseWeightInput * ratesSettings.mexicoRate);

                        const newShip: Shipment = {
                          id: generatedId,
                          lockerId: warehouseLocker,
                          sender: 'Tienda Courier Intern.',
                          receiver: clientName,
                          origin: warehouseBodega,
                          destination: matchingUser ? matchingUser.address : 'Guatemala Hub Central',
                          status: 'En Sucursal', // Recepcionado en bodega central
                          serviceType: 'Estándar',
                          weight: warehouseWeightInput,
                          dimensions: '30x25x20 cm',
                          lastUpdated: `${currentDate} ${currentTime}`,
                          history: [
                            {
                              date: currentDate,
                              time: currentTime,
                              status: 'En Sucursal',
                              location: `Bodega ${warehouseBodega}`,
                              details: isShein 
                                ? `Ingreso físico de Bolsa Shein a bodega de ${warehouseBodega}.`
                                : `Ingreso físico a bodega de ${warehouseBodega}. Peso registrado: ${warehouseWeightInput} Lbs.`
                            }
                          ],
                          notes: warehouseNotes
                        };

                        // Save to Supabase
                        db.upsertShipment(newShip);

                        setShipments([newShip, ...shipments]);

                        // Generate invoice
                        const newFacId = `FAC-${1000 + invoices.length + 1}`;
                        const newInvoice = {
                          id: newFacId,
                          lockerId: warehouseLocker,
                          date: currentDate,
                          concept: isShein
                            ? `Flete Especial Bolsa Shein ${generatedId}`
                            : `Cargo Flete Almacén ${warehouseBodega} ${generatedId} (${warehouseWeightInput} Lbs)`,
                          amount: fleteTotal,
                          paymentStatus: 'Pendiente'
                        };

                        // Save Invoice to Supabase
                        db.upsertInvoice(newInvoice);

                        setInvoices(prev => [newInvoice, ...prev]);

                        alert(`¡Paquete ingresado formalmente en Bodega de ${warehouseBodega}! ID de guía asignado: ${generatedId}. Se ha emitido la factura ${newFacId} por Q ${fleteTotal.toFixed(2)}.`);
                        
                        // Reset Shein package checkbox
                        setIsSheinPackage(false);
                        
                        // We do not reset to keep the printed sticker on screen for the admin to see!
                      };

                      const isSheinActive = isSheinPackage || warehouseNotes.toLowerCase().includes('shein');
                      const stickerFlete = isSheinActive
                        ? ratesSettings.sheinRate
                        : (warehouseBodega === 'Laredo'
                          ? warehouseWeightInput * ratesSettings.laredoRate
                          : warehouseWeightInput * ratesSettings.mexicoRate);

                      return (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                          <div>
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">🏢 Recepción de Carga y Báscula (Warehouse Check-In)</h3>
                            <p className="text-4xs text-gray-500">Módulo operativo en andén para pesar, medir e ingresar paquetes a estanterías físicas de almacenamiento, con generación de código QR/Etiqueta Zebra.</p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            
                            {/* Warehouse check-in form - LEFT */}
                            <form onSubmit={handleWarehouseCheckIn} className="lg:col-span-7 space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Casillero Destino *</label>
                                  <select
                                    value={warehouseLocker}
                                    onChange={(e) => setWarehouseLocker(e.target.value)}
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono text-brand-orange font-bold"
                                  >
                                    {users.filter(u => u.role === 'client').map(u => (
                                      <option key={u.lockerId} value={u.lockerId}>{u.lockerId} &mdash; {u.name}</option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Bodega de Ingreso *</label>
                                  <select
                                    value={warehouseBodega}
                                    onChange={(e) => setWarehouseBodega(e.target.value as 'Laredo' | 'Mexico')}
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold font-mono"
                                  >
                                    <option value="Laredo">Laredo 🇺🇸</option>
                                    <option value="Mexico">México 🇲🇽</option>
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Lectura de Báscula (Peso en Lbs) *</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0.1"
                                    required
                                    value={warehouseWeightInput}
                                    onChange={(e) => setWarehouseWeightInput(Number(e.target.value))}
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold font-mono"
                                  />
                                </div>

                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Descripción del Contenido *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Ej: Calzado, repuestos, ropa..."
                                    value={warehouseNotes}
                                    onChange={(e) => setWarehouseNotes(e.target.value)}
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  />
                                </div>
                              </div>

                              {/* Shein package classification checkbox */}
                              <div className="flex items-center space-x-2 bg-gray-50 border border-gray-200 p-2.5 rounded hover:border-brand-orange transition select-none">
                                <input
                                  id="isSheinPackageCheckbox"
                                  type="checkbox"
                                  checked={isSheinPackage}
                                  onChange={(e) => setIsSheinPackage(e.target.checked)}
                                  className="w-4 h-4 accent-brand-orange rounded cursor-pointer"
                                />
                                <label 
                                  htmlFor="isSheinPackageCheckbox"
                                  className="text-4xs font-bold text-brand-gray-dark uppercase cursor-pointer select-none flex items-center space-x-1"
                                >
                                  <span>🎀 ¿Es Paquete/Bolsa Shein?</span>
                                  <span className="text-brand-orange font-extrabold font-mono">(Tarifa Especial Plana Q {ratesSettings.sheinRate})</span>
                                </label>
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2.5 rounded uppercase tracking-wider transition cursor-pointer"
                              >
                                Ingresar a Bodega {warehouseBodega}
                              </button>
                            </form>

                            {/* Thermal printer sticker label simulation preview - RIGHT */}
                            <div className="lg:col-span-5 space-y-4">
                              <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block text-center">ETIQUETA TÉRMICA GENERADA (IMPRESORA ZEBRA)</span>
                              
                              {/* The simulated sticker */}
                              <div className="bg-white border-2 border-brand-gray-dark p-6 max-w-xs mx-auto rounded shadow-lg text-brand-gray-dark space-y-4 font-mono select-none relative overflow-hidden active-accent-border">
                                <div className="text-center font-black border-b border-brand-gray-dark pb-2">
                                  <div className="text-xs tracking-widest uppercase">SHIPFAST GT</div>
                                  <div className="text-4xs text-gray-500 uppercase">BODEGA: {warehouseBodega.toUpperCase()}</div>
                                  {isSheinActive && (
                                    <div className="text-[7px] bg-brand-orange text-white px-1.5 py-0.5 rounded font-black inline-block uppercase mt-1 animate-pulse">
                                      🎀 BOLSA SHEIN TARIFA FIJA
                                    </div>
                                  )}
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-4xs">
                                  <div>
                                    <span className="block text-gray-400 uppercase font-black">Casillero:</span>
                                    <strong className="text-xs font-black tracking-widest block">{warehouseLocker}</strong>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-gray-400 uppercase font-black">Origen Bodega:</span>
                                    <strong className="text-xs font-black block text-brand-orange">{warehouseBodega.toUpperCase()}</strong>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-4xs">
                                  <div>
                                    <span className="block text-gray-400 uppercase font-black">Peso Físico:</span>
                                    <strong className="text-xs font-bold block">{warehouseWeightInput.toFixed(1)} Lbs</strong>
                                  </div>
                                  <div className="text-right">
                                    <span className="block text-gray-400 uppercase font-black">Flete Est.:</span>
                                    <strong className="text-xs font-bold block">Q {stickerFlete.toFixed(2)}</strong>
                                  </div>
                                </div>

                                <div className="border-t border-brand-gray-dark pt-2">
                                  <div className="text-4xs text-gray-500 uppercase font-black block text-center mb-1">Rastreo de Distribución</div>
                                  
                                  {/* Sleek barcode simulation */}
                                  <div className="flex justify-center items-stretch h-8 space-x-[1.5px] bg-white">
                                    {barcodeLines.map((width, idx) => (
                                      <div 
                                        key={idx} 
                                        className="bg-brand-gray-dark h-full" 
                                        style={{ width: `${width * 0.75}px` }} 
                                      />
                                    ))}
                                  </div>
                                  
                                  <div className="text-4xs text-center font-black mt-1">*{warehouseLocker}-HUB-GT*</div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    alert('Imprimiendo etiqueta en Impresora Térmica Zebra GK420d... (Simulación Completada).');
                                  }}
                                  className="w-full bg-brand-gray-dark hover:bg-gray-800 text-white text-4xs font-bold py-1.5 rounded uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5"
                                >
                                  <Printer className="h-3 w-3 text-brand-orange animate-pulse" />
                                  Imprimir Sticker Técnico
                                </button>
                              </div>
                            </div>

                          </div>

                          {/* Consolidated Packages list by Client and Bodega */}
                          <div className="border-t border-gray-200 pt-6">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                              <div>
                                <h4 className="text-2xs font-extrabold text-brand-gray-dark uppercase tracking-wider font-display flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-brand-orange" />
                                  📦 Resumen de Paquetes Consolidados en Almacén
                                </h4>
                                <p className="text-4xs text-gray-500 mt-0.5">Control en tiempo real de paquetes recepcionados (En Sucursal) agrupados por cliente y su bodega de origen.</p>
                              </div>
                              
                              {/* Quick stats badges */}
                              <div className="flex gap-2">
                                <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded border border-blue-100 flex items-center gap-1 font-mono">
                                  🇺🇸 Laredo: {shipments.filter(s => s.status === 'En Sucursal' && s.origin === 'Laredo').length} paq.
                                </span>
                                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2.5 py-1 rounded border border-emerald-100 flex items-center gap-1 font-mono">
                                  🇲🇽 México: {shipments.filter(s => s.status === 'En Sucursal' && s.origin === 'Mexico').length} paq.
                                </span>
                              </div>
                            </div>

                            {/* Real-time consolidated table */}
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-3 text-center w-10">Estado</th>
                                    <th className="py-2.5 px-3">Casillero</th>
                                    <th className="py-2.5 px-3">Cliente</th>
                                    <th className="py-2.5 px-3">Bodega Origen</th>
                                    <th className="py-2.5 px-3 text-center">Cant. Paquetes</th>
                                    <th className="py-2.5 px-3 text-right">Peso Acumulado</th>
                                    <th className="py-2.5 px-3 text-center">Acción</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                  {(() => {
                                    const inWarehouse = shipments.filter(s => s.status === 'En Sucursal');
                                    const groups: { [key: string]: { lockerId: string; clientName: string; bodega: string; count: number; totalWeight: number; shipments: Shipment[] } } = {};
                                    
                                    inWarehouse.forEach(s => {
                                      const key = `${s.lockerId}-${s.origin}`;
                                      if (!groups[key]) {
                                        const user = users.find(u => u.lockerId === s.lockerId);
                                        groups[key] = {
                                          lockerId: s.lockerId,
                                          clientName: user ? user.name : s.receiver || 'Cliente',
                                          bodega: s.origin,
                                          count: 0,
                                          totalWeight: 0,
                                          shipments: []
                                        };
                                      }
                                      groups[key].count += 1;
                                      groups[key].totalWeight += s.weight;
                                      groups[key].shipments.push(s);
                                    });
                                    
                                    const groupList = Object.values(groups);
                                    
                                    if (groupList.length === 0) {
                                      return (
                                        <tr>
                                          <td colSpan={7} className="text-center py-8 text-gray-400 font-medium">
                                            No hay paquetes consolidados en sucursal en este momento.
                                          </td>
                                        </tr>
                                      );
                                    }
                                    
                                    return groupList.map((g) => {
                                      const groupKey = `${g.lockerId}-${g.bodega}`;
                                      const isExpanded = expandedWarehouseGroup === groupKey;
                                      
                                      return (
                                        <React.Fragment key={groupKey}>
                                          <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-orange-50/20' : ''}`}>
                                            <td className="py-3 px-3 text-center">
                                              <span className="h-2 w-2 rounded-full bg-orange-500 inline-block animate-pulse" title="En Almacén" />
                                            </td>
                                            <td className="py-3 px-3 font-bold font-mono text-brand-orange">
                                              {g.lockerId}
                                            </td>
                                            <td className="py-3 px-3 text-brand-gray-dark font-bold">
                                              {g.clientName}
                                            </td>
                                            <td className="py-3 px-3">
                                              {g.bodega === 'Laredo' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-4xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                  🇺🇸 Laredo US
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-4xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                  🇲🇽 México MX
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-3 px-3 text-center font-extrabold">
                                              <span className="bg-brand-orange/15 text-brand-orange text-3xs font-extrabold px-2.5 py-0.5 rounded-full">
                                                {g.count} {g.count === 1 ? 'paquete' : 'paquetes'}
                                              </span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-mono text-gray-600 font-bold">
                                              {g.totalWeight.toFixed(1)} Lbs
                                            </td>
                                            <td className="py-3 px-3 text-center space-x-2">
                                              <button
                                                type="button"
                                                onClick={() => setExpandedWarehouseGroup(isExpanded ? null : groupKey)}
                                                className="text-brand-orange hover:text-brand-orange-hover text-4xs font-black uppercase tracking-wider underline cursor-pointer"
                                              >
                                                {isExpanded ? 'Ocultar Detalle' : 'Ver Detalle'}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  const estimatedFlete = g.shipments.reduce((acc, s) => {
                                                    const isShein = (s.notes || '').toLowerCase().includes('shein');
                                                    const sFlete = isShein
                                                      ? ratesSettings.sheinRate
                                                      : (g.bodega === 'Laredo'
                                                        ? s.weight * ratesSettings.laredoRate
                                                        : s.weight * ratesSettings.mexicoRate);
                                                    return acc + sFlete;
                                                  }, 0);
                                                  handleAutoDispatch(g.lockerId, g.bodega as 'Laredo' | 'Mexico', g.shipments, g.totalWeight, estimatedFlete);
                                                }}
                                                className="bg-brand-orange hover:bg-brand-orange-hover text-white text-[9px] font-extrabold px-2.5 py-1 rounded uppercase tracking-wider transition cursor-pointer"
                                              >
                                                Despachar
                                              </button>
                                            </td>
                                          </tr>
                                          
                                          {/* Expanded Detail Panel */}
                                          {isExpanded && (
                                            <tr className="bg-gray-50/50">
                                              <td colSpan={7} className="px-6 py-4 border-t border-b border-gray-200">
                                                <div className="space-y-2">
                                                  <h5 className="text-[10px] font-extrabold text-brand-gray-dark uppercase tracking-wider flex items-center gap-1">
                                                    <ClipboardList className="h-3.5 w-3.5 text-brand-orange" />
                                                    Guías individuales de {g.clientName} ({g.lockerId}) en Bodega {g.bodega}
                                                  </h5>
                                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {g.shipments.map(s => {
                                                      return (
                                                        <div key={s.id} className="bg-white border border-gray-200 p-2.5 rounded shadow-2xs space-y-1.5 font-mono text-[9px] relative overflow-hidden">
                                                          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                                                            <span className="font-bold text-brand-orange">{s.id}</span>
                                                            <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[8px] font-bold">En Almacén</span>
                                                          </div>
                                                          <div className="flex justify-between text-gray-500">
                                                            <span>Contenido:</span>
                                                            <span className="text-brand-gray-dark font-semibold truncate max-w-[120px]" title={s.notes}>
                                                              {s.notes || 'Sin descripción'}
                                                            </span>
                                                          </div>
                                                          <div className="flex justify-between text-gray-500">
                                                            <span>Peso:</span>
                                                            <strong className="text-brand-gray-dark">{s.weight.toFixed(1)} Lbs</strong>
                                                          </div>
                                                          <div className="flex justify-between text-gray-500">
                                                            <span>Fecha ingreso:</span>
                                                            <span className="text-gray-400">{s.lastUpdated}</span>
                                                          </div>
                                                        </div>
                                                      );
                                                    })}
                                                  </div>
                                                </div>
                                              </td>
                                            </tr>
                                          )}
                                        </React.Fragment>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })()}



                    {/* ==================== 7. HISTORIAL DE CONSOLIDADOS (`consolidado`) ==================== */}
                    {adminSubTab === 'consolidado' && (() => {
                      const handleUpdateStatus = (guideId: string, newStatus: string) => {
                        // 1. Update the Master Guide status in consolidatedGuides
                        const targetGuide = consolidatedGuides.find(g => g.id === guideId);
                        if (targetGuide) {
                          db.upsertConsolidatedGuide({ ...targetGuide, status: newStatus });
                        }

                        setConsolidatedGuides(prev => prev.map(g => {
                          if (g.id === guideId) {
                            return { ...g, status: newStatus };
                          }
                          return g;
                        }));

                        // 2. Propagate the status change to all individual shipments in the consolidated guide
                        const currentDate = new Date().toISOString().split('T')[0];
                        const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                        const updatedShipmentsList: any[] = [];
                        const nextShipments = shipments.map(s => {
                          const hasGuideRef = s.history.some(h => h.details && h.details.includes(guideId));
                          if (hasGuideRef) {
                            let packageStatus: "Creado" | "En Tránsito" | "En Sucursal" | "En Ruta" | "Entregado" | "Retrasado" = 'En Tránsito';
                            let detailsText = `Estado de Guía Madre ${guideId} actualizado a: ${newStatus}.`;
                            let locationText = 'Ruta Troncal / Aduanas';

                            if (newStatus === 'Entregado') {
                              packageStatus = 'Entregado';
                              detailsText = `Paquete entregado formalmente al cliente (Guía Madre ${guideId} - Entregado).`;
                              locationText = 'Sucursal Destino Guatemala';
                            } else if (newStatus === 'Listo para Entrega') {
                              packageStatus = 'En Sucursal';
                              detailsText = `Paquete listo para entrega en oficina central (Guía Madre ${guideId} - Arribado).`;
                              locationText = 'Sede Central Guatemala';
                            } else if (newStatus === 'Recibido en Hub') {
                              packageStatus = 'En Sucursal';
                              detailsText = `Carga ingresada y desconsolidada en Hub Central (Guía Madre ${guideId}).`;
                              locationText = 'Hub Central Guatemala';
                            }

                            const updatedShip = {
                              ...s,
                              status: packageStatus,
                              lastUpdated: `${currentDate} ${currentTime}`,
                              history: [
                                {
                                  date: currentDate,
                                  time: currentTime,
                                  status: packageStatus,
                                  location: locationText,
                                  details: detailsText
                                },
                                ...s.history
                              ]
                            };
                            updatedShipmentsList.push(updatedShip);
                            return updatedShip;
                          }
                          return s;
                        });

                        if (updatedShipmentsList.length > 0) {
                          db.upsertShipments(updatedShipmentsList);
                        }

                        setShipments(nextShipments);

                        alert(`¡Guía Madre ${guideId} actualizada a: ${newStatus}!\nSe ha propagado el estado a todos sus paquetes individuales.`);
                      };

                      // Filter Master Guides list
                      const filteredGuides = consolidatedGuides.filter(guide => {
                        const query = masterGuideSearch.toLowerCase().trim();
                        const matchesSearch = !query || 
                          guide.id.toLowerCase().includes(query) ||
                          (guide.notes && guide.notes.toLowerCase().includes(query)) ||
                          guide.origin.toLowerCase().includes(query) ||
                          guide.destination.toLowerCase().includes(query) ||
                          guide.status.toLowerCase().includes(query) ||
                          guide.date.includes(query);

                        const matchesOrigin = consolidadoOriginFilter === 'Todos' || guide.origin === consolidadoOriginFilter;
                        const matchesStatus = consolidadoStatusFilter === 'Todos' || guide.status === consolidadoStatusFilter;

                        return matchesSearch && matchesOrigin && matchesStatus;
                      });

                      return (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                          {/* Header */}
                          <div>
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1 flex items-center gap-2">
                              <Layers className="w-4 h-4 text-brand-orange" />
                              📦 Historial de Guías Madre y Consolidados
                            </h3>
                            <p className="text-4xs text-gray-500">
                              Consulte el registro de todas las Guías Madre emitidas. Administre el estado de tránsito de los lotes internacionales y actualice el flujo logístico de los paquetes vinculados.
                            </p>
                          </div>

                          {/* Filters and Search Bar */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            
                            {/* Search bar */}
                            <div className="md:col-span-6 relative">
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Buscar Guía Madre</label>
                              <div className="relative">
                                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-gray-400">
                                  <Search className="h-3.5 w-3.5" />
                                </span>
                                <input
                                  type="text"
                                  placeholder="Ej: SF-CONS-SFG0-LRD-123..."
                                  value={masterGuideSearch}
                                  onChange={(e) => setMasterGuideSearch(e.target.value)}
                                  className="w-full pl-8 pr-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono"
                                />
                              </div>
                            </div>

                            {/* Origin Filter */}
                            <div className="md:col-span-3">
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Bodega de Origen</label>
                              <select
                                value={consolidadoOriginFilter}
                                onChange={(e) => setConsolidadoOriginFilter(e.target.value)}
                                className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                              >
                                <option value="Todos">Todas las Bodegas</option>
                                <option value="Laredo">Bodega Laredo 🇺🇸</option>
                                <option value="Mexico">Bodega México 🇲🇽</option>
                              </select>
                            </div>

                            {/* Status Filter */}
                            <div className="md:col-span-3">
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Estado del Consolidado</label>
                              <select
                                value={consolidadoStatusFilter}
                                onChange={(e) => setConsolidadoStatusFilter(e.target.value)}
                                className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                              >
                                <option value="Todos">Todos los Estados</option>
                                <option value="Despachado">Despachado / Enviado</option>
                                <option value="En Tránsito">En Tránsito</option>
                                <option value="Recibido en Hub">Recibido en Hub</option>
                                <option value="Listo para Entrega">Listo para Entrega</option>
                                <option value="Entregado">Entregado</option>
                              </select>
                            </div>

                          </div>

                          {/* History High-Density Table */}
                          <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                  <th className="py-2.5 px-3">Fecha</th>
                                  <th className="py-2.5 px-3">Guía Madre ID</th>
                                  <th className="py-2.5 px-3">Bodega Origen</th>
                                  <th className="py-2.5 px-3">Destino final</th>
                                  <th className="py-2.5 px-3 text-center">Bultos</th>
                                  <th className="py-2.5 px-3 text-right">Peso Total</th>
                                  <th className="py-2.5 px-3 text-center">Estado Tránsito</th>
                                  <th className="py-2.5 px-3 text-center">Actualizar Estado</th>
                                  <th className="py-2.5 px-3 text-center">Detalles</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                {filteredGuides.length > 0 ? (
                                  filteredGuides.map(guide => {
                                    const guideKey = guide.id;
                                    const isExpanded = expandedConsolidadoGuide === guideKey;

                                    // Filter child packages dynamically
                                    const childShipments = shipments.filter(s => 
                                      s.history.some(h => h.details && h.details.includes(guide.id)) ||
                                      (s.notes && s.notes.includes(guide.id))
                                    );

                                    return (
                                      <React.Fragment key={guide.id}>
                                        <tr className={`hover:bg-gray-50/50 transition-colors ${isExpanded ? 'bg-orange-50/10' : ''}`}>
                                          <td className="py-3 px-3 font-mono text-gray-400">
                                            {guide.date}
                                          </td>
                                          <td className="py-3 px-3 font-bold font-mono text-brand-orange tracking-wide uppercase">
                                            {guide.id}
                                          </td>
                                          <td className="py-3 px-3">
                                            {guide.origin === 'Laredo' ? (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-4xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                                🇺🇸 Laredo US
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-4xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                🇲🇽 México MX
                                              </span>
                                            )}
                                          </td>
                                          <td className="py-3 px-3 text-gray-500">
                                            {guide.destination}
                                          </td>
                                          <td className="py-3 px-3 text-center">
                                            <span className="bg-slate-100 text-slate-800 text-4xs font-extrabold px-2 py-0.5 rounded">
                                              {guide.itemsCount} bultos
                                            </span>
                                          </td>
                                          <td className="py-3 px-3 text-right font-mono text-gray-600 font-bold">
                                            {Number(guide.totalWeight).toFixed(1)} Lbs
                                          </td>
                                          <td className="py-3 px-3 text-center">
                                            <span className={`px-2.5 py-0.5 rounded-full text-4xs font-extrabold uppercase border ${
                                              guide.status === 'Entregado' ? 'bg-green-50 border-green-200 text-green-700' :
                                              guide.status === 'Listo para Entrega' ? 'bg-amber-50 border-amber-200 text-amber-700 font-extrabold' :
                                              guide.status === 'Recibido en Hub' ? 'bg-purple-50 border-purple-200 text-purple-700' :
                                              guide.status === 'En Tránsito' ? 'bg-blue-50 border-blue-200 text-blue-700 font-extrabold animate-pulse' :
                                              'bg-gray-50 border-gray-200 text-gray-600'
                                            }`}>
                                              {guide.status}
                                            </span>
                                          </td>
                                          <td className="py-3 px-3 text-center">
                                            <select
                                              value={guide.status}
                                              onChange={(e) => handleUpdateStatus(guide.id, e.target.value)}
                                              className="px-2 py-1 text-4xs font-bold border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono text-brand-gray-dark"
                                            >
                                              <option value="Despachado">Despachado</option>
                                              <option value="En Tránsito">En Tránsito</option>
                                              <option value="Recibido en Hub">Recibido en Hub</option>
                                              <option value="Listo para Entrega">Listo para Entrega</option>
                                              <option value="Entregado">Entregado</option>
                                            </select>
                                          </td>
                                          <td className="py-3 px-3 text-center">
                                            <button
                                              type="button"
                                              onClick={() => setExpandedConsolidadoGuide(isExpanded ? null : guideKey)}
                                              className="text-brand-orange hover:text-brand-orange-hover text-4xs font-black uppercase tracking-wider underline cursor-pointer"
                                            >
                                              {isExpanded ? 'Ocultar' : 'Ver Detalle'}
                                            </button>
                                          </td>
                                        </tr>

                                        {/* Expanded Details Row */}
                                        {isExpanded && (
                                          <tr className="bg-gray-50/50">
                                            <td colSpan={9} className="px-6 py-4 border-t border-b border-gray-200">
                                              <div className="space-y-4">
                                                
                                                {/* Header Details */}
                                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-gray-200 pb-3">
                                                  <div>
                                                    <h5 className="text-[10px] font-black text-brand-gray-dark uppercase tracking-widest flex items-center gap-1.5">
                                                      <ClipboardList className="h-4 w-4 text-brand-orange" />
                                                      Especificaciones del Consolidado {guide.id}
                                                    </h5>
                                                    <p className="text-4xs text-gray-500 font-sans mt-0.5 italic">
                                                      <strong>Bitácora:</strong> {guide.notes || 'Sin observaciones registradas.'}
                                                    </p>
                                                  </div>
                                                  <div className="text-right">
                                                    <span className="text-5xs text-gray-400 block font-bold uppercase tracking-wider">Destinatario General</span>
                                                    <strong className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wide">ShipFast GT Hub Central</strong>
                                                  </div>
                                                </div>

                                                {/* Child Shipments List */}
                                                <div className="space-y-2">
                                                  <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest block">Paquetes Consolidados en este Lote ({childShipments.length}):</span>
                                                  
                                                  {childShipments.length > 0 ? (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                                      {childShipments.map(ship => (
                                                        <div key={ship.id} className="bg-white border border-gray-200 rounded p-3 shadow-3xs space-y-1.5 text-[9px] font-mono relative overflow-hidden">
                                                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange"></div>
                                                          
                                                          <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                                                            <strong className="text-brand-orange font-black">{ship.id}</strong>
                                                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                                                              ship.status === 'Entregado' ? 'bg-green-100 text-green-800' :
                                                              ship.status === 'En Sucursal' ? 'bg-amber-100 text-amber-800' :
                                                              'bg-blue-100 text-blue-800'
                                                            }`}>
                                                              {ship.status}
                                                            </span>
                                                          </div>

                                                          <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-gray-500 font-medium">
                                                            <div>&bull; Casillero: <strong className="text-brand-gray-dark">{ship.lockerId}</strong></div>
                                                            <div>&bull; Peso: <strong className="text-brand-gray-dark">{ship.weight.toFixed(1)} Lbs</strong></div>
                                                            <div className="col-span-2 truncate">&bull; Destino: <strong className="text-brand-gray-dark font-sans">{ship.receiver}</strong></div>
                                                            <div className="col-span-2 truncate">&bull; Contenido: <strong className="text-brand-gray-dark font-sans">{ship.notes || 'Sin descripción'}</strong></div>
                                                          </div>
                                                        </div>
                                                      ))}
                                                    </div>
                                                  ) : (
                                                    <p className="text-4xs text-gray-400 italic">
                                                      No se encontraron paquetes individuales vinculados activamente a esta Guía Madre en la base de datos simulada.
                                                    </p>
                                                  )}
                                                </div>

                                              </div>
                                            </td>
                                          </tr>
                                        )}
                                      </React.Fragment>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={9} className="text-center py-12 text-gray-400 font-medium">
                                      No se encontraron Guías Madre que coincidan con los criterios de búsqueda.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                        </div>
                      );
                    })()}

                    {/* ==================== 8. FACTURACIÓN Y COBROS (`facturacion`) ==================== */}
                    {adminSubTab === 'facturacion' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">💰 Facturación y Control de Fletes de Clientes</h3>
                          <p className="text-4xs text-gray-500">Módulo de contabilidad. Genere facturas directas con importes fijos expresados puramente en Quetzales (Q), libres de recargos automáticos o fórmulas de IVA.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                          
                          {/* Invoice table list - LEFT */}
                          <div className="lg:col-span-8 space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Libro Ledger de Facturas Emitidas</span>
                            
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-4">Factura ID</th>
                                    <th className="py-2.5 px-3">Casillero</th>
                                    <th className="py-2.5 px-3">Fecha Emisión</th>
                                    <th className="py-2.5 px-3">Concepto Descripción</th>
                                    <th className="py-2.5 px-3 text-right">Importe Cobro</th>
                                    <th className="py-2.5 px-4 text-center">Estado Pago</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                  {invoices.map(invoice => (
                                    <tr key={invoice.id} className="hover:bg-gray-50/50">
                                      <td className="py-3 px-4 font-bold text-brand-gray-dark uppercase">{invoice.id}</td>
                                      <td className="py-3 px-3 font-mono text-gray-500">{invoice.lockerId}</td>
                                      <td className="py-3 px-3 font-mono">{invoice.date}</td>
                                      <td className="py-3 px-3 font-bold">{invoice.concept}</td>
                                      <td className="py-3 px-3 text-right font-mono text-brand-orange font-black">Q {invoice.amount.toFixed(2)}</td>
                                      <td className="py-3 px-4 text-center">
                                        <span className={`px-2 py-0.5 rounded text-4xs font-extrabold uppercase border ${
                                          invoice.paymentStatus === 'Pagado'
                                            ? 'bg-green-50 border-green-200 text-green-700'
                                            : 'bg-red-50 border-red-200 text-red-700 font-extrabold animate-pulse'
                                        }`}>
                                          {invoice.paymentStatus}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Invoice form manual creator - RIGHT */}
                          <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4">
                            <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Emitir Factura Manual (Q)</h4>
                            
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!invoiceConcept.trim()) {
                                  alert('Ingrese el concepto del cobro.');
                                  return;
                                }

                                const currentDate = new Date().toISOString().split('T')[0];
                                const invoiceId = `FAC-${1000 + invoices.length + 1}`;
                                const newInvoice = {
                                  id: invoiceId,
                                  lockerId: invoiceLocker,
                                  date: currentDate,
                                  concept: invoiceConcept,
                                  amount: invoiceAmount,
                                  paymentStatus: 'Pendiente'
                                };

                                // Save to Supabase
                                db.upsertInvoice(newInvoice);

                                setInvoices(prev => [
                                  newInvoice,
                                  ...prev
                                ]);

                                alert(`Factura manual ${invoiceId} emitida por un valor de Q ${invoiceAmount.toFixed(2)} asociada al casillero ${invoiceLocker}.`);
                                setInvoiceConcept('');
                                setInvoiceAmount(120.00);
                              }}
                              className="space-y-3"
                            >
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Casillero Asignado *</label>
                                <select
                                  value={invoiceLocker}
                                  onChange={(e) => setInvoiceLocker(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono text-brand-orange font-bold"
                                >
                                  {users.filter(u => u.role === 'client').map(u => (
                                    <option key={u.lockerId} value={u.lockerId}>{u.lockerId} &mdash; {u.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Concepto Detalle *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej: Flete de paquete SF-4912-GT"
                                  value={invoiceConcept}
                                  onChange={(e) => setInvoiceConcept(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                />
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Importe en Quetzales (Q) *</label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={invoiceAmount}
                                  onChange={(e) => setInvoiceAmount(Number(e.target.value))}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-bold font-mono text-brand-gray-dark"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer"
                              >
                                Emitir Factura Manual
                              </button>
                            </form>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ==================== 9. REGISTRO DE PAGOS / COBROS (`pagos`) ==================== */}
                    {adminSubTab === 'pagos' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">💰 Caja Chica y Recibos de Pagos Recaudados</h3>
                          <p className="text-4xs text-gray-500">Módulo de control de caja. Reciba pagos en efectivo, transferencia o contra-entrega (COD) para cancelar facturas pendientes, sumando saldo líquido en tiempo real.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                          
                          {/* Payments Log Ledger - LEFT */}
                          <div className="lg:col-span-8 space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Historial Ledger de Transacciones de Caja</span>
                            
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-4">Recibo ID</th>
                                    <th className="py-2.5 px-3">Casillero</th>
                                    <th className="py-2.5 px-3">Factura Relac.</th>
                                    <th className="py-2.5 px-3">Fecha Recibo</th>
                                    <th className="py-2.5 px-3">Método Pago</th>
                                    <th className="py-2.5 px-3 text-right">Monto Recaudado</th>
                                    <th className="py-2.5 px-4">Notas / Auditoría</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                  {paymentsLog.map(pay => (
                                    <tr key={pay.id} className="hover:bg-gray-50/50">
                                      <td className="py-3 px-4 font-bold text-brand-gray-dark uppercase">{pay.id}</td>
                                      <td className="py-3 px-3 font-mono text-gray-500">{pay.lockerId}</td>
                                      <td className="py-3 px-3 font-bold text-brand-orange uppercase">{pay.invoiceId}</td>
                                      <td className="py-3 px-3 font-mono">{pay.date}</td>
                                      <td className="py-3 px-3 font-bold">{pay.method}</td>
                                      <td className="py-3 px-3 text-right font-mono text-green-700 font-black">Q {pay.amount.toFixed(2)}</td>
                                      <td className="py-3 px-4 text-gray-400 italic">{pay.notes}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Record Payment Form - RIGHT */}
                          <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4">
                            <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Registrar Cobro Recibido (Caja)</h4>
                            
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                
                                const selectedInvoice = invoices.find(i => i.id === paymentInvoice);
                                if (!selectedInvoice) {
                                  alert('Seleccione una factura pendiente válida.');
                                  return;
                                }

                                const currentDate = new Date().toISOString().split('T')[0];
                                const receiptId = `PAG-${500 + paymentsLog.length + 1}`;
                                const updatedInvoice = { ...selectedInvoice, paymentStatus: 'Pagado' };
                                const newPayment = {
                                  id: receiptId,
                                  lockerId: paymentLocker,
                                  date: currentDate,
                                  method: paymentMethod,
                                  invoiceId: paymentInvoice,
                                  amount: paymentAmount,
                                  notes: paymentNotes || 'Auditado en ventanilla'
                                };

                                // Save to Supabase
                                db.upsertInvoice(updatedInvoice);
                                db.upsertPayment(newPayment);

                                // Update invoice status
                                setInvoices(prev => prev.map(inv => inv.id === paymentInvoice ? updatedInvoice : inv));

                                // Append transaction receipt
                                setPaymentsLog(prev => [
                                  newPayment,
                                  ...prev
                                ]);

                                alert(`¡Recibo de pago ${receiptId} registrado correctamente! Factura ${paymentInvoice} marcada como Pagada.`);
                                
                                // Reset fields
                                setPaymentNotes('');
                              }}
                              className="space-y-3"
                            >
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Seleccionar Factura Pendiente *</label>
                                <select
                                  value={paymentInvoice}
                                  onChange={(e) => {
                                    setPaymentInvoice(e.target.value);
                                    const match = invoices.find(i => i.id === e.target.value);
                                    if (match) {
                                      setPaymentLocker(match.lockerId);
                                      setPaymentAmount(match.amount);
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono text-brand-orange font-bold"
                                >
                                  <option value="">-- Facturas en Cola --</option>
                                  {invoices.filter(i => i.paymentStatus === 'Pendiente').map(i => (
                                    <option key={i.id} value={i.id}>{i.id} &mdash; {i.lockerId} (Q {i.amount.toFixed(2)})</option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-4xs bg-white p-2.5 rounded border border-gray-200">
                                <div>Locker: <strong>{paymentLocker}</strong></div>
                                <div>Monto: <strong>Q {paymentAmount.toFixed(2)}</strong></div>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Método de Recaudación *</label>
                                <select
                                  value={paymentMethod}
                                  onChange={(e) => setPaymentMethod(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                                >
                                  <option value="Transferencia Bancaria">Transferencia Bancaria</option>
                                  <option value="Pago en Efectivo">Pago en Efectivo</option>
                                  <option value="Tarjeta de Crédito">Tarjeta de Crédito/Débito</option>
                                  <option value="Contra-Entrega (COD)">Contra-Entrega (COD)</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Notas / Código Referencia *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej: Depósito Banrural Ref #8219"
                                  value={paymentNotes}
                                  onChange={(e) => setPaymentNotes(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer"
                              >
                                Registrar Recibo de Pago
                              </button>
                            </form>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ==================== 10. REGISTRO DE GASTOS (`gastos`) ==================== */}
                    {adminSubTab === 'gastos' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">💸 Registro de Gastos y Egresos Operativos</h3>
                          <p className="text-4xs text-gray-500">Módulo de control presupuestario. Registre egresos de combustible, viáticos, mantenimiento de vehículos o reparaciones, deduciendo automáticamente el efectivo neto.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                          
                          {/* Expenses table ledger - LEFT */}
                          <div className="lg:col-span-8 space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Libro Ledger de Egresos y Gastos Administrativos</span>
                            
                            <div className="overflow-x-auto border border-gray-200 rounded-lg">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                    <th className="py-2.5 px-4">Gasto ID</th>
                                    <th className="py-2.5 px-3">Fecha Registro</th>
                                    <th className="py-2.5 px-3">Categoría Estatus</th>
                                    <th className="py-2.5 px-3">Detalle / Justificación</th>
                                    <th className="py-2.5 px-3 text-right">Monto Gastado</th>
                                    <th className="py-2.5 px-4">Cajero / Operador</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                  {expensesLog.map(exp => (
                                    <tr key={exp.id} className="hover:bg-gray-50/50">
                                      <td className="py-3 px-4 font-bold text-brand-gray-dark uppercase">{exp.id}</td>
                                      <td className="py-3 px-3 font-mono">{exp.date}</td>
                                      <td className="py-3 px-3 font-bold text-brand-orange uppercase">{exp.category}</td>
                                      <td className="py-3 px-3">{exp.description}</td>
                                      <td className="py-3 px-3 text-right font-mono text-red-600 font-black">Q {exp.amount.toFixed(2)}</td>
                                      <td className="py-3 px-4 text-gray-400 font-bold">{exp.cashier}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>

                          {/* Gasto creator - RIGHT */}
                          <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4">
                            <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Registrar Egreso Operativo (Q)</h4>
                            
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!expenseDescription.trim()) {
                                  alert('Ingrese una justificación detallada del gasto.');
                                  return;
                                }

                                const currentDate = new Date().toISOString().split('T')[0];
                                const expId = `GTO-${800 + expensesLog.length + 1}`;
                                const newExpense = {
                                  id: expId,
                                  date: currentDate,
                                  category: expenseCategory,
                                  description: expenseDescription,
                                  amount: expenseAmount,
                                  cashier: 'Auditor Central'
                                };

                                // Save to Supabase
                                db.upsertExpense(newExpense);

                                setExpensesLog(prev => [
                                  newExpense,
                                  ...prev
                                ]);

                                alert(`Gasto administrativo ${expId} por valor de Q ${expenseAmount.toFixed(2)} registrado en el ledger.`);
                                setExpenseDescription('');
                                setExpenseAmount(150.00);
                              }}
                              className="space-y-3"
                            >
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Categoría del Gasto *</label>
                                <select
                                  value={expenseCategory}
                                  onChange={(e) => setExpenseCategory(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                                >
                                  <option value="Combustible">Combustible Troncales</option>
                                  <option value="Viáticos">Viáticos / Repartidores</option>
                                  <option value="Mantenimiento">Mantenimiento Flotilla</option>
                                  <option value="Servicios">Alquileres / Luz / Internet</option>
                                  <option value="Papelería">Papelería y Stickers Bodega</option>
                                  <option value="Otros">Otros Imprevistos</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Detalle / Proveedor Justificación *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej: Diésel camión placas C-214"
                                  value={expenseDescription}
                                  onChange={(e) => setExpenseDescription(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                />
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Monto en Quetzales (Q) *</label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={expenseAmount}
                                  onChange={(e) => setExpenseAmount(Number(e.target.value))}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-bold font-mono text-brand-gray-dark"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer"
                              >
                                Registrar Egreso
                              </button>
                            </form>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ==================== 11. REPORTES DE RENDIMIENTO (`reportes`) ==================== */}
                    {adminSubTab === 'reportes' && (() => {
                      const totalWeightLbs = shipments.reduce((acc, curr) => acc + curr.weight, 0);
                      const deliveredRatio = (shipments.filter(s => s.status === 'Entregado').length / shipments.length) * 100;

                      return (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                          <div>
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">📊 Reportes Operativos e Indicadores Clave (KPIs)</h3>
                            <p className="text-4xs text-gray-500">Módulo gerencial de analítica. Supervise el volumen de carga movilizada, márgenes brutos de rentabilidad neta y tasas operativas en Guatemala.</p>
                          </div>

                          {/* Graphical Stats Cards */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            
                            {/* Card 1: Load volume */}
                            <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-3">
                              <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Volumen Acumulado de Carga</span>
                              <div className="text-xl font-black text-brand-gray-dark font-mono">{totalWeightLbs.toFixed(1)} Lbs</div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-brand-orange h-full rounded-full" style={{ width: '74%' }} />
                              </div>
                              <span className="text-[10px] text-gray-500 block">+12.4% con respecto a la semana anterior</span>
                            </div>

                            {/* Card 2: Cash Revenue Net */}
                            <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-3">
                              <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Margen Neto Operativo</span>
                              <div className="text-xl font-black text-green-700 font-mono">Q {netCashLedger.toFixed(2)}</div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-green-600 h-full rounded-full" style={{ width: '85%' }} />
                              </div>
                              <span className="text-[10px] text-gray-500 block">Eficiencia financiera consolidada</span>
                            </div>

                            {/* Card 3: SLA success */}
                            <div className="bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-3">
                              <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Tasa SLA de Entregas (Éxito)</span>
                              <div className="text-xl font-black text-brand-orange font-mono">{deliveredRatio.toFixed(1)}%</div>
                              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-brand-orange h-full rounded-full" style={{ width: `${deliveredRatio}%` }} />
                              </div>
                              <span className="text-[10px] text-gray-500 block">Entregas dentro del rango estimado (24h/48h)</span>
                            </div>

                          </div>

                          {/* Quick export simulator */}
                          <div className="p-4 bg-orange-50/50 border border-brand-orange/20 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-3">
                            <span className="text-3xs text-brand-orange font-bold">¿Desea exportar el libro contable de caja consolidado o el manifiesto unificado en formato de hoja de cálculo?</span>
                            <button
                              type="button"
                              onClick={() => {
                                alert('Generando y descargando libro consolidado en formato CSV... (Simulación Exitosa).');
                              }}
                              className="bg-brand-gray-dark hover:bg-gray-800 text-white text-3xs font-extrabold px-4 py-2 rounded uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-3xs"
                            >
                              <FileSpreadsheet className="h-3.5 w-3.5 text-brand-orange animate-pulse" />
                              Exportar Libro Ledger (.CSV)
                            </button>
                          </div>

                        </div>
                      );
                    })()}

                    {/* ==================== 12. SEDES Y SUCURSALES (`sucursales`) ==================== */}
                    {adminSubTab === 'sucursales' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">🏢 Sedes, Andenes y Sucursales de Distribución</h3>
                          <p className="text-4xs text-gray-500">Directorio de hubs físicos autorizados en la red logística de ShipFast Guatemala. Gestione personal asignado, flota automotriz activa y andenes de descarga.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                          
                          {/* Branch office listings - LEFT */}
                          <div className="lg:col-span-8 space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Listado de Sucursales Activas Nacionales</span>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {branchesList.map(branch => (
                                <div key={branch.id} className="bg-gray-50 border border-gray-200 p-4 rounded-lg space-y-2.5 font-mono text-3xs text-brand-gray-dark border-l-4 border-l-brand-gray-dark hover:border-l-brand-orange transition-all">
                                  <div className="flex justify-between items-center border-b border-gray-200 pb-1">
                                    <strong className="text-2xs font-extrabold text-brand-gray-dark font-sans">{branch.name}</strong>
                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{branch.id}</span>
                                  </div>

                                  <div className="space-y-1 text-gray-600">
                                    <div>&bull; Director Regional: <strong>{branch.manager}</strong></div>
                                    <div>&bull; Región Geográfica: {branch.region}</div>
                                    <div>&bull; Operadores Staff: <strong>{branch.staffCount} personas</strong></div>
                                    <div>&bull; Flota Vehicular: <strong>{branch.activeVehicles} unidades</strong></div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Branch office register - RIGHT */}
                          <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4">
                            <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Registrar Nueva Sucursal</h4>
                            
                            <form 
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (!newBranchName.trim() || !newBranchManager.trim()) {
                                  alert('Por favor complete todos los datos.');
                                  return;
                                }

                                const brId = `SUC-0${branchesList.length + 1}`;
                                const newBranch = {
                                  id: brId,
                                  name: newBranchName,
                                  region: newBranchRegion,
                                  manager: newBranchManager,
                                  staffCount: 4,
                                  activeVehicles: 2
                                };

                                // Save to Supabase
                                db.upsertBranch(newBranch);

                                setBranchesList(prev => [
                                  ...prev,
                                  newBranch
                                ]);

                                alert(`Nueva sucursal regional ${newBranchName} registrada exitosamente bajo el código ${brId}.`);
                                setNewBranchName('');
                                setNewBranchManager('');
                              }}
                              className="space-y-3"
                            >
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Oficial Sucursal *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Ej: Sucursal Chiquimula"
                                  value={newBranchName}
                                  onChange={(e) => setNewBranchName(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                />
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Región de Operaciones *</label>
                                <select
                                  value={newBranchRegion}
                                  onChange={(e) => setNewBranchRegion(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                                >
                                  <option value="Metropolitana">Metropolitana</option>
                                  <option value="Central">Central</option>
                                  <option value="Occidente">Occidente</option>
                                  <option value="Oriente">Oriente</option>
                                  <option value="Verapaces">Verapaces</option>
                                  <option value="Pacífico">Pacífico (Sur)</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Administrador / Manager de Andén *</label>
                                <input
                                  type="text"
                                  required
                                  placeholder="Nombre de Gerente"
                                  value={newBranchManager}
                                  onChange={(e) => setNewBranchManager(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer"
                              >
                                Registrar Sucursal
                              </button>
                            </form>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ==================== 13. USUARIOS Y OPERADORES (`usuarios`) ==================== */}
                    {adminSubTab === 'usuarios' && (() => {
                      const handleAddOperator = (e: React.FormEvent) => {
                        e.preventDefault();
                        const userName = (document.getElementById('opNameInput') as HTMLInputElement)?.value || '';
                        const userRole = (document.getElementById('opRoleSelect') as HTMLSelectElement)?.value || 'driver';
                        let userPhone = (document.getElementById('opPhoneInput') as HTMLInputElement)?.value || '';
                        const userEmail = (document.getElementById('opEmailInput') as HTMLInputElement)?.value || '';

                        if (!userName.trim() || !userEmail.trim()) {
                          alert('Por favor complete todos los datos del operador.');
                          return;
                        }

                        // Phone validation force +502
                        userPhone = userPhone.trim();
                        if (!userPhone.startsWith('+502')) {
                          userPhone = '+502 ' + userPhone.replace('+502', '').trim();
                        }

                        const newStaff: UserProfile = {
                          lockerId: `SFG${users.length}`,
                          name: userName,
                          email: userEmail,
                          phone: userPhone,
                          address: 'Sucursal Central, Guatemala',
                          role: userRole,
                          password: '1234'
                        };

                        // Save to Supabase
                        db.upsertProfile(newStaff);

                        setUsers([...users, newStaff]);
                        alert(`Operador/Repartidor ${userName} agregado exitosamente con el prefijo +502 en su teléfono.`);
                        
                        // Reset fields
                        (document.getElementById('opNameInput') as HTMLInputElement).value = '';
                        (document.getElementById('opPhoneInput') as HTMLInputElement).value = '+502 ';
                        (document.getElementById('opEmailInput') as HTMLInputElement).value = '';
                      };

                      return (
                        <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                          <div>
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">👥 Usuarios, Pilotos y Operadores de Distribución</h3>
                            <p className="text-4xs text-gray-500">Módulo de recursos humanos. Gestione los perfiles de operadores de bodega central y pilotos/mensajeros de ruta. Valide teléfonos con el código de país obligatorio (+502).</p>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            
                            {/* Operator directories - LEFT */}
                            <div className="lg:col-span-8 space-y-4">
                              <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block">Directorio Logístico de Pilotos y Mensajeros Autorizados</span>
                              
                              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider">
                                      <th className="py-2.5 px-4">Identificador</th>
                                      <th className="py-2.5 px-3">Nombre Completo</th>
                                      <th className="py-2.5 px-3">Rol / Función</th>
                                      <th className="py-2.5 px-3">Número de Teléfono (+502)</th>
                                      <th className="py-2.5 px-4">Correo Institucional</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                    {users.map((u, uIdx) => (
                                      <tr key={uIdx} className="hover:bg-gray-50/50">
                                        <td className="py-3 px-4 font-mono font-bold text-gray-400">{u.lockerId}</td>
                                        <td className="py-3 px-3 font-bold">{u.name}</td>
                                        <td className="py-3 px-3">
                                          <span className={`px-2 py-0.5 rounded text-4xs font-extrabold uppercase border ${
                                            u.role === 'admin' 
                                              ? 'bg-brand-orange/10 border-brand-orange/30 text-brand-orange' 
                                              : 'bg-gray-50 border-gray-200 text-gray-600'
                                          }`}>
                                            {u.role === 'admin' ? 'Administrador Central' : 
                                             u.role === 'driver' ? 'Mensajero Motorizado' :
                                             u.role === 'pilot' ? 'Piloto de Carga' :
                                             u.role === 'operator' ? 'Despachador de Bodega' :
                                             u.role === 'auditor' ? 'Auditor Contable' : 'Cliente'}
                                          </span>
                                        </td>
                                        <td className="py-3 px-3 font-mono font-bold text-brand-gray-dark">{u.phone}</td>
                                        <td className="py-3 px-4 font-mono text-gray-400">{u.email}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Operator register - RIGHT */}
                            <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4">
                              <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Registrar Nuevo Operador</h4>
                              
                              <form onSubmit={handleAddOperator} className="space-y-3">
                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Completo *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Nombre del conductor/operario"
                                    id="opNameInput"
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  />
                                </div>

                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Función Operativa *</label>
                                  <select
                                    id="opRoleSelect"
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold"
                                  >
                                    <option value="driver">Mensajero Motorizado (Local)</option>
                                    <option value="pilot">Piloto de Carga Troncal</option>
                                    <option value="operator">Despachador de Bodega</option>
                                    <option value="auditor">Auditor Contable</option>
                                  </select>
                                </div>

                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Número de Teléfono (+502) *</label>
                                  <input
                                    type="text"
                                    required
                                    defaultValue="+502 "
                                    id="opPhoneInput"
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-bold font-mono text-brand-gray-dark"
                                  />
                                </div>

                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Correo Electrónico *</label>
                                  <input
                                    type="email"
                                    required
                                    placeholder="operador@shipfast.gt"
                                    id="opEmailInput"
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  />
                                </div>

                                <button
                                  type="submit"
                                  className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer"
                                >
                                  Registrar Colaborador
                                </button>
                              </form>
                            </div>

                          </div>
                        </div>
                      );
                    })()}

                    {/* ==================== 14. CONFIGURACIÓN TARIFARIA (`tarifas`) ==================== */}
                    {adminSubTab === 'tarifas' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">⚙️ Configuración de Tarifas de Envío en Quetzales (Q)</h3>
                          <p className="text-4xs text-gray-500">Módulo comercial dinámico. Ajuste los precios base y costos por peso adicional. Los cambios en estos parámetros se reflejan instantáneamente en el cotizador público de la landing page.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                          
                          {/* Rates sliders - LEFT */}
                          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg space-y-6">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-200 pb-2">Controles de Margen Tarifario Fijos en Q</span>
                            
                            {/* Standard Service Base Rate */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>TARIFA BASE ESTÁNDAR</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.baseEstandar}</span>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="100"
                                step="5"
                                value={ratesSettings.baseEstandar}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, baseEstandar: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>

                            {/* Express Service Base Rate */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>TARIFA BASE EXPRESS (24h)</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.baseExpress}</span>
                              </div>
                              <input
                                type="range"
                                min="20"
                                max="200"
                                step="5"
                                value={ratesSettings.baseExpress}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, baseExpress: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>

                            {/* Additional Weight standard */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>COSTO POR LB EXTRA ESTÁNDAR</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.pesoEstandar} / Lb</span>
                              </div>
                              <input
                                type="range"
                                min="1"
                                max="20"
                                step="1"
                                value={ratesSettings.pesoEstandar}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, pesoEstandar: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>

                            {/* Additional Weight express */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>COSTO POR LB EXTRA EXPRESS</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.pesoExpress} / Lb</span>
                              </div>
                              <input
                                type="range"
                                min="2"
                                max="40"
                                step="1"
                                value={ratesSettings.pesoExpress}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, pesoExpress: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>

                            {/* Laredo Hub Tariff */}
                            <div className="space-y-2 border-t border-gray-200 pt-4">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>TARIFA IMPORTACIÓN LAREDO (USA)</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.laredoRate} / Lb</span>
                              </div>
                              <input
                                type="range"
                                min="10"
                                max="150"
                                step="5"
                                value={ratesSettings.laredoRate}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, laredoRate: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>

                            {/* Mexico Hub Tariff */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>TARIFA IMPORTACIÓN MÉXICO (MX)</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.mexicoRate} / Lb</span>
                              </div>
                              <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={ratesSettings.mexicoRate}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, mexicoRate: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>

                            {/* Shein Packages Tariff */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-3xs font-bold text-brand-gray-dark">
                                <span>TARIFA BOLSA SHEIN (TARIFA PLANA)</span>
                                <span className="text-brand-orange font-mono">Q {ratesSettings.sheinRate} / Bolsa</span>
                              </div>
                              <input
                                type="range"
                                min="5"
                                max="100"
                                step="5"
                                value={ratesSettings.sheinRate}
                                onChange={(e) => setRatesSettings(prev => ({ ...prev, sheinRate: Number(e.target.value) }))}
                                className="w-full accent-brand-orange cursor-pointer"
                              />
                            </div>
                          </div>

                          {/* Quick interactive calculator preview - RIGHT */}
                          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-200 pb-2">🎯 SIMULADOR CON TARIFAS LIVE</span>
                            
                            <div className="space-y-4 text-3xs text-gray-600">
                              <p className="font-semibold text-gray-600">Fletes estimados calculados dinámicamente en tiempo real:</p>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Card 1: Laredo USA */}
                                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1 font-mono hover:shadow-xs transition active-accent-border">
                                  <div className="text-[9px] text-gray-400 uppercase font-black">Laredo USA (5 Lbs)</div>
                                  <div className="text-sm font-black text-brand-orange">
                                    Q {(5 * ratesSettings.laredoRate).toFixed(2)}
                                  </div>
                                  <div className="text-[8px] text-gray-500 font-semibold font-sans leading-none">
                                    5 Lbs x Q {ratesSettings.laredoRate}
                                  </div>
                                </div>

                                {/* Card 2: México */}
                                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1 font-mono hover:shadow-xs transition active-accent-border">
                                  <div className="text-[9px] text-gray-400 uppercase font-black">México (5 Lbs)</div>
                                  <div className="text-sm font-black text-brand-orange">
                                    Q {(5 * ratesSettings.mexicoRate).toFixed(2)}
                                  </div>
                                  <div className="text-[8px] text-gray-500 font-semibold font-sans leading-none">
                                    5 Lbs x Q {ratesSettings.mexicoRate}
                                  </div>
                                </div>

                                {/* Card 3: Bolsa Shein */}
                                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1 font-mono hover:shadow-xs transition active-accent-border">
                                  <div className="text-[9px] text-gray-400 uppercase font-black">Bolsa Shein (1 Bolsa)</div>
                                  <div className="text-sm font-black text-brand-orange">
                                    Q {ratesSettings.sheinRate.toFixed(2)}
                                  </div>
                                  <div className="text-[8px] text-gray-500 font-semibold font-sans leading-none">
                                    Tarifa Fija Q {ratesSettings.sheinRate}
                                  </div>
                                </div>

                                {/* Card 4: Local Express */}
                                <div className="bg-white border border-gray-200 rounded-lg p-3 text-center space-y-1 font-mono hover:shadow-xs transition active-accent-border">
                                  <div className="text-[9px] text-gray-400 uppercase font-black">Local Express (5 Lbs)</div>
                                  <div className="text-sm font-black text-brand-orange">
                                    Q {(ratesSettings.baseExpress + (5 * ratesSettings.pesoExpress)).toFixed(2)}
                                  </div>
                                  <div className="text-[8px] text-gray-500 font-semibold font-sans leading-none">
                                    Base Q{ratesSettings.baseExpress} + 5 Lbs x Q{ratesSettings.pesoExpress}
                                  </div>
                                </div>
                              </div>

                              <p className="text-4xs italic text-gray-400 leading-normal pt-2 border-t border-gray-200">
                                *Nota Comercial: Al cambiar los parámetros comerciales con los sliders de la izquierda, la landing page y el cotizador de casilleros de los clientes se reprogramarán instantáneamente en tiempo real.
                              </p>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* ==================== 15. AJUSTES DE SISTEMA (`ajustes`) ==================== */}
                    {adminSubTab === 'ajustes' && (
                      <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-2xs space-y-6">
                        <div>
                          <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">⚙️ Ajustes Generales del Sistema Logístico</h3>
                          <p className="text-4xs text-gray-500">Configure los parámetros técnicos meta del Hub digital. Ajuste tiempos, active módulos experimentales y bloquee el registro de casilleros automatizado.</p>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                          
                          {/* System settings form */}
                          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-200 pb-2">Parámetros Operativos Generales</span>
                            
                            <div className="space-y-3">
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Oficial del Portal / Site</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  value={systemSettings.siteName}
                                  onChange={(e) => setSystemSettings(prev => ({ ...prev, siteName: e.target.value }))}
                                />
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Prefijo Telefónico por Defecto</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-mono font-bold text-brand-orange"
                                  value={systemSettings.defaultPrefix}
                                  onChange={(e) => setSystemSettings(prev => ({ ...prev, defaultPrefix: e.target.value }))}
                                />
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Horario Operativo de Hubs</label>
                                <input
                                  type="text"
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold font-mono"
                                  value={systemSettings.operatingHours}
                                  onChange={(e) => setSystemSettings(prev => ({ ...prev, operatingHours: e.target.value }))}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Toggle toggles */}
                          <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg space-y-4">
                            <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-200 pb-2">Toggles de Seguridad y Pruebas</span>
                            
                            <div className="space-y-4">
                              {/* Toggle 1: self-reg */}
                              <div className="flex justify-between items-center text-3xs">
                                <div>
                                  <strong className="text-brand-gray-dark block">Permitir Auto-Registro de Clientes</strong>
                                  <span className="text-gray-400 text-4xs block">Habilita la pestaña de creación de casilleros</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={systemSettings.allowSelfRegistration}
                                  onChange={(e) => setSystemSettings(prev => ({ ...prev, allowSelfRegistration: e.target.checked }))}
                                  className="rounded border-gray-300 text-brand-orange focus:ring-brand-orange cursor-pointer h-4 w-4"
                                />
                              </div>

                              {/* Toggle 2: sandbox */}
                              <div className="flex justify-between items-center text-3xs">
                                <div>
                                  <strong className="text-brand-gray-dark block">Modo Sandbox de Demostración Activo</strong>
                                  <span className="text-gray-400 text-4xs block">Simula transiciones de rastreo automáticas</span>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={systemSettings.sandboxMode}
                                  onChange={(e) => setSystemSettings(prev => ({ ...prev, sandboxMode: e.target.checked }))}
                                  className="rounded border-gray-300 text-brand-orange focus:ring-brand-orange cursor-pointer h-4 w-4"
                                />
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                  </div>

                  {/* ==================== CREATE NEW SHIPMENT MODAL (OVERLAY DUAL-MODE) ==================== */}
                  {newShipmentModal && (
                    <div className="fixed inset-0 bg-brand-gray-dark/60 backdrop-blur-xs flex justify-center items-center z-40 p-4">
                      <div className={`bg-white w-full rounded-lg border border-gray-200 shadow-2xl overflow-hidden animate-zoom-in transition-all duration-300 ${newShipmentModalMode === 'bulk' ? 'max-w-6xl' : 'max-w-lg'}`}>
                        
                        {/* Widescreen Professional Dual-Mode Header with Tabs */}
                        <div className="bg-brand-gray-dark text-white px-4 py-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-gray-800 shrink-0">
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4 text-brand-orange animate-pulse" />
                            <h4 className="text-2xs font-extrabold uppercase tracking-wider font-display">
                              {newShipmentModalMode === 'bulk' ? 'Ingreso de Despachos por Lote' : 'Ingresar Nuevo Envío Individual'}
                            </h4>
                          </div>
                          
                          <div className="flex items-center gap-1 bg-gray-900 p-0.5 rounded border border-gray-800">
                            <button
                              type="button"
                              onClick={() => setNewShipmentModalMode('individual')}
                              className={`px-3 py-1 text-4xs font-bold rounded uppercase tracking-wider transition cursor-pointer ${newShipmentModalMode === 'individual' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                              Individual
                            </button>
                            <button
                              type="button"
                              onClick={() => setNewShipmentModalMode('bulk')}
                              className={`px-3 py-1 text-4xs font-bold rounded uppercase tracking-wider transition cursor-pointer ${newShipmentModalMode === 'bulk' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white'}`}
                            >
                              Multi-Entry (Lote Rápido) ⚡
                            </button>
                          </div>

                          <button 
                            onClick={() => setNewShipmentModal(false)}
                            className="text-gray-400 hover:text-white font-black text-xs cursor-pointer"
                          >
                            &times;
                          </button>
                        </div>

                        {/* MODE 1: INDIVIDUAL ENTRY PANEL */}
                        {newShipmentModalMode === 'individual' && (
                          <form onSubmit={handleAdminCreateShipment} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Remitente *</label>
                                <input
                                  type="text"
                                  required
                                  value={adminSender}
                                  onChange={(e) => setAdminSender(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange font-semibold text-brand-gray-dark"
                                  placeholder="Empresa remitente"
                                />
                              </div>
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Contacto Consignatario *</label>
                                <input
                                  type="text"
                                  required
                                  value={adminReceiver}
                                  onChange={(e) => setAdminReceiver(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange font-semibold text-brand-gray-dark"
                                  placeholder="Persona destino"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Asignar Casillero de Cliente *</label>
                                <select
                                  value={adminLockerLink}
                                  onChange={(e) => setAdminLockerLink(e.target.value)}
                                  className="w-full px-2 py-1.5 text-3xs border border-gray-300 rounded bg-white font-mono text-brand-orange font-bold focus:ring-1 focus:ring-brand-orange"
                                >
                                  {users.filter(u => u.role === 'client').map(u => (
                                    <option key={u.lockerId} value={u.lockerId}>{u.lockerId} — {u.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dimensiones</label>
                                <input
                                  type="text"
                                  required
                                  value={adminDimensions}
                                  onChange={(e) => setAdminDimensions(e.target.value)}
                                  className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  placeholder="30x20x20 cm"
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
                                  className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
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
                                  className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  placeholder="Ciudad Destino"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio</label>
                                <select
                                  value={adminService}
                                  onChange={(e) => setAdminService(e.target.value as any)}
                                  className="w-full px-2 py-1.5 text-3xs border border-gray-300 rounded bg-white font-semibold"
                                >
                                  <option value="Express">Express</option>
                                  <option value="Estándar">Estándar</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Peso Físico (Lbs)</label>
                                <input
                                  type="number"
                                  min="1"
                                  required
                                  value={adminWeight}
                                  onChange={(e) => setAdminWeight(Number(e.target.value))}
                                  className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded font-semibold font-mono"
                                />
                              </div>
                            </div>

                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Observaciones Especiales</label>
                              <textarea
                                value={adminNotes}
                                onChange={(e) => setAdminNotes(e.target.value)}
                                rows={2}
                                className="w-full px-2.5 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                placeholder="Frágil, no apilar..."
                              />
                            </div>

                            <div className="pt-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setNewShipmentModal(false)}
                                className="px-4 py-2 text-3xs border border-gray-300 rounded font-bold uppercase hover:bg-gray-100 cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                className="px-5 py-2 text-3xs bg-brand-orange hover:bg-brand-orange-hover text-white rounded font-bold uppercase cursor-pointer"
                              >
                                Crear Despacho
                              </button>
                            </div>
                          </form>
                        )}

                        {/* MODE 2: MULTI-ENTRY (BULK) PANEL */}
                        {newShipmentModalMode === 'bulk' && (
                          <div className="p-6 space-y-4 flex flex-col max-h-[80vh]">
                            
                            {/* Widescreen Top-Row Title and Toolbelt */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                              <div>
                                <h2 className="text-base font-black text-brand-gray-dark font-display leading-none tracking-tight">Multi-Entry (Bulk)</h2>
                                <p className="text-4xs text-gray-500 font-bold uppercase mt-1">Ingreso secuencial rápido y tabulado.</p>
                              </div>

                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                {/* Auto-Save Switch toggler */}
                                <button
                                  type="button"
                                  onClick={() => setBulkAutoSave(!bulkAutoSave)}
                                  className={`px-3 py-1.5 text-4xs font-bold rounded-md border flex items-center gap-1.5 transition cursor-pointer ${
                                    bulkAutoSave 
                                      ? 'bg-green-50 border-green-300 text-green-700 font-extrabold shadow-2xs' 
                                      : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <FileText className="h-3.5 w-3.5" />
                                  Auto-Save {bulkAutoSave ? 'ON' : 'OFF'}
                                </button>

                                {/* Guardar Todos purple button */}
                                <button
                                  type="button"
                                  onClick={saveAllBulkRows}
                                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-4xs font-bold px-4 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer transition shadow-xs uppercase tracking-wider font-display"
                                >
                                  <FileSpreadsheet className="h-3.5 w-3.5" />
                                  Guardar Todos
                                </button>

                                {/* + Añadir Fila white button */}
                                <button
                                  type="button"
                                  onClick={addBulkRow}
                                  className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-4xs font-bold px-4 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer transition uppercase"
                                >
                                  <Plus className="h-3.5 w-3.5 text-gray-500" />
                                  Añadir Fila
                                </button>
                              </div>
                            </div>

                            {/* Main Spreadsheet Grid Container */}
                            <div className="flex-1 overflow-y-auto border border-gray-200 rounded-lg shadow-2xs min-h-[250px] bg-gray-50/50">
                              <table className="w-full text-left border-collapse table-fixed">
                                <thead>
                                  <tr className="bg-gray-100 border-b border-gray-200 text-4xs font-extrabold text-gray-500 uppercase tracking-wider sticky top-0 z-10">
                                    <th className="py-2.5 px-3 w-10 text-center">#</th>
                                    <th className="py-2.5 px-2 w-36">BODEGA</th>
                                    <th className="py-2.5 px-2 w-48">TRACKING NUMBER *</th>
                                    <th className="py-2.5 px-2 w-64">CLIENTE / LOCKER *</th>
                                    <th className="py-2.5 px-2 w-28 text-right">PESO (LBS)</th>
                                    <th className="py-2.5 px-2 w-20 text-center">PZAS</th>
                                    <th className="py-2.5 px-2 w-20 text-center">SHEIN?</th>
                                    <th className="py-2.5 px-3 w-44 text-center">ACCIONES</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                  {bulkRows.map((row, index) => {
                                    const searchVal = row.lockerId;
                                    const matchingClients = users.filter(u => 
                                      u.role === 'client' && 
                                      (u.lockerId.toLowerCase().includes(searchVal.toLowerCase()) || 
                                       u.name.toLowerCase().includes(searchVal.toLowerCase()))
                                    );

                                    return (
                                      <tr 
                                        key={row.id} 
                                        className={`hover:bg-gray-50/40 transition-all ${row.saved ? 'bg-green-50/30' : ''}`}
                                      >
                                        {/* 1. Index */}
                                        <td className="py-2 px-3 text-center font-bold text-gray-400">{index + 1}</td>

                                        {/* 2. Bodega dropdown */}
                                        <td className="py-2 px-2">
                                          <select
                                            value={row.bodega}
                                            disabled={row.saved}
                                            onChange={(e) => updateBulkRow(row.id, 'bodega', e.target.value)}
                                            className="w-full px-2 py-1 text-3xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                                          >
                                            <option value="Laredo">Laredo 🇺🇸</option>
                                            <option value="Mexico">México 🇲🇽</option>
                                          </select>
                                        </td>

                                        {/* 3. Tracking Number */}
                                        <td className="py-2 px-2">
                                          <input
                                            type="text"
                                            required
                                            id={`bulk-tracking-${index}`}
                                            placeholder="ESCRIBE..."
                                            value={row.trackingNumber}
                                            disabled={row.saved}
                                            onChange={(e) => updateBulkRow(row.id, 'trackingNumber', e.target.value.toUpperCase())}
                                            onKeyDown={(e) => handleKeyDownOnRow(e, index, row.id)}
                                            className="w-full px-2.5 py-1 text-3xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                                          />
                                        </td>

                                        {/* 4. Locker search autocomplete input */}
                                        <td className="py-2 px-2 relative">
                                          <div className="relative">
                                            <input
                                              type="text"
                                              required
                                              id={`bulk-locker-${index}`}
                                              placeholder="Buscar por nombre, apellido o SFG..."
                                              value={row.lockerId}
                                              disabled={row.saved}
                                              onFocus={() => setActiveAutocompleteRow(row.id)}
                                              onChange={(e) => {
                                                updateBulkRow(row.id, 'lockerId', e.target.value);
                                                setActiveAutocompleteRow(row.id);
                                              }}
                                              onKeyDown={(e) => handleKeyDownOnRow(e, index, row.id)}
                                              className="w-full pl-6 pr-2 py-1 text-3xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                                            />
                                            <Search className="h-3 w-3 text-gray-400 absolute left-2 top-2" />
                                          </div>

                                          {/* Floating suggestions dropdown popup */}
                                          {activeAutocompleteRow === row.id && !row.saved && searchVal.trim() !== '' && (
                                            <div className="absolute left-2 right-2 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-36 overflow-y-auto z-20 divide-y divide-gray-100">
                                              {matchingClients.map(client => (
                                                <button
                                                  key={client.lockerId}
                                                  type="button"
                                                  onClick={() => {
                                                    updateBulkRow(row.id, 'lockerId', client.lockerId);
                                                    setActiveAutocompleteRow(null);
                                                  }}
                                                  className="w-full text-left px-3 py-1.5 hover:bg-indigo-50 font-sans text-3xs transition flex justify-between items-center cursor-pointer"
                                                >
                                                  <div>
                                                    <span className="font-bold text-indigo-600 font-mono">{client.lockerId}</span>
                                                    <span className="text-brand-gray-dark ml-2">{client.name}</span>
                                                  </div>
                                                  <span className="text-gray-400 text-4xs italic">{client.address.split(',')[0]}</span>
                                                </button>
                                              ))}
                                              {matchingClients.length === 0 && (
                                                <div className="px-3 py-2 text-center text-gray-400 text-4xs font-medium">
                                                  Sin coincidencias registradas
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </td>

                                        {/* 5. Peso (LBS) */}
                                        <td className="py-2 px-2">
                                          <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            required
                                            id={`bulk-weight-${index}`}
                                            value={row.weight === 0 ? '' : row.weight}
                                            disabled={row.saved}
                                            placeholder="0.00"
                                            onChange={(e) => updateBulkRow(row.id, 'weight', Number(e.target.value))}
                                            onKeyDown={(e) => handleKeyDownOnRow(e, index, row.id)}
                                            className="w-full px-2 py-1 text-3xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono text-right disabled:opacity-60 disabled:cursor-not-allowed"
                                          />
                                        </td>

                                        {/* 6. Piezas */}
                                        <td className="py-2 px-2">
                                          <input
                                            type="number"
                                            min="1"
                                            required
                                            id={`bulk-pieces-${index}`}
                                            value={row.pieces}
                                            disabled={row.saved}
                                            onChange={(e) => updateBulkRow(row.id, 'pieces', Number(e.target.value))}
                                            onKeyDown={(e) => handleKeyDownOnRow(e, index, row.id)}
                                            className="w-full px-2 py-1 text-3xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold font-mono text-center disabled:opacity-60 disabled:cursor-not-allowed"
                                          />
                                        </td>

                                        {/* 7. Shein Checkbox */}
                                        <td className="py-2 px-2 text-center">
                                          <input
                                            type="checkbox"
                                            checked={!!row.isShein}
                                            disabled={row.saved}
                                            onChange={(e) => updateBulkRow(row.id, 'isShein', e.target.checked)}
                                            className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed mx-auto"
                                          />
                                        </td>

                                        {/* 8. Acciones */}
                                        <td className="py-2 px-3 text-center flex items-center justify-center gap-1">
                                          {row.saved ? (
                                            <span className="bg-green-100 text-green-800 text-[9px] font-extrabold px-2.5 py-0.5 rounded flex items-center gap-1 select-none border border-green-200">
                                              <Check className="h-3 w-3 text-green-600 font-black" />
                                              Guardado
                                            </span>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => saveBulkRow(row.id)}
                                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[9px] font-extrabold px-2.5 py-1 rounded flex items-center gap-1 transition cursor-pointer uppercase shadow-3xs"
                                            >
                                              <FileText className="h-3 w-3" />
                                              Guardar
                                            </button>
                                          )}

                                          {/* Imprimir simulated thermal sticker button */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const matchedClient = users.find(u => u.lockerId.toUpperCase() === row.lockerId.toUpperCase().trim());
                                              setBulkPrintSticker({
                                                id: row.saved ? (shipments.find(s => s.notes?.includes(row.trackingNumber))?.id || 'SF-MOCK-GT') : 'SF-PEND-GT',
                                                trackingNumber: row.trackingNumber || 'PENDIENTE',
                                                lockerId: row.lockerId.toUpperCase() || 'SFG0',
                                                receiverName: matchedClient ? matchedClient.name : 'Consignatario General',
                                                bodega: row.bodega,
                                                weightLbs: row.weight || 0.0,
                                                pieces: row.pieces || 1,
                                                destination: matchedClient ? matchedClient.address : 'Guatemala Central'
                                              });
                                            }}
                                            className="border border-gray-300 hover:border-gray-400 hover:bg-gray-100 text-gray-500 p-1 rounded-md transition cursor-pointer"
                                            title="Imprimir Etiqueta Térmica"
                                          >
                                            <Printer className="h-3.5 w-3.5" />
                                          </button>

                                          {/* Delete row button */}
                                          <button
                                            type="button"
                                            onClick={() => deleteBulkRow(row.id)}
                                            className="border border-red-200 hover:border-red-300 hover:bg-red-50 text-red-500 p-1 rounded-md transition cursor-pointer"
                                            title="Eliminar Fila"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>

                            {/* Table footer guides matching image 2 */}
                            <div className="bg-gray-50 border border-gray-200 p-3 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0 select-none">
                              <div className="text-3xs font-extrabold text-gray-500">
                                <span className="font-black text-brand-gray-dark">{bulkRows.length} fila(s)</span> &mdash;{' '}
                                <span className="font-black text-green-600">{bulkRows.filter(r => r.saved).length} guardado(s)</span>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-gray-400 font-extrabold uppercase tracking-wide">
                                <div className="flex items-center gap-1">
                                  <kbd className="bg-white border border-gray-300 text-brand-gray-dark px-1.5 py-0.5 rounded shadow-3xs font-mono font-black text-[9px] uppercase">Tab</kbd>
                                  <span>navegar naturalmente</span>
                                </div>
                                <span>&bull;</span>
                                <div className="flex items-center gap-1">
                                  <kbd className="bg-white border border-gray-300 text-brand-gray-dark px-1.5 py-0.5 rounded shadow-3xs font-mono font-black text-[9px] uppercase">Enter</kbd>
                                  <span>salto rápido (y Auto-Save)</span>
                                </div>
                              </div>
                            </div>

                            {/* Modal Close control */}
                            <div className="pt-2 border-t border-gray-100 flex justify-end gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => setNewShipmentModal(false)}
                                className="px-5 py-2 text-3xs border border-gray-300 rounded font-black uppercase hover:bg-gray-100 cursor-pointer text-brand-gray-dark"
                              >
                                Cerrar Portal de Lotes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              );
            })()}

            {/* ==================== ADMIN: DRIVER PORTAL TERMINAL TAB ==================== */}
            {currentUser.role === 'admin' && activeTab === 'driver-terminal' && (
              <div className="flex justify-center items-start flex-1 min-h-0 py-4">
                
                {/* Mobile device frame casing */}
                <div className="w-full max-w-sm bg-brand-gray-dark p-3 rounded-[36px] shadow-2xl border-4 border-gray-700 flex flex-col my-auto animate-zoom-in" style={{ height: '600px' }}>
                  
                  {/* Screen viewport */}
                  <div className="bg-gray-100 flex-1 rounded-[28px] overflow-hidden flex flex-col relative">
                    
                    {/* Status bar */}
                    <div className="bg-brand-gray-dark px-6 py-1 flex justify-between text-white text-2xs font-bold shrink-0 tracking-widest">
                      <span>SHIPFAST MOBILE</span>
                      <span>08:45 AM</span>
                    </div>

                    {/* App Header */}
                    <div className="bg-brand-gray-dark/95 text-white p-4 flex justify-between items-center border-b border-gray-800 shrink-0">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-brand-orange" />
                        <span className="text-xs font-bold tracking-wide">OPERADOR: M-412</span>
                      </div>
                      <span className="bg-brand-orange text-white text-3xs px-2 py-0.5 font-bold rounded">ONLINE</span>
                    </div>

                    {/* Task cards sheet list */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                      <div className="px-1 pt-1 flex justify-between items-center">
                        <span className="text-2xs font-extrabold text-gray-500 uppercase tracking-wider">Hojas de Ruta de Hoy</span>
                        <span className="bg-gray-300 text-brand-gray-dark text-3xs px-2 py-0.5 rounded-full font-bold">
                          {shipments.filter(s => s.status !== 'Entregado').length} Pendientes
                        </span>
                      </div>

                      {shipments.map(s => {
                        const isEntregado = s.status === 'Entregado';
                        if (isEntregado) return null;

                        return (
                          <div key={s.id} className="bg-white rounded-lg border border-gray-200 shadow-2xs p-3.5 space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="text-xs font-extrabold text-brand-gray-dark block tracking-tight">{s.id}</span>
                                <span className="text-3xs font-semibold text-gray-400 uppercase tracking-tight block">
                                  Casillero: {s.lockerId} | {s.serviceType}
                                </span>
                              </div>
                              <span className={`text-4xs px-2 py-0.5 font-extrabold rounded-full uppercase border ${
                                s.status === 'Retrasado' 
                                  ? 'bg-red-50 border-red-200 text-red-800 font-extrabold' 
                                  : 'bg-blue-50 border-blue-200 text-blue-800'
                              }`}>
                                {s.status}
                              </span>
                            </div>

                            <div className="space-y-0.5 text-3xs text-gray-600">
                              <div className="truncate"><strong>DE:</strong> {s.sender}</div>
                              <div className="line-clamp-2"><strong>A:</strong> {s.destination}</div>
                            </div>

                            <div className="pt-2 border-t border-gray-100 flex justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  const currentDate = new Date().toISOString().split('T')[0];
                                  const currentTime = new Date().toTimeString().split(' ')[0].substring(0, 5);

                                  const updatedShip = {
                                    ...s,
                                    status: 'En Ruta' as const,
                                    lastUpdated: `${currentDate} ${currentTime}`,
                                    history: [
                                      {
                                        date: currentDate,
                                        time: currentTime,
                                        status: 'En Ruta' as const,
                                        location: s.destination.split(',')[0],
                                        details: 'Unidad de reparto local iniciada en la zona asignada.'
                                      },
                                      ...s.history
                                    ]
                                  };

                                  // Save to Supabase
                                  db.upsertShipment(updatedShip);

                                  setShipments(prev => prev.map(ship => {
                                    if (ship.id === s.id) {
                                      return updatedShip;
                                    }
                                    return ship;
                                  }));
                                  alert('Envío marcado: En Ruta de Entrega.');
                                }}
                                disabled={s.status === 'En Ruta'}
                                className={`px-2.5 py-1 text-4xs font-bold rounded uppercase tracking-wider transition ${
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
                                className="bg-brand-orange hover:bg-brand-orange-hover text-white px-2.5 py-1 text-4xs font-bold rounded uppercase tracking-wider transition cursor-pointer"
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

                    {/* Bottom footer */}
                    <div className="bg-brand-gray-dark text-center py-2.5 text-white text-3xs font-semibold shrink-0">
                      SISTEMA REPARTIDOR CENTRAL
                    </div>

                    {/* Digital Signature Overlay */}
                    {activeDriverTaskId && (
                      <div className="absolute inset-0 bg-brand-gray-dark/80 backdrop-blur-xs flex items-end z-20">
                        <div className="bg-white w-full rounded-t-2xl p-5 space-y-4 shadow-xl border-t-2 border-brand-orange">
                          
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
                                placeholder="Ingrese nombre"
                                value={signeeName}
                                onChange={(e) => setSigneeName(e.target.value)}
                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
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
                                  height="100"
                                  className="w-full cursor-crosshair touch-none"
                                />
                              </div>
                              <p className="text-4xs text-gray-400 mt-1">Dibuje con el dedo o mouse sobre el lienzo.</p>
                            </div>
                          </div>

                          <button
                            onClick={handleDriverDeliveryConfirm}
                            className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2 rounded transition uppercase tracking-wider cursor-pointer"
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

            {/* ==================== ADMIN: AI CHAT TAB ==================== */}
            {currentUser.role === 'admin' && activeTab === 'ai-chat' && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-xs flex flex-col flex-1 min-h-0 max-h-[600px] overflow-hidden">
                <div className="bg-brand-gray-dark text-white p-4 border-b border-gray-800 flex justify-between items-center shrink-0">
                  <div className="flex items-center space-x-2">
                    <Sparkles className="h-5 w-5 text-brand-orange animate-pulse" />
                    <div>
                      <h3 className="text-xs font-bold tracking-wider font-display uppercase">Centro de Despacho Inteligente</h3>
                      <p className="text-4xs text-gray-400 font-semibold uppercase">Simulador de Control de Rutas por IA (Gemini Model)</p>
                    </div>
                  </div>
                  <span className="bg-brand-orange text-white text-4xs px-2.5 py-0.5 font-bold rounded">AI AGENT</span>
                </div>

                {/* Quick actions panel */}
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

                {/* Chat conversation */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
                  {aiChat.map((msg, idx) => {
                    const isAI = msg.sender === 'ai';
                    return (
                      <div key={idx} className={`flex ${isAI ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                        <div className={`max-w-xl rounded-lg p-3.5 shadow-2xs text-xs leading-relaxed space-y-1 ${
                          isAI 
                            ? 'bg-white border border-gray-200 text-brand-gray-dark active-accent-border' 
                            : 'bg-brand-gray-dark text-white'
                        }`}>
                          <div className="flex justify-between items-center text-4xs font-bold text-gray-400 mb-1">
                            <span className="uppercase tracking-wider">{isAI ? 'Despacho Inteligente IA' : 'Operador Central'}</span>
                            <span>{msg.timestamp}</span>
                          </div>
                          
                          <div className="space-y-2 whitespace-pre-wrap">
                            {msg.text.split('\n').map((line, lIdx) => {
                              if (line.startsWith('**') && line.endsWith('**')) {
                                return <h4 key={lIdx} className="font-extrabold text-brand-gray-dark pt-1 first:pt-0 uppercase tracking-wider text-2xs">{line.replace(/\*\*/g, '')}</h4>;
                              }
                              if (line.startsWith('- **') || line.startsWith('* **')) {
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
                        <span className="text-gray-500 font-bold uppercase tracking-wider">Despachador analizando coordenadas...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input query send form */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white flex gap-2 shrink-0">
                  <input
                    type="text"
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Preguntar sobre despachos, carreteras o desempeño del Hub..."
                    className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
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

          {/* ==================== ZEBRA GK420d THERMAL PRINTER SIMULATOR ==================== */}
          {bulkPrintSticker && (
            <div className="fixed inset-0 bg-brand-gray-dark/85 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
              <div className="bg-white rounded-xl shadow-2xl border border-gray-200 max-w-sm w-full p-6 animate-zoom-in flex flex-col gap-4">
                
                {/* Simulator Header */}
                <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Printer className="h-5 w-5 text-indigo-600 animate-pulse" />
                      <span className="absolute -top-1 -right-1 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                      </span>
                    </div>
                    <div>
                      <h4 className="text-2xs font-extrabold uppercase tracking-wide text-brand-gray-dark font-sans leading-none">
                        Zebra GK420d
                      </h4>
                      <span className="text-[9px] font-extrabold text-green-600 uppercase tracking-widest">
                        Online (USB001)
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={isPrinting}
                    onClick={() => setBulkPrintSticker(null)}
                    className="text-gray-400 hover:text-gray-600 font-bold text-xs p-1 rounded-full hover:bg-gray-100 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* The 4x6 Thermal Label Container */}
                <div className="relative overflow-hidden flex justify-center bg-gray-100 p-4 rounded-lg border border-gray-200 shadow-inner">
                  
                  {/* Sticker itself */}
                  <div className="w-[260px] bg-white border-[3px] border-black p-3.5 font-mono text-black select-none flex flex-col justify-between rounded-none shadow-md aspect-[4/6] relative">
                    
                    {/* Zebra physical scan line simulator during printing */}
                    {isPrinting && !printSuccess && (
                      <div className="absolute left-0 right-0 h-1 bg-red-500/80 animate-bounce z-10"></div>
                    )}

                    {/* Logo & Header */}
                    <div className="flex justify-between items-center border-b-[2px] border-black pb-1.5">
                      <span className="text-[14px] font-black tracking-widest font-sans uppercase">SHIPFAST GT</span>
                      <span className="text-[9px] font-black border border-black px-1.5 py-0.5 uppercase">INTL</span>
                    </div>

                    {/* Route Box */}
                    <div className="border-b-[2px] border-black py-1.5 flex flex-col">
                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-wide">ORIGEN: {bulkPrintSticker.bodega?.toUpperCase() || 'MIAMI HUB'}</span>
                      <span className="text-[12px] font-black uppercase text-center bg-black text-white py-0.5 tracking-wider mt-1 rounded-2xs">
                        {(() => {
                          const dest = bulkPrintSticker.destination ? bulkPrintSticker.destination.toLowerCase() : '';
                          if (dest.includes('xela') || dest.includes('quetzaltenango') || dest.includes('san marcos') || dest.includes('hueh') || dest.includes('solola') || dest.includes('totonicapan')) {
                            return 'OCCIDENTE - HUB XELA';
                          }
                          if (dest.includes('zacapa') || dest.includes('chiquimula') || dest.includes('izabal') || dest.includes('progreso') || dest.includes('oriente') || dest.includes('jutiapa') || dest.includes('jalapa')) {
                            return 'ORIENTE - HUB CHIQUIMULA';
                          }
                          if (dest.includes('coban') || dest.includes('verapaz') || dest.includes('norte') || dest.includes('peten')) {
                            return 'NORTE - HUB COBÁN';
                          }
                          if (dest.includes('escuintla') || dest.includes('suchi') || dest.includes('retalhuleu') || dest.includes('reus') || dest.includes('sur') || dest.includes('santa rosa')) {
                            return 'SUR - HUB ESCUINTLA';
                          }
                          return 'METRO - HUB CENTRAL';
                        })()}
                      </span>
                    </div>

                    {/* Locker & Destination Block */}
                    <div className="border-b-[2px] border-black py-2 flex flex-col gap-1">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">CASILLERO:</span>
                        <span className="text-[20px] font-black text-black tracking-widest">{bulkPrintSticker.lockerId}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">CONSIGNATARIO:</span>
                        <span className="text-[10px] font-black text-black truncate uppercase leading-tight mt-0.5">{bulkPrintSticker.receiverName}</span>
                      </div>
                    </div>

                    {/* Weights & Dimensions Block */}
                    <div className="border-b-[2px] border-black py-2 grid grid-cols-2 gap-2 text-center">
                      <div className="border-r border-black flex flex-col justify-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">PESO TOTAL</span>
                        <span className="text-[13px] font-black text-black mt-0.5 leading-none">
                          {bulkPrintSticker.weightLbs ? bulkPrintSticker.weightLbs.toFixed(2) : '0.00'} LBS
                        </span>
                        <span className="text-[9px] font-medium text-gray-400 mt-0.5">
                          EXCLUSIVO LIBRAS (LBS)
                        </span>
                      </div>
                      <div className="flex flex-col justify-center">
                        <span className="text-[8px] font-bold text-gray-500 uppercase">BULTOS / PZAS</span>
                        <span className="text-[15px] font-black text-black mt-0.5 leading-none">
                          {bulkPrintSticker.pieces || 1} / 1
                        </span>
                        <span className="text-[8px] font-bold text-gray-400 mt-1 uppercase">EXPRESS</span>
                      </div>
                    </div>

                    {/* Barcode Block */}
                    <div className="py-2.5 flex flex-col items-center gap-1">
                      {/* Barcode lines */}
                      <div className="h-10 w-full bg-white flex items-stretch px-1.5 select-none overflow-hidden">
                        <div className="w-[3px] bg-black mr-[1px]"></div>
                        <div className="w-[1px] bg-black mr-[2px]"></div>
                        <div className="w-[4px] bg-black mr-[1px]"></div>
                        <div className="w-[2px] bg-black mr-[3px]"></div>
                        <div className="w-[1px] bg-black mr-[1px]"></div>
                        <div className="w-[3px] bg-black mr-[2px]"></div>
                        <div className="w-[2px] bg-black mr-[1px]"></div>
                        <div className="w-[4px] bg-black mr-[2px]"></div>
                        <div className="w-[1px] bg-black mr-[1px]"></div>
                        <div className="w-[3px] bg-black mr-[3px]"></div>
                        <div className="w-[2px] bg-black mr-[1px]"></div>
                        <div className="w-[1px] bg-black mr-[2px]"></div>
                        <div className="w-[4px] bg-black mr-[1px]"></div>
                        <div className="w-[3px] bg-black mr-[2px]"></div>
                        <div className="w-[1px] bg-black mr-[1px]"></div>
                        <div className="w-[2px] bg-black mr-[3px]"></div>
                        <div className="w-[3px] bg-black mr-[1px]"></div>
                        <div className="w-[1px] bg-black mr-[2px]"></div>
                        <div className="w-[4px] bg-black mr-[1px]"></div>
                        <div className="w-[2px] bg-black mr-[1px]"></div>
                        <div className="w-[1px] bg-black mr-[3px]"></div>
                        <div className="w-[3px] bg-black mr-[1px]"></div>
                        <div className="w-[2px] bg-black mr-[2px]"></div>
                        <div className="w-[4px] bg-black mr-[1px]"></div>
                        <div className="w-[1px] bg-black mr-[1px]"></div>
                        <div className="w-[3px] bg-black mr-[2px]"></div>
                        <div className="w-[2px] bg-black mr-[1px]"></div>
                        <div className="w-[4px] bg-black mr-[2px]"></div>
                        <div className="w-[1px] bg-black mr-[1px]"></div>
                        <div className="w-[3px] bg-black mr-[3px]"></div>
                        <div className="w-[2px] bg-black mr-[1px]"></div>
                      </div>
                      <span className="text-[9px] font-black text-black tracking-widest leading-none font-mono">
                        {bulkPrintSticker.trackingNumber}
                      </span>
                    </div>

                    {/* Label Footer */}
                    <div className="border-t border-black pt-1 flex justify-between items-center text-[7px] font-bold text-gray-500">
                      <span>GUÍA: {bulkPrintSticker.id || 'PENDIENTE'}</span>
                      <span>2026-05-21 GT</span>
                    </div>

                  </div>
                </div>

                {/* Progress bar / Simulation feedback */}
                {isPrinting && (
                  <div className="w-full bg-gray-100 rounded-md p-3 border border-gray-200 flex flex-col gap-2">
                    <div className="flex justify-between items-center text-4xs font-extrabold uppercase text-indigo-700 tracking-wider">
                      <span>{printStatusText}</span>
                      <span>{printProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-300 ${printSuccess ? 'bg-green-500' : 'bg-indigo-600'}`}
                        style={{ width: `${printProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Actions / Interactive panel */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isPrinting}
                    onClick={() => setBulkPrintSticker(null)}
                    className="flex-1 py-2 text-3xs border border-gray-300 rounded font-black uppercase text-brand-gray-dark hover:bg-gray-50 cursor-pointer disabled:opacity-40 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isPrinting}
                    onClick={handleSimulatePrint}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-black uppercase text-3xs tracking-wider flex items-center justify-center gap-1 transition cursor-pointer disabled:opacity-55 shadow-xs"
                  >
                    {printSuccess ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 animate-bounce" />
                        ¡Impreso!
                      </>
                    ) : (
                      <>
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ==================== NUEVA PRE-ALERTA MANUAL CLIENT OVERLAY ==================== */}
          {isClientPreAlertModalOpen && (
            <div className="fixed inset-0 bg-brand-gray-dark/60 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
              <div className="bg-white w-full max-w-md rounded-2xl border border-gray-100 shadow-2xl p-6 relative animate-zoom-in transition-all duration-300 font-sans">
                
                {/* Close Button X */}
                <button
                  type="button"
                  onClick={() => setIsClientPreAlertModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer p-1 rounded-full hover:bg-gray-100 transition"
                >
                  <X className="h-4 w-4" />
                </button>

                {/* Header Section */}
                <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
                  <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl flex items-center justify-center w-11 h-11 border border-blue-100 animate-pulse">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-brand-gray-dark tracking-tight uppercase">Nueva Pre-Alerta Manual</h3>
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">Registrar una pre-alerta para tus paquetes</p>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleCreateClientPreAlert} className="space-y-4">
                  
                  {/* CLIENTE (CASILLERO) * */}
                  <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">CLIENTE (CASILLERO) *</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
                      <input
                        type="text"
                        disabled
                        value={`${currentUser.name} (Casillero: ${currentUser.lockerId})`}
                        className="w-full pl-9 pr-4 py-2 text-xs border border-yellow-400 bg-amber-50/20 text-gray-700 font-bold rounded-lg focus:outline-none cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* 2-Column fields: TRACKING and BODEGA */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">TRACKING *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1Z999AA10123456784"
                        value={clientPreAlertTracking}
                        onChange={(e) => setClientPreAlertTracking(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-mono font-bold text-brand-gray-dark placeholder-gray-300"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">BODEGA</label>
                      <select
                        value={clientPreAlertBodega}
                        onChange={(e) => setClientPreAlertBodega(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-semibold text-brand-gray-dark bg-white"
                      >
                        <option value="Sin bodega">Sin bodega</option>
                        <option value="Laredo">Laredo 🇺🇸</option>
                        <option value="Mexico">México 🇲🇽</option>
                      </select>
                    </div>
                  </div>

                  {/* 2-Column fields: VALOR DECLARADO and SEGURO */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">VALOR DECLARADO ($) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        min="0"
                        placeholder="0.00"
                        value={clientPreAlertValue}
                        onChange={(e) => setClientPreAlertValue(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-bold text-brand-gray-dark"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">SEGURO (5%)</label>
                      <select
                        value={clientPreAlertInsurance}
                        onChange={(e) => setClientPreAlertInsurance(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-bold text-brand-gray-dark bg-white text-center"
                      >
                        <option value="Sin seguro">Sin seguro</option>
                        <option value="Con seguro (5%)">Con seguro (5%)</option>
                      </select>
                    </div>
                  </div>

                  {/* FACTURA (IMAGEN O PDF) */}
                  <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">FACTURA (IMAGEN O PDF)</label>
                    <input
                      type="file"
                      id="clientPreAlertFile"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setClientPreAlertFileName(file.name);
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="clientPreAlertFile"
                      className="border-2 border-dashed border-gray-200 hover:border-indigo-400 bg-gray-50 hover:bg-indigo-50/10 rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
                    >
                      <UploadCloud className="h-6 w-6 text-gray-400 hover:text-indigo-500 transition-colors animate-bounce" />
                      <span className="text-[10px] font-bold text-gray-500 select-none">
                        {clientPreAlertFileName ? (
                          <span className="text-green-600 font-extrabold flex items-center justify-center gap-1">
                            ✓ {clientPreAlertFileName}
                          </span>
                        ) : (
                          'Click para subir factura'
                        )}
                      </span>
                    </label>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end gap-3 border-t border-gray-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setClientPreAlertFileName('');
                        setIsClientPreAlertModalOpen(false);
                      }}
                      className="px-5 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs py-2.5 px-5 rounded-lg flex items-center justify-center gap-2 shadow-md shadow-indigo-100 hover:shadow-indigo-200 active:scale-98 transition cursor-pointer"
                    >
                      <span className="inline-flex items-center justify-center border border-white/40 rounded-full p-0.5">
                        <Plus className="h-3 w-3" />
                      </span>
                      Crear Pre-Alerta
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}

          </main>

          {/* Authenticated Dashboard Footer */}
          <footer className="bg-brand-gray-dark text-gray-500 py-3.5 px-6 border-t border-gray-800 text-center text-4xs font-bold uppercase tracking-widest shrink-0">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
              <span>&copy; 2026 SHIPFAST LOGISTICS GUATEMALA. TODOS LOS DERECHOS RESERVADOS.</span>
              <div className="flex items-center gap-3">
                <span>CONEXIÓN CORPORATIVA TLS</span>
                <span>|</span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-brand-orange" />
                  SISTEMA ACTIVO SECURE
                </span>
              </div>
            </div>
          </footer>

        </div>
      )}

    </div>
  );
}
