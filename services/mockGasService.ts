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

class HybridGasService {
  private apiUrl: string = import.meta.env.VITE_GAS_API_URL || '';

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
  // Fixes issue where Sheet headers are "OrderNumber" but frontend expects "orderNumber"
  private normalizeData(data: any): any {
    if (Array.isArray(data)) {
      return data.map(item => this.normalizeData(item));
    }
    if (data !== null && typeof data === 'object') {
      const newObj: any = {};
      Object.keys(data).forEach(key => {
        // Convert first char to lower case
        let newKey = key.charAt(0).toLowerCase() + key.slice(1);
        // Special case: "ID" -> "id"
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
          console.log(`📡 Sending API Request: [${action}]`);
          
          const response = await fetch(this.apiUrl, {
              method: 'POST',
              body: JSON.stringify({ action, payload })
          });

          const json = await response.json();
          
          if (!json.success && (json.status === 'error' || json.error)) {
              throw new Error(json.error || 'API Error');
          }

          // Debug log for data structure
          if (Array.isArray(json.data) && json.data.length > 0) {
              console.log(`📥 API Response [${action}] Sample Key Check:`, Object.keys(json.data[0]));
          }

          // Normalize data keys before returning
          const normalized = this.normalizeData(json.data);
          
          if (Array.isArray(normalized) && normalized.length > 0) {
             console.log(`✨ Normalized Data [${action}] Sample Key Check:`, Object.keys(normalized[0]));
          }

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
            
            console.log(`📥 GAS Response [${functionName}] Raw:`, data);
            
            // Normalize data keys before returning
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

  async getInventory(): Promise<Product[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Product[]>('getInventory');
    if (this.isApiEnvironment()) return this.callApi<Product[]>('getInventory');

    await delay(300);
    const stored = localStorage.getItem('cal_inventory');
    return stored ? JSON.parse(stored) : INITIAL_INVENTORY;
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    if (this.isGasEnvironment()) return this.callGasBackend<Product>('addProduct', product);
    if (this.isApiEnvironment()) return this.callApi<Product>('addProduct', product);

    await delay(300);
    const products = await this.getInventory();
    const newProduct: Product = { ...product, id: Date.now().toString(), lastUpdated: new Date().toISOString() };
    products.push(newProduct);
    localStorage.setItem('cal_inventory', JSON.stringify(products));
    return newProduct;
  }

  async getCustomers(): Promise<Customer[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Customer[]>('getCustomers');
    if (this.isApiEnvironment()) return this.callApi<Customer[]>('getCustomers');

    await delay(200);
    const stored = localStorage.getItem('cal_customers');
    return stored ? JSON.parse(stored) : INITIAL_CUSTOMERS;
  }

  async addCustomer(name: string): Promise<Customer> {
    if (this.isGasEnvironment()) return this.callGasBackend<Customer>('addCustomer', name);
    if (this.isApiEnvironment()) return this.callApi<Customer>('addCustomer', name);

    await delay(200);
    const customers = await this.getCustomers();
    const newCustomer = { id: 'c-' + Date.now(), name };
    customers.push(newCustomer);
    localStorage.setItem('cal_customers', JSON.stringify(customers));
    return newCustomer;
  }

  async getTechnicians(): Promise<Technician[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Technician[]>('getTechnicians');
    if (this.isApiEnvironment()) return this.callApi<Technician[]>('getTechnicians');

    await delay(200);
    const stored = localStorage.getItem('cal_technicians');
    return stored ? JSON.parse(stored) : INITIAL_TECHNICIANS;
  }

  async addTechnician(name: string): Promise<Technician> {
      if (this.isGasEnvironment()) return this.callGasBackend<Technician>('addTechnician', name);
      if (this.isApiEnvironment()) return this.callApi<Technician>('addTechnician', name);

      await delay(200);
      const techs = await this.getTechnicians();
      const newTech = { id: 't-' + Date.now(), name };
      techs.push(newTech);
      localStorage.setItem('cal_technicians', JSON.stringify(techs));
      return newTech;
  }

  async removeTechnician(id: string): Promise<void> {
      if (this.isGasEnvironment()) return this.callGasBackend<void>('removeTechnician', id);
      if (this.isApiEnvironment()) return this.callApi<void>('removeTechnician', id);

      await delay(200);
      const techs = await this.getTechnicians();
      localStorage.setItem('cal_technicians', JSON.stringify(techs.filter(t => t.id !== id)));
  }

  async getOrders(): Promise<Order[]> {
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

    // Garbage Collection: Filter out header rows or invalid data
    // This removes rows where 'OrderNumber' (value) equals the header name 'OrderNumber' or is empty
    return orders.filter(o => 
        o && 
        o.orderNumber && 
        String(o.orderNumber).trim() !== '' &&
        String(o.orderNumber).toLowerCase() !== 'ordernumber' && 
        !String(o.orderNumber).includes('ID, OrderNumber') 
    );
  }

  async checkOrderExists(orderNumber: string): Promise<boolean> {
      if (this.isGasEnvironment()) return this.callGasBackend<boolean>('checkOrderExists', orderNumber);
      if (this.isApiEnvironment()) return this.callApi<boolean>('checkOrderExists', orderNumber);

      const orders = await this.getOrders();
      return orders.some(o => o.orderNumber === orderNumber);
  }

  async createOrders(ordersData: any[], manualOrderNumber: string): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('createOrders', JSON.stringify(ordersData), manualOrderNumber);
    if (this.isApiEnvironment()) return this.callApi<void>('createOrders', { ordersData, manualOrderNumber });

    await delay(800);
    const existing = await this.getOrders();
    const newOrders = ordersData.map(d => ({
        ...d,
        id: Date.now().toString() + Math.random(),
        orderNumber: manualOrderNumber,
        totalAmount: Math.round(d.unitPrice * d.quantity * (d.discountRate/100)),
        createDate: new Date().toISOString(),
        isArchived: false
    }));
    localStorage.setItem('cal_orders', JSON.stringify([...newOrders, ...existing]));
  }

  async updateOrderStatusByNo(orderNumber: string, newStatus: CalibrationStatus): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('updateOrderStatusByNo', orderNumber, newStatus);
    if (this.isApiEnvironment()) return this.callApi<void>('updateOrderStatusByNo', { orderNumber, newStatus });

    const orders = await this.getOrders();
    orders.forEach(o => {
        if(o.orderNumber === orderNumber) {
            o.status = newStatus;
            if(newStatus === CalibrationStatus.COMPLETED) o.isArchived = true;
        }
    });
    localStorage.setItem('cal_orders', JSON.stringify(orders));
  }

  async updateOrderNotesByNo(orderNumber: string, notes: string): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('updateOrderNotesByNo', orderNumber, notes);
    if (this.isApiEnvironment()) return this.callApi<void>('updateOrderNotesByNo', { orderNumber, notes });

    const orders = await this.getOrders();
    orders.forEach(o => { if(o.orderNumber === orderNumber) o.notes = notes; });
    localStorage.setItem('cal_orders', JSON.stringify(orders));
  }

  async updateOrderTargetDateByNo(orderNumber: string, newDate: string): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('updateOrderTargetDateByNo', orderNumber, newDate);
    if (this.isApiEnvironment()) return this.callApi<void>('updateOrderTargetDateByNo', { orderNumber, newDate });

    const orders = await this.getOrders();
    orders.forEach(o => { if(o.orderNumber === orderNumber) o.targetDate = new Date(newDate).toISOString(); });
    localStorage.setItem('cal_orders', JSON.stringify(orders));
  }
  
  async restoreOrderByNo(orderNumber: string, reason: string): Promise<void> {
      if (this.isGasEnvironment()) return this.callGasBackend<void>('restoreOrderByNo', orderNumber, reason);
      if (this.isApiEnvironment()) return this.callApi<void>('restoreOrderByNo', { orderNumber, reason });

      const orders = await this.getOrders();
      orders.forEach(o => {
          if (o.orderNumber === orderNumber) {
              o.isArchived = false;
              o.status = CalibrationStatus.PENDING;
              o.resurrectReason = reason;
          }
      });
      localStorage.setItem('cal_orders', JSON.stringify(orders));
  }

  async deleteOrderByNo(orderNumber: string): Promise<void> {
      if (this.isGasEnvironment()) return this.callGasBackend<void>('deleteOrderByNo', orderNumber);
      if (this.isApiEnvironment()) return this.callApi<void>('deleteOrderByNo', { orderNumber });

      const orders = await this.getOrders();
      localStorage.setItem('cal_orders', JSON.stringify(orders.filter(o => o.orderNumber !== orderNumber)));
  }
}

export const mockGasService = new HybridGasService();