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
  async deleteShipment(trackingId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('shipments').delete().eq('id', trackingId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteShipment error", err);
      return false;
    }
  },
  async deleteShipments(trackingIds: string[]): Promise<boolean> {
    if (!trackingIds.length) return true;
    try {
      const { error } = await supabase.from('shipments').delete().in('id', trackingIds);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteShipments error", err);
      return false;
    }
  },
  async replaceShipment(oldTrackingId: string, shipment: any): Promise<boolean> {
    try {
      const ok = await this.upsertShipment(shipment);
      if (ok && oldTrackingId && oldTrackingId !== shipment.id) {
        await supabase.from('shipments').delete().eq('id', oldTrackingId);
      }
      return ok;
    } catch (err) {
      console.error("Supabase: replaceShipment error", err);
      return false;
    }
  },

  // Pre-Alerts (Lightweight list query without heavy base64 PDF/signature blobs for fast loading)
  _mapLightPreAlerts(data: any[]): any[] {
    const camelList = toCamel(data) || [];
    return camelList.map((pa: any) => {
      const desc = String(pa.description || '');
      let insurance = pa.insurance || 'Sin seguro';
      let invoiceFileName = pa.invoiceFileName || '';

      if (desc) {
        const parts = desc.split(' | ');
        for (const part of parts) {
          const trimmed = part.trim();
          const lower = trimmed.toLowerCase();
          if (lower.startsWith('seguro:')) {
            insurance = trimmed.slice(7).trim().split(':::WAIVER:::')[0] || 'Sin seguro';
          } else if (lower.startsWith('factura:') && !invoiceFileName) {
            invoiceFileName = trimmed.slice(8).trim().split(':::')[0] || '';
          }
        }
      }

      return {
        ...pa,
        insurance,
        invoiceFileName
      };
    });
  },
  async getPreAlertsByLocker(lockerId: string): Promise<any[]> {
    const clean = (lockerId || '').trim().toUpperCase().replace(/^(SFG|SFA)[\s-]+(\d+)$/, '$1$2');
    if (!clean) return [];
    try {
      const { data, error } = await supabase
        .from('pre_alerts')
        .select('id,locker_id,sender,description,weight_est,status,date_created,declared_value')
        .ilike('locker_id', clean);
      if (error) throw error;
      return this._mapLightPreAlerts(data || []);
    } catch (err) {
      console.error("Supabase: getPreAlertsByLocker error", err);
      return [];
    }
  },
  async getPreAlerts(onProgress?: (rows: any[]) => void): Promise<any[]> {
    const PAGE_SIZE = 250;
    const allRows: any[] = [];
    let offset = 0;

    try {
      while (true) {
        let pageData: any[] | null = null;
        let lastErr: any = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          const { data, error } = await supabase
            .from('pre_alerts')
            .select('id,locker_id,sender,description,weight_est,status,date_created,declared_value')
            .range(offset, offset + PAGE_SIZE - 1);
          if (!error && data) {
            pageData = data;
            lastErr = null;
            break;
          }
          lastErr = error;
        }

        if (lastErr || !pageData) {
          if (allRows.length > 0) break;
          throw lastErr;
        }

        const mapped = this._mapLightPreAlerts(pageData);
        allRows.push(...mapped);
        if (onProgress && allRows.length > 0) {
          onProgress([...allRows]);
        }

        if (pageData.length < PAGE_SIZE) {
          break;
        }
        offset += PAGE_SIZE;
      }
      return allRows;
    } catch (err) {
      console.error("Supabase: getPreAlerts error, using fallback", err);
      return allRows;
    }
  },
  async getPreAlertAttachment(id: string): Promise<{ invoiceFileName: string; insurance: string; waiverDate: string; waiverSignature: string } | null> {
    try {
      const { data, error } = await supabase
        .from('pre_alerts')
        .select('invoice_file_name,insurance')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) return null;
      let insurance = data.insurance || 'Sin seguro';
      let waiverDate = '';
      let waiverSignature = '';
      if (typeof insurance === 'string' && insurance.includes(':::WAIVER:::')) {
        const [cleanIns, rest] = insurance.split(':::WAIVER:::');
        const sepIdx = rest.indexOf(':::');
        waiverDate = sepIdx !== -1 ? rest.slice(0, sepIdx) : '';
        waiverSignature = sepIdx !== -1 ? rest.slice(sepIdx + 3) : rest;
        insurance = cleanIns || 'Sin seguro';
      }
      return {
        invoiceFileName: data.invoice_file_name || '',
        insurance,
        waiverDate,
        waiverSignature
      };
    } catch (err) {
      console.error("Supabase: getPreAlertAttachment error", err);
      return null;
    }
  },
  async upsertPreAlert(preAlert: any): Promise<boolean> {
    try {
      const copy = { ...preAlert };
      const waiverSig = copy.waiverSignature;
      const waiverDt = copy.waiverDate || new Date().toISOString();
      delete copy.waiverSignature;
      delete copy.waiverDate;
      if (waiverSig) {
        const cleanIns = (copy.insurance || 'Sin seguro').split(':::WAIVER:::')[0];
        copy.insurance = `${cleanIns}:::WAIVER:::${waiverDt}:::${waiverSig}`;
      } else {
        // Avoid overwriting existing stored signature blob when updating status/metadata
        delete copy.insurance;
      }
      if (!copy.invoiceFileName || (!String(copy.invoiceFileName).includes(':::') && !String(copy.invoiceFileName).startsWith('data:'))) {
        // Avoid overwriting existing stored base64 PDF/image when updating status/metadata
        delete copy.invoiceFileName;
      }
      const dbObj = toSnake(copy);
      const { error } = await supabase.from('pre_alerts').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertPreAlert error", err);
      return false;
    }
  },
  async replacePreAlert(oldId: string, preAlert: any): Promise<boolean> {
    try {
      const enriched = { ...preAlert };
      if (oldId && (!enriched.waiverSignature || !String(enriched.invoiceFileName || '').includes(':::'))) {
        const existingAtt = await this.getPreAlertAttachment(oldId);
        if (existingAtt) {
          if (!enriched.waiverSignature && existingAtt.waiverSignature) {
            enriched.waiverSignature = existingAtt.waiverSignature;
            enriched.waiverDate = existingAtt.waiverDate;
          }
          if (!String(enriched.invoiceFileName || '').includes(':::') && existingAtt.invoiceFileName) {
            enriched.invoiceFileName = existingAtt.invoiceFileName;
          }
        }
      }
      const ok = await this.upsertPreAlert(enriched);
      if (ok && oldId && oldId !== preAlert.id) {
        await supabase.from('pre_alerts').delete().eq('id', oldId);
      }
      return ok;
    } catch (err) {
      console.error("Supabase: replacePreAlert error", err);
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
  async deleteConsolidatedGuide(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('consolidated_guides').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteConsolidatedGuide error", err);
      return false;
    }
  },
  async deleteConsolidatedGuides(ids: string[]): Promise<boolean> {
    if (!ids.length) return true;
    try {
      const { error } = await supabase.from('consolidated_guides').delete().in('id', ids);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteConsolidatedGuides error", err);
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
      const raw = toSnake(invoice);
      const dbObj = {
        id: raw.id,
        locker_id: raw.locker_id ?? null,
        date: raw.date,
        concept: raw.concept,
        amount: raw.amount,
        payment_status: raw.payment_status || 'Pendiente'
      };
      const { error } = await supabase.from('invoices').upsert(dbObj);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: upsertInvoice error", err);
      return false;
    }
  },
  async deleteInvoice(id: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteInvoice error", err);
      return false;
    }
  },
  async deleteInvoices(ids: string[]): Promise<boolean> {
    if (!ids.length) return true;
    try {
      const { error } = await supabase.from('invoices').delete().in('id', ids);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Supabase: deleteInvoices error", err);
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
