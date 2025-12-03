import { Order, Product, Customer, CalibrationStatus, CalibrationType, Technician } from '../types';

// Mock Data for Customers (Fallback)
const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: '科技實業股份有限公司', contactPerson: '王經理', phone: '02-22334455' },
  { id: 'c2', name: '航太精密組件', contactPerson: '李工程師', phone: '04-22334455' },
];

// Mock Data for Technicians (Fallback)
const INITIAL_TECHNICIANS: Technician[] = [
    { id: 't1', name: '陳小明' },
    { id: 't2', name: '林志豪' },
];

// Mock Data for Inventory (Fallback)
const INITIAL_INVENTORY: Product[] = [
  { id: '1', name: '數位卡尺校正', specification: '0-150mm', category: '長度', standardPrice: 1200, lastUpdated: '2023-10-01' },
];

const INITIAL_ORDERS: Order[] = [];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Environment Types
export type EnvType = 'gas' | 'api' | 'mock';

class HybridGasService {
  private apiUrl: string = import.meta.env.VITE_GAS_API_URL || '';

  // 1. Detect GAS Embedded Environment
  public isGasEnvironment(): boolean {
    return (
      typeof window !== 'undefined' && 
      (window as any).google && 
      (window as any).google.script && 
      (window as any).google.script.run
    );
  }

  // 2. Detect API Environment (Vercel)
  public isApiEnvironment(): boolean {
      return !!this.apiUrl && !this.isGasEnvironment();
  }

  public getEnvironmentType(): EnvType {
      if (this.isGasEnvironment()) return 'gas';
      if (this.isApiEnvironment()) return 'api';
      return 'mock';
  }

  // --- API Caller Helper (For Vercel) ---
  private async callApi<T>(action: string, payload?: any): Promise<T> {
      try {
          // Use no-cors mode carefully, but usually GAS Web App requires standard CORS handling in the script
          // The Code.gs I provided handles CORS response headers.
          const response = await fetch(this.apiUrl, {
              method: 'POST',
              headers: {
                  'Content-Type': 'text/plain;charset=utf-8', // GAS requires text/plain to avoid preflight issues sometimes
              },
              body: JSON.stringify({ action, payload })
          });

          const json = await response.json();
          if (json.status === 'error' || json.error) {
              throw new Error(json.error || 'API Error');
          }
          return json.data as T;
      } catch (error) {
          console.error(`API Call Failed [${action}]:`, error);
          throw error;
      }
  }

  // --- GAS Caller Helper (For Embedded) ---
  private callGasBackend<T>(functionName: string, ...args: any[]): Promise<T> {
    return new Promise((resolve, reject) => {
      (window as any).google.script.run
        .withSuccessHandler((response: any) => {
            try {
                resolve(typeof response === 'string' ? JSON.parse(response) : response);
            } catch (e) {
                resolve(response);
            }
        })
        .withFailureHandler((error: any) => {
            console.error(`GAS Call Failed: ${functionName}`, error);
            reject(error);
        })
        [functionName](...args);
    });
  }

  // --- Admin Security ---
  async checkAdminPassword(input: string): Promise<boolean> {
    if (this.isGasEnvironment()) return this.callGasBackend<boolean>('checkAdminPassword', input);
    if (this.isApiEnvironment()) return this.callApi<boolean>('checkAdminPassword', input);
    
    await delay(200);
    const stored = localStorage.getItem('cal_admin_pwd');
    const currentPwd = stored || '0000';
    return input === currentPwd;
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

  // --- Inventory ---
  async getInventory(): Promise<Product[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Product[]>('getInventory');
    if (this.isApiEnvironment()) return this.callApi<Product[]>('getInventory');

    await delay(300);
    const stored = localStorage.getItem('cal_inventory');
    if (!stored) {
      localStorage.setItem('cal_inventory', JSON.stringify(INITIAL_INVENTORY));
      return INITIAL_INVENTORY;
    }
    return JSON.parse(stored);
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    if (this.isGasEnvironment()) return this.callGasBackend<Product>('addProduct', product);
    if (this.isApiEnvironment()) return this.callApi<Product>('addProduct', product);

    await delay(300);
    const products = await this.getInventory();
    const newProduct: Product = {
      ...product,
      id: Math.random().toString(36).substr(2, 9),
      lastUpdated: new Date().toISOString(),
    };
    products.push(newProduct);
    localStorage.setItem('cal_inventory', JSON.stringify(products));
    return newProduct;
  }

  // --- Customers ---
  async getCustomers(): Promise<Customer[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Customer[]>('getCustomers');
    if (this.isApiEnvironment()) return this.callApi<Customer[]>('getCustomers');

    await delay(200);
    const stored = localStorage.getItem('cal_customers');
    if (!stored) {
        localStorage.setItem('cal_customers', JSON.stringify(INITIAL_CUSTOMERS));
        return INITIAL_CUSTOMERS;
    }
    return JSON.parse(stored);
  }

  async addCustomer(name: string): Promise<Customer> {
    if (this.isGasEnvironment()) return this.callGasBackend<Customer>('addCustomer', name);
    if (this.isApiEnvironment()) return this.callApi<Customer>('addCustomer', name);

    await delay(200);
    const customers = await this.getCustomers();
    const newCustomer: Customer = {
        id: 'c-' + Math.random().toString(36).substr(2, 5),
        name: name
    };
    customers.push(newCustomer);
    localStorage.setItem('cal_customers', JSON.stringify(customers));
    return newCustomer;
  }

  // --- Technicians ---
  async getTechnicians(): Promise<Technician[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Technician[]>('getTechnicians');
    if (this.isApiEnvironment()) return this.callApi<Technician[]>('getTechnicians');

    await delay(200);
    const stored = localStorage.getItem('cal_technicians');
    if (!stored) {
        localStorage.setItem('cal_technicians', JSON.stringify(INITIAL_TECHNICIANS));
        return INITIAL_TECHNICIANS;
    }
    return JSON.parse(stored);
  }

  async addTechnician(name: string): Promise<Technician> {
      if (this.isGasEnvironment()) return this.callGasBackend<Technician>('addTechnician', name);
      if (this.isApiEnvironment()) return this.callApi<Technician>('addTechnician', name);

      await delay(200);
      const technicians = await this.getTechnicians();
      const newTech = { id: 't-' + Math.random().toString(36).substr(2, 5), name };
      technicians.push(newTech);
      localStorage.setItem('cal_technicians', JSON.stringify(technicians));
      return newTech;
  }

  async removeTechnician(id: string): Promise<void> {
      if (this.isGasEnvironment()) return this.callGasBackend<void>('removeTechnician', id);
      if (this.isApiEnvironment()) return this.callApi<void>('removeTechnician', id);

      await delay(200);
      const technicians = await this.getTechnicians();
      const updated = technicians.filter(t => t.id !== id);
      localStorage.setItem('cal_technicians', JSON.stringify(updated));
  }

  // --- Orders ---
  async getOrders(): Promise<Order[]> {
    if (this.isGasEnvironment()) return this.callGasBackend<Order[]>('getOrders');
    if (this.isApiEnvironment()) return this.callApi<Order[]>('getOrders');

    await delay(400);
    const stored = localStorage.getItem('cal_orders');
    if (!stored) {
      localStorage.setItem('cal_orders', JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return JSON.parse(stored);
  }

  async checkOrderExists(orderNumber: string): Promise<boolean> {
      if (this.isGasEnvironment()) return this.callGasBackend<boolean>('checkOrderExists', orderNumber);
      if (this.isApiEnvironment()) return this.callApi<boolean>('checkOrderExists', orderNumber);

      const orders = await this.getOrders();
      return orders.some(o => o.orderNumber === orderNumber);
  }

  async createOrders(
      ordersData: Omit<Order, 'id' | 'totalAmount' | 'createDate' | 'isArchived'>[], 
      manualOrderNumber: string
    ): Promise<void> {
    
    if (this.isGasEnvironment()) {
        return this.callGasBackend<void>('createOrders', JSON.stringify(ordersData), manualOrderNumber);
    }
    if (this.isApiEnvironment()) {
        return this.callApi<void>('createOrders', { ordersData, manualOrderNumber });
    }

    await delay(800);
    const existingOrders = await this.getOrders();
    const createDate = new Date().toISOString();

    const newOrders: Order[] = ordersData.map(data => {
        const subtotal = data.unitPrice * data.quantity;
        const discountMultiplier = data.discountRate / 100;
        
        return {
            ...data,
            id: Math.random().toString(36).substr(2, 9),
            orderNumber: manualOrderNumber,
            totalAmount: Math.round(subtotal * discountMultiplier),
            createDate,
            isArchived: false,
        };
    });
    
    const updatedOrders = [...newOrders, ...existingOrders];
    localStorage.setItem('cal_orders', JSON.stringify(updatedOrders));
  }

  // BATCH UPDATE: Update all items with same Order Number
  async updateOrderStatusByNo(orderNumber: string, newStatus: CalibrationStatus): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('updateOrderStatusByNo', orderNumber, newStatus);
    if (this.isApiEnvironment()) return this.callApi<void>('updateOrderStatusByNo', { orderNumber, newStatus });

    await delay(200);
    const orders = await this.getOrders();
    let updated = false;

    orders.forEach(o => {
        if (o.orderNumber === orderNumber) {
            o.status = newStatus;
            if (newStatus === CalibrationStatus.COMPLETED) {
                o.isArchived = true;
            }
            updated = true;
        }
    });

    if (updated) {
        localStorage.setItem('cal_orders', JSON.stringify(orders));
    }
  }

  async updateOrderNotesByNo(orderNumber: string, notes: string): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('updateOrderNotesByNo', orderNumber, notes);
    if (this.isApiEnvironment()) return this.callApi<void>('updateOrderNotesByNo', { orderNumber, notes });

    await delay(200);
    const orders = await this.getOrders();
    let updated = false;
    orders.forEach(o => {
        if (o.orderNumber === orderNumber) {
            o.notes = notes;
            updated = true;
        }
    });
    if (updated) {
       localStorage.setItem('cal_orders', JSON.stringify(orders));
    }
  }

  async updateOrderTargetDateByNo(orderNumber: string, newDate: string): Promise<void> {
    if (this.isGasEnvironment()) return this.callGasBackend<void>('updateOrderTargetDateByNo', orderNumber, newDate);
    if (this.isApiEnvironment()) return this.callApi<void>('updateOrderTargetDateByNo', { orderNumber, newDate });

    await delay(200);
    const orders = await this.getOrders();
    let updated = false;
    const dateObj = new Date(newDate);

    if (!isNaN(dateObj.getTime())) {
        orders.forEach(o => {
            if (o.orderNumber === orderNumber) {
                o.targetDate = dateObj.toISOString();
                updated = true;
            }
        });
    }
    
    if (updated) {
         localStorage.setItem('cal_orders', JSON.stringify(orders));
    }
  }
  
  async restoreOrderByNo(orderNumber: string, reason: string): Promise<void> {
      if (this.isGasEnvironment()) return this.callGasBackend<void>('restoreOrderByNo', orderNumber, reason);
      if (this.isApiEnvironment()) return this.callApi<void>('restoreOrderByNo', { orderNumber, reason });

      await delay(200);
      const orders = await this.getOrders();
      let updated = false;

      orders.forEach(o => {
          if (o.orderNumber === orderNumber) {
              o.isArchived = false;
              o.status = CalibrationStatus.PENDING;
              o.resurrectReason = reason;
              o.notes = o.notes 
                ? `${o.notes} (復活: ${reason})` 
                : `(復活: ${reason})`;
              updated = true;
          }
      });

      if (updated) {
          localStorage.setItem('cal_orders', JSON.stringify(orders));
      }
  }

  async deleteOrderByNo(orderNumber: string): Promise<void> {
      if (this.isGasEnvironment()) return this.callGasBackend<void>('deleteOrderByNo', orderNumber);
      if (this.isApiEnvironment()) return this.callApi<void>('deleteOrderByNo', { orderNumber });

      await delay(500);
      const orders = await this.getOrders();
      const filteredOrders = orders.filter(o => o.orderNumber !== orderNumber);
      localStorage.setItem('cal_orders', JSON.stringify(filteredOrders));
  }
}

export const mockGasService = new HybridGasService();