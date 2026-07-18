import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cseswkiayedqpfmtcoce.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_7XGmzW5jLlvhdrFPnh8QJA_07LqL9hE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// CamelCase <-> SnakeCase Mapper functions
export function toCamel(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
      acc[camelKey] = toCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

export function toSnake(obj: any): any {
  if (Array.isArray(obj)) return obj.map(toSnake);
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = toSnake(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// Global CRUD helpers with error logging and empty-array fallback
export const db = {
  // Profiles
  async getProfiles(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getProfiles error, using fallback", err);
      return [];
    }
  },
  async upsertProfile(profile: any): Promise<boolean> {
    try {
      const dbObj = toSnake(profile);
      const { error } = await supabase.from('profiles').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertProfile error", err);
      return false;
    }
  },
  async deleteProfile(lockerId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('profiles').delete().eq('locker_id', lockerId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteProfile error", err);
      return false;
    }
  },

  // Shipments
  async getShipments(limit?: number, offset?: number): Promise<any[]> {
    try {
      let query = supabase.from('shipments').select('*');
      if (limit !== undefined && offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }
      const { data, error } = await query;
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getShipments error, using fallback", err);
      return [];
    }
  },
  async upsertShipments(shipmentsList: any[]): Promise<boolean> {
    try {
      const dbList = toSnake(shipmentsList);
      const { error } = await supabase.from('shipments').upsert(dbList);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertShipments error", err);
      return false;
    }
  },
  async upsertShipment(shipment: any): Promise<boolean> {
    try {
      const dbObj = toSnake(shipment);
      const { error } = await supabase.from('shipments').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertShipment error", err);
      return false;
    }
  },

  // Pre-Alerts
  async getPreAlerts(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('pre_alerts').select('*');
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getPreAlerts error, using fallback", err);
      return [];
    }
  },
  async upsertPreAlert(preAlert: any): Promise<boolean> {
    try {
      const dbObj = toSnake(preAlert);
      const { error } = await supabase.from('pre_alerts').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertPreAlert error", err);
      return false;
    }
  },

  // Consolidated Guides
  async getConsolidatedGuides(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('consolidated_guides').select('*');
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getConsolidatedGuides error, using fallback", err);
      return [];
    }
  },
  async upsertConsolidatedGuide(guide: any): Promise<boolean> {
    try {
      const dbObj = toSnake(guide);
      const { error } = await supabase.from('consolidated_guides').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertConsolidatedGuide error", err);
      return false;
    }
  },

  // Invoices
  async getInvoices(limit?: number, offset?: number): Promise<any[]> {
    try {
      let query = supabase.from('invoices').select('*');
      if (limit !== undefined && offset !== undefined) {
        query = query.range(offset, offset + limit - 1);
      }
      const { data, error } = await query;
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getInvoices error, using fallback", err);
      return [];
    }
  },
  async upsertInvoice(invoice: any): Promise<boolean> {
    try {
      const dbObj = toSnake(invoice);
      const { error } = await supabase.from('invoices').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertInvoice error", err);
      return false;
    }
  },

  // Payments
  async getPayments(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('payments').select('*');
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getPayments error, using fallback", err);
      return [];
    }
  },
  async upsertPayment(payment: any): Promise<boolean> {
    try {
      const dbObj = toSnake(payment);
      const { error } = await supabase.from('payments').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertPayment error", err);
      return false;
    }
  },

  // Expenses
  async getExpenses(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('expenses').select('*');
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getExpenses error, using fallback", err);
      return [];
    }
  },
  async upsertExpense(expense: any): Promise<boolean> {
    try {
      const dbObj = toSnake(expense);
      const { error } = await supabase.from('expenses').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertExpense error", err);
      return false;
    }
  },

  // Branches
  async getBranches(): Promise<any[]> {
    try {
      const { data, error } = await supabase.from('branches').select('*');
      if (error) throw error;
      return toCamel(data) || [];
    } catch (err) {
      console.error("Supabase: getBranches error, using fallback", err);
      return [];
    }
  },
  async upsertBranch(branch: any): Promise<boolean> {
    try {
      const dbObj = toSnake(branch);
      const { error } = await supabase.from('branches').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertBranch error", err);
      return false;
    }
  },

  // Quotes
  async getQuote(id: string): Promise<any | null> {
    try {
      const { data, error } = await supabase.from('quotes').select('*').eq('id', id).single();
      if (error) throw error;
      return toCamel(data);
    } catch (err) {
      console.error("Supabase: getQuote error", err);
      return null;
    }
  },
  async upsertQuote(quote: any): Promise<boolean> {
    try {
      const dbObj = toSnake(quote);
      const { error } = await supabase.from('quotes').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertQuote error", err);
      return false;
    }
  }
};
