
export enum CalibrationStatus {
  PENDING = 'Pending',
  CALIBRATING = 'Calibrating',
  COMPLETED = 'Completed',
}

export enum CalibrationType {
  INTERNAL = 'Internal', // 內校
  EXTERNAL = 'External', // 委外
}

// Helper to display Chinese status
export const StatusLabel: Record<string, string> = {
  [CalibrationStatus.PENDING]: '待處理',
  [CalibrationStatus.CALIBRATING]: '校正中',
  [CalibrationStatus.COMPLETED]: '已完成',
};

export const CalibrationTypeLabel: Record<string, string> = {
  [CalibrationType.INTERNAL]: '內校',
  [CalibrationType.EXTERNAL]: '委外',
};

export interface Customer {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
}

export interface Technician {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  name: string; // 庫存品項名稱 (校正服務項目)
  specification: string; 
  category: string;
  standardPrice: number;
  lastUpdated: string;
}

export interface Order {
  id: string;
  orderNumber: string; // 校正訂單編號 (Header)
  
  // Equipment Info (Header) - The physical object being calibrated
  equipmentNumber: string; // 設備案號
  equipmentName: string;   // 設備名稱 (New)
  customerName: string;
  
  // Calibration Service Details (Line Item) - From Inventory
  productId: string;
  productName: string; // 校正品項名稱 (From Inventory)
  productSpec: string; 
  category: string;
  calibrationType: CalibrationType;
  
  quantity: number;
  unitPrice: number;
  discountRate: number; // (Header/Global)
  totalAmount: number; 
  
  status: CalibrationStatus;
  createDate: string; 
  targetDate: string; // (Header)
  technicians: string[]; // (Header)
  notes?: string; 
  isArchived: boolean;
  resurrectReason?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  activeOrders: number;
  completedOrders: number;
  pendingAmount: number;
}

export type ViewState = 'dashboard' | 'create-order' | 'order-list' | 'inventory' | 'settings';

export interface OrderTemplate extends Partial<Order> {
  isCopy?: boolean;
}
