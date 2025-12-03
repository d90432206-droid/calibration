
import { Order, Product, Customer, CalibrationStatus, CalibrationType, Technician } from '../types';

// Mock Data (Fallback only)
const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: '測試客戶有限公司' },
];
const INITIAL_TECHNICIANS: Technician[] = [
    { id: 't1', name: '測試人員' },
];
const INITIAL_INVENTORY: Product[] = [
  { id: '1', name: '測試品項 (Mock)', specification: 'N/A', category: '測試', standardPrice: 0, lastUpdated: new Date().toISOString() },
];
const INITIAL_ORDERS: Order[] = [];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export type EnvType = 'gas' | 'api' | 'mock';

// Simple In-Memory Cache Interface
interface CacheItem<T> {
    data: T;
    timestamp: number;
}

class HybridGasService {
  private apiUrl: string = (import.meta as any).env?.VITE_GAS_API_URL || '';
  
  // Cache Store
  private cache: Record<string, CacheItem<any>> = {};
  // Cache TTL (Time To Live) in milliseconds (e.g., 5 minutes)
  private readonly CACHE_TTL = 5 * 60 * 1000; 

  constructor() {
    console.log('--- System Connection Init ---');
    console.log('Detected API URL:', this.apiUrl ? this.apiUrl : '(Not Set)');
    if (!this.apiUrl) {
        console.warn('⚠️ No VITE_GAS_API_URL found. System will fallback to LOCAL MOCK mode.');
        console.warn('To fix this: Create a .env.local file with VITE_GAS_API_URL=your_script_url');
    } else {
        console.log('✅ API URL detected. System is in API Mode.');
    }
  }

  // --- Cache Methods ---
  private getCache<T>(key: string): T | null {
      const item = this.cache[key];
      if (!item) return null;
      
      const now = Date.now();
      if (now - item.timestamp > this.CACHE_TTL) {
          delete this.cache[key];
          return null; // Cache expired
      }
      return item.data as T;
  }

  private setCache<T>(key: string, data: T): void {
      this.cache[key] = {
          data,
          timestamp: Date.now()
      };
  }

  private clearCache(keyPrefix?: string): void {
      if (keyPrefix) {
          Object.keys(this.cache).forEach(key => {
              if (key.startsWith(keyPrefix)) delete this.cache[key];
          });
      } else {
          this.cache = {};
      }
      console.log(`🧹 Cache cleared ${keyPrefix ? `for prefix: ${keyPrefix}` : 'entirely'}`);
  }

  public isGasEnvironment(): boolean {
    return (
      typeof window !== 'undefined' && 
      (window as any).google && 
      (window as any).google.script && 
      (window as any).google.script.run
    );
  }

  public isApiEnvironment(): boolean {
      return !!this.apiUrl && !this.isGasEnvironment();
  }

  public getEnvironmentType(): EnvType {
      if (this.isGasEnvironment()) return 'gas';
      if (this.isApiEnvironment()) return 'api';
      return 'mock';
  }

  // --- Helper: Normalize Keys (PascalCase -> camelCase) ---
  private normalizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeData(item));
    }
    if (data !== null && typeof data === 'object') {
      const newObj: any = {};
      Object.keys(data).forEach(key => {
        let newKey = key.charAt(0).toLowerCase() + key.slice(1);
        if (key === 'ID') newKey = 'id';
        newObj[newKey] = this.normalizeData(data[key]);
      });
      return newObj;
    }
    return data;
  }

  // --- API Caller (Standard fetch) ---
  private async callApi<T>(action: string, payload?: any): Promise<T> {
      try {
          // console.log(`📡 Sending API Request: [${action}]`);
          
          const response = await fetch(this.apiUrl, {
              method: 'POST',
              body: JSON.stringify({ action, payload })
          });

          const json = await response.json();
          
          if (!json.success && (json.status === 'error' || json.error)) {
              throw new Error(json.error || 'API Error');
          }

          const normalized = this.normalizeData(json.data);
          return normalized as T;
      } catch (error) {
          console.error(`❌ API Call Failed [${action}]:`, error);
          throw error;
      }
  }

  // --- GAS Caller ---
  private callGasBackend<T>(functionName: string, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      (window as any).google.script.run
        .withSuccessHandler((response: any) => {
            let data = response;
            try { 
                data = typeof response === 'string' ? JSON.parse(response) : response; 
            } 
            catch (e) { /* ignore */ }
            resolve(this.normalizeData(data));
        })
        .withFailureHandler((error: any) => {
            console.error(`❌ GAS Call Failed [${functionName}]:`, error);
            reject(error);
        })
        [functionName](...args);
    });
  }

  // --- Methods ---

  async checkAdminPassword(input: string): Promise<boolean> {
    const cleanInput = (input || '').trim();
    if (this.isGasEnvironment()) return this.callGasBackend<boolean>('checkAdminPassword', cleanInput);
    if (this.isApiEnvironment()) return this.callApi<boolean>('checkAdminPassword', cleanInput);
    
    await delay(200);
    const stored = localStorage.getItem('cal_admin_pwd');
    return cleanInput === (stored || '0000');
  }

  async changeAdminPassword(oldPwd: string, newPwd: string): Promise<boolean> {
      if (this.isGasEnvironment()) return this.callGasBackend<boolean>('changeAdminPassword', oldPwd, newPwd);
      if (this.isApiEnvironment()) return this.callApi<boolean>('changeAdminPassword', { oldPwd, newPwd });

      await delay(300);
      const isValid = await this.checkAdminPassword(oldPwd);
      if (isValid) {
          localStorage.setItem('cal_admin_pwd', newPwd);
          return true;
      }
      return false;
  }

  async getInventory(forceRefresh = false): Promise<Product[]> {
    if (!forceRefresh) {
        const cached = this.getCache<Product[]>('inventory');
        if (cached) return cached;
    }

    let data: Product[];
    if (this.isGasEnvironment()) {
        data = await this.callGasBackend<Product[]>('getInventory');
    } else if (this.isApiEnvironment()) {
        data = await this.callApi<Product[]>('getInventory');
    } else {
        await delay(300);
        const stored = localStorage.getItem('cal_inventory');
        data = stored ? JSON.parse(stored) : INITIAL_INVENTORY;
    }
    
    this.setCache('inventory', data);
    return data;
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    let newProduct: Product;
    
    if (this.isGasEnvironment()) {
        newProduct = await this.callGasBackend<Product>('addProduct', product);
    } else if (this.isApiEnvironment()) {
        newProduct = await this.callApi<Product>('addProduct', product);
    } else {
        await delay(300);
        const products = await this.getInventory(true); // Force fetch local
        newProduct = { ...product, id: Date.now().toString(), lastUpdated: new Date().toISOString() };
        products.push(newProduct);
        localStorage.setItem('cal_inventory', JSON.stringify(products));
    }
    
    this.clearCache('inventory'); // Invalidate cache
    return newProduct;
  }

  async getCustomers(forceRefresh = false): Promise<Customer[]> {
    if (!forceRefresh) {
        const cached = this.getCache<Customer[]>('customers');
        if (cached) return cached;
    }

    let data: Customer[];
    if (this.isGasEnvironment()) {
        data = await this.callGasBackend<Customer[]>('getCustomers');
    } else if (this.isApiEnvironment()) {
        data = await this.callApi<Customer[]>('getCustomers');
    } else {
        await delay(200);
        const stored = localStorage.getItem('cal_customers');
        data = stored ? JSON.parse(stored) : INITIAL_CUSTOMERS;
    }

    this.setCache('customers', data);
    return data;
  }

  async addCustomer(name: string): Promise<Customer> {
    let newCustomer: Customer;
    if (this.isGasEnvironment()) {
        newCustomer = await this.callGasBackend<Customer>('addCustomer', name);
    } else if (this.isApiEnvironment()) {
        newCustomer = await this.callApi<Customer>('addCustomer', name);
    } else {
        await delay(200);
        const customers = await this.getCustomers(true);
        newCustomer = { id: 'c-' + Date.now(), name };
        customers.push(newCustomer);
        localStorage.setItem('cal_customers', JSON.stringify(customers));
    }
    
    this.clearCache('customers');
    return newCustomer;
  }

  async getTechnicians(forceRefresh = false): Promise<Technician[]> {
    if (!forceRefresh) {
        const cached = this.getCache<Technician[]>('technicians');
        if (cached) return cached;
    }

    let data: Technician[];
    if (this.isGasEnvironment()) {
        data = await this.callGasBackend<Technician[]>('getTechnicians');
    } else if (this.isApiEnvironment()) {
        data = await this.callApi<Technician[]>('getTechnicians');
    } else {
        await delay(200);
        const stored = localStorage.getItem('cal_technicians');
        data = stored ? JSON.parse(stored) : INITIAL_TECHNICIANS;
    }

    this.setCache('technicians', data);
    return data;
  }

  async addTechnician(name: string): Promise<Technician> {
      let newTech: Technician;
      if (this.isGasEnvironment()) {
          newTech = await this.callGasBackend<Technician>('addTechnician', name);
      } else if (this.isApiEnvironment()) {
          newTech = await this.callApi<Technician>('addTechnician', name);
      } else {
          await delay(200);
          const techs = await this.getTechnicians(true);
          newTech = { id: 't-' + Date.now(), name };
          techs.push(newTech);
          localStorage.setItem('cal_technicians', JSON.stringify(techs));
      }
      this.clearCache('technicians');
      return newTech;
  }

  async removeTechnician(id: string): Promise<void> {
      if (this.isGasEnvironment()) await this.callGasBackend<void>('removeTechnician', id);
      else if (this.isApiEnvironment()) await this.callApi<void>('removeTechnician', id);
      else {
          await delay(200);
          const techs = await this.getTechnicians(true);
          localStorage.setItem('cal_technicians', JSON.stringify(techs.filter(t => t.id !== id)));
      }
      this.clearCache('technicians');
  }

  async getOrders(forceRefresh = false): Promise<Order[]> {
    // 1. Try Cache
    if (!forceRefresh) {
        const cached = this.getCache<Order[]>('orders');
        if (cached) return cached;
    }

    // 2. Fetch Data
    let orders: Order[] = [];
    if (this.isGasEnvironment()) {
        orders = await this.callGasBackend<Order[]>('getOrders');
    } else if (this.isApiEnvironment()) {
        orders = await this.callApi<Order[]>('getOrders');
    } else {
        await delay(400);
        const stored = localStorage.getItem('cal_orders');
        orders = stored ? JSON.parse(stored) : INITIAL_ORDERS;
    }

    // 3. Filter Garbage
    const cleanOrders = orders.filter(o => 
        o && 
        o.orderNumber && 
        String(o.orderNumber).trim() !== '' &&
        String(o.orderNumber).toLowerCase() !== 'ordernumber' && 
        !String(o.orderNumber).includes('ID, OrderNumber') 
    );

    // 4. Update Cache
    this.setCache('orders', cleanOrders);
    return cleanOrders;
  }

  async checkOrderExists(orderNumber: string): Promise<boolean> {
      const orders = await this.getOrders();
      return orders.some(o => o.orderNumber === orderNumber);
  }

  async createOrders(ordersData: any[], manualOrderNumber: string): Promise<void> {
    // 1. Generate Optimistic Objects (Temporary IDs)
    const createDate = new Date().toISOString();
    const newOrders: Order[] = ordersData.map(d => ({
        ...d,
        id: 'TEMP-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
        orderNumber: manualOrderNumber,
        totalAmount: Math.round(d.unitPrice * d.quantity * (d.discountRate / 100)),
        createDate: createDate,
        isArchived: false,
        resurrectReason: ''
    }));

    // 2. Optimistic Update: Update cache IMMEDIATELY
    const cachedOrders = this.getCache<Order[]>('orders') || [];
    this.setCache('orders', [...newOrders, ...cachedOrders]);

    // 3. Perform Actual API Call (Background)
    if (this.isGasEnvironment()) {
        await this.callGasBackend<void>('createOrders', JSON.stringify(ordersData), manualOrderNumber);
    } else if (this.isApiEnvironment()) {
        await this.callApi<void>('createOrders', { ordersData, manualOrderNumber });
    } else {
        // Mock Mode persistence
        await delay(800);
        const stored = localStorage.getItem('cal_orders');
        const existing = stored ? JSON.parse(stored) : [];
        localStorage.setItem('cal_orders', JSON.stringify([...newOrders, ...existing]));
    }
    
    // IMPORTANT: Do NOT clear cache here. We want to show the optimistic data instantly.
    // The next natural refresh (cache expiry) will sync with server data.
  }

  async updateOrderStatusByNo(orderNumber: string, newStatus: CalibrationStatus): Promise<void> {
    // Optimistic Update
    const cached = this.getCache<Order[]>('orders');
    if (cached) {
        const updated = cached.map(o => {
            if (o.orderNumber === orderNumber) {
                return { 
                    ...o, 
                    status: newStatus, 
                    isArchived: newStatus === CalibrationStatus.COMPLETED 
                };
            }
            return o;
        });
        this.setCache('orders', updated);
    }

    if (this.isGasEnvironment()) await this.callGasBackend<void>('updateOrderStatusByNo', orderNumber, newStatus);
    else if (this.isApiEnvironment()) await this.callApi<void>('updateOrderStatusByNo', { orderNumber, newStatus });
    else {
        const orders = await this.getOrders(true);
        orders.forEach(o => {
            if(o.orderNumber === orderNumber) {
                o.status = newStatus;
                if(newStatus === CalibrationStatus.COMPLETED) o.isArchived = true;
            }
        });
        localStorage.setItem('cal_orders', JSON.stringify(orders));
    }
  }

  async updateOrderNotesByNo(orderNumber: string, notes: string): Promise<void> {
    // Optimistic Update
    const cached = this.getCache<Order[]>('orders');
    if (cached) {
        const updated = cached.map(o => o.orderNumber === orderNumber ? { ...o, notes } : o);
        this.setCache('orders', updated);
    }

    if (this.isGasEnvironment()) await this.callGasBackend<void>('updateOrderNotesByNo', orderNumber, notes);
    else if (this.isApiEnvironment()) await this.callApi<void>('updateOrderNotesByNo', { orderNumber, notes });
    else {
        const orders = await this.getOrders(true);
        orders.forEach(o => { if(o.orderNumber === orderNumber) o.notes = notes; });
        localStorage.setItem('cal_orders', JSON.stringify(orders));
    }
  }

  async updateOrderTargetDateByNo(orderNumber: string, newDate: string): Promise<void> {
    // Optimistic Update
    const cached = this.getCache<Order[]>('orders');
    if (cached) {
        const isoDate = new Date(newDate).toISOString();
        const updated = cached.map(o => o.orderNumber === orderNumber ? { ...o, targetDate: isoDate } : o);
        this.setCache('orders', updated);
    }

    if (this.isGasEnvironment()) await this.callGasBackend<void>('updateOrderTargetDateByNo', orderNumber, newDate);
    else if (this.isApiEnvironment()) await this.callApi<void>('updateOrderTargetDateByNo', { orderNumber, newDate });
    else {
        const orders = await this.getOrders(true);
        orders.forEach(o => { if(o.orderNumber === orderNumber) o.targetDate = new Date(newDate).toISOString(); });
        localStorage.setItem('cal_orders', JSON.stringify(orders));
    }
  }
  
  async restoreOrderByNo(orderNumber: string, reason: string): Promise<void> {
      // Optimistic Update
      const cached = this.getCache<Order[]>('orders');
      if (cached) {
          const updated = cached.map(o => {
              if (o.orderNumber === orderNumber) {
                  return {
                      ...o,
                      isArchived: false,
                      status: CalibrationStatus.PENDING,
                      resurrectReason: reason,
                      notes: o.notes ? `${o.notes} (復活: ${reason})` : `(復活: ${reason})`
                  };
              }
              return o;
          });
          this.setCache('orders', updated);
      }

      if (this.isGasEnvironment()) await this.callGasBackend<void>('restoreOrderByNo', orderNumber, reason);
      else if (this.isApiEnvironment()) await this.callApi<void>('restoreOrderByNo', { orderNumber, reason });
      else {
          const orders = await this.getOrders(true);
          orders.forEach(o => {
              if (o.orderNumber === orderNumber) {
                  o.isArchived = false;
                  o.status = CalibrationStatus.PENDING;
                  o.resurrectReason = reason;
              }
          });
          localStorage.setItem('cal_orders', JSON.stringify(orders));
      }
  }

  async deleteOrderByNo(orderNumber: string): Promise<void> {
      // Optimistic Update
      const cached = this.getCache<Order[]>('orders');
      if (cached) {
          this.setCache('orders', cached.filter(o => o.orderNumber !== orderNumber));
      }

      if (this.isGasEnvironment()) await this.callGasBackend<void>('deleteOrderByNo', orderNumber);
      else if (this.isApiEnvironment()) await this.callApi<void>('deleteOrderByNo', { orderNumber });
      else {
          const orders = await this.getOrders(true);
          localStorage.setItem('cal_orders', JSON.stringify(orders.filter(o => o.orderNumber !== orderNumber)));
      }
  }
}

export const mockGasService = new HybridGasService();
