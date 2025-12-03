
import { Order, Product, Customer, CalibrationStatus, CalibrationType, Technician } from '../types';

// Mock Data for Customers
const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: '科技實業股份有限公司', contactPerson: '王經理', phone: '02-22334455' },
  { id: 'c2', name: '航太精密組件', contactPerson: '李工程師', phone: '04-22334455' },
  { id: 'c3', name: '精準實驗室', contactPerson: '張主任', phone: '03-55667788' },
  { id: 'c4', name: '動力機械維修中心', contactPerson: '劉技師', phone: '07-88990011' },
];

// Mock Data for Technicians
const INITIAL_TECHNICIANS: Technician[] = [
    { id: 't1', name: '陳小明' },
    { id: 't2', name: '林志豪' },
    { id: 't3', name: '張雅雯' },
    { id: 't4', name: '王大明' },
    { id: 't5', name: '李小美' },
];

// Mock Data to simulate "Product Inventory.CSV"
const INITIAL_INVENTORY: Product[] = [
  { id: '1', name: '數位卡尺校正', specification: '0-150mm / 0.01mm', category: '長度量測', standardPrice: 1200, lastUpdated: '2023-10-01' },
  { id: '2', name: '外徑分厘卡校正', specification: '0-25mm / 0.001mm', category: '長度量測', standardPrice: 1500, lastUpdated: '2023-10-05' },
  { id: '3', name: '壓力錶校正', specification: '0-100 psi / Grade A', category: '壓力', standardPrice: 2200, lastUpdated: '2023-09-15' },
  { id: '4', name: '三用電表校正 (Fluke)', specification: 'True RMS', category: '電學', standardPrice: 3500, lastUpdated: '2023-11-20' },
  { id: '5', name: '扭力扳手校正', specification: '10-50 Nm / 3/8" Dr.', category: '扭力', standardPrice: 1800, lastUpdated: '2023-10-10' },
  { id: '6', name: '溫度感測器校正', specification: 'Class A / -50~250°C', category: '溫度', standardPrice: 2800, lastUpdated: '2023-12-01' },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: 'ord-001-1',
    orderNumber: 'CAL-2023-001',
    equipmentNumber: 'EQ-001',
    equipmentName: '品管室數位卡尺',
    customerName: '科技實業股份有限公司',
    productId: '1',
    productName: '數位卡尺校正',
    productSpec: '0-150mm',
    category: '長度量測',
    calibrationType: CalibrationType.INTERNAL,
    quantity: 1,
    unitPrice: 1200,
    discountRate: 100,
    totalAmount: 1200,
    status: CalibrationStatus.COMPLETED,
    createDate: '2023-12-01T10:00:00Z',
    targetDate: '2023-12-05T10:00:00Z',
    technicians: ['陳小明'],
    isArchived: true,
    notes: '年度校正'
  },
  {
    id: 'ord-001-2',
    orderNumber: 'CAL-2023-001',
    equipmentNumber: 'EQ-001',
    equipmentName: '品管室數位卡尺',
    customerName: '科技實業股份有限公司',
    productId: '2',
    productName: '深度規校正',
    productSpec: '0-25mm',
    category: '長度量測',
    calibrationType: CalibrationType.INTERNAL,
    quantity: 1,
    unitPrice: 1500,
    discountRate: 100,
    totalAmount: 1500,
    status: CalibrationStatus.COMPLETED,
    createDate: '2023-12-01T10:00:00Z',
    targetDate: '2023-12-05T10:00:00Z',
    technicians: ['陳小明'],
    isArchived: true,
    notes: '年度校正'
  },
  {
    id: 'ord-002',
    orderNumber: 'CAL-2024-002',
    equipmentNumber: 'EQ-099',
    equipmentName: '產線高壓錶',
    customerName: '航太精密組件',
    productId: '3',
    productName: '壓力錶校正',
    productSpec: '0-100 psi',
    category: '壓力',
    calibrationType: CalibrationType.EXTERNAL,
    quantity: 1,
    unitPrice: 2200,
    discountRate: 90,
    totalAmount: 1980,
    status: CalibrationStatus.CALIBRATING,
    createDate: '2024-01-15T09:30:00Z',
    targetDate: '2024-01-20T09:30:00Z',
    technicians: ['林志豪', '張雅雯'],
    isArchived: false,
  },
  {
    id: 'ord-003',
    orderNumber: 'CAL-2024-003',
    equipmentNumber: 'EQ-105',
    equipmentName: 'Fluke 87V 電表',
    customerName: '精準實驗室',
    productId: '4',
    productName: '三用電表校正 (Fluke)',
    productSpec: 'True RMS',
    category: '電學',
    calibrationType: CalibrationType.INTERNAL,
    quantity: 3,
    unitPrice: 3500,
    discountRate: 95,
    totalAmount: 9975,
    status: CalibrationStatus.PENDING,
    createDate: '2024-02-10T14:00:00Z',
    targetDate: '2024-02-17T14:00:00Z',
    technicians: ['陳小明'],
    isArchived: false,
  },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class MockGasService {
  // --- Admin Security ---
  async checkAdminPassword(input: string): Promise<boolean> {
    await delay(200);
    const stored = localStorage.getItem('cal_admin_pwd');
    // Default password is '0000' if not set
    const currentPwd = stored || '0000';
    return input === currentPwd;
  }

  async changeAdminPassword(oldPwd: string, newPwd: string): Promise<boolean> {
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
    await delay(300);
    const stored = localStorage.getItem('cal_inventory');
    if (!stored) {
      localStorage.setItem('cal_inventory', JSON.stringify(INITIAL_INVENTORY));
      return INITIAL_INVENTORY;
    }
    return JSON.parse(stored);
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
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
    await delay(200);
    const stored = localStorage.getItem('cal_customers');
    if (!stored) {
        localStorage.setItem('cal_customers', JSON.stringify(INITIAL_CUSTOMERS));
        return INITIAL_CUSTOMERS;
    }
    return JSON.parse(stored);
  }

  async addCustomer(name: string): Promise<Customer> {
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
    await delay(200);
    const stored = localStorage.getItem('cal_technicians');
    if (!stored) {
        localStorage.setItem('cal_technicians', JSON.stringify(INITIAL_TECHNICIANS));
        return INITIAL_TECHNICIANS;
    }
    return JSON.parse(stored);
  }

  async addTechnician(name: string): Promise<Technician> {
      await delay(200);
      const technicians = await this.getTechnicians();
      const newTech = { id: 't-' + Math.random().toString(36).substr(2, 5), name };
      technicians.push(newTech);
      localStorage.setItem('cal_technicians', JSON.stringify(technicians));
      return newTech;
  }

  async removeTechnician(id: string): Promise<void> {
      await delay(200);
      const technicians = await this.getTechnicians();
      const updated = technicians.filter(t => t.id !== id);
      localStorage.setItem('cal_technicians', JSON.stringify(updated));
  }

  // --- Orders ---
  async getOrders(): Promise<Order[]> {
    await delay(400);
    const stored = localStorage.getItem('cal_orders');
    if (!stored) {
      localStorage.setItem('cal_orders', JSON.stringify(INITIAL_ORDERS));
      return INITIAL_ORDERS;
    }
    return JSON.parse(stored);
  }

  async checkOrderExists(orderNumber: string): Promise<boolean> {
      const orders = await this.getOrders();
      return orders.some(o => o.orderNumber === orderNumber);
  }

  async createOrders(
      ordersData: Omit<Order, 'id' | 'totalAmount' | 'createDate' | 'isArchived'>[], 
      manualOrderNumber: string
    ): Promise<void> {
    await delay(800);
    const existingOrders = await this.getOrders();
    const createDate = new Date().toISOString();

    const newOrders: Order[] = ordersData.map(data => {
        // Calculate Total: (Price * Qty) * (Discount / 100)
        // Example: Discount 80 (80%) -> Multiplier 0.8
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
    await delay(200);
    const orders = await this.getOrders();
    let updated = false;

    orders.forEach(o => {
        if (o.orderNumber === orderNumber) {
            o.status = newStatus;
            // Auto Archive if Completed
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
  
  // RESTORE BATCH: Restore all items with same Order Number
  async restoreOrderByNo(orderNumber: string, reason: string): Promise<void> {
      await delay(200);
      const orders = await this.getOrders();
      let updated = false;

      orders.forEach(o => {
          if (o.orderNumber === orderNumber) {
              o.isArchived = false; // Set archived to false
              o.status = CalibrationStatus.PENDING; // Reset status to Pending
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

  // DELETE BATCH: Delete all items with same Order Number
  async deleteOrderByNo(orderNumber: string): Promise<void> {
      await delay(500);
      const orders = await this.getOrders();
      const filteredOrders = orders.filter(o => o.orderNumber !== orderNumber);
      localStorage.setItem('cal_orders', JSON.stringify(filteredOrders));
  }
}

export const mockGasService = new MockGasService();
