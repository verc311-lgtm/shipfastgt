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
  PlusCircle,
  Share2,
  FileDown,
  Link,
  Copy
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
  declaredValue?: number;
  insurance?: string;
  invoiceFileName?: string;
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
    email: "info@shipfastgt.com",
    phone: "+502 2222-0000",
    address: "Hub Central, Guatemala",
    role: "admin",
    password: "admin"
  }
];

const INITIAL_PRE_ALERTS: PreAlert[] = [];

// Initial state data
const INITIAL_SHIPMENTS: Shipment[] = [];

function parseInvoiceConcept(conceptStr: string) {
  try {
    const trimmed = conceptStr ? conceptStr.trim() : '';
    if (trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      return {
        detail: parsed.detail || '',
        manualClientName: parsed.manualClientName || '',
        purchaseLink: parsed.purchaseLink || '',
        isManual: !!parsed.manualClientName
      };
    }
  } catch (e) {
    // Treat as raw text
  }
  return {
    detail: conceptStr || '',
    manualClientName: '',
    purchaseLink: '',
    isManual: false
  };
}

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
  const [quoteOrigin, setQuoteOrigin] = useState('Texas');
  const [quoteDestination, setQuoteDestination] = useState('Guatemala');

  const [quoteWeight, setQuoteWeight] = useState(1);
  const [quoteProductLink, setQuoteProductLink] = useState('');
  const [quoteProductPriceUsd, setQuoteProductPriceUsd] = useState<number | ''>('');
  const [quoteWhoPurchases, setQuoteWhoPurchases] = useState<'Nosotros' | 'Cliente'>('Nosotros');
  const [calculatedQuote, setCalculatedQuote] = useState<{
    base: number;
    weightCost: number;
    productPriceUsd?: number;
    productPriceQts?: number;
    taxesQts?: number;
    total: number;
    days: string;
    route: string;
    productLink?: string;
  } | null>(null);
  const [copyLinkSuccess, setCopyLinkSuccess] = useState(false);

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
  const [isAdminPreAlertModalOpen, setIsAdminPreAlertModalOpen] = useState(false);
  const [adminPreAlertLockerId, setAdminPreAlertLockerId] = useState('');
  const [clientPreAlertTracking, setClientPreAlertTracking] = useState('');
  const [clientPreAlertBodega, setClientPreAlertBodega] = useState('Sin bodega');
  const [clientPreAlertValue, setClientPreAlertValue] = useState('');
  const [clientPreAlertWeight, setClientPreAlertWeight] = useState('1.0');
  const [clientPreAlertInsurance, setClientPreAlertInsurance] = useState('Sin seguro');
  const [clientPreAlertFileName, setClientPreAlertFileName] = useState('');
  const [activeWarehouseModal, setActiveWarehouseModal] = useState<'USA' | 'MEX' | null>(null);

  // Selected User for Details and Password/Address Edit
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserProfile | null>(null);

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
  const [invoiceUnregistered, setInvoiceUnregistered] = useState(false);
  const [invoiceManualName, setInvoiceManualName] = useState('');
  const [invoicePurchaseLink, setInvoicePurchaseLink] = useState('');
  const [activePreAlertInvoice, setActivePreAlertInvoice] = useState<PreAlert | null>(null);

  // Quotation Module States
  const [quoteClientType, setQuoteClientType] = useState<'registered' | 'manual'>('registered');
  const [quoteLockerId, setQuoteLockerId] = useState('');
  const [quoteManualName, setQuoteManualName] = useState('');
  const [quoteManualNit, setQuoteManualNit] = useState('CF');
  const [quoteManualCompany, setQuoteManualCompany] = useState('');
  const [quoteManualEmail, setQuoteManualEmail] = useState('');
  const [quoteConcept, setQuoteConcept] = useState('Servicios de Flete y Despacho Aduanero Internacional');
  const [quoteFormWeight, setQuoteFormWeight] = useState('1.0');
  const [quoteFormWeightRate, setQuoteFormWeightRate] = useState('60');
  const [quoteExtraCharges, setQuoteExtraCharges] = useState('0');
  const [quoteObservations, setQuoteObservations] = useState('Cotización válida por 15 días a partir de la fecha de emisión. Precios expresados en Quetzales (Q).');

  // Manual & Promo Email Modal States
  const [isMailModalOpen, setIsMailModalOpen] = useState(false);
  const [mailModalRecipient, setMailModalRecipient] = useState<UserProfile | null>(null);
  const [mailModalSubject, setMailModalSubject] = useState('');
  const [mailModalBody, setMailModalBody] = useState('');
  const [mailPromoImage, setMailPromoImage] = useState(''); // base64 string
  const [mailPromoImageName, setMailPromoImageName] = useState('');

  // Payments
  const [paymentsLog, setPaymentsLog] = useState<any[]>([]);
  const [paymentLocker, setPaymentLocker] = useState('');
  const [paymentInvoice, setPaymentInvoice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Transferencia Bancaria');
  const [paymentAmount, setPaymentAmount] = useState(57.40);
  const [paymentNotes, setPaymentNotes] = useState('');

  // Expenses
  const [expensesLog, setExpensesLog] = useState<any[]>([]);
  const [expenseCategory, setExpenseCategory] = useState('Internet');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState(150.00);
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split('T')[0]);

  // EmailJS Settings
  const [emailJsServiceId, setEmailJsServiceId] = useState(() => localStorage.getItem('emailJsServiceId') || 'service_raovwem');
  const [emailJsTemplateId, setEmailJsTemplateId] = useState(() => localStorage.getItem('emailJsTemplateId') || 'template_kuyiz4w');
  const [emailJsPublicKey, setEmailJsPublicKey] = useState(() => localStorage.getItem('emailJsPublicKey') || 'sNH_mwwk97ff9bPCp');
  const [emailJsPrivateKey, setEmailJsPrivateKey] = useState(() => localStorage.getItem('emailJsPrivateKey') || 'sNH_mwwk97ff9bPCp');

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

  // Send Welcome Email helper via EmailJS or native mailto fallback
  const sendWelcomeEmailHelper = async (profile: UserProfile, silent = false) => {
    const nameParts = profile.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const emailBodyTextPlain = `¡Bienvenido/a a ShipFast GT! 🇬🇹🚀

Estimado/a ${profile.name},

Nos complace darte la más cordial bienvenida a ShipFast GT, tu servicio de mensajería y casillero internacional de confianza. A partir de este momento, tienes acceso a nuestras bodegas en Estados Unidos y México para recibir todas tus compras de forma rápida, segura y económica.

A continuación, te detallamos la información de tu casillero y las direcciones exactas que debes utilizar al realizar tus compras en tus tiendas favoritas (Amazon, SHEIN, Mercado Libre, etc.).

--------------------------------------------------
📦 BODEGA EE.UU.
--------------------------------------------------
Copia y pega estos datos exactamente igual al hacer tu compra:

Nombre: ShipFast ${firstName}
Apellido: ${lastName}
Teléfono: +1 757-7762319
Dirección 1: 1900 Justo Penn St.
Suite / Apt: ${profile.lockerId}
Ciudad: Laredo
Estado: Texas (TX)
Zip Code: 78041

--------------------------------------------------
🇲🇽 BODEGA COMPRAS MÉXICO
--------------------------------------------------
Copia y pega estos datos exactamente igual al hacer tu compra:

Nombre: ShipFast ${firstName}
Apellido: ${lastName}
Teléfono: 9621027742
Ubicación: México
Dirección: Libramiento Sur Ote, Parque Logístico Tamarindo
Referencias: [${profile.lockerId}] + Bodega JT Express 320B Jony Maza Blanca Díaz
Estado: Chiapas
Ciudad: Tapachula
Distrito: Tapachula Centro
Código Postal: 30700
CURP: GADB000327MCSBZLA7

--------------------------------------------------
👗 ENVÍOS DE SHEIN MÉXICO
--------------------------------------------------
Utiliza esta dirección específica para tus compras en SHEIN:

Nombre: ShipFast ${firstName}
Apellido: ${lastName}
Teléfono: 9621027742
Ubicación: México
Dirección: Libramiento Sur Ote, Parque Logístico Tamarindo
Referencias: [${profile.lockerId}] + Bodega JT Express 320B Jony Maza Blanca Díaz
Estado/Provincia: Chiapas
Ciudad: Tapachula
Distrito: La Joya
Código Postal: 30783
CURP: GADB000327MCSBZLA7

--------------------------------------------------
📱 INFORMACIÓN DE SOPORTE Y CONTACTO
--------------------------------------------------
Recuerda que estamos para apoyarte en cada paso de tus envíos. Si tienes alguna duda, puedes contactarnos directamente a nuestro WhatsApp oficial:

💬 WhatsApp Soporte: +502 3726-8751

¡Gracias por confiar en ShipFast GT! Esperamos servirte muy pronto.

Atentamente,
El Equipo de ShipFast GT`;

    const emailBodyTextHtml = `<div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; color: #1f2937; line-height: 1.6; margin: 0;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-top: 6px solid #ea580c;">
    
    <!-- Header -->
    <div style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f3f4f6;">
      <img src="https://app.shipfastgt.com/logo.png" alt="ShipFast GT" style="max-width: 220px; height: auto;" />
    </div>

    <!-- Content Body -->
    <div style="padding: 40px 30px;">
      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">¡Bienvenido/a a la familia ShipFast GT! 🇬🇹🚀</h2>
      
      <p style="font-size: 15px; color: #4b5563; margin-top: 25px;">
        Estimado/a <strong>${profile.name}</strong>,
      </p>
      
      <p style="font-size: 14px; color: #4b5563;">
        Nos complace darte la más cordial bienvenida a <strong>ShipFast GT</strong>, tu servicio de mensajería y casillero internacional de confianza. A partir de este momento, tienes acceso a nuestras bodegas en Estados Unidos y México para recibir todas tus compras de forma rápida, segura y económica.
      </p>

      <div style="background-color: #fff7ed; border-left: 4px solid #ea580c; padding: 15px; border-radius: 6px; margin: 25px 0;">
        <strong style="color: #c2410c; font-size: 13px; display: block; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.5px;">🔑 Tu Código de Casillero Oficial:</strong>
        <span style="font-size: 22px; font-weight: 800; font-family: monospace; color: #ea580c; letter-spacing: 1px;">${profile.lockerId}</span>
      </div>

      <p style="font-size: 14px; color: #4b5563; margin-bottom: 25px;">
        Al realizar tus compras en tus tiendas favoritas (Amazon, SHEIN, Mercado Libre, etc.), **copia y pega los datos exactamente igual** como se muestran a continuación para evitar cualquier contratiempo en la recepción de tus paquetes:
      </p>

      <!-- BODEGA EEUU -->
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #ea580c; text-transform: uppercase; letter-spacing: 0.5px;">🇺🇸 Tu Dirección de Casillero en EE.UU.</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 120px;">Nombre:</td><td style="padding: 8px 0; color: #1f2937; font-weight: bold;">ShipFast ${firstName}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Apellido:</td><td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${lastName}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Teléfono:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">+1 757-7762319</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Dirección 1:</td><td style="padding: 8px 0; color: #1f2937;">1900 Justo Penn St.</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Suite / Apt:</td><td style="padding: 8px 0; color: #ea580c; font-weight: bold; font-family: monospace;">${profile.lockerId}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ciudad:</td><td style="padding: 8px 0; color: #1f2937;">Laredo</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Estado:</td><td style="padding: 8px 0; color: #1f2937;">Texas (TX)</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Zip Code:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">78041</td></tr>
        </table>
      </div>

      <!-- BODEGA MEXICO -->
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">🇲🇽 Bodega Compras México</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 120px;">Nombre:</td><td style="padding: 8px 0; color: #1f2937; font-weight: bold;">ShipFast ${firstName}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Apellido:</td><td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${lastName}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Teléfono:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">9621027742</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ubicación:</td><td style="padding: 8px 0; color: #1f2937;">México</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Dirección:</td><td style="padding: 8px 0; color: #1f2937;">Libramiento Sur Ote, Parque Logístico Tamarindo</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Referencias:</td><td style="padding: 8px 0; color: #ea580c; font-weight: bold;">[${profile.lockerId}] + Bodega JT Express 320B Jony Maza Blanca Díaz</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Estado:</td><td style="padding: 8px 0; color: #1f2937;">Chiapas</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ciudad:</td><td style="padding: 8px 0; color: #1f2937;">Tapachula</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Distrito:</td><td style="padding: 8px 0; color: #1f2937;">Tapachula Centro</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Código Postal:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">30700</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">CURP:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">GADB000327MCSBZLA7</td></tr>
        </table>
      </div>

      <!-- ENVIOS DE SHEIN MEXICO -->
      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 25px; margin-bottom: 25px;">
        <div style="margin-bottom: 15px;">
          <h3 style="margin: 0; font-size: 15px; font-weight: 800; color: #db2777; text-transform: uppercase; letter-spacing: 0.5px;">👗 Envíos de SHEIN México</h3>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold; width: 120px;">Nombre:</td><td style="padding: 8px 0; color: #1f2937; font-weight: bold;">ShipFast ${firstName}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Apellido:</td><td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${lastName}</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Teléfono:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">9621027742</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ubicación:</td><td style="padding: 8px 0; color: #1f2937;">México</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Dirección:</td><td style="padding: 8px 0; color: #1f2937;">Libramiento Sur Ote, Parque Logístico Tamarindo</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Referencias:</td><td style="padding: 8px 0; color: #ea580c; font-weight: bold;">[${profile.lockerId}] + Bodega JT Express 320B Jony Maza Blanca Díaz</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Estado/Provincia:</td><td style="padding: 8px 0; color: #1f2937;">Chiapas</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Ciudad:</td><td style="padding: 8px 0; color: #1f2937;">Tapachula</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Distrito:</td><td style="padding: 8px 0; color: #1f2937;">La Joya</td></tr>
          <tr style="border-bottom: 1px solid #f3f4f6;"><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">Código Postal:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">30783</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280; font-weight: bold;">CURP:</td><td style="padding: 8px 0; color: #1f2937; font-family: monospace;">GADB000327MCSBZLA7</td></tr>
        </table>
      </div>

      <!-- Support and Contact Info -->
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; text-align: center; margin-top: 30px;">
        <strong style="color: #1e3a8a; font-size: 14px; display: block; margin-bottom: 10px;">💬 ¿Tienes alguna duda o necesitas asistencia?</strong>
        <p style="font-size: 13px; color: #4b5563; margin: 0 0 15px 0;">Estamos disponibles para apoyarte en cada paso de tus importaciones y mensajería en Guatemala.</p>
        <a href="https://wa.me/50237268751" target="_blank" style="background-color: #25d366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          🟢 Contactar por WhatsApp: +502 3726-8751
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #1f2937; padding: 30px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #374151;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #ffffff;">ShipFast Logistics S.A. &copy; 2026</p>
      <p style="margin: 0 0 8px 0;">El servicio de courier y mensajería express más rápido de Guatemala.</p>
      <p style="margin: 0; color: #6b7280;">Este es un correo automático. Por favor, no respondas directamente a este mensaje.</p>
    </div>

  </div>
</div>`;

    const serviceId = emailJsServiceId.trim();
    const templateId = emailJsTemplateId.trim();
    const publicKey = emailJsPublicKey.trim();
    const privateKey = emailJsPrivateKey.trim();

    if (serviceId && templateId && publicKey) {
      try {
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
              to_name: profile.name,
              name: profile.name,
              to_email: profile.email,
              email: profile.email,
              locker_id: profile.lockerId,
              first_name: firstName,
              last_name: lastName,
              subject: `¡Bienvenido a ShipFast GT! - Tu Casillero ${profile.lockerId}`,
              message: emailBodyTextHtml
            }
          })
        });

        if (response.ok) {
          if (!silent) {
            alert(`📧 ¡Correo de bienvenida enviado automáticamente en segundo plano a ${profile.name} (${profile.email})!`);
          }
          return true;
        } else {
          const errorText = await response.text();
          console.error("EmailJS error details:", errorText);
          if (!silent) {
            alert(`No se pudo enviar el correo de forma automática.
Detalle del servidor (EmailJS): "${errorText}" (Código ${response.status})

Se procederá a abrir tu cliente de correo nativo como alternativa de respaldo.`);
          }
        }
      } catch (err) {
        console.error("EmailJS network error:", err);
        if (!silent) {
          alert("Ocurrió un inconveniente de red al conectar con el servidor de correos. Abriendo tu cliente de correo nativo como alternativa de respaldo...");
        }
      }
    }

    if (!silent) {
      // Native mailto fallback
      const subject = encodeURIComponent(`¡Bienvenido a ShipFast GT! - Tu Casillero ${profile.lockerId}`);
      const body = encodeURIComponent(emailBodyTextPlain);
      window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
    }
    return false;
  };

  // Send Pre-Alert Received notification email via EmailJS or native mailto fallback
  const sendPreAlertReceivedEmailHelper = async (
    pa: PreAlert & { declaredValue?: number; insurance?: string; invoiceFileName?: string },
    shipmentId: string,
    fleteBase: number,
    insuranceFeeGtq: number,
    totalCharge: number,
    silent = true
  ) => {
    // Find matching profile/client
    const profile = users.find(u => u.lockerId === pa.lockerId);
    if (!profile) return false;

    const nameParts = profile.name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    const isLaredo = !pa.description.toLowerCase().includes('mexico') && !pa.description.toLowerCase().includes('méxico');
    const warehouseName = isLaredo ? "Bodega de Laredo, Texas (USA) 🇺🇸" : "Bodega de Tapachula, Chiapas (México) 🇲🇽";

    const hasInsurance = pa.insurance === 'Con seguro (5%)' || (pa.description && pa.description.includes('Seguro: Con seguro (5%)'));
    const declaredValue = pa.declaredValue || 0;

    const emailBodyTextPlain = `Notificación de Recepción de Paquete - ShipFast GT 🇬🇹🚀

Estimado/a ${profile.name},

Nos complace informarle que su paquete pre-alertado ha sido recibido físicamente en nuestras bodegas y ya se encuentra registrado para su importación a Guatemala.

Detalles del Paquete:
- Guía Asignada: ${shipmentId}
- Tracking original: ${pa.id}
- Remitente / Tienda: ${pa.sender}
- Peso registrado: ${pa.weightEst} Lbs
- Ubicación de recepción: ${warehouseName}
- Valor Declarado: $${declaredValue.toFixed(2)} USD
- Seguro Premium (5%): ${hasInsurance ? `Adquirido (Q ${insuranceFeeGtq.toFixed(2)})` : "No Adquirido (Responsabilidad Limitada a $50 USD)"}

Cargos de Flete y Tarifas Asignadas:
- Flete Base: Q ${fleteBase.toFixed(2)}
- Recargo de Seguro: Q ${insuranceFeeGtq.toFixed(2)}
- Total a Facturar: Q ${totalCharge.toFixed(2)}

¡Gracias por confiar en ShipFast GT! Le mantendremos informado sobre el avance en ruta hacia Guatemala.`;

    const emailBodyTextHtml = `<div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; color: #1f2937; line-height: 1.6; margin: 0;">
  <div style="max-width: 650px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1); border-top: 8px solid #ea580c;">
    
    <!-- Header -->
    <div style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 2px solid #f3f4f6;">
      <img src="https://app.shipfastgt.com/logo.png" alt="ShipFast GT" style="max-width: 220px; height: auto;" />
    </div>

    <!-- Content Body -->
    <div style="padding: 40px 30px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="background-color: #ffedd5; color: #ea580c; font-size: 10px; font-weight: 900; text-transform: uppercase; tracking-wider; padding: 6px 16px; border-radius: 9999px; display: inline-block; border: 1px solid #fed7aa; margin-bottom: 15px;">
          📦 Paquete Recibido en Bodega Internacional
        </span>
        <h2 style="margin: 0; color: #111827; font-size: 22px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">¡Tu paquete está listo para volar! 🇬🇹🚀</h2>
      </div>

      <p style="font-size: 15px; color: #4b5563;">
        Estimado/a <strong>${profile.name}</strong>,
      </p>
      
      <p style="font-size: 14px; color: #4b5563;">
        Nos complace informarte que hemos recibido físicamente tu paquete en nuestra <strong>${warehouseName}</strong>. A partir de este momento, se ha completado el ingreso logístico y la asignación de su guía para proceder con el tránsito directo hacia Guatemala.
      </p>

      <!-- Main Receipt Card -->
      <div style="background-color: #fafafa; border: 1px solid #e5e7eb; border-radius: 12px; padding: 25px; margin: 30px 0;">
        <h3 style="margin: 0 0 20px 0; font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #eff6ff; padding-bottom: 10px;">
          📋 Detalles de la Guía Logística
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: bold; width: 150px;">Guía ShipFast:</td>
            <td style="padding: 10px 0; color: #ea580c; font-weight: 900; font-family: monospace; font-size: 15px;">${shipmentId}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: bold;">Tracking Original:</td>
            <td style="padding: 10px 0; color: #1f2937; font-family: monospace;">${pa.id}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: bold;">Remitente:</td>
            <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">${pa.sender}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: bold;">Peso Registrado:</td>
            <td style="padding: 10px 0; color: #1f2937; font-weight: bold;">${pa.weightEst} Lbs</td>
          </tr>
          <tr style="border-bottom: 1px solid #f3f4f6;">
            <td style="padding: 10px 0; color: #6b7280; font-weight: bold;">Valor Declarado:</td>
            <td style="padding: 10px 0; color: #1f2937;">$${declaredValue.toFixed(2)} USD</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #6b7280; font-weight: bold;">Seguro Premium (5%):</td>
            <td style="padding: 10px 0;">
              {hasInsurance ? (
                <span style="color: #16a34a; font-weight: 800;">🛡️ Adquirido (Q ${insuranceFeeGtq.toFixed(2)})</span>
              ) : (
                <span style="color: #ea580c; font-weight: bold;">⚠️ No Adquirido (Resp. Máx. $50 USD)</span>
              )}
            </td>
          </tr>
        </table>
      </div>

      <!-- Financial Breakdown Card -->
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 25px; margin-bottom: 30px;">
        <h3 style="margin: 0 0 15px 0; font-size: 14px; font-weight: 800; color: #1e3a8a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #dbeafe; padding-bottom: 8px;">
          💰 Resumen de Flete y Cargos
        </h3>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr style="border-bottom: 1px solid #dbeafe;">
            <td style="padding: 8px 0; color: #1e3a8a; font-weight: bold;">Flete por Peso (${pa.weightEst} Lbs):</td>
            <td style="padding: 8px 0; color: #1e293b; text-align: right; font-weight: bold;">Q ${fleteBase.toFixed(2)}</td>
          </tr>
          {insuranceFeeGtq > 0 && (
            <tr style="border-bottom: 1px solid #dbeafe;">
              <td style="padding: 8px 0; color: #1e3a8a; font-weight: bold;">Seguro Opcional (5%):</td>
              <td style="padding: 8px 0; color: #16a34a; text-align: right; font-weight: bold;">Q ${insuranceFeeGtq.toFixed(2)}</td>
            </tr>
          )}
          <tr style="font-size: 16px; font-weight: 900;">
            <td style="padding: 12px 0 0 0; color: #1e3a8a;">Total a Cobrar:</td>
            <td style="padding: 12px 0 0 0; color: #ea580c; text-align: right; font-size: 18px;">Q ${totalCharge.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      <!-- Support and WhatsApp Quick Action -->
      <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center;">
        <strong style="color: #166534; font-size: 14px; display: block; margin-bottom: 8px;">💬 ¿Deseas coordinar tu entrega o entrega local en Guatemala?</strong>
        <p style="font-size: 13px; color: #4b5563; margin: 0 0 15px 0;">Contáctanos de inmediato para programar tu entrega a domicilio.</p>
        <a href="https://wa.me/50237268751" target="_blank" style="background-color: #25d366; color: white; padding: 10px 24px; text-decoration: none; border-radius: 8px; font-weight: 900; font-size: 13px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); text-transform: uppercase;">
          🟢 Coordinar por WhatsApp
        </a>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #1f2937; padding: 30px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #374151;">
      <p style="margin: 0 0 8px 0; font-weight: bold; color: #ffffff;">ShipFast Logistics S.A. &copy; 2026</p>
      <p style="margin: 0 0 8px 0;">El servicio de courier y mensajería express más rápido de Guatemala.</p>
      <p style="margin: 0; color: #6b7280;">Este es un correo automático. Por favor, no respondas directamente a este mensaje.</p>
    </div>

  </div>
</div>`;

    const serviceId = emailJsServiceId.trim();
    const templateId = emailJsTemplateId.trim();
    const publicKey = emailJsPublicKey.trim();
    const privateKey = emailJsPrivateKey.trim();

    if (serviceId && templateId && publicKey) {
      try {
        const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            accessToken: privateKey,
            template_params: {
              to_name: profile.name,
              name: profile.name,
              to_email: profile.email,
              email: profile.email,
              locker_id: profile.lockerId,
              first_name: firstName,
              last_name: lastName,
              subject: `📦 Paquete Recibido en Bodega Internacional - Guía ${shipmentId}`,
              message: emailBodyTextHtml
            }
          })
        });

        if (response.ok) {
          if (!silent) {
            alert(`📧 ¡Notificación de recepción enviada con éxito a ${profile.name} (${profile.email})!`);
          }
          return true;
        } else {
          const errorText = await response.text();
          console.error("EmailJS pre-alert notification error:", errorText);
        }
      } catch (err) {
        console.error("EmailJS network error for pre-alert notification:", err);
      }
    }

    if (!silent) {
      // Native mailto fallback
      const subject = encodeURIComponent(`📦 Paquete Recibido en Bodega - Guía ${shipmentId}`);
      const body = encodeURIComponent(emailBodyTextPlain);
      window.location.href = `mailto:${profile.email}?subject=${subject}&body=${body}`;
    }
    return false;
  };

  // Handle Registration
  const handleSignupSubmit = async (e: React.FormEvent) => {
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
    await db.upsertProfile(newProfile);

    setUsers([...users, newProfile]);
    setSignupSuccessLocker(generatedLockerId);

    // Reset fields
    setSignupName('');
    setSignupEmail('');
    setSignupPhone('+502 ');
    setSignupAddress('');
    setSignupPassword('');

    // Send welcome email automatically & silently in the background!
    sendWelcomeEmailHelper(newProfile, true);
  };

  // Handle Quote Calculation
  const handleCalculateQuote = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Pricing formulas
    const base = 35; // Servicio de Envío Local Q35
    let weightCost = 0;
    let days = '8 a 10 Días Hábiles';

    if (quoteOrigin === 'Texas') {
      weightCost = quoteWeight * 60; // Q60 X LB LAREDO (Texas)
      days = '8 a 10 Días Hábiles';
    } else {
      weightCost = quoteWeight * 30; // Q30 X LB MEXICO
      days = '4 a 6 Días Hábiles';
    }

    let productPriceUsd = 0;
    let productPriceQts = 0;
    let taxesQts = 0;

    if (quoteProductPriceUsd && Number(quoteProductPriceUsd) > 0) {
      productPriceUsd = Number(quoteProductPriceUsd);
      productPriceQts = productPriceUsd * 8;
      taxesQts = Number((productPriceQts * 0.12).toFixed(2));
    }

    const total = quoteWhoPurchases === 'Nosotros' 
      ? (base + weightCost + productPriceQts + taxesQts)
      : (base + weightCost);
    
    // Route guidelines based on destination department
    let route = `Ruta Logística Nacional hacia ${quoteDestination}`;
    if (quoteDestination === 'Guatemala' || quoteDestination === 'Sacatepéquez' || quoteDestination === 'Chimaltenango') {
      route = `Corredor Central Metropolitano (Destino: ${quoteDestination})`;
    } else if (['Quetzaltenango', 'Huehuetenango', 'San Marcos', 'Totonicapán', 'Sololá', 'Quiché', 'Retalhuleu', 'Suchitepéquez'].includes(quoteDestination)) {
      route = `Corredor Occidente CA-1 (Destino: ${quoteDestination})`;
    } else if (['Escuintla', 'Santa Rosa', 'Jutiapa'].includes(quoteDestination)) {
      route = `Corredor Sur / Costa Sur CA-9 (Destino: ${quoteDestination})`;
    } else if (['Zacapa', 'Chiquimula', 'El Progreso', 'Jalapa', 'Izabal'].includes(quoteDestination)) {
      route = `Corredor Oriental CA-9 Norte (Destino: ${quoteDestination})`;
    } else if (['Alta Verapaz', 'Baja Verapaz', 'Petén'].includes(quoteDestination)) {
      route = `Ruta Transversal del Norte / Petén (Destino: ${quoteDestination})`;
    }

    setCalculatedQuote({
      base,
      weightCost,
      productPriceUsd: quoteWhoPurchases === 'Nosotros' ? productPriceUsd : 0,
      productPriceQts: quoteWhoPurchases === 'Nosotros' ? productPriceQts : 0,
      taxesQts: quoteWhoPurchases === 'Nosotros' ? taxesQts : 0,
      total,
      days,
      route,
      productLink: quoteProductLink,
      whoPurchases: quoteWhoPurchases
    } as any);
  };

  // Pre-calculate quote if URL has parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const quoteIdParam = params.get('quote');
    const origin = params.get('origin');
    const destination = params.get('destination');
    const weight = params.get('weight');
    const price = params.get('price');
    const link = params.get('link');

    async function parseUrlParams() {
      if (quoteIdParam) {
        const savedQuote = await db.getQuote(quoteIdParam);
        if (savedQuote) {
          setQuoteOrigin(savedQuote.origin === 'Mexico' || savedQuote.origin === 'México' || savedQuote.origin === 'mexico' ? 'México' : 'Texas');
          setQuoteDestination(savedQuote.destination);
          setQuoteWeight(savedQuote.weight);
          setQuoteProductPriceUsd(savedQuote.productPriceUsd > 0 ? savedQuote.productPriceUsd : '');
          setQuoteProductLink(savedQuote.productLink || '');

          setCalculatedQuote({
            base: 35,
            weightCost: savedQuote.origin === 'Texas' ? savedQuote.weight * 60 : savedQuote.weight * 30,
            productPriceUsd: savedQuote.productPriceUsd,
            productPriceQts: savedQuote.productPriceUsd * 8,
            taxesQts: Number((savedQuote.productPriceUsd * 8 * 0.12).toFixed(2)),
            total: savedQuote.total,
            days: savedQuote.days,
            route: savedQuote.route,
            productLink: savedQuote.productLink || undefined
          });

          if (!currentUser) {
            setAccessTab('quote');
          }
          return; // successfully loaded from DB!
        }
      }

      // Standard fallback query parameters parsing
      if (origin || destination || weight || price || link) {
        const decodedOrigin = origin ? decodeURIComponent(origin) : 'Texas';
        const decodedDest = destination ? decodeURIComponent(destination) : 'Guatemala';
        const parsedWeight = weight ? Number(weight) : 1;
        const parsedPrice = price ? Number(price) : 0;
        const decodedLink = link ? decodeURIComponent(link) : '';

        setQuoteOrigin(decodedOrigin === 'Mexico' || decodedOrigin === 'México' || decodedOrigin === 'mexico' ? 'México' : 'Texas');
        setQuoteDestination(decodedDest);
        setQuoteWeight(parsedWeight);
        setQuoteProductPriceUsd(parsedPrice > 0 ? parsedPrice : '');
        setQuoteProductLink(decodedLink);

        // Compute calculations directly
        const baseVal = 35;
        let weightCostVal = 0;
        let daysVal = '8 a 10 Días Hábiles';

        if (decodedOrigin === 'Mexico' || decodedOrigin === 'México' || decodedOrigin === 'mexico') {
          weightCostVal = parsedWeight * 30;
          daysVal = '4 a 6 Días Hábiles';
        } else {
          weightCostVal = parsedWeight * 60;
          daysVal = '8 a 10 Días Hábiles';
        }

        let productPriceQtsVal = 0;
        let taxesQtsVal = 0;

        if (parsedPrice > 0) {
          productPriceQtsVal = parsedPrice * 8;
          taxesQtsVal = Number((productPriceQtsVal * 0.12).toFixed(2));
        }

        const totalVal = baseVal + weightCostVal + productPriceQtsVal + taxesQtsVal;
        
        let routeVal = `Ruta Logística Nacional hacia ${decodedDest}`;
        if (decodedDest === 'Guatemala' || decodedDest === 'Sacatepéquez' || decodedDest === 'Chimaltenango') {
          routeVal = `Corredor Central Metropolitano (Destino: ${decodedDest})`;
        } else if (['Quetzaltenango', 'Huehuetenango', 'San Marcos', 'Totonicapán', 'Sololá', 'Quiché', 'Retalhuleu', 'Suchitepéquez'].includes(decodedDest)) {
          routeVal = `Corredor Occidente CA-1 (Destino: ${decodedDest})`;
        } else if (['Escuintla', 'Santa Rosa', 'Jutiapa'].includes(decodedDest)) {
          routeVal = `Corredor Sur / Costa Sur CA-9 (Destino: ${decodedDest})`;
        } else if (['Zacapa', 'Chiquimula', 'El Progreso', 'Jalapa', 'Izabal'].includes(decodedDest)) {
          routeVal = `Corredor Oriental CA-9 Norte (Destino: ${decodedDest})`;
        } else if (['Alta Verapaz', 'Baja Verapaz', 'Petén'].includes(decodedDest)) {
          routeVal = `Ruta Transversal del Norte / Petén (Destino: ${decodedDest})`;
        }

        setCalculatedQuote({
          base: baseVal,
          weightCost: weightCostVal,
          productPriceUsd: parsedPrice,
          productPriceQts: productPriceQtsVal,
          taxesQts: taxesQtsVal,
          total: totalVal,
          days: daysVal,
          route: routeVal,
          productLink: decodedLink || undefined
        });
        
        if (!currentUser) {
          setAccessTab('quote');
        }
      }
    }

    parseUrlParams();
  }, [currentUser]);

  // Copy shareable link to clipboard
  const handleCopyShareLink = async () => {
    if (!calculatedQuote) return;
    const baseUrl = window.location.origin + window.location.pathname;
    const quoteId = `SF-QT-${Math.floor(100000 + Math.random() * 900000)}`;

    const quoteObj = {
      id: quoteId,
      date: new Date().toISOString().split('T')[0],
      origin: quoteOrigin,
      destination: quoteDestination,
      weight: quoteWeight,
      productPriceUsd: calculatedQuote.productPriceUsd || 0,
      productLink: calculatedQuote.productLink || '',
      total: calculatedQuote.total,
      days: calculatedQuote.days,
      route: calculatedQuote.route
    };

    // Save to Supabase (dynamic quotes table)
    const success = await db.upsertQuote(quoteObj);
    
    // Construct database-backed clean URL if successful, otherwise fallback to URL parameters
    let shareUrl = '';
    if (success) {
      shareUrl = `${baseUrl}?quote=${quoteId}`;
    } else {
      const priceParam = calculatedQuote.productPriceUsd ? `&price=${calculatedQuote.productPriceUsd}` : '';
      const linkParam = calculatedQuote.productLink ? `&link=${encodeURIComponent(calculatedQuote.productLink)}` : '';
      shareUrl = `${baseUrl}?origin=${quoteOrigin}&destination=${quoteDestination}&weight=${quoteWeight}${priceParam}${linkParam}`;
    }
    
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopyLinkSuccess(true);
      setTimeout(() => setCopyLinkSuccess(false), 3000);
    });
  };

  // Download Quote PDF (Opens print-ready professional invoice layout)
  const handleDownloadPDF = () => {
    if (!calculatedQuote) return;

    const quoteId = `SF-QT-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = new Date().toLocaleDateString('es-GT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes (popups) para descargar el PDF de tu cotización.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Cotización ${quoteId} - ShipFast GT</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            margin: 0;
            padding: 40px;
            line-height: 1.5;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #EA580C;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .logo-title {
            font-size: 28px;
            font-weight: 800;
            color: #1F2937;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .logo-title span {
            color: #EA580C;
          }
          .company-info {
            text-align: right;
            font-size: 12px;
            color: #6B7280;
          }
          .title {
            font-size: 20px;
            font-weight: bold;
            color: #111827;
            margin-bottom: 20px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
            background-color: #F9FAFB;
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #E5E7EB;
            font-size: 13px;
          }
          .meta-item {
            margin-bottom: 6px;
          }
          .meta-item strong {
            color: #4B5563;
          }
          .table-title {
            font-size: 14px;
            font-weight: bold;
            color: #1F2937;
            border-bottom: 1px solid #E5E7EB;
            padding-bottom: 8px;
            margin-bottom: 12px;
            text-transform: uppercase;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          th {
            background-color: #F3F4F6;
            color: #374151;
            font-weight: 600;
            text-align: left;
            padding: 10px 12px;
            font-size: 13px;
            border-bottom: 1px solid #E5E7EB;
          }
          td {
            padding: 12px;
            font-size: 13px;
            border-bottom: 1px solid #F3F4F6;
          }
          .text-right {
            text-align: right;
          }
          .total-row {
            background-color: #FFF7ED;
            font-weight: bold;
            border-top: 2px solid #FED7AA;
          }
          .total-row td {
            color: #C2410C;
            font-size: 16px;
            border-bottom: 2px solid #FED7AA;
          }
          .route-box {
            background-color: #EFF6FF;
            border: 1px solid #BFDBFE;
            padding: 15px;
            border-radius: 8px;
            font-size: 13px;
            color: #1E3A8A;
            margin-bottom: 40px;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: #9CA3AF;
            border-top: 1px solid #E5E7EB;
            padding-top: 20px;
          }
          .btn-print-action {
            background-color: #EA580C;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
            transition: background-color 0.2s;
          }
          .btn-print-action:hover {
            background-color: #C2410C;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <button class="btn-print-action" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
          <button class="btn-print-action" style="background-color: #4B5563;" onclick="window.close()">Cerrar Ventana</button>
        </div>

        <div class="header">
          <div class="logo-title">
            ShipFast<span>GT</span>
          </div>
          <div class="company-info">
            <strong>ShipFast Logistics S.A.</strong><br>
            Texas 🇺🇸 • México 🇲🇽 • Guatemala 🇬🇹<br>
            Soporte: info@shipfastgt.com | WhatsApp: +502 3000-0000
          </div>
        </div>

        <div class="title">Cotización Oficial de Courier e Importación</div>

        <div class="meta-grid">
          <div>
            <div class="meta-item"><strong>ID Cotización:</strong> ${quoteId}</div>
            <div class="meta-item"><strong>Fecha:</strong> ${dateStr}</div>
            <div class="meta-item"><strong>Origen:</strong> ${quoteOrigin === 'Texas' ? 'Texas (Laredo, EUA) 🇺🇸' : 'México 🇲🇽'}</div>
            <div class="meta-item"><strong>Destino:</strong> ${quoteDestination}, Guatemala 🇬🇹</div>
          </div>
          <div>
            <div class="meta-item"><strong>Peso Registrado:</strong> ${quoteWeight} Lbs</div>
            <div class="meta-item"><strong>Tiempo de Entrega:</strong> ${calculatedQuote.days}</div>
            <div class="meta-item"><strong>Validez:</strong> 15 Días a partir de la emisión</div>
          </div>
        </div>

        <div class="table-title">Desglose de Tarifas y Flete</div>
        <table>
          <thead>
            <tr>
              <th>Concepto / Detalle del Servicio</th>
              <th class="text-right">Monto</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedQuote.productLink ? `
            <tr>
              <td><strong>Enlace del Producto:</strong><br><span style="font-size: 11px; color: #4B5563;">${calculatedQuote.productLink}</span></td>
              <td class="text-right">-</td>
            </tr>
            ` : ''}
            ${calculatedQuote.productPriceUsd ? `
            <tr>
              <td><strong>Costo del Producto:</strong> $${calculatedQuote.productPriceUsd.toFixed(2)} USD (Tipo de cambio fijo x8.00)</td>
              <td class="text-right">Q ${calculatedQuote.productPriceQts?.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Impuestos de Importación:</strong> IVA General sobre Importación (12%)</td>
              <td class="text-right" style="color: #DC2626;">Q ${calculatedQuote.taxesQts?.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td><strong>Cargo por Peso (Flete Internacional):</strong> ${quoteWeight} Lbs (${quoteOrigin === 'Texas' ? 'Q60.00/Lb Laredo' : 'Q30.00/Lb México'})</td>
              <td class="text-right">Q ${calculatedQuote.weightCost.toFixed(2)}</td>
            </tr>
            <tr>
              <td><strong>Cargo Base (Servicio de Envío Local):</strong> Entrega domiciliar nacional</td>
              <td class="text-right">Q ${calculatedQuote.base.toFixed(2)}</td>
            </tr>
            <tr class="total-row">
              <td>TOTAL ESTIMADO A PAGAR:</td>
              <td class="text-right">Q ${calculatedQuote.total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="route-box">
          <strong>📍 Ruta Operativa Asignada:</strong> ${calculatedQuote.route}<br>
          Monitoreo y despacho terrestre coordinado para cobertura departamental en Guatemala.
        </div>

        <div class="footer">
          <p>Esta es una estimación de tarifa sujeta a la validación del peso volumétrico y descripción real del paquete en nuestras bodegas de origen.</p>
          <p>© ${new Date().getFullYear()} ShipFast GT. Todos los derechos reservados.</p>
        </div>

        <script>
          setTimeout(function() {
            window.print();
          }, 800);
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Generate professional print-ready HTML Invoice PDF
  const handlePrintInvoicePDF = (invoice: any) => {
    const parsed = parseInvoiceConcept(invoice.concept);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor permite las ventanas emergentes (popups) para descargar el PDF de tu factura.');
      return;
    }

    // Find user details if registered
    const clientUser = users.find(u => u.lockerId === invoice.lockerId);
    const clientName = invoice.lockerId 
      ? (clientUser ? clientUser.name : `Cliente (${invoice.lockerId})`)
      : parsed.manualClientName || 'Cliente No Registrado';
    const clientEmail = clientUser?.email || 'N/A';
    const clientPhone = clientUser?.phone || 'N/A';
    const clientAddress = clientUser?.address || 'Dirección no registrada';
    
    const logoUrl = window.location.origin + '/logo.png';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Factura ${invoice.id} - ShipFast GT</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          
          @page {
            size: letter;
            margin: 0.5in;
          }
          
          body {
            font-family: 'Inter', sans-serif;
            color: #1F2937;
            margin: 0;
            padding: 20px;
            line-height: 1.5;
            background-color: #ffffff;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #EA580C;
            padding-bottom: 25px;
            margin-bottom: 30px;
          }
          .logo-area {
            display: flex;
            flex-direction: column;
            gap: 5px;
          }
          .logo-img {
            max-height: 55px;
            width: auto;
            display: block;
          }
          .logo-title {
            font-size: 26px;
            font-weight: 800;
            color: #1F2937;
          }
          .logo-title span {
            color: #EA580C;
          }
          .company-info {
            text-align: right;
            font-size: 11px;
            color: #4B5563;
            line-height: 1.6;
          }
          .title-area {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 25px;
          }
          .title {
            font-size: 22px;
            font-weight: 800;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
          }
          .invoice-id {
            font-size: 16px;
            font-weight: 700;
            color: #EA580C;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 35px;
          }
          .info-block {
            background-color: #F9FAFB;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #E5E7EB;
          }
          .info-block h3 {
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            color: #9CA3AF;
            letter-spacing: 0.5px;
            margin-top: 0;
            margin-bottom: 12px;
            border-bottom: 1px solid #E5E7EB;
            padding-bottom: 6px;
          }
          .info-block p {
            margin: 4px 0;
            font-size: 13px;
            color: #374151;
          }
          .client-name {
            font-size: 15px;
            font-weight: 700;
            color: #111827;
            margin-bottom: 6px !important;
          }
          .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            border: 1px solid;
          }
          .badge-pending {
            background-color: #FEF2F2;
            color: #991B1B;
            border-color: #FCA5A5;
          }
          .badge-paid {
            background-color: #F0FDF4;
            color: #166534;
            border-color: #86EFAC;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
          }
          th {
            background-color: #F3F4F6;
            color: #374151;
            font-weight: 700;
            text-align: left;
            padding: 12px 16px;
            font-size: 12px;
            text-transform: uppercase;
            border-bottom: 2px solid #E5E7EB;
          }
          td {
            padding: 16px;
            font-size: 13px;
            border-bottom: 1px solid #E5E7EB;
            color: #374151;
          }
          .concept-title {
            font-weight: 600;
            color: #111827;
            font-size: 14px;
          }
          .concept-link {
            font-size: 11px;
            color: #EA580C;
            text-decoration: none;
            margin-top: 6px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-weight: 600;
          }
          .concept-link:hover {
            text-decoration: underline;
          }
          .text-right {
            text-align: right;
          }
          .summary-container {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 40px;
          }
          .summary-box {
            width: 320px;
          }
          .summary-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #F3F4F6;
            font-size: 13px;
          }
          .summary-row.total {
            border-bottom: none;
            font-size: 18px;
            font-weight: 800;
            color: #EA580C;
            padding-top: 12px;
            border-top: 2px solid #FED7AA;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: #9CA3AF;
            border-top: 1px solid #E5E7EB;
            padding-top: 20px;
            margin-top: 50px;
          }
          .btn-print-action {
            background-color: #EA580C;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 14px;
            font-weight: bold;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
            transition: background-color 0.2s;
          }
          .btn-print-action:hover {
            background-color: #C2410C;
          }
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="display: flex; justify-content: space-between; margin-bottom: 20px;">
          <button class="btn-print-action" onclick="window.print()">🖨️ Imprimir / Guardar como PDF</button>
          <button class="btn-print-action" style="background-color: #4B5563;" onclick="window.close()">Cerrar Ventana</button>
        </div>

        <div class="header">
          <div class="logo-area">
            <img class="logo-img" src="${logoUrl}" onerror="this.style.display='none'; document.getElementById('alt-logo').style.display='block';" alt="Logo" />
            <div id="alt-logo" class="logo-title" style="display:none;">ShipFast<span>GT</span></div>
            <p style="color: #6B7280; font-size: 11px; margin: 0; font-weight: 500;">Premium Courier & Cargo Service</p>
          </div>
          <div class="company-info">
            <strong>ShipFast Logistics Quetzaltenango</strong><br>
            Calle B 22-48 Zona 3, Colonia Minerva<br>
            Quetzaltenango, Guatemala<br>
            Soporte: info@shipfastgt.com | Tel: +502 3726-8751
          </div>
        </div>

        <div class="title-area">
          <h1 class="title">Factura de Servicio</h1>
          <span class="invoice-id">Factura No: ${invoice.id}</span>
        </div>

        <div class="info-grid">
          <div class="info-block">
            <h3>EMISOR / PROVEEDOR</h3>
            <p class="client-name">ShipFast Quetzaltenango</p>
            <p><strong>Dirección:</strong> Calle B 22-48 Zona 3, Colonia Minerva, Quetzaltenango, Guatemala</p>
            <p><strong>Teléfono:</strong> +502 3726-8751</p>
            <p><strong>Email:</strong> info@shipfastgt.com</p>
          </div>
          <div class="info-block">
            <h3>FACTURADO A</h3>
            <p class="client-name">${clientName}</p>
            ${invoice.lockerId ? `<p><strong>Casillero:</strong> ${invoice.lockerId}</p>` : '<p><strong>Estado:</strong> Cliente No Registrado (Manual)</p>'}
            <p><strong>Email:</strong> ${clientEmail}</p>
            <p><strong>Teléfono:</strong> ${clientPhone}</p>
            <p><strong>Dirección:</strong> ${clientAddress}</p>
          </div>
        </div>

        <table style="width: 100%;">
          <thead>
            <tr>
              <th style="width: 70%;">Descripción del Cargo / Concepto</th>
              <th style="width: 30%; text-align: right;">Monto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="concept-title">${parsed.detail}</div>
                ${parsed.purchaseLink ? `
                  <a href="${parsed.purchaseLink}" class="concept-link" target="_blank">
                    🔗 Enlace de Compra Asoc.
                  </a>
                ` : ''}
              </td>
              <td class="text-right" style="font-weight: 700;">Q ${invoice.amount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="summary-container">
          <div class="summary-box">
            <div class="summary-row">
              <span style="color: #4B5563;">Subtotal:</span>
              <span style="font-weight: 600;">Q ${invoice.amount.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span style="color: #4B5563;">Impuestos (Exento IVA / Flete):</span>
              <span style="font-weight: 600;">Q 0.00</span>
            </div>
            <div class="summary-row">
              <span style="color: #4B5563;">Estado de Pago:</span>
              <span>
                <span class="badge ${invoice.paymentStatus === 'Pagado' ? 'badge-paid' : 'badge-pending'}">
                  ${invoice.paymentStatus}
                </span>
              </span>
            </div>
            <div class="summary-row total">
              <span>Total a Cancelar:</span>
              <span>Q ${invoice.amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="footer">
          <p>Esta factura ha sido generada digitalmente de forma oficial.</p>
          <p>© ${new Date().getFullYear()} ShipFast GT. Todos los derechos reservados.</p>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
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

    const weightVal = parseFloat(clientPreAlertWeight) || 1.0;

    const newPreAlert: PreAlert & { declaredValue?: number; insurance?: string; invoiceFileName?: string } = {
      id: clientPreAlertTracking.trim().toUpperCase(),
      lockerId: currentUser.lockerId,
      sender: 'Compra Online',
      description: `Origen: ${clientPreAlertBodega} | Valor: $${declaredVal.toFixed(2)} | Seguro: ${clientPreAlertInsurance}${clientPreAlertFileName ? ` | Factura: ${clientPreAlertFileName}` : ''}`,
      weightEst: weightVal,
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
    setClientPreAlertWeight('1.0');
    setClientPreAlertInsurance('Sin seguro');
    setClientPreAlertFileName('');
    setIsClientPreAlertModalOpen(false);

    alert(`¡Pre-Alerta registrada con éxito!\nEl paquete con tracking "${newPreAlert.id}" ha sido documentado. El equipo de ShipFast en ${clientPreAlertBodega === 'Sin bodega' ? 'Laredo o México' : clientPreAlertBodega} estará pendiente de su arribo.`);
  };

  // Admin Pre-Alert Submission Handler
  const handleCreateAdminPreAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPreAlertLockerId.trim()) {
      alert('Por favor selecciona un casillero válido.');
      return;
    }
    if (!clientPreAlertTracking.trim()) {
      alert('Por favor ingresa un número de tracking válido.');
      return;
    }
    
    const declaredVal = parseFloat(clientPreAlertValue) || 0;
    if (clientPreAlertValue.trim() && (isNaN(declaredVal) || declaredVal < 0)) {
      alert('Por favor ingresa un valor declarado válido.');
      return;
    }

    const weightVal = parseFloat(clientPreAlertWeight) || 1.0;

    const targetUser = users.find(u => u.lockerId === adminPreAlertLockerId.toUpperCase());
    const clientName = targetUser ? targetUser.name : 'Cliente';

    const newPreAlert: PreAlert & { declaredValue?: number; insurance?: string; invoiceFileName?: string } = {
      id: clientPreAlertTracking.trim().toUpperCase(),
      lockerId: adminPreAlertLockerId.toUpperCase(),
      sender: 'Compra Online (Pre-alertado por Admin)',
      description: `Origen: ${clientPreAlertBodega} | Valor: $${declaredVal.toFixed(2)} | Seguro: ${clientPreAlertInsurance}${clientPreAlertFileName ? ` | Factura: ${clientPreAlertFileName}` : ''}`,
      weightEst: weightVal,
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
    setClientPreAlertWeight('1.0');
    setClientPreAlertInsurance('Sin seguro');
    setClientPreAlertFileName('');
    setAdminPreAlertLockerId('');
    setIsAdminPreAlertModalOpen(false);

    alert(`¡Pre-Alerta registrada por Administrador con éxito!\nEl paquete con tracking "${newPreAlert.id}" asignado a "${clientName} (${newPreAlert.lockerId})" ha sido documentado en el sistema.`);
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

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Origen del Envío</label>
                            <select
                              value={quoteOrigin}
                              onChange={(e) => setQuoteOrigin(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            >
                              <option value="Texas">Texas 🇺🇸 (Laredo - Q60/Lb)</option>
                              <option value="Mexico">México 🇲🇽 (Q30/Lb)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Destino del Envío</label>
                            <select
                              value={quoteDestination}
                              onChange={(e) => setQuoteDestination(e.target.value)}
                              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                            >
                              <option value="Alta Verapaz">Alta Verapaz</option>
                              <option value="Baja Verapaz">Baja Verapaz</option>
                              <option value="Chimaltenango">Chimaltenango</option>
                              <option value="Chiquimula">Chiquimula</option>
                              <option value="El Progreso">El Progreso</option>
                              <option value="Escuintla">Escuintla</option>
                              <option value="Guatemala">Guatemala</option>
                              <option value="Huehuetenango">Huehuetenango</option>
                              <option value="Izabal">Izabal</option>
                              <option value="Jalapa">Jalapa</option>
                              <option value="Jutiapa">Jutiapa</option>
                              <option value="Petén">Petén</option>
                              <option value="Quetzaltenango">Quetzaltenango</option>
                              <option value="Quiché">Quiché</option>
                              <option value="Retalhuleu">Retalhuleu</option>
                              <option value="Sacatepéquez">Sacatepéquez</option>
                              <option value="San Marcos">San Marcos</option>
                              <option value="Santa Rosa">Santa Rosa</option>
                              <option value="Sololá">Sololá</option>
                              <option value="Suchitepéquez">Suchitepéquez</option>
                              <option value="Totonicapán">Totonicapán</option>
                              <option value="Zacapa">Zacapa</option>
                            </select>
                          </div>
                        </div>

                        {/* ¿Quién compra? Selector */}
                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">¿Quién realiza la compra?</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setQuoteWhoPurchases('Nosotros')}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition uppercase tracking-wider cursor-pointer ${
                                quoteWhoPurchases === 'Nosotros'
                                  ? 'bg-brand-orange text-white shadow-3xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              🛒 ShipFast realiza la compra
                            </button>
                            <button
                              type="button"
                              onClick={() => setQuoteWhoPurchases('Cliente')}
                              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition uppercase tracking-wider cursor-pointer ${
                                quoteWhoPurchases === 'Cliente'
                                  ? 'bg-brand-orange text-white shadow-3xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              👤 Yo realizo mi propia compra
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio de Envío Local</label>
                            <input
                              type="text"
                              readOnly
                              value="Envío Local Departamental (Q35.00)"
                              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500 font-semibold focus:outline-none"
                            />
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

                        {quoteWhoPurchases === 'Nosotros' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in">
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Link del Producto (Opcional)</label>
                              <input
                                type="text"
                                placeholder="https://ejemplo.com/producto"
                                value={quoteProductLink}
                                onChange={(e) => setQuoteProductLink(e.target.value)}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              />
                            </div>

                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Precio del Producto ($ USD)</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                value={quoteProductPriceUsd === '' ? '' : quoteProductPriceUsd}
                                onChange={(e) => setQuoteProductPriceUsd(e.target.value === '' ? '' : Number(e.target.value))}
                                className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                      >
                        Calcular Tarifa
                      </button>

                      {/* Display Quotation Result */}
                      {calculatedQuote && (
                        <div className="bg-white border border-gray-150 rounded-xl shadow-md p-4 space-y-3.5 border-t-4 border-t-brand-orange mt-4 animate-zoom-in">
                          <div className="flex justify-between items-center pb-2.5 border-b border-gray-150/60">
                            <div className="flex items-center gap-2">
                              <div className="p-1 bg-orange-100 rounded text-brand-orange">
                                <TrendingUp className="h-3.5 w-3.5" />
                              </div>
                              <div>
                                <h4 className="text-4xs font-bold text-gray-700 uppercase tracking-wider">Detalle del Flete</h4>
                                <p className="text-5xs text-gray-400 tracking-wide font-semibold">Cálculo Automático</p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 bg-orange-50 text-brand-orange text-4xs font-bold rounded-full border border-orange-100/50 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {calculatedQuote.days}
                            </span>
                          </div>

                          <div className="space-y-2.5">
                            {calculatedQuote.productLink && (
                              <div className="flex justify-between items-center text-4xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                                <span className="flex items-center gap-1 shrink-0"><Link className="h-3 w-3 text-gray-400" /> Enlace:</span>
                                <a href={calculatedQuote.productLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline truncate max-w-[150px] break-all">
                                  {calculatedQuote.productLink}
                                </a>
                              </div>
                            )}

                            <div className="bg-gray-50/30 p-2.5 rounded border border-gray-100 space-y-1.5">
                              {calculatedQuote.productPriceUsd !== undefined && calculatedQuote.productPriceUsd > 0 && (
                                <>
                                  <div className="flex justify-between text-4xs text-gray-500">
                                    <span>Valor del Producto ($ USD):</span>
                                    <span className="font-medium text-gray-800">${calculatedQuote.productPriceUsd.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-4xs text-gray-500">
                                    <span>Valor en Quetzales (Cambio x8):</span>
                                    <span className="font-semibold text-gray-800">Q {calculatedQuote.productPriceQts?.toFixed(2)}</span>
                                  </div>
                                  <div className="flex justify-between text-4xs text-red-500 font-medium">
                                    <span>Impuesto de Importación (12% IVA):</span>
                                    <span>Q {calculatedQuote.taxesQts?.toFixed(2)}</span>
                                  </div>
                                  <div className="border-t border-gray-200/50 my-1"></div>
                                </>
                              )}

                              <div className="flex justify-between text-4xs text-gray-500">
                                <span className="flex items-center gap-1"><Package className="h-3 w-3 text-gray-400" /> Flete Internacional ({quoteWeight} Lbs):</span>
                                <span className="font-medium text-gray-800">Q {calculatedQuote.weightCost.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-4xs text-gray-500">
                                <span className="flex items-center gap-1"><Truck className="h-3 w-3 text-gray-400" /> Envío Local (Flat):</span>
                                <span className="font-medium text-gray-800">Q {calculatedQuote.base.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Big Estimated Total Highlight */}
                            <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 p-3 rounded-lg border border-orange-100/50 flex justify-between items-center">
                              <div>
                                <span className="text-5xs font-bold text-gray-400 uppercase tracking-widest block">TOTAL ESTIMADO</span>
                                <span className="text-5xs text-gray-400">
                                  {(calculatedQuote as any).whoPurchases === 'Cliente' 
                                    ? 'Únicamente flete internacional y envío local' 
                                    : 'Impuestos y envío local incluidos'}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-black text-brand-orange tracking-tight block">Q {calculatedQuote.total.toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Route Box */}
                            <div className="p-2 bg-blue-50/50 border border-blue-100/50 rounded text-4xs text-blue-800 leading-normal flex items-start gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-0.5" />
                              <div>
                                <strong>Ruta Logística:</strong> {calculatedQuote.route}
                              </div>
                            </div>

                            {/* Action Row */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-150/60">
                              <button
                                type="button"
                                onClick={handleCopyShareLink}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-4xs font-bold rounded transition duration-150 uppercase tracking-wider cursor-pointer"
                              >
                                <Share2 className="h-3 w-3" />
                                {copyLinkSuccess ? '¡Copiado!' : 'Copiar Enlace'}
                              </button>
                              <button
                                type="button"
                                onClick={handleDownloadPDF}
                                className="flex items-center justify-center gap-1 py-1.5 px-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-4xs font-bold rounded transition duration-150 uppercase tracking-wider cursor-pointer shadow-xs"
                              >
                                <FileDown className="h-3 w-3" />
                                Descargar PDF
                              </button>
                            </div>
                            
                            {copyLinkSuccess && (
                              <div className="text-center text-5xs text-green-600 font-bold bg-green-50 py-1 rounded border border-green-100/50 animate-fade-in">
                                ✓ ¡El enlace de esta cotización ha sido copiado al portapapeles!
                              </div>
                            )}
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
              <nav className="flex overflow-x-auto no-scrollbar space-x-1 bg-gray-800 p-1 rounded-lg border border-gray-700 max-w-full shrink-0">
                {currentUser.role === 'client' ? (
                  <>
                    <button
                      onClick={() => setActiveTab('my-locker')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      className="px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer active:scale-98 whitespace-nowrap"
                    >
                      <PlusCircle className="h-3.5 w-3.5 animate-pulse" />
                      Pre-Alertar 🚀
                    </button>
                    <button
                      onClick={() => setActiveTab('pickup-request')}
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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
                      className={`px-4 py-1.5 text-3xs font-bold rounded uppercase tracking-wider transition flex items-center gap-1.5 whitespace-nowrap ${
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

                  {/* Bodegas de Envío / Direcciones Oficiales */}
                  <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-xs space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-brand-orange animate-bounce" />
                        Direcciones de Bodega (Casillero)
                      </h4>
                      <p className="text-[10px] text-gray-400 font-semibold uppercase mt-0.5">Información sobre direcciones de recepción internacional</p>
                    </div>

                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-center space-y-2">
                      <span className="text-xl">📞</span>
                      <h5 className="text-[10px] font-black text-amber-800 uppercase tracking-wider">Verificación de Bodegas Requerida</h5>
                      <p className="text-[9.5px] text-amber-700 font-bold leading-normal uppercase tracking-wide">
                        contáctanos primero para verificar las direcciones de Bodegas
                      </p>
                      <p className="text-[8.5px] text-slate-500 font-medium">
                        Por motivos de actualización de seguridad y logística, todas nuestras direcciones de recepción internacional (EE.UU. y México) se encuentran temporalmente resguardadas. Ponte en contacto directo con soporte para habilitar tu despacho.
                      </p>
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded border border-gray-200 text-2xs text-brand-gray-dark shrink-0">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                          <option value="Texas">Texas 🇺🇸 (Laredo - Q60/Lb)</option>
                          <option value="Mexico">México 🇲🇽 (Q30/Lb)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Destino del Envío</label>
                        <select
                          value={quoteDestination}
                          onChange={(e) => setQuoteDestination(e.target.value)}
                          className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-brand-orange"
                        >
                          <option value="Alta Verapaz">Alta Verapaz</option>
                          <option value="Baja Verapaz">Baja Verapaz</option>
                          <option value="Chimaltenango">Chimaltenango</option>
                          <option value="Chiquimula">Chiquimula</option>
                          <option value="El Progreso">El Progreso</option>
                          <option value="Escuintla">Escuintla</option>
                          <option value="Guatemala">Guatemala</option>
                          <option value="Huehuetenango">Huehuetenango</option>
                          <option value="Izabal">Izabal</option>
                          <option value="Jalapa">Jalapa</option>
                          <option value="Jutiapa">Jutiapa</option>
                          <option value="Petén">Petén</option>
                          <option value="Quetzaltenango">Quetzaltenango</option>
                          <option value="Quiché">Quiché</option>
                          <option value="Retalhuleu">Retalhuleu</option>
                          <option value="Sacatepéquez">Sacatepéquez</option>
                          <option value="San Marcos">San Marcos</option>
                          <option value="Santa Rosa">Santa Rosa</option>
                          <option value="Sololá">Sololá</option>
                          <option value="Suchitepéquez">Suchitepéquez</option>
                          <option value="Totonicapán">Totonicapán</option>
                          <option value="Zacapa">Zacapa</option>
                        </select>
                      </div>
                    </div>

                    {/* ¿Quién compra? Selector */}
                    <div className="mt-3">
                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">¿Quién realiza la compra?</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setQuoteWhoPurchases('Nosotros')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition uppercase tracking-wider cursor-pointer ${
                            quoteWhoPurchases === 'Nosotros'
                              ? 'bg-brand-orange text-white shadow-3xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          🛒 ShipFast realiza la compra
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuoteWhoPurchases('Cliente')}
                          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition uppercase tracking-wider cursor-pointer ${
                            quoteWhoPurchases === 'Cliente'
                              ? 'bg-brand-orange text-white shadow-3xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          👤 Yo realizo mi propia compra
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Servicio de Envío Local</label>
                        <input
                          type="text"
                          readOnly
                          value="Envío Local Departamental (Q35.00)"
                          className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md bg-gray-50 text-gray-500 font-semibold focus:outline-none"
                        />
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

                    {quoteWhoPurchases === 'Nosotros' && (
                      <div className="grid grid-cols-2 gap-3 animate-fade-in">
                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Link del Producto (Opcional)</label>
                          <input
                            type="text"
                            placeholder="https://ejemplo.com/producto"
                            value={quoteProductLink}
                            onChange={(e) => setQuoteProductLink(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                          />
                        </div>

                        <div>
                          <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Precio del Producto ($ USD)</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={quoteProductPriceUsd === '' ? '' : quoteProductPriceUsd}
                            onChange={(e) => setQuoteProductPriceUsd(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-orange"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-brand-orange hover:bg-brand-orange-hover text-white text-xs font-bold py-2.5 rounded-md transition duration-200 uppercase tracking-wider mt-2 cursor-pointer"
                  >
                    Calcular Tarifa
                  </button>

                  {calculatedQuote && (
                    <div className="bg-white border border-gray-150 rounded-xl shadow-md p-4 space-y-3.5 border-t-4 border-t-brand-orange mt-4 animate-zoom-in">
                      <div className="flex justify-between items-center pb-2.5 border-b border-gray-150/60">
                        <div className="flex items-center gap-2">
                          <div className="p-1 bg-orange-100 rounded text-brand-orange">
                            <TrendingUp className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <h4 className="text-4xs font-bold text-gray-700 uppercase tracking-wider">Detalle del Flete</h4>
                            <p className="text-5xs text-gray-400 tracking-wide font-semibold">Cálculo Automático</p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-orange-50 text-brand-orange text-4xs font-bold rounded-full border border-orange-100/50 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {calculatedQuote.days}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {calculatedQuote.productLink && (
                          <div className="flex justify-between items-center text-4xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="flex items-center gap-1 shrink-0"><Link className="h-3 w-3 text-gray-400" /> Enlace:</span>
                            <a href={calculatedQuote.productLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 hover:underline truncate max-w-[150px] break-all">
                              {calculatedQuote.productLink}
                            </a>
                          </div>
                        )}

                        <div className="bg-gray-50/30 p-2.5 rounded border border-gray-100 space-y-1.5">
                          {calculatedQuote.productPriceUsd !== undefined && calculatedQuote.productPriceUsd > 0 && (
                            <>
                              <div className="flex justify-between text-4xs text-gray-500">
                                <span>Valor del Producto ($ USD):</span>
                                <span className="font-medium text-gray-800">${calculatedQuote.productPriceUsd.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-4xs text-gray-500">
                                <span>Valor en Quetzales (Cambio x8):</span>
                                <span className="font-semibold text-gray-800">Q {calculatedQuote.productPriceQts?.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-4xs text-red-500 font-medium">
                                <span>Impuesto de Importación (12% IVA):</span>
                                <span>Q {calculatedQuote.taxesQts?.toFixed(2)}</span>
                              </div>
                              <div className="border-t border-gray-200/50 my-1"></div>
                            </>
                          )}

                          <div className="flex justify-between text-4xs text-gray-500">
                            <span className="flex items-center gap-1"><Package className="h-3 w-3 text-gray-400" /> Flete Internacional ({quoteWeight} Lbs):</span>
                            <span className="font-medium text-gray-800">Q {calculatedQuote.weightCost.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-4xs text-gray-500">
                            <span className="flex items-center gap-1"><Truck className="h-3 w-3 text-gray-400" /> Envío Local (Flat):</span>
                            <span className="font-medium text-gray-800">Q {calculatedQuote.base.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Big Estimated Total Highlight */}
                        <div className="bg-gradient-to-r from-orange-50 to-orange-100/50 p-3 rounded-lg border border-orange-100/50 flex justify-between items-center">
                          <div>
                            <span className="text-5xs font-bold text-gray-400 uppercase tracking-widest block">TOTAL ESTIMADO</span>
                            <span className="text-5xs text-gray-400">
                              {(calculatedQuote as any).whoPurchases === 'Cliente' 
                                ? 'Únicamente flete internacional y envío local' 
                                : 'Impuestos y envío local incluidos'}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-brand-orange tracking-tight block">Q {calculatedQuote.total.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Route Box */}
                        <div className="p-2 bg-blue-50/50 border border-blue-100/50 rounded text-4xs text-blue-800 leading-normal flex items-start gap-1.5">
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-0.5" />
                          <div>
                            <strong>Ruta Logística:</strong> {calculatedQuote.route}
                          </div>
                        </div>

                        {/* Action Row */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-150/60">
                          <button
                            type="button"
                            onClick={handleCopyShareLink}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-4xs font-bold rounded transition duration-150 uppercase tracking-wider cursor-pointer"
                          >
                            <Share2 className="h-3 w-3" />
                            {copyLinkSuccess ? '¡Copiado!' : 'Copiar Enlace'}
                          </button>
                          <button
                            type="button"
                            onClick={handleDownloadPDF}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 bg-brand-orange hover:bg-brand-orange-hover text-white text-4xs font-bold rounded transition duration-150 uppercase tracking-wider cursor-pointer shadow-xs"
                          >
                            <FileDown className="h-3 w-3" />
                            Descargar PDF
                          </button>
                        </div>
                        
                        {copyLinkSuccess && (
                          <div className="text-center text-5xs text-green-600 font-bold bg-green-50 py-1 rounded border border-green-100/50 animate-fade-in">
                            ✓ ¡El enlace de esta cotización ha sido copiado al portapapeles!
                          </div>
                        )}
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
                if (['facturacion', 'pagos', 'gastos', 'cotizaciones'].includes(subTab)) return 'finanzas';
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
                  { id: 'cotizaciones', label: 'Generar Cotización', icon: ClipboardList },
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
                    <div className="bg-brand-gray-dark px-4 py-2 flex overflow-x-auto no-scrollbar space-x-2 border-b border-gray-800 shrink-0">
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
                            className={`flex items-center space-x-2 px-4 py-2 text-2xs font-extrabold uppercase tracking-wider rounded-md transition-all cursor-pointer whitespace-nowrap ${
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
                    <div className="bg-gray-50 px-4 py-2 flex overflow-x-auto no-scrollbar space-x-1 border-t border-gray-100 shrink-0">
                      {subTabsConfig[activeCategory].map(tab => {
                        const TabIcon = tab.icon;
                        const isTabActive = adminSubTab === tab.id;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => setAdminSubTab(tab.id)}
                            className={`flex items-center space-x-1.5 px-3 py-1.5 text-3xs font-extrabold uppercase tracking-widest rounded transition-all cursor-pointer border whitespace-nowrap ${
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
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div>
                            <h3 className="text-xs font-bold text-brand-gray-dark uppercase tracking-wider font-display mb-1">🕒 Pre-alertas Declaradas por Clientes</h3>
                            <p className="text-4xs text-gray-500">Buzón de recepción internacional. Cuando el cliente compra en tiendas online, declara su paquete antes de que llegue a nuestras bodegas en Laredo (USA) o México.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setAdminPreAlertLockerId('');
                              setClientPreAlertTracking('');
                              setClientPreAlertBodega('Laredo');
                              setClientPreAlertValue('');
                              setClientPreAlertInsurance('Sin seguro');
                              setClientPreAlertFileName('');
                              setIsAdminPreAlertModalOpen(true);
                            }}
                            className="bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold px-4 py-2 rounded uppercase tracking-wider cursor-pointer transition shadow-3xs flex items-center gap-1"
                          >
                            <PlusCircle className="h-3.5 w-3.5" />
                            Registrar Pre-Alerta Manual
                          </button>
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
                              {preAlerts.map(pa => {
                                const parts = pa.description ? pa.description.split(' | ') : [];
                                const cleanDescription = parts.filter(p => !p.startsWith('Factura:')).join(' | ');
                                const invoiceFile = pa.invoiceFileName || (() => {
                                  if (pa.description && pa.description.includes('Factura:')) {
                                    const matchParts = pa.description.split('Factura:');
                                    if (matchParts.length > 1) return matchParts[1].trim();
                                  }
                                  return null;
                                })();

                                return (
                                  <tr key={pa.id} className="hover:bg-gray-50/50">
                                    <td className="py-3 px-4 font-mono font-bold text-brand-orange uppercase">
                                      <div className="flex items-center gap-1">
                                        <span>{pa.id}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            navigator.clipboard.writeText(pa.id);
                                            alert(`Tracking "${pa.id}" copiado al portapapeles.`);
                                          }}
                                          className="p-1 text-gray-400 hover:text-brand-orange hover:bg-orange-50 rounded transition cursor-pointer"
                                          title="Copiar Tracking"
                                        >
                                          <Copy className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                    <td className="py-3 px-3 font-mono text-gray-500">{pa.lockerId}</td>
                                    <td className="py-3 px-3 font-bold">{pa.sender}</td>
                                    <td className="py-3 px-3">
                                      <div className="flex flex-col gap-1 text-left">
                                        <span className="italic text-brand-gray-dark font-medium">{cleanDescription}</span>
                                        {invoiceFile && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActivePreAlertInvoice({ ...pa, invoiceFileName: invoiceFile });
                                            }}
                                            className="mt-1 self-start inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 hover:text-blue-800 text-[10px] font-black tracking-wider transition-all duration-150 cursor-pointer shadow-3xs"
                                            title={`Ver archivo: ${invoiceFile}`}
                                          >
                                            📄 Ver Factura ({invoiceFile})
                                          </button>
                                        )}
                                      </div>
                                    </td>
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

                                                const declaredValue = pa.declaredValue || (() => {
                                                  if (pa.description && pa.description.includes('Valor: $')) {
                                                    const valParts = pa.description.split('Valor: $');
                                                    if (valParts.length > 1) {
                                                      const val = parseFloat(valParts[1].split(' | ')[0]);
                                                      if (!isNaN(val)) return val;
                                                    }
                                                  }
                                                  return 0;
                                                })();
                                                const hasInsurance = pa.insurance === 'Con seguro (5%)' || (pa.description && pa.description.includes('Seguro: Con seguro (5%)'));
                                                const insuranceFeeUsd = hasInsurance ? (declaredValue * 0.05) : 0;
                                                const insuranceFeeGtq = insuranceFeeUsd * 8.00;
                                                const totalCharge = flete + insuranceFeeGtq;

                                                const invoiceId = `FAC-${1000 + invoices.length + 1}`;
                                                const newInvoice = {
                                                  id: invoiceId,
                                                  lockerId: pa.lockerId,
                                                  date: currentDate,
                                                  concept: isShein
                                                    ? `Flete Especial Bolsa Shein ${generatedId}${insuranceFeeGtq > 0 ? ` + Seguro 5% (Q ${insuranceFeeGtq.toFixed(2)})` : ''}`
                                                    : `Cargo Flete Almacén Laredo ${generatedId} (${pa.weightEst} Lbs)${insuranceFeeGtq > 0 ? ` + Seguro 5% (Q ${insuranceFeeGtq.toFixed(2)})` : ''}`,
                                                  amount: totalCharge,
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

                                            // Trigger background receipt email to client!
                                            sendPreAlertReceivedEmailHelper(pa, generatedId, flete, insuranceFeeGtq, totalCharge, true);

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

                                                const declaredValue = pa.declaredValue || (() => {
                                                  if (pa.description && pa.description.includes('Valor: $')) {
                                                    const valParts = pa.description.split('Valor: $');
                                                    if (valParts.length > 1) {
                                                      const val = parseFloat(valParts[1].split(' | ')[0]);
                                                      if (!isNaN(val)) return val;
                                                    }
                                                  }
                                                  return 0;
                                                })();
                                                const hasInsurance = pa.insurance === 'Con seguro (5%)' || (pa.description && pa.description.includes('Seguro: Con seguro (5%)'));
                                                const insuranceFeeUsd = hasInsurance ? (declaredValue * 0.05) : 0;
                                                const insuranceFeeGtq = insuranceFeeUsd * 8.00;
                                                const totalCharge = flete + insuranceFeeGtq;

                                                const invoiceId = `FAC-${1000 + invoices.length + 1}`;
                                                const newInvoice = {
                                                  id: invoiceId,
                                                  lockerId: pa.lockerId,
                                                  date: currentDate,
                                                  concept: isShein
                                                    ? `Flete Especial Bolsa Shein ${generatedId}${insuranceFeeGtq > 0 ? ` + Seguro 5% (Q ${insuranceFeeGtq.toFixed(2)})` : ''}`
                                                    : `Cargo Flete Almacén México ${generatedId} (${pa.weightEst} Lbs)${insuranceFeeGtq > 0 ? ` + Seguro 5% (Q ${insuranceFeeGtq.toFixed(2)})` : ''}`,
                                                  amount: totalCharge,
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

                                            // Trigger background receipt email to client!
                                            sendPreAlertReceivedEmailHelper(pa, generatedId, flete, insuranceFeeGtq, totalCharge, false);

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
                                );
                              })}

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
                                    <th className="py-2.5 px-4 text-center">Acciones</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                  {invoices.map(invoice => {
                                    const parsed = parseInvoiceConcept(invoice.concept);
                                    return (
                                      <tr key={invoice.id} className="hover:bg-gray-50/50">
                                        <td className="py-3 px-4 font-bold text-brand-gray-dark uppercase">{invoice.id}</td>
                                        <td className="py-3 px-3 font-mono text-gray-500">{invoice.lockerId || 'N/R'}</td>
                                        <td className="py-3 px-3 font-mono">{invoice.date}</td>
                                        <td className="py-3 px-3">
                                          <div className="flex flex-col gap-0.5">
                                            <span className="font-bold text-brand-gray-dark">{parsed.detail}</span>
                                            {parsed.manualClientName && (
                                              <span className="text-4xs text-gray-400 font-extrabold uppercase flex items-center gap-1">
                                                👤 Cliente: {parsed.manualClientName} (No Registrado)
                                              </span>
                                            )}
                                            {parsed.purchaseLink && (
                                              <a
                                                href={parsed.purchaseLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-4xs text-brand-orange hover:text-brand-orange-hover hover:underline font-extrabold flex items-center gap-0.5"
                                              >
                                                🔗 Link Compra
                                              </a>
                                            )}
                                          </div>
                                        </td>
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
                                        <td className="py-3 px-4 text-center">
                                          <button
                                            type="button"
                                            onClick={() => handlePrintInvoicePDF(invoice)}
                                            className="bg-brand-gray-dark hover:bg-brand-gray-dark/80 text-white font-extrabold text-4xs px-2.5 py-1 rounded transition uppercase tracking-wider flex items-center gap-1 mx-auto cursor-pointer"
                                            title="Generar Factura en PDF profesional"
                                          >
                                            🖨️ PDF
                                          </button>
                                        </td>
                                      </tr>
                                    );
                                  })}
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
                                if (invoiceUnregistered && !invoiceManualName.trim()) {
                                  alert('Ingrese el nombre del cliente no registrado.');
                                  return;
                                }

                                const currentDate = new Date().toISOString().split('T')[0];
                                const invoiceId = `FAC-${1000 + invoices.length + 1}`;
                                const conceptPayload = JSON.stringify({
                                  detail: invoiceConcept.trim(),
                                  manualClientName: invoiceUnregistered ? invoiceManualName.trim() : '',
                                  purchaseLink: invoicePurchaseLink.trim()
                                });

                                const selectedLockerId = invoiceUnregistered 
                                  ? null 
                                  : (invoiceLocker || (users.filter(u => u.role === 'client')[0]?.lockerId || null));

                                const newInvoice = {
                                  id: invoiceId,
                                  lockerId: selectedLockerId,
                                  date: currentDate,
                                  concept: conceptPayload,
                                  amount: invoiceAmount,
                                  paymentStatus: 'Pendiente'
                                };

                                // Save to Supabase
                                db.upsertInvoice(newInvoice);

                                setInvoices(prev => [
                                  newInvoice,
                                  ...prev
                                ]);

                                alert(`Factura manual ${invoiceId} emitida por un valor de Q ${invoiceAmount.toFixed(2)} asociada a ${invoiceUnregistered ? `cliente manual: ${invoiceManualName}` : `casillero ${selectedLockerId}`}.`);
                                
                                // Reset fields
                                setInvoiceConcept('');
                                setInvoiceAmount(120.00);
                                setInvoiceManualName('');
                                setInvoicePurchaseLink('');
                                setInvoiceUnregistered(false);
                                setInvoiceLocker('');
                              }}
                              className="space-y-3"
                            >
                              {/* Checkbox Cliente No Registrado */}
                              <div className="flex items-center gap-2 py-1">
                                <input
                                  type="checkbox"
                                  id="invoiceUnregistered"
                                  checked={invoiceUnregistered}
                                  onChange={(e) => {
                                    setInvoiceUnregistered(e.target.checked);
                                    if (e.target.checked) {
                                      setInvoiceLocker('');
                                    }
                                  }}
                                  className="h-3.5 w-3.5 rounded border-gray-300 text-brand-orange focus:ring-brand-orange cursor-pointer"
                                />
                                <label htmlFor="invoiceUnregistered" className="text-4xs font-extrabold text-brand-gray-dark uppercase tracking-wider cursor-pointer select-none">
                                  👤 Cliente No Registrado
                                </label>
                              </div>

                              {/* Conditionally show select or text input */}
                              {!invoiceUnregistered ? (
                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Casillero Asignado *</label>
                                  <select
                                    value={invoiceLocker}
                                    onChange={(e) => setInvoiceLocker(e.target.value)}
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-mono text-brand-orange font-bold"
                                  >
                                    <option value="">-- Seleccionar Casillero --</option>
                                    {users.filter(u => u.role === 'client').map(u => (
                                      <option key={u.lockerId} value={u.lockerId}>{u.lockerId} &mdash; {u.name}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre del Cliente *</label>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Nombre de la persona (manual)"
                                    value={invoiceManualName}
                                    onChange={(e) => setInvoiceManualName(e.target.value)}
                                    className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark"
                                  />
                                </div>
                              )}

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
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Link de la Compra (Opcional)</label>
                                <input
                                  type="url"
                                  placeholder="https://ejemplo.com/compra/item"
                                  value={invoicePurchaseLink}
                                  onChange={(e) => setInvoicePurchaseLink(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark font-mono text-xs"
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
                    {/* ==================== NUEVO MÓDULO DE COTIZACIONES (`cotizaciones`) ==================== */}
                    {adminSubTab === 'cotizaciones' && (() => {
                      // Handle SVG PDF generation
                      const handleGenerateQuotationPDF = (e: React.FormEvent) => {
                        e.preventDefault();
                        
                        let clientName = '';
                        let clientNit = '';
                        let clientCompany = '';
                        let clientLocker = '';
                        let clientEmail = '';

                        if (quoteClientType === 'registered') {
                          const targetUser = users.find(u => u.lockerId === quoteLockerId.toUpperCase());
                          if (!targetUser) {
                            alert('Por favor selecciona un casillero válido.');
                            return;
                          }
                          clientName = targetUser.name;
                          clientNit = (targetUser as any).nit || 'CF';
                          clientCompany = (targetUser as any).companyName || 'Particular';
                          clientLocker = targetUser.lockerId;
                          clientEmail = targetUser.email || '';
                        } else {
                          if (!quoteManualName.trim()) {
                            alert('Por favor ingresa el nombre del cliente.');
                            return;
                          }
                          clientName = quoteManualName.trim();
                          clientNit = quoteManualNit.trim() || 'CF';
                          clientCompany = quoteManualCompany.trim() || 'Particular';
                          clientLocker = 'MANUAL';
                          clientEmail = quoteManualEmail.trim();
                        }

                        const weightVal = parseFloat(quoteFormWeight) || 0;
                        const rateVal = parseFloat(quoteFormWeightRate) || 0;
                        const extraVal = parseFloat(quoteExtraCharges) || 0;
                        const subtotalWeight = weightVal * rateVal;
                        const totalQuote = subtotalWeight + extraVal;

                        const todayStr = new Date().toISOString().split('T')[0];
                        const quoteNumber = `COT-${Math.floor(1000 + Math.random() * 9000)}`;

                        // Generate print-ready HTML Invoice window containing beautiful SVG & Table styling
                        const printWindow = window.open('', '_blank');
                        if (!printWindow) {
                          alert('Error: Por favor permita las ventanas emergentes (pop-ups) para generar la cotización.');
                          return;
                        }

                        printWindow.document.write(`
                          <html>
                          <head>
                            <title>Cotización ${quoteNumber} - ShipFast</title>
                            <meta charset="utf-8" />
                            <style>
                              @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800;900&display=swap');
                              body {
                                font-family: 'Outfit', sans-serif;
                                margin: 0;
                                padding: 40px;
                                color: #1e293b;
                                background-color: #ffffff;
                                -webkit-print-color-adjust: exact;
                              }
                              .header {
                                display: flex;
                                justify-content: space-between;
                                align-items: flex-start;
                                border-bottom: 2px solid #f1f5f9;
                                padding-bottom: 30px;
                                margin-bottom: 30px;
                              }
                              .logo-section {
                                display: flex;
                                align-items: center;
                                gap: 15px;
                              }
                              .logo-svg {
                                width: 50px;
                                height: 50px;
                              }
                              .brand-title {
                                font-size: 24px;
                                font-weight: 900;
                                text-transform: uppercase;
                                color: #f97316;
                                letter-spacing: -1px;
                              }
                              .brand-subtitle {
                                font-size: 10px;
                                font-weight: 800;
                                color: #64748b;
                                text-transform: uppercase;
                                tracking: 2px;
                              }
                              .doc-info {
                                text-align: right;
                              }
                              .doc-title {
                                font-size: 26px;
                                font-weight: 900;
                                text-transform: uppercase;
                                color: #0f172a;
                                margin: 0 0 5px 0;
                              }
                              .doc-number {
                                font-size: 14px;
                                font-weight: 800;
                                color: #f97316;
                                margin-bottom: 10px;
                              }
                              .meta-grid {
                                display: grid;
                                grid-template-cols: 1fr 1fr;
                                gap: 40px;
                                margin-bottom: 40px;
                              }
                              .meta-box {
                                background-color: #f8fafc;
                                border: 1px solid #e2e8f0;
                                border-radius: 16px;
                                padding: 20px;
                              }
                              .meta-title {
                                font-size: 11px;
                                font-weight: 800;
                                color: #64748b;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                margin-bottom: 12px;
                                border-bottom: 1px solid #e2e8f0;
                                padding-bottom: 6px;
                              }
                              .meta-item {
                                font-size: 12px;
                                line-height: 1.6;
                                margin-bottom: 4px;
                              }
                              .meta-item strong {
                                color: #475569;
                              }
                              .table-items {
                                w-full;
                                width: 100%;
                                border-collapse: collapse;
                                margin-bottom: 40px;
                              }
                              .table-items th {
                                background-color: #0f172a;
                                color: #ffffff;
                                text-transform: uppercase;
                                font-size: 10px;
                                font-weight: 800;
                                letter-spacing: 1px;
                                padding: 12px 16px;
                                text-align: left;
                              }
                              .table-items td {
                                padding: 16px;
                                border-bottom: 1px solid #e2e8f0;
                                font-size: 12px;
                              }
                              .table-items tr:last-child td {
                                border-bottom: 2px solid #0f172a;
                              }
                              .summary-section {
                                display: flex;
                                justify-content: flex-end;
                                margin-bottom: 40px;
                              }
                              .summary-table {
                                width: 300px;
                                border-collapse: collapse;
                              }
                              .summary-table td {
                                padding: 8px 16px;
                                font-size: 12px;
                              }
                              .summary-table .total-row td {
                                font-size: 16px;
                                font-weight: 900;
                                color: #f97316;
                                border-top: 2px solid #f1f5f9;
                                padding-top: 12px;
                              }
                              .obs-box {
                                background-color: #fffbeb;
                                border: 1px solid #fef3c7;
                                border-radius: 16px;
                                padding: 20px;
                                font-size: 11px;
                                line-height: 1.5;
                                color: #92400e;
                                margin-bottom: 50px;
                              }
                              .footer {
                                text-align: center;
                                font-size: 10px;
                                color: #94a3b8;
                                border-top: 1px solid #f1f5f9;
                                padding-top: 20px;
                              }
                              @media print {
                                body {
                                  padding: 0;
                                }
                                .no-print {
                                  display: none;
                                }
                              }
                            </style>
                          </head>
                          <body>
                            <div class="header">
                              <div class="logo-section">
                                <!-- Vector SVG Logo -->
                                <svg class="logo-svg" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <circle cx="50" cy="50" r="48" fill="#f97316" />
                                  <path d="M25 50H75M75 50L55 30M75 50L55 70" stroke="white" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                                <div>
                                  <div class="brand-title">ShipFast</div>
                                  <div class="brand-subtitle">Courier & Logistics</div>
                                </div>
                              </div>
                              <div class="doc-info">
                                <h1 class="doc-title">Cotización</h1>
                                <div class="doc-number">Referencia: ${quoteNumber}</div>
                                <div style="font-size: 11px; color: #64748b;">Fecha Emisión: ${todayStr}</div>
                              </div>
                            </div>

                            <div class="meta-grid">
                              <div class="meta-box">
                                <div class="meta-title">Datos del Cliente</div>
                                <div class="meta-item"><strong>Nombre:</strong> ${clientName}</div>
                                <div class="meta-item"><strong>NIT:</strong> ${clientNit}</div>
                                <div class="meta-item"><strong>Empresa:</strong> ${clientCompany}</div>
                                ${clientEmail ? `<div class="meta-item"><strong>Email:</strong> ${clientEmail}</div>` : ''}
                                ${clientLocker !== 'MANUAL' ? `<div class="meta-item"><strong>Casillero Asociado:</strong> ${clientLocker}</div>` : ''}
                              </div>
                              <div class="meta-box">
                                <div class="meta-title">Detalles del Emisor</div>
                                <div class="meta-item"><strong>ShipFast Guatemala S.A.</strong></div>
                                <div class="meta-item"><strong>NIT:</strong> 82194819-2</div>
                                <div class="meta-item"><strong>Dirección:</strong> 15 Calle 12-40 Zona 10, Edificio Géminis</div>
                                <div class="meta-item"><strong>PBX:</strong> +502 2300-8800</div>
                                <div class="meta-item"><strong>Email:</strong> cotizaciones@shipfast.com.gt</div>
                              </div>
                            </div>

                            <table class="table-items">
                              <thead>
                                <tr>
                                  <th>Descripción del Servicio</th>
                                  <th style="text-align: center; width: 100px;">Peso (Lbs)</th>
                                  <th style="text-align: right; width: 120px;">Tarifa unitaria</th>
                                  <th style="text-align: right; width: 120px;">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td>
                                    <strong>${quoteConcept}</strong>
                                    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Servicios logísticos unificados de aduana, importación y manipulación.</div>
                                  </td>
                                  <td style="text-align: center; font-weight: bold;">${weightVal.toFixed(1)} Lbs</td>
                                  <td style="text-align: right; font-family: monospace;">Q ${rateVal.toFixed(2)}</td>
                                  <td style="text-align: right; font-weight: bold; font-family: monospace;">Q ${subtotalWeight.toFixed(2)}</td>
                                </tr>
                                ${extraVal > 0 ? `
                                <tr>
                                  <td>
                                    <strong>Cargos Adicionales y Trámites</strong>
                                    <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Gastos de despacho aduanal locales o entrega a domicilio.</div>
                                  </td>
                                  <td style="text-align: center;">-</td>
                                  <td style="text-align: right; font-family: monospace;">Q ${extraVal.toFixed(2)}</td>
                                  <td style="text-align: right; font-weight: bold; font-family: monospace;">Q ${extraVal.toFixed(2)}</td>
                                </tr>
                                ` : ''}
                              </tbody>
                            </table>

                            <div class="summary-section">
                              <table class="summary-table">
                                <tr>
                                  <td style="color: #64748b; font-weight: 600;">Subtotal:</td>
                                  <td style="text-align: right; font-family: monospace; font-weight: bold;">Q ${totalQuote.toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td style="color: #64748b; font-weight: 600;">Impuestos (IVA incl.):</td>
                                  <td style="text-align: right; font-family: monospace; color: #64748b;">Incluido</td>
                                </tr>
                                <tr class="total-row">
                                  <td>Total Estimado:</td>
                                  <td style="text-align: right; font-family: monospace;">Q ${totalQuote.toFixed(2)}</td>
                                </tr>
                              </table>
                            </div>

                            <div class="obs-box">
                              <strong>Términos y Observaciones:</strong><br/>
                              ${quoteObservations.replace(/\n/g, '<br/>')}
                            </div>

                            <div class="footer">
                              <p>Gracias por confiar en ShipFast. Su mejor aliado en soluciones logísticas internacionales.</p>
                              <p style="font-size: 8px; color: #cbd5e1; margin-top: 10px;">Documento generado automáticamente por ShipFast Management System.</p>
                            </div>

                            <script>
                              window.onload = function() {
                                window.print();
                              }
                            </script>
                          </body>
                          </html>
                        `);
                        printWindow.document.close();
                      };

                      return (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in font-sans">
                          
                          {/* Left Form Box */}
                          <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-6">
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                              <div className="bg-orange-50 text-brand-orange p-3 rounded-2xl flex items-center justify-center w-12 h-12 border border-orange-100">
                                <ClipboardList className="h-6 w-6" />
                              </div>
                              <div>
                                <h3 className="text-sm font-extrabold text-brand-gray-dark tracking-tight uppercase">Emisión de Cotizaciones Oficiales</h3>
                                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">Genere archivos PDF con el logotipo oficial e importes calculados</p>
                              </div>
                            </div>

                            <form onSubmit={handleGenerateQuotationPDF} className="space-y-5">
                              
                              {/* Client Type Selector */}
                              <div>
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-2">Tipo de Cliente Destinatario</label>
                                <div className="grid grid-cols-2 gap-4">
                                  <button
                                    type="button"
                                    onClick={() => setQuoteClientType('registered')}
                                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${quoteClientType === 'registered' ? 'bg-orange-50 border-brand-orange text-brand-orange shadow-2xs' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                  >
                                    👤 Cliente con Casillero
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuoteClientType('manual')}
                                    className={`py-3 px-4 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${quoteClientType === 'manual' ? 'bg-orange-50 border-brand-orange text-brand-orange shadow-2xs' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                                  >
                                    ➕ Agregar Cliente Manual
                                  </button>
                                </div>
                              </div>

                              {/* Form fields based on client type selection */}
                              {quoteClientType === 'registered' ? (
                                <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl animate-fade-in">
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Buscar y Seleccionar Casillero *</label>
                                  <select
                                    required
                                    value={quoteLockerId}
                                    onChange={(e) => setQuoteLockerId(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark bg-white"
                                  >
                                    <option value="">-- Seleccionar Casillero --</option>
                                    {users.map(u => (
                                      <option key={u.lockerId} value={u.lockerId}>
                                        {u.name} (Locker: {u.lockerId})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-4 animate-fade-in">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Nombre Completo del Cliente *</label>
                                      <input
                                        type="text"
                                        required
                                        placeholder="Ej: Juan Antonio Pérez"
                                        value={quoteManualName}
                                        onChange={(e) => setQuoteManualName(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark bg-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">NIT Facturación</label>
                                      <input
                                        type="text"
                                        placeholder="Ej: 839210-9 o CF"
                                        value={quoteManualNit}
                                        onChange={(e) => setQuoteManualNit(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark bg-white"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Nombre de la Empresa</label>
                                      <input
                                        type="text"
                                        placeholder="Ej: Importaciones del Norte S.A."
                                        value={quoteManualCompany}
                                        onChange={(e) => setQuoteManualCompany(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark bg-white"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
                                      <input
                                        type="email"
                                        placeholder="Ej: juan.perez@empresa.com"
                                        value={quoteManualEmail}
                                        onChange={(e) => setQuoteManualEmail(e.target.value)}
                                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark bg-white"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Quotation concept details */}
                              <div>
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Concepto o Descripción General *</label>
                                <input
                                  type="text"
                                  required
                                  value={quoteConcept}
                                  onChange={(e) => setQuoteConcept(e.target.value)}
                                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark"
                                />
                              </div>

                              {/* Rates and Calculations */}
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Peso en Libras (Lbs) *</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    required
                                    min="0.1"
                                    value={quoteFormWeight}
                                    onChange={(e) => setQuoteFormWeight(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-mono font-bold text-brand-gray-dark"
                                  />
                                </div>

                                <div>
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Tarifa por Libra (Q) *</label>
                                  <input
                                    type="number"
                                    step="1"
                                    required
                                    min="1"
                                    value={quoteFormWeightRate}
                                    onChange={(e) => setQuoteFormWeightRate(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-mono font-bold text-brand-gray-dark"
                                  />
                                </div>

                                <div>
                                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Cargos Adicionales (Q)</label>
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={quoteExtraCharges}
                                    onChange={(e) => setQuoteExtraCharges(e.target.value)}
                                    className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-mono font-bold text-brand-gray-dark"
                                  />
                                </div>
                              </div>

                              {/* Observations text */}
                              <div>
                                <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Términos y Observaciones de la Cotización</label>
                                <textarea
                                  rows={3}
                                  value={quoteObservations}
                                  onChange={(e) => setQuoteObservations(e.target.value)}
                                  className="w-full p-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark leading-relaxed"
                                />
                              </div>

                              {/* Action Submit */}
                              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                                <button
                                  type="submit"
                                  className="bg-brand-orange hover:bg-brand-orange-hover text-white font-extrabold text-xs py-3 px-8 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-100 hover:shadow-orange-200 active:scale-98 transition cursor-pointer uppercase tracking-wider"
                                >
                                  <Printer className="h-4 w-4" />
                                  Generar PDF / Cotización SVG
                                </button>
                              </div>

                            </form>
                          </div>

                          {/* Info Sidebar Box */}
                          <div className="lg:col-span-4 bg-slate-50 border border-slate-200/50 p-6 rounded-3xl text-3xs space-y-4 leading-relaxed text-slate-600">
                            <h4 className="font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-slate-200/40 pb-2">Instrucciones del Módulo</h4>
                            <p>Este generador produce cotizaciones unificadas alineadas con la imagen de marca de la empresa.</p>
                            
                            <ul className="list-disc pl-4 space-y-2">
                              <li><strong>Casilleros:</strong> Al cotizar a un casillero registrado se auto-completan los campos del perfil guardados (Empresa, Nombre, Correo).</li>
                              <li><strong>Cliente Manual:</strong> Utilícelo para cotizar servicios a empresas o personas particulares que aún no tienen una cuenta activa.</li>
                              <li><strong>Formatos SVG:</strong> El PDF generado integra un logotipo vectorial SVG que garantiza máxima fidelidad visual y nitidez al imprimirse o guardarse.</li>
                            </ul>
                          </div>

                        </div>
                      );
                    })()}

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

                                const expId = `GTO-${800 + expensesLog.length + 1}`;
                                const newExpense = {
                                  id: expId,
                                  date: expenseDate,
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
                                setExpenseDate(new Date().toISOString().split('T')[0]);
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
                                  <option value="Internet">Internet</option>
                                  <option value="Luz">Luz</option>
                                  <option value="Renta">Renta</option>
                                  <option value="Impuestos">Impuestos</option>
                                  <option value="Salarios">Salarios</option>
                                  <option value="Gastos Laredo">Gastos Laredo</option>
                                  <option value="Gastos Tapachula">Gastos Tapachula</option>
                                  <option value="Gastos Greensboro">Gastos Greensboro</option>
                                  <option value="Cargo Express">Cargo Express</option>
                                  <option value="Gastos Oficina">Gastos Oficina</option>
                                  <option value="Compras Online">Compras Online</option>
                                  <option value="Otros">Otros</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Fecha del Gasto *</label>
                                <input
                                  type="date"
                                  required
                                  value={expenseDate}
                                  onChange={(e) => setExpenseDate(e.target.value)}
                                  className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark focus:border-brand-orange focus:ring-1 focus:ring-brand-orange bg-white outline-hidden"
                                />
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
                                  step="0.01"
                                  min="0.01"
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

                      const handleSaveEditedUser = async (e: React.FormEvent) => {
                        e.preventDefault();
                        if (!selectedUserForEdit) return;

                        // Phone validation force +502
                        let phone = selectedUserForEdit.phone.trim();
                        if (!phone.startsWith('+502')) {
                          phone = '+502 ' + phone.replace('+502', '').trim();
                        }

                        const updatedUser = {
                          ...selectedUserForEdit,
                          phone
                        };

                        // Save to Supabase
                        const success = await db.upsertProfile(updatedUser);
                        if (success) {
                          setUsers(users.map(u => u.lockerId === updatedUser.lockerId ? updatedUser : u));
                          alert(`El perfil del usuario ${updatedUser.name} (${updatedUser.lockerId}) ha sido actualizado con éxito.`);
                          setSelectedUserForEdit(null);
                        } else {
                          alert('Ocurrió un error al intentar guardar los cambios en la base de datos.');
                        }
                      };

                      const handleDeleteUser = async (lockerId: string) => {
                        const success = await db.deleteProfile(lockerId);
                        if (success) {
                          setUsers(users.filter(u => u.lockerId !== lockerId));
                          alert('El usuario ha sido eliminado exitosamente de la base de datos.');
                          setSelectedUserForEdit(null);
                        } else {
                          alert('Ocurrió un error al intentar eliminar el usuario de la base de datos.');
                        }
                      };

                      const handleCopyWelcomeEmail = () => {
                        if (!selectedUserForEdit) return;
                        
                        const nameParts = selectedUserForEdit.name.trim().split(/\s+/);
                        const firstName = nameParts[0] || '';
                        const lastName = nameParts.slice(1).join(' ') || '';
                        
                        const emailBodyText = `¡Bienvenido/a a ShipFast GT! 🇬🇹🚀

Estimado/a ${selectedUserForEdit.name},

Nos complace darte la más cordial bienvenida a ShipFast GT, tu servicio de mensajería y casillero internacional de confianza. A partir de este momento, tienes acceso a nuestras bodegas en Estados Unidos y México para recibir todas tus compras de forma rápida, segura y económica.

A continuación, te detallamos la información de tu casillero y las direcciones exactas que debes utilizar al realizar tus compras en tus tiendas favoritas (Amazon, SHEIN, Mercado Libre, etc.).

--------------------------------------------------
📦 BODEGA EE.UU.
--------------------------------------------------
Copia y pega estos datos exactamente igual al hacer tu compra:

Nombre: ShipFast ${firstName}
Apellido: ${lastName}
Teléfono: +1 757-7762319
Dirección 1: 1900 Justo Penn St.
Suite / Apt: ${selectedUserForEdit.lockerId}
Ciudad: Laredo
Estado: Texas (TX)
Zip Code: 78041

--------------------------------------------------
🇲🇽 BODEGA COMPRAS MÉXICO
--------------------------------------------------
Copia y pega estos datos exactamente igual al hacer tu compra:

Nombre: ShipFast ${firstName}
Apellido: ${lastName}
Teléfono: 9621027742
Ubicación: México
Dirección: Libramiento Sur Ote, Parque Logístico Tamarindo
Referencias: [${selectedUserForEdit.lockerId}] + Bodega JT Express 320B Jony Maza Blanca Díaz
Estado: Chiapas
Ciudad: Tapachula
Distrito: Tapachula Centro
Código Postal: 30700
CURP: GADB000327MCSBZLA7

--------------------------------------------------
👗 ENVÍOS DE SHEIN MÉXICO
--------------------------------------------------
Utiliza esta dirección específica para tus compras en SHEIN:

Nombre: ShipFast ${firstName}
Apellido: ${lastName}
Teléfono: 9621027742
Ubicación: México
Dirección: Libramiento Sur Ote, Parque Logístico Tamarindo
Referencias: [${selectedUserForEdit.lockerId}] + Bodega JT Express 320B Jony Maza Blanca Díaz
Estado/Provincia: Chiapas
Ciudad: Tapachula
Distrito: La Joya
Código Postal: 30783
CURP: GADB000327MCSBZLA7

--------------------------------------------------
📱 INFORMACIÓN DE SOPORTE Y CONTACTO
--------------------------------------------------
Recuerda que estamos para apoyarte en cada paso de tus envíos. Si tienes alguna duda, puedes contactarnos directamente a nuestro WhatsApp oficial:

💬 WhatsApp Soporte: +502 3726-8751

¡Gracias por confiar en ShipFast GT! Esperamos servirte muy pronto.

Atentamente,
El Equipo de ShipFast GT`;

                        navigator.clipboard.writeText(emailBodyText);
                        alert(`¡Correo de bienvenida para ${selectedUserForEdit.name} copiado al portapapeles con éxito!`);
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
                                      <th className="py-2.5 px-4">Correo</th>
                                      <th className="py-2.5 px-4 text-center">Acciones</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100 text-3xs font-semibold text-brand-gray-dark">
                                    {users.map((u, uIdx) => (
                                      <tr 
                                        key={uIdx} 
                                        onClick={() => setSelectedUserForEdit(u)}
                                        className={`hover:bg-gray-50/70 transition cursor-pointer ${
                                          selectedUserForEdit?.lockerId === u.lockerId ? 'bg-orange-50/50 hover:bg-orange-50' : ''
                                        }`}
                                      >
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
                                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedUserForEdit(u)}
                                            className="px-2.5 py-1 bg-brand-orange/10 hover:bg-brand-orange text-brand-orange hover:text-white rounded border border-brand-orange/20 text-5xs font-black uppercase tracking-wider transition cursor-pointer"
                                          >
                                            Editar
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            {/* Operator register/edit - RIGHT */}
                            <div className="lg:col-span-4 bg-gray-50 border border-gray-200 p-5 rounded-lg space-y-4 shadow-xs">
                              {selectedUserForEdit ? (
                                <div className="space-y-4 animate-fade-in">
                                  <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                                    <h4 className="text-3xs font-extrabold text-brand-orange uppercase tracking-wider">Detalles / Editar Perfil</h4>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedUserForEdit(null)}
                                      className="text-5xs text-gray-500 hover:text-gray-700 font-bold bg-white border border-gray-250 px-2 py-0.5 rounded cursor-pointer transition shadow-3xs"
                                    >
                                      Volver
                                    </button>
                                  </div>

                                  <form onSubmit={handleSaveEditedUser} className="space-y-3">
                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Identificador (Casillero)</label>
                                      <input
                                        type="text"
                                        disabled
                                        value={selectedUserForEdit.lockerId}
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-200 rounded font-bold font-mono text-gray-400 bg-gray-100 cursor-not-allowed"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Completo *</label>
                                      <input
                                        type="text"
                                        required
                                        value={selectedUserForEdit.name}
                                        onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, name: e.target.value })}
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Rol / Función *</label>
                                      <select
                                        value={selectedUserForEdit.role}
                                        onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, role: e.target.value })}
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:border-brand-orange focus:ring-1 focus:ring-brand-orange bg-white font-semibold text-brand-gray-dark outline-hidden"
                                      >
                                        <option value="client">Cliente</option>
                                        <option value="admin">Administrador Central</option>
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
                                        value={selectedUserForEdit.phone}
                                        onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, phone: e.target.value })}
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-bold font-mono text-brand-gray-dark bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Correo Electrónico *</label>
                                      <input
                                        type="email"
                                        required
                                        value={selectedUserForEdit.email}
                                        onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, email: e.target.value })}
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Dirección Registrada *</label>
                                      <textarea
                                        rows={2}
                                        required
                                        value={selectedUserForEdit.address || ''}
                                        onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, address: e.target.value })}
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark bg-white resize-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Contraseña de Acceso</label>
                                      <input
                                        type="text"
                                        value={selectedUserForEdit.password || ''}
                                        onChange={(e) => setSelectedUserForEdit({ ...selectedUserForEdit, password: e.target.value })}
                                        placeholder="Ingrese contraseña"
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-bold font-mono text-brand-gray-dark bg-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                      <button
                                        type="submit"
                                        className="flex-1 bg-brand-orange hover:bg-brand-orange-hover text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer text-center"
                                      >
                                        Guardar
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (confirm(`¿Está seguro de que desea eliminar al usuario ${selectedUserForEdit.name} (${selectedUserForEdit.lockerId})?`)) {
                                            handleDeleteUser(selectedUserForEdit.lockerId);
                                          }
                                        }}
                                        className="px-3 bg-red-600 hover:bg-red-700 text-white text-3xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer text-center"
                                      >
                                        Eliminar
                                      </button>
                                    </div>

                                    <div className="border-t border-gray-250 pt-3 mt-3 space-y-2">
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-0.5">Correo y Notificaciones</label>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setMailModalRecipient(selectedUserForEdit);
                                            setMailModalSubject(`¡Bienvenido a ShipFast GT! - Tu Casillero ${selectedUserForEdit.lockerId}`);
                                            
                                            setMailModalBody(`Hola ${selectedUserForEdit.name},\n\nNos complace darte la más cordial bienvenida a ShipFast GT. A partir de este momento tienes activo tu casillero oficial para compras en EE.UU. y México.\n\n🔑 TU NÚMERO DE CASILLERO: ${selectedUserForEdit.lockerId}\n\nUsa este número de casillero como referencia obligatoria al comprar en Amazon, SHEIN o Mercado Libre.`);
                                            setMailPromoImage('');
                                            setMailPromoImageName('');
                                            setIsMailModalOpen(true);
                                          }}
                                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-4xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer text-center flex items-center justify-center gap-1"
                                        >
                                          ✉️ Enviar Correo
                                        </button>
                                        <button
                                          type="button"
                                          onClick={handleCopyWelcomeEmail}
                                          className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-4xs font-extrabold py-2 rounded uppercase tracking-wider transition cursor-pointer text-center flex items-center justify-center gap-1"
                                        >
                                          📋 Copiar Texto
                                        </button>
                                      </div>
                                    </div>
                                  </form>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <h4 className="text-3xs font-extrabold text-brand-gray-dark uppercase tracking-wider border-b border-gray-200 pb-1.5">Registrar Nuevo Operador</h4>
                                  
                                  <form onSubmit={handleAddOperator} className="space-y-3">
                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Nombre Completo *</label>
                                      <input
                                        type="text"
                                        required
                                        placeholder="Nombre del conductor/operario"
                                        id="opNameInput"
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Función Operativa *</label>
                                      <select
                                        id="opRoleSelect"
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded focus:ring-1 focus:ring-brand-orange bg-white font-semibold outline-hidden"
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
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-bold font-mono text-brand-gray-dark focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Correo Electrónico *</label>
                                      <input
                                        type="email"
                                        required
                                        placeholder="operador@shipfast.gt"
                                        id="opEmailInput"
                                        className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-semibold text-brand-gray-dark focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-hidden"
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
                              )}
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

                        <div className="bg-gray-50 border border-gray-200 p-6 rounded-lg space-y-4 mt-6">
                          <span className="text-4xs font-bold text-gray-400 uppercase tracking-widest block border-b border-gray-200 pb-2">📧 Automatización de Correo Electrónico (EmailJS)</span>
                          <p className="text-4xs text-gray-500">Configure sus credenciales públicas de <strong>EmailJS</strong> para enviar el correo de bienvenida de fondo de forma 100% automática al hacer clic en "Enviar Correo" (sin redirecciones ni ventanas emergentes). Si estos campos están vacíos, el sistema utilizará el enlace de correo nativo (`mailto:`) como respaldo automático.</p>
                          
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Service ID *</label>
                              <input
                                type="text"
                                placeholder="Ej: service_gmail"
                                className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-mono font-bold text-brand-orange bg-white outline-hidden focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                value={emailJsServiceId}
                                onChange={(e) => {
                                  setEmailJsServiceId(e.target.value);
                                  localStorage.setItem('emailJsServiceId', e.target.value);
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Template ID *</label>
                              <input
                                type="text"
                                placeholder="Ej: template_welcome"
                                className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-mono font-bold text-brand-orange bg-white outline-hidden focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                value={emailJsTemplateId}
                                onChange={(e) => {
                                  setEmailJsTemplateId(e.target.value);
                                  localStorage.setItem('emailJsTemplateId', e.target.value);
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Public Key (User ID) *</label>
                              <input
                                type="text"
                                placeholder="Ej: user_abc123xyz"
                                className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-mono font-bold text-brand-orange bg-white outline-hidden focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                value={emailJsPublicKey}
                                onChange={(e) => {
                                  setEmailJsPublicKey(e.target.value);
                                  localStorage.setItem('emailJsPublicKey', e.target.value);
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-4xs font-bold text-gray-500 uppercase block mb-1">Private Key *</label>
                              <input
                                type="password"
                                placeholder="Ingrese Private Key"
                                className="w-full px-3 py-1.5 text-3xs border border-gray-300 rounded font-mono font-bold text-brand-orange bg-white outline-hidden focus:ring-1 focus:ring-brand-orange focus:border-brand-orange"
                                value={emailJsPrivateKey}
                                onChange={(e) => {
                                  setEmailJsPrivateKey(e.target.value);
                                  localStorage.setItem('emailJsPrivateKey', e.target.value);
                                }}
                              />
                            </div>
                          </div>
                          
                          <div className="bg-orange-50 border border-orange-200 text-brand-gray-dark p-3.5 rounded text-4xs space-y-1">
                            <strong className="block text-brand-orange">💡 Instrucciones de Configuración en EmailJS:</strong>
                            <p>1. Regístrese gratis en <a href="https://www.emailjs.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-bold">emailjs.com</a>, conecte su cuenta de correo (Gmail, Outlook, etc.) y obtenga su <strong>Service ID</strong>.</p>
                            <p>2. Cree una plantilla de correo (Email Template) y copie su <strong>Template ID</strong>. El cuerpo de la plantilla debe contener la variable <code>{"{{message}}"}</code> que recibe el correo completo y personalizado con las bodegas.</p>
                            <p>3. Vaya a la sección Account (Cuenta) y luego a API Keys para copiar su <strong>Public Key</strong> y su <strong>Private Key</strong>. Pégue las 4 claves aquí arriba ¡y listo! Los correos se enviarán de forma invisible en segundo plano con seguridad mejorada.</p>
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

          {/* ==================== BODEGA INTERNACIONAL ZOOM OVERLAY ==================== */}
          {activeWarehouseModal && (
            <div className="fixed inset-0 bg-brand-gray-dark/65 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-100 shadow-2xl overflow-hidden relative animate-zoom-in transition-all duration-300 font-sans">
                
                {/* Header Flag / Title */}
                <div className={`p-6 text-white relative ${activeWarehouseModal === 'USA' ? 'bg-gradient-to-r from-brand-orange to-amber-600' : 'bg-gradient-to-r from-indigo-600 to-indigo-800'}`}>
                  <button
                    type="button"
                    onClick={() => setActiveWarehouseModal(null)}
                    className="absolute top-4 right-4 text-white/80 hover:text-white cursor-pointer p-1.5 rounded-full hover:bg-white/10 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none">
                      {activeWarehouseModal === 'USA' ? '🇺🇸' : '🇲🇽'}
                    </span>
                    <div>
                      <span className="text-[10px] font-black tracking-widest uppercase text-white/80 block">Dirección Oficial Completa</span>
                      <h3 className="text-lg font-black tracking-tight uppercase">
                        {activeWarehouseModal === 'USA' ? 'Bodega Laredo (Texas, EE.UU.)' : 'Bodega Tapachula (México)'}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Details list */}
                <div className="p-6 space-y-5">
                  <div className="bg-slate-50 border border-slate-200/50 rounded-2xl p-5 space-y-4">
                    <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/40 pb-2">
                      Datos a Ingresar en Tiendas Online (Amazon, SHEIN, etc.)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {activeWarehouseModal === 'USA' ? (
                        <>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Nombre / First Name</span>
                            <span className="font-extrabold text-slate-800">ShipFast {currentUser.name.split(' ')[0]}</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Apellido / Last Name</span>
                            <span className="font-extrabold text-slate-800">{currentUser.name.split(' ').slice(1).join(' ') || 'Logistics'}</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl md:col-span-2">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Dirección Línea 1 / Address 1</span>
                            <span className="font-extrabold text-slate-800">1900 Justo Penn St.</span>
                          </div>
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl md:col-span-2 flex justify-between items-center">
                            <div>
                              <span className="text-amber-800 uppercase font-black text-[9px] block mb-0.5">Suite / Address 2 *</span>
                              <span className="font-black text-brand-orange text-sm tracking-wider font-mono">{currentUser.lockerId}</span>
                            </div>
                            <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md uppercase">Requerido</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Ciudad / City</span>
                            <span className="font-extrabold text-slate-800">Laredo</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Estado / State</span>
                            <span className="font-extrabold text-slate-800">Texas (TX)</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Código Postal / Zip Code</span>
                            <span className="font-black text-slate-800 font-mono">78041</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Teléfono / Phone</span>
                            <span className="font-black text-slate-800 font-mono">+1 757-7762319</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Nombre / First Name</span>
                            <span className="font-extrabold text-slate-800">ShipFast {currentUser.name.split(' ')[0]}</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Apellido / Last Name</span>
                            <span className="font-extrabold text-slate-800">{currentUser.name.split(' ').slice(1).join(' ') || 'Logistics'}</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl md:col-span-2">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Dirección / Address</span>
                            <span className="font-extrabold text-slate-800">Libramiento Sur Ote, Parque Logístico Tamarindo</span>
                          </div>
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl md:col-span-2 flex justify-between items-center">
                            <div>
                              <span className="text-amber-800 uppercase font-black text-[9px] block mb-0.5">Referencias / Suite *</span>
                              <span className="font-black text-brand-orange text-xs tracking-wider leading-tight block">
                                <strong className="text-sm font-mono">{currentUser.lockerId}</strong> + Bodega JT Express 320B Jony Maza Blanca Díaz
                              </span>
                            </div>
                            <span className="text-[8px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md uppercase self-start">Requerido</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Estado / State</span>
                            <span className="font-extrabold text-slate-800">Chiapas</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Ciudad / City</span>
                            <span className="font-extrabold text-slate-800">Tapachula</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Código Postal / Zip Code</span>
                            <span className="font-black text-slate-800 font-mono">30700</span>
                          </div>
                          <div className="p-3 bg-white border border-slate-100 rounded-xl">
                            <span className="text-slate-400 uppercase font-black text-[9px] block mb-0.5">Teléfono / Phone</span>
                            <span className="font-black text-slate-800 font-mono">9621027742</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Copy Alert Warning */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 font-medium leading-normal">
                      <strong>IMPORTANTE:</strong> Asegúrate de copiar el identificador de casillero <strong>{currentUser.lockerId}</strong> tal y como se muestra arriba. Si omites esta referencia, las bodegas internacionales no podrán identificar a quién pertenece tu carga y habrá demoras en su asignación.
                    </p>
                  </div>
                </div>

                {/* Footer close button */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveWarehouseModal(null)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs py-2 px-6 rounded-xl active:scale-95 transition cursor-pointer shadow-sm"
                  >
                    Entendido, Cerrar
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* ==================== NUEVA PRE-ALERTA MANUAL CLIENT OVERLAY ==================== */}
          {isClientPreAlertModalOpen && (
            <div className="fixed inset-0 bg-brand-gray-dark/65 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-100 shadow-2xl overflow-hidden relative animate-zoom-in transition-all duration-300 font-sans">
                
                {/* Close Button X */}
                <button
                  type="button"
                  onClick={() => setIsClientPreAlertModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer p-1.5 rounded-full hover:bg-slate-50 transition"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Header Section */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white relative">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 text-white p-2.5 rounded-xl flex items-center justify-center w-11 h-11 border border-white/10 animate-pulse">
                      <PlusCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-widest uppercase text-white/80 block">Servicio del Cliente</span>
                      <h3 className="text-md font-black tracking-tight uppercase">Nueva Pre-Alerta Manual</h3>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleCreateClientPreAlert} className="p-6 space-y-4">
                  
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

                  {/* 3-Column fields: TRACKING, BODEGA and PESO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">TRACKING *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1Z999AA1012"
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

                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">PESO EST. (LBS) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        min="0.1"
                        placeholder="1.0"
                        value={clientPreAlertWeight}
                        onChange={(e) => setClientPreAlertWeight(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none font-bold text-brand-gray-dark"
                      />
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

                  {/* Insurance/Liability Warning Disclaimer */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[10px] leading-relaxed flex items-start gap-2">
                    <span className="text-sm shrink-0">⚠️</span>
                    <div>
                      <strong>Político de Responsabilidad y Seguro:</strong> Si el paquete se declara <strong>Sin seguro</strong>, la empresa responderá por un límite máximo de hasta <strong>$50.00 USD</strong> en caso de pérdida o siniestro.
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
                      className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50 hover:bg-indigo-50/10 rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
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
                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClientPreAlertFileName('');
                        setIsClientPreAlertModalOpen(false);
                      }}
                      className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition active:scale-95 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-extrabold text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-100 hover:shadow-indigo-200 active:scale-98 transition cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Crear Pre-Alerta
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}

          {/* ==================== NUEVA PRE-ALERTA MANUAL ADMINISTRADOR OVERLAY ==================== */}
          {isAdminPreAlertModalOpen && (
            <div className="fixed inset-0 bg-brand-gray-dark/65 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
              <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-100 shadow-2xl overflow-hidden relative animate-zoom-in transition-all duration-300 font-sans">
                
                {/* Close Button X */}
                <button
                  type="button"
                  onClick={() => setIsAdminPreAlertModalOpen(false)}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer p-1.5 rounded-full hover:bg-slate-50 transition"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Header Section */}
                <div className="bg-gradient-to-r from-brand-orange to-amber-600 p-6 text-white relative">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 text-white p-2.5 rounded-xl flex items-center justify-center w-11 h-11 border border-white/10">
                      <PlusCircle className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black tracking-widest uppercase text-white/80 block">Acción Operativa</span>
                      <h3 className="text-md font-black tracking-tight uppercase">Pre-Alerta Administrativa</h3>
                    </div>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleCreateAdminPreAlert} className="p-6 space-y-4">
                  
                  {/* CLIENTE (CASILLERO) SELECT * */}
                  <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">CLIENTE / CASILLERO DESTINATARIO *</label>
                    <select
                      required
                      value={adminPreAlertLockerId}
                      onChange={(e) => setAdminPreAlertLockerId(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark bg-white"
                    >
                      <option value="">-- Seleccionar Casillero Destinatario --</option>
                      {users.map(u => (
                        <option key={u.lockerId} value={u.lockerId}>
                          {u.name} (Locker: {u.lockerId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 3-Column fields: TRACKING, BODEGA and PESO */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">TRACKING *</label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1Z999AA1012"
                        value={clientPreAlertTracking}
                        onChange={(e) => setClientPreAlertTracking(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-mono font-bold text-brand-gray-dark placeholder-gray-300"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">BODEGA</label>
                      <select
                        value={clientPreAlertBodega}
                        onChange={(e) => setClientPreAlertBodega(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark bg-white"
                      >
                        <option value="Sin bodega">Sin bodega</option>
                        <option value="Laredo">Laredo 🇺🇸</option>
                        <option value="Mexico">México 🇲🇽</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">PESO EST. (LBS) *</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        min="0.1"
                        placeholder="1.0"
                        value={clientPreAlertWeight}
                        onChange={(e) => setClientPreAlertWeight(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark"
                      />
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
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">SEGURO (5%)</label>
                      <select
                        value={clientPreAlertInsurance}
                        onChange={(e) => setClientPreAlertInsurance(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark bg-white text-center"
                      >
                        <option value="Sin seguro">Sin seguro</option>
                        <option value="Con seguro (5%)">Con seguro (5%)</option>
                      </select>
                    </div>
                  </div>

                  {/* Insurance/Liability Warning Disclaimer */}
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[10px] leading-relaxed flex items-start gap-2">
                    <span className="text-sm shrink-0">⚠️</span>
                    <div>
                      <strong>Político de Responsabilidad y Seguro:</strong> Si el paquete se declara <strong>Sin seguro</strong>, la empresa responderá por un límite máximo de hasta <strong>$50.00 USD</strong> en caso de pérdida o siniestro.
                    </div>
                  </div>

                  {/* FACTURA (IMAGEN O PDF) */}
                  <div>
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">FACTURA (IMAGEN O PDF)</label>
                    <input
                      type="file"
                      id="adminPreAlertFile"
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
                      htmlFor="adminPreAlertFile"
                      className="border-2 border-dashed border-slate-200 hover:border-brand-orange bg-slate-50 hover:bg-orange-50/10 rounded-2xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-1.5"
                    >
                      <UploadCloud className="h-6 w-6 text-gray-400 hover:text-brand-orange transition-colors animate-bounce" />
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
                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClientPreAlertFileName('');
                        setAdminPreAlertLockerId('');
                        setIsAdminPreAlertModalOpen(false);
                      }}
                      className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition active:scale-95 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="bg-brand-orange hover:bg-brand-orange-hover text-white font-extrabold text-xs py-2.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-md shadow-orange-100 hover:shadow-orange-200 active:scale-98 transition cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                      Registrar Pre-Alerta
                    </button>
                  </div>

                </form>

              </div>
            </div>
          )}

          {/* ==================== PREVIEW ATTACHED PRE-ALERT INVOICE MODAL ==================== */}
          {activePreAlertInvoice && (() => {
            const fileName = activePreAlertInvoice.invoiceFileName || '';
            const isPdf = fileName.toLowerCase().endsWith('.pdf');
            const amount = activePreAlertInvoice.declaredValue || 25.94;
            const tracking = activePreAlertInvoice.id;
            const clientLocker = activePreAlertInvoice.lockerId;

            return (
              <div className="fixed inset-0 bg-brand-gray-dark/70 backdrop-blur-xs flex justify-center items-center z-50 p-4 animate-fade-in">
                <div className="bg-white w-full max-w-2xl rounded-2xl border border-gray-100 shadow-2xl overflow-hidden animate-zoom-in transition-all duration-300 font-sans">
                  
                  {/* Modal Header */}
                  <div className="bg-brand-gray-dark text-white px-6 py-4 flex justify-between items-center border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-gray-800 text-brand-orange border border-gray-700">
                        <FileText className="h-5 w-5" />
                      </span>
                      <div>
                        <h3 className="text-2xs font-extrabold uppercase tracking-wider text-gray-100">Vista Previa de Documento</h3>
                        <p className="text-[10px] text-gray-400 font-mono font-medium">{fileName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActivePreAlertInvoice(null)}
                      className="text-gray-400 hover:text-white cursor-pointer p-1.5 rounded-full hover:bg-gray-800 transition"
                      title="Cerrar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Modal Body / Document Renderer */}
                  <div className="p-6 bg-gray-50 flex flex-col items-center justify-center min-h-[420px] max-h-[550px] overflow-y-auto">
                    
                    {/* Simulated Premium Document Layout */}
                    <div className="w-full bg-white border border-gray-200 rounded-xl shadow-xs p-6 font-mono text-[11px] leading-relaxed text-gray-700 max-w-lg relative select-none">
                      
                      {/* Document Watermark */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                        <div className="text-gray-900 border-8 border-gray-950 font-sans font-black text-6xl rotate-12 uppercase p-4 tracking-widest">
                          {isPdf ? 'PDF DOC' : 'IMAGE'}
                        </div>
                      </div>

                      {/* Header */}
                      <div className="border-b-2 border-dashed border-gray-300 pb-4 mb-4 flex justify-between items-start">
                        <div>
                          <div className="text-xs font-black text-brand-orange uppercase font-sans tracking-wide">AMAZON.COM SERVICES LLC</div>
                          <div>Retailer Invoice & Receipt</div>
                          <div>Seattle, Washington, USA</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-brand-gray-dark">ORIGINAL RECEIPT</div>
                          <div>Fecha: {activePreAlertInvoice.dateCreated}</div>
                          <div>Locker: {clientLocker}</div>
                        </div>
                      </div>

                      {/* Details Grid */}
                      <div className="grid grid-cols-2 gap-4 border-b border-gray-200 pb-4 mb-4">
                        <div>
                          <div className="font-bold text-gray-500">CLIENT SHIPPING ADDRESS:</div>
                          <div className="font-semibold text-brand-gray-dark uppercase font-sans">ShipFast Bodega Laredo</div>
                          <div>13702 Loring Ave Suite 150</div>
                          <div>Laredo, TX 78045, USA</div>
                          <div>C/O Casillero {clientLocker}</div>
                        </div>
                        <div>
                          <div className="font-bold text-gray-500">TRANSACTION DATA:</div>
                          <div>Tracking ID:</div>
                          <div className="font-bold text-[10px] text-brand-orange select-text">{tracking}</div>
                          <div>Payment Method: Credit Card ending *4892</div>
                        </div>
                      </div>

                      {/* Items Table */}
                      <table className="w-full border-collapse mb-4">
                        <thead>
                          <tr className="border-b border-gray-300 text-gray-500 font-bold text-left">
                            <th className="pb-1 text-left">Descripción del Artículo</th>
                            <th className="pb-1 text-center" style={{ width: '15%' }}>Cant</th>
                            <th className="pb-1 text-right" style={{ width: '25%' }}>Precio</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-gray-100">
                            <td className="py-2 font-sans font-semibold text-brand-gray-dark">
                              Electronic Device / Online Purchase Cargo
                              <span className="block text-[9px] text-gray-400 font-mono">Part No: B08XX-AMZN</span>
                            </td>
                            <td className="py-2 text-center">1</td>
                            <td className="py-2 text-right font-bold">USD {amount.toFixed(2)}</td>
                          </tr>
                        </tbody>
                      </table>

                      {/* Totals Summary */}
                      <div className="flex justify-end">
                        <div className="w-56 text-right space-y-1">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>USD {amount.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Impuestos (Sales Tax):</span>
                            <span>USD 0.00</span>
                          </div>
                          <div className="flex justify-between font-black text-brand-orange border-t border-dashed border-gray-300 pt-1.5 text-xs">
                            <span>TOTAL PAID:</span>
                            <span>USD {amount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Barcode representation */}
                      <div className="border-t border-gray-200 mt-5 pt-4 flex flex-col items-center gap-1.5 select-none">
                        <div className="flex gap-[1px] h-8 bg-gray-200 px-4 py-1 items-stretch">
                          {[2, 1, 3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2].map((w, idx) => (
                            <div key={idx} className="bg-brand-gray-dark" style={{ width: `${w}px` }}></div>
                          ))}
                        </div>
                        <span className="text-[9px] text-gray-400 tracking-wider">*{tracking}*</span>
                      </div>

                    </div>

                  </div>

                  {/* Modal Footer */}
                  <div className="bg-gray-100 px-6 py-4 flex justify-between items-center border-t border-gray-200">
                    <span className="text-4xs text-gray-500 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-green-500 rounded-full animate-ping"></span>
                      Documento Verificado por Antivirus ShipFast
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const printInvoiceWindow = window.open('', '_blank');
                          if (printInvoiceWindow) {
                            printInvoiceWindow.document.write(`
                              <html>
                                <head>
                                  <title>Factura Adjunta ${tracking}</title>
                                  <style>
                                    body { font-family: monospace; padding: 40px; color: #333; }
                                    .invoice { max-width: 600px; margin: 0 auto; border: 1px solid #ccc; padding: 20px; }
                                    .text-right { text-align: right; }
                                  </style>
                                </head>
                                <body>
                                  <div class="invoice">
                                    <h2>AMAZON.COM SERVICES LLC</h2>
                                    <p>Online Store Receipt</p>
                                    <hr>
                                    <p><strong>Tracking ID:</strong> ${tracking}</p>
                                    <p><strong>Locker ID:</strong> ${clientLocker}</p>
                                    <p><strong>Fecha:</strong> ${activePreAlertInvoice.dateCreated}</p>
                                    <hr>
                                    <table style="width:100%; border-collapse:collapse;">
                                      <tr><td style="padding:10px 0;">Cargo Purchase</td><td class="text-right">USD ${amount.toFixed(2)}</td></tr>
                                    </table>
                                    <hr>
                                    <p class="text-right"><strong>Total Paid: USD ${amount.toFixed(2)}</strong></p>
                                  </div>
                                  <script>window.onload = function() { window.print(); }</script>
                                </body>
                              </html>
                            `);
                            printInvoiceWindow.document.close();
                          }
                        }}
                        className="px-4 py-1.5 bg-brand-gray-dark hover:bg-brand-gray-dark/80 text-white font-extrabold text-3xs rounded uppercase tracking-wider transition cursor-pointer"
                      >
                        🖨️ Imprimir
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivePreAlertInvoice(null)}
                        className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-brand-gray-dark font-extrabold text-3xs rounded uppercase tracking-wider transition cursor-pointer"
                      >
                        Cerrar
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ==================== MODAL DE CORREO PERSONALIZADO Y PROMOCIONES ==================== */}
          {isMailModalOpen && mailModalRecipient && (() => {
            const handleSendCustomMail = async (e: React.FormEvent) => {
              e.preventDefault();
              if (!mailModalSubject.trim() || !mailModalBody.trim()) {
                alert('Por favor complete el asunto y cuerpo del mensaje.');
                return;
              }

              // Build elegant HTML email layout integrating corporate logo, brand colors, body text & promo image
              let emailContentHtml = `
                <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #f3f4f6; padding: 40px 20px; color: #1f2937; line-height: 1.6; margin: 0;">
                  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); border-top: 6px solid #ea580c;">
                    
                    <!-- Header -->
                    <div style="padding: 30px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #f3f4f6;">
                      <img src="https://app.shipfastgt.com/logo.png" alt="ShipFast GT" style="max-width: 220px; height: auto;" />
                    </div>

                    <!-- Content Body -->
                    <div style="padding: 40px 30px;">
                      <h2 style="margin-top: 0; color: #111827; font-size: 20px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 0.5px;">Notificación Especial - ShipFast GT</h2>
                      
                      <p style="font-size: 15px; color: #4b5563; margin-top: 25px;">
                        Estimado/a <strong>${mailModalRecipient.name}</strong>,
                      </p>
                      
                      <div style="font-size: 14px; color: #4b5563; white-space: pre-line; margin-bottom: 25px;">
                        ${mailModalBody}
                      </div>

                      <!-- Promo Image Attachment -->
                      ${mailPromoImage ? `
                        <div style="margin: 30px 0; text-align: center; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb;">
                          <img src="${mailPromoImage}" alt="Promoción / Imagen adjunta" style="max-width: 100%; height: auto; display: block; margin: 0 auto;" />
                        </div>
                      ` : ''}

                      <!-- Support CTA -->
                      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; text-align: center; margin-top: 30px;">
                        <strong style="color: #1e3a8a; font-size: 14px; display: block; margin-bottom: 10px;">💬 ¿Tienes alguna duda o necesitas asistencia?</strong>
                        <p style="font-size: 13px; color: #4b5563; margin: 0 0 15px 0;">Ponte en contacto con nuestro equipo de atención y soporte.</p>
                        <a href="https://wa.me/50237268751" target="_blank" style="background-color: #25d366; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 13px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                          🟢 Chat en Línea WhatsApp
                        </a>
                      </div>

                    </div>

                    <!-- Footer -->
                    <div style="background-color: #1f2937; padding: 30px; text-align: center; color: #9ca3af; font-size: 11px; border-top: 1px solid #374151;">
                      <p style="margin: 0 0 8px 0; font-weight: bold; color: #ffffff;">ShipFast Logistics S.A. &copy; 2026</p>
                      <p style="margin: 0; color: #6b7280;">Este correo es de carácter informativo enviado desde el panel de operaciones.</p>
                    </div>

                  </div>
                </div>
              `;

              const serviceId = emailJsServiceId.trim();
              const templateId = emailJsTemplateId.trim();
              const publicKey = emailJsPublicKey.trim();
              const privateKey = emailJsPrivateKey.trim();

              if (!serviceId || !templateId || !publicKey) {
                alert('Ajustes de EmailJS incompletos en Ajustes del Sistema. Por favor configure las llaves correspondientes primero.');
                return;
              }

              try {
                const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json"
                  },
                  body: JSON.stringify({
                    service_id: serviceId,
                    template_id: templateId,
                    user_id: publicKey,
                    accessToken: privateKey,
                    template_params: {
                      to_name: mailModalRecipient.name,
                      name: mailModalRecipient.name,
                      to_email: mailModalRecipient.email,
                      email: mailModalRecipient.email,
                      locker_id: mailModalRecipient.lockerId,
                      subject: mailModalSubject,
                      message: emailContentHtml
                    }
                  })
                });

                if (response.ok) {
                  alert(`📧 Correo especial y promoción enviado exitosamente a ${mailModalRecipient.name} (${mailModalRecipient.email}).`);
                  setIsMailModalOpen(false);
                  setMailModalRecipient(null);
                  setMailModalSubject('');
                  setMailModalBody('');
                  setMailPromoImage('');
                  setMailPromoImageName('');
                } else {
                  const errorText = await response.text();
                  alert(`Error al enviar correo: ${errorText} (Código ${response.status})`);
                }
              } catch (err) {
                console.error("Custom Email error:", err);
                alert("Error de red al intentar conectarse al servidor de envíos.");
              }
            };

            const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setMailPromoImageName(file.name);

              const reader = new FileReader();
              reader.onloadend = () => {
                setMailPromoImage(reader.result as string);
              };
              reader.readAsDataURL(file);
            };

            return (
              <div className="fixed inset-0 bg-brand-gray-dark/75 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
                <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  
                  {/* Header */}
                  <div className="p-6 border-b border-slate-100 bg-orange-50/50 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="bg-brand-orange text-white p-2 rounded-xl flex items-center justify-center">
                        <Send className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-brand-gray-dark uppercase tracking-wider">Enviar Correo y Promoción</h3>
                        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">Destinatario: {mailModalRecipient.name} ({mailModalRecipient.lockerId})</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMailModalOpen(false);
                        setMailModalRecipient(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 font-bold text-xs"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSendCustomMail} className="p-6 space-y-4 overflow-y-auto flex-1">
                    
                    {/* Recipient Email Info */}
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Correo Electrónico de Destino</label>
                      <input
                        type="text"
                        disabled
                        value={mailModalRecipient.email}
                        className="w-full px-3 py-2 text-xs border border-gray-200 bg-slate-50 text-gray-400 font-semibold rounded-lg cursor-not-allowed font-mono"
                      />
                    </div>

                    {/* Subject field */}
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Asunto del Correo *</label>
                      <input
                        type="text"
                        required
                        value={mailModalSubject}
                        onChange={(e) => setMailModalSubject(e.target.value)}
                        placeholder="Ej: Nueva Promoción: Flete con 15% de Descuento"
                        className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-bold text-brand-gray-dark"
                      />
                    </div>

                    {/* Email body editor */}
                    <div>
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block mb-1">Cuerpo / Mensaje Principal *</label>
                      <textarea
                        rows={6}
                        required
                        value={mailModalBody}
                        onChange={(e) => setMailModalBody(e.target.value)}
                        placeholder="Escriba aquí los detalles o anuncio que desea enviarle al cliente..."
                        className="w-full p-3 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand-orange focus:border-brand-orange focus:outline-none font-semibold text-brand-gray-dark leading-relaxed resize-none"
                      />
                    </div>

                    {/* Promotional image uploader */}
                    <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-2">
                      <label className="text-[9px] font-black text-gray-500 uppercase tracking-wider block">Adjuntar Imagen Promocional (Opcional)</label>
                      <div className="flex items-center gap-3">
                        <label className="bg-brand-gray-dark hover:bg-gray-800 text-white font-extrabold text-[10px] px-4 py-2 rounded-xl cursor-pointer uppercase tracking-wider transition">
                          📁 Cargar Imagen
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageChange}
                            className="hidden"
                          />
                        </label>
                        <span className="text-[10px] font-mono font-bold text-slate-500 truncate max-w-[200px]">
                          {mailPromoImageName || "Ningún archivo seleccionado"}
                        </span>
                      </div>
                      
                      {mailPromoImage && (
                        <div className="mt-3 relative border border-slate-200 rounded-lg overflow-hidden bg-white max-h-[140px] flex items-center justify-center">
                          <img src={mailPromoImage} alt="Vista Previa" className="max-h-[140px] max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setMailPromoImage('');
                              setMailPromoImageName('');
                            }}
                            className="absolute right-2 top-2 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-bold"
                            title="Quitar imagen"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Footer buttons */}
                    <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsMailModalOpen(false);
                          setMailModalRecipient(null);
                        }}
                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-brand-gray-dark font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2.5 bg-brand-orange hover:bg-brand-orange-hover text-white font-extrabold text-[10px] rounded-xl uppercase tracking-wider transition cursor-pointer flex items-center gap-1.5 shadow-md shadow-orange-100"
                      >
                        <Send className="h-3.5 w-3.5" />
                        Enviar Correo
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            );
          })()}

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
