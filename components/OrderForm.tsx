
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product, Customer, CalibrationStatus, CalibrationType, OrderTemplate, CalibrationTypeLabel, Order, Technician } from '../types';
import { mockGasService } from '../services/mockGasService';
import { Save, Plus, Trash2, ShoppingCart, User, Archive, FileText, Building2, Percent, Search, History, Package, Monitor, ArrowDownCircle, CheckSquare, Square } from 'lucide-react';

interface OrderFormProps {
  onOrderCreated: () => void;
  copyData?: OrderTemplate | null;
}

interface CartItem {
  tempId: string;
  productId: string;
  productName: string; // Inventory Name
  productSpec: string;
  category: string;
  calibrationType: CalibrationType;
  price: number;
  quantity: number;
  saveToInventory: boolean;
}

export const OrderForm: React.FC<OrderFormProps> = ({ onOrderCreated, copyData }) => {
  const [inventory, setInventory] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [historicalOrders, setHistoricalOrders] = useState<Order[]>([]);
  const [availableTechnicians, setAvailableTechnicians] = useState<Technician[]>([]);

  // Customer Search
  const [customerQuery, setCustomerQuery] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  // --- Header Input State (Equipment Info) ---
  const [orderNumber, setOrderNumber] = useState(''); // Default to empty
  const [targetDate, setTargetDate] = useState('');
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);
  const [discountRate, setDiscountRate] = useState<number>(100); // Default to 100% (No discount)
  
  // Equipment Fields (Header)
  const [eqNumberQuery, setEqNumberQuery] = useState('');
  const [eqNameQuery, setEqNameQuery] = useState('');
  const [showEqNumSuggestions, setShowEqNumSuggestions] = useState(false);
  const [showEqNameSuggestions, setShowEqNameSuggestions] = useState(false);

  // --- Item Input State (Inventory Search) ---
  const [productNameQuery, setProductNameQuery] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  
  const [currentItem, setCurrentItem] = useState<Partial<CartItem>>({
    price: 0,
    quantity: 1,
    category: '',
    productSpec: '',
    calibrationType: CalibrationType.INTERNAL,
    saveToInventory: false,
    productId: ''
  });

  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  // Validation State
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  // Refs
  const customerWrapperRef = useRef<HTMLDivElement>(null);
  const eqNumWrapperRef = useRef<HTMLDivElement>(null);
  const eqNameWrapperRef = useRef<HTMLDivElement>(null);
  const productWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mockGasService.getInventory().then(setInventory);
    mockGasService.getCustomers().then(setCustomers);
    mockGasService.getOrders().then(setHistoricalOrders);
    mockGasService.getTechnicians().then(setAvailableTechnicians);
    
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setTargetDate(nextWeek.toISOString().split('T')[0]);
    
    // Default order number is EMPTY to force manual entry
    // setOrderNumber(''); 

    if (copyData) {
        // Copy Header Info
        setCustomerQuery(copyData.customerName || '');
        setEqNumberQuery(copyData.equipmentNumber || '');
        setEqNameQuery(copyData.equipmentName || '');
        setSelectedTechnicians(copyData.technicians || []);
        setDiscountRate(copyData.discountRate || 100);
        
        // Copy Single Item (Usually copy creates a new order with same equipment/item)
        if (copyData.productName) {
            setCart([{
                tempId: Date.now().toString(),
                productId: copyData.productId || '',
                productName: copyData.productName,
                productSpec: copyData.productSpec || '',
                category: copyData.category || '',
                calibrationType: copyData.calibrationType || CalibrationType.INTERNAL,
                price: copyData.unitPrice || 0,
                quantity: copyData.quantity || 1,
                saveToInventory: false
            }]);
        }
    }
  }, [copyData]);

  // Click Outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (customerWrapperRef.current && !customerWrapperRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
      if (eqNumWrapperRef.current && !eqNumWrapperRef.current.contains(event.target as Node)) {
        setShowEqNumSuggestions(false);
      }
      if (eqNameWrapperRef.current && !eqNameWrapperRef.current.contains(event.target as Node)) {
        setShowEqNameSuggestions(false);
      }
      if (productWrapperRef.current && !productWrapperRef.current.contains(event.target as Node)) {
        setShowProductSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Optimization: Pre-calculate Unique Equipment List ---
  // Instead of filtering all orders on every keystroke, we build a unique index once when orders load.
  const uniqueEquipmentHistory = useMemo(() => {
      const map = new Map<string, Order>();
      
      // Sort by date desc first so the latest entry wins in the map (if we want latest)
      // or just keep the first one found if order doesn't matter.
      // Here we assume historicalOrders are potentially mixed, so we process them.
      
      historicalOrders.forEach(order => {
          // Robust check: Ensure equipmentNumber exists
          if (!order.equipmentNumber) return;
          
          const key = `${order.equipmentNumber.trim()}`;
          // const key = `${order.equipmentNumber.trim()}|${(order.equipmentName || '').trim()}`; // Composite key if needed
          
          if (!map.has(key)) {
              map.set(key, order);
          } else {
              // Optional: Update if this order is newer? 
              // For now, first found (or last found depending on iteration) is fine for "Suggestion"
          }
      });
      
      return Array.from(map.values());
  }, [historicalOrders]);

  // Helper: Get item count for a specific job (Order + Eq match)
  const getJobItemCount = (order: Order) => {
      return historicalOrders.filter(o => 
          o.orderNumber === order.orderNumber && 
          o.equipmentNumber === order.equipmentNumber
      ).length;
  };

  // --- Logic: Search Equipment Numbers (Using Optimized Index) ---
  const eqNumSuggestions = useMemo(() => {
      if (!eqNumberQuery) return [];
      const q = eqNumberQuery.toLowerCase().trim();
      
      return uniqueEquipmentHistory
          .filter(o => String(o.equipmentNumber || '').toLowerCase().includes(q))
          .slice(0, 8); // Limit results for performance
  }, [eqNumberQuery, uniqueEquipmentHistory]);

  // --- Logic: Search Equipment Names (Using Optimized Index) ---
  // Note: For Equipment Name, we might want a different unique index if names are shared across numbers,
  // but usually searching the same unique history is sufficient.
  const eqNameSuggestions = useMemo(() => {
      if (!eqNameQuery) return [];
      const q = eqNameQuery.toLowerCase().trim();

      // We filter the unique list by Name this time
      return uniqueEquipmentHistory
          .filter(o => String(o.equipmentName || '').toLowerCase().includes(q))
          .slice(0, 8);
  }, [eqNameQuery, uniqueEquipmentHistory]);


  const handleHistoricalSelect = (order: Order) => {
      // 1. Fill Header
      setEqNumberQuery(order.equipmentNumber);
      setEqNameQuery(order.equipmentName || ''); 
      if (order.customerName) setCustomerQuery(order.customerName);
      
      // 2. Find ALL items belonging to this Equipment in that Past Order
      // (This still needs to search the full history to get all items of that specific past order)
      const relatedItems = historicalOrders.filter(o => 
          o.orderNumber === order.orderNumber && 
          o.equipmentNumber === order.equipmentNumber
      );

      // 3. Convert to Cart Items
      const newCartItems: CartItem[] = relatedItems.map(o => ({
          tempId: Date.now().toString() + Math.random().toString().substr(2, 5),
          productId: o.productId,
          productName: o.productName,
          productSpec: o.productSpec,
          category: o.category,
          calibrationType: o.calibrationType,
          price: o.unitPrice,
          quantity: o.quantity,
          saveToInventory: false
      }));

      // 4. Add to Cart
      setCart(prev => [...prev, ...newCartItems]);
      
      setPrefillMessage(`已自動帶入 "${order.equipmentNumber}" 的 ${newCartItems.length} 筆歷史校正明細`);

      // Close suggestions
      setShowEqNumSuggestions(false);
      setShowEqNameSuggestions(false);
      
      // Clear single item input (since we added to cart directly)
      setProductNameQuery('');
      setCurrentItem({
          price: 0,
          quantity: 1,
          category: '',
          productSpec: '',
          calibrationType: CalibrationType.INTERNAL,
          saveToInventory: false,
          productId: ''
      });

      // Clear message after 3s
      setTimeout(() => setPrefillMessage(null), 3000);
  };


  // --- Logic: Search Inventory Product (The Service Item) ---
  const productSuggestions = React.useMemo(() => {
      if (!productNameQuery) return [];
      const q = productNameQuery.toLowerCase();
      // Safe string check
      return inventory.filter(p => String(p.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [productNameQuery, inventory]);

  const handleProductSelect = (product: Product) => {
      setProductNameQuery(product.name);
      setCurrentItem(prev => ({
          ...prev,
          productSpec: product.specification,
          category: product.category,
          price: product.standardPrice,
          productId: product.id
      }));
      setShowProductSuggestions(false);
  };

  const handleCustomerSelect = (customer: Customer) => {
    setCustomerQuery(customer.name);
    setShowCustomerSuggestions(false);
  };

  const filteredCustomers = useMemo(() => {
      if (!customerQuery) return [];
      const q = customerQuery.toLowerCase();
      return customers.filter(c => String(c.name || '').toLowerCase().includes(q)).slice(0, 8);
  }, [customers, customerQuery]);

  const handleTechnicianToggle = (tech: string) => {
      setSelectedTechnicians(prev => 
        prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]
      );
  };

  const addToCart = () => {
    if (!productNameQuery || currentItem.price === undefined) {
        alert("請選擇校正品項並確認價格");
        return;
    }

    const newItem: CartItem = {
        tempId: Date.now().toString(),
        productId: currentItem.productId || '',
        productName: productNameQuery,
        productSpec: currentItem.productSpec || '',
        category: currentItem.category || '一般',
        calibrationType: currentItem.calibrationType || CalibrationType.INTERNAL,
        price: currentItem.price || 0,
        quantity: currentItem.quantity || 1,
        saveToInventory: currentItem.saveToInventory || false
    };

    setCart([...cart, newItem]);
    
    // Reset inputs for next item
    setProductNameQuery('');
    setCurrentItem({
        price: 0,
        quantity: 1,
        category: '',
        productSpec: '',
        calibrationType: CalibrationType.INTERNAL,
        saveToInventory: false,
        productId: ''
    });
  };

  const removeFromCart = (tempId: string) => {
    setCart(cart.filter(item => item.tempId !== tempId));
  };

  const handleSubmit = async () => {
    // 1. Trigger visual validation errors first
    setHasAttemptedSubmit(true);

    // 2. Collect missing fields
    const missingFields: string[] = [];
    if (!orderNumber.trim()) missingFields.push('校正訂單編號');
    if (!customerQuery.trim()) missingFields.push('客戶名稱');
    if (!targetDate) missingFields.push('預計完成日');
    if (!eqNumberQuery.trim()) missingFields.push('設備案號');
    if (!eqNameQuery.trim()) missingFields.push('設備名稱');
    if (cart.length === 0) missingFields.push('校正明細 (至少加入一項)');

    if (missingFields.length > 0) {
        // Ensure alert works by using a timeout to allow React to render the red borders first (optional but good practice)
        setTimeout(() => {
            alert(`無法建立工單，請補齊以下資訊：\n\n- ${missingFields.join('\n- ')}`);
        }, 50);
        return;
    }

    setLoading(true);

    try {
      // 3. Validation - Duplicate Order Number
      const exists = await mockGasService.checkOrderExists(orderNumber);
      if (exists) {
        alert(`訂單編號 ${orderNumber} 已存在，請使用不同的編號。`);
        setLoading(false);
        return;
      }

      const existingCustomer = customers.find(c => c.name === customerQuery);
      if (!existingCustomer) {
        await mockGasService.addCustomer(customerQuery);
      }

      const orderPayloads = [];

      for (const item of cart) {
        let finalProductId = item.productId;

        if (!finalProductId && item.saveToInventory) {
          const newProduct = await mockGasService.addProduct({
            name: item.productName,
            specification: item.productSpec,
            category: item.category,
            standardPrice: item.price,
            lastUpdated: new Date().toISOString()
          });
          finalProductId = newProduct.id;
        } else if (!finalProductId) {
            finalProductId = 'TEMP-' + Math.random().toString(36).substr(2, 5);
        }

        orderPayloads.push({
            orderNumber: orderNumber,
            customerName: customerQuery,
            equipmentNumber: eqNumberQuery, // Header info for all items
            equipmentName: eqNameQuery,     // Header info for all items
            
            productId: finalProductId,
            productName: item.productName,
            productSpec: item.productSpec,
            category: item.category,
            calibrationType: item.calibrationType,
            quantity: item.quantity,
            unitPrice: item.price,
            discountRate: discountRate,
            
            status: CalibrationStatus.PENDING,
            targetDate: new Date(targetDate).toISOString(),
            technicians: selectedTechnicians,
        });
      }

      await mockGasService.createOrders(orderPayloads, orderNumber);

      mockGasService.getInventory().then(setInventory);
      mockGasService.getCustomers().then(setCustomers);
      onOrderCreated();
    } catch (error) {
      console.error("Error creating orders", error);
      alert("建立訂單失敗");
    } finally {
      setLoading(false);
    }
  };

  const subTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const finalTotal = Math.round(subTotal * (discountRate / 100));

  // Helper for input styles based on validation
  const getInputClass = (value: string | number) => {
      const base = "w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-brand-500 outline-none transition-colors";
      if (hasAttemptedSubmit && !value) {
          return `${base} border-red-500 bg-red-50 ring-1 ring-red-500`;
      }
      return `${base} border-slate-300`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      
      {/* Header Info Card */}
      <div className="bg-white rounded-lg shadow-sm border-t-4 border-brand-600 border border-slate-200 p-6">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Archive className="text-brand-600" />
            {copyData ? '複製並建立新校正工單' : '建立校正工單'}
        </h2>
        
        {/* Row 1: Order Basics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
             <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <FileText size={14}/> 校正訂單編號 (Order ID) <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                value={orderNumber}
                onChange={e => setOrderNumber(e.target.value)}
                className={`${getInputClass(orderNumber)} bg-slate-50 font-mono text-brand-800 font-bold`}
                placeholder="例如: CAL-2024-001"
              />
            </div>
             <div className="relative" ref={customerWrapperRef}>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Building2 size={14}/> 客戶名稱 (Client) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                    type="text" 
                    value={customerQuery}
                    onChange={e => {
                        setCustomerQuery(e.target.value);
                        setShowCustomerSuggestions(true);
                    }}
                    onFocus={() => setShowCustomerSuggestions(true)}
                    className={`${getInputClass(customerQuery)} pl-9`}
                    placeholder="搜尋或輸入新客戶..."
                />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              </div>
              {showCustomerSuggestions && customerQuery && (
                <div className="absolute z-20 w-full bg-white mt-1 border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {filteredCustomers.map(c => (
                        <div key={c.id} onClick={() => handleCustomerSelect(c)} className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm">
                            {c.name}
                        </div>
                    ))}
                    {filteredCustomers.length === 0 && (
                         <div className="px-4 py-2 text-slate-400 text-sm italic">將新增 "{customerQuery}"</div>
                    )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">預計完成日 <span className="text-red-500">*</span></label>
              <input 
                type="date" 
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className={getInputClass(targetDate)}
              />
            </div>
        </div>

        <div className="border-t border-slate-100 my-4"></div>

        {/* Row 2: Equipment Info (The object being calibrated) */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-6 relative">
            <div className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-brand-600 border border-brand-100 rounded">
                被校正設備資訊 (Equipment Info)
            </div>
            
            <div ref={eqNumWrapperRef} className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                   <History size={14} className="text-slate-400"/> 設備案號 (Equipment No.) <span className="text-red-500">*</span>
                </label>
                <input 
                    type="text" 
                    value={eqNumberQuery}
                    onChange={e => {
                        setEqNumberQuery(e.target.value);
                        setShowEqNumSuggestions(true);
                    }}
                    onFocus={() => setShowEqNumSuggestions(true)}
                    className={`${getInputClass(eqNumberQuery)} font-mono`}
                    placeholder="輸入案號索引歷史資料..."
                />
                {showEqNumSuggestions && eqNumSuggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white mt-1 border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
                        <div className="px-3 py-1 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase sticky top-0 border-b">歷史案號索引</div>
                        {eqNumSuggestions.map((item: Order) => {
                            const itemCount = getJobItemCount(item);
                            return (
                                <div 
                                key={item.id} 
                                onClick={() => handleHistoricalSelect(item)}
                                className="px-4 py-3 hover:bg-brand-50 cursor-pointer border-b border-slate-50 last:border-none group"
                                >
                                    <div className="flex justify-between items-start">
                                        <span className="font-mono font-bold text-slate-700 text-sm">{item.equipmentNumber}</span>
                                        <span className="text-xs text-slate-400">{new Date(item.createDate).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-800 my-0.5">{item.equipmentName}</div>
                                    <div className="flex items-center gap-1 mt-1 bg-slate-100 p-1.5 rounded-md group-hover:bg-brand-100/50">
                                        <Package size={10} className="text-slate-500" />
                                        <span className="text-xs text-slate-600 font-medium">
                                            包含: {item.productName} 
                                            {itemCount > 1 ? <span className="text-brand-600 ml-1 font-bold">等 {itemCount} 項明細</span> : ` (${item.productSpec})`}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div ref={eqNameWrapperRef} className="relative">
                <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                   <Monitor size={14} className="text-slate-400"/> 設備名稱 (Equipment Name) <span className="text-red-500">*</span>
                </label>
                <input 
                    type="text" 
                    value={eqNameQuery}
                    onChange={e => {
                        setEqNameQuery(e.target.value);
                        setShowEqNameSuggestions(true);
                    }}
                    onFocus={() => setShowEqNameSuggestions(true)}
                    className={getInputClass(eqNameQuery)}
                    placeholder="例如: 品管室數位卡尺"
                />
                {showEqNameSuggestions && eqNameSuggestions.length > 0 && (
                     <div className="absolute z-20 w-full bg-white mt-1 border border-slate-200 rounded-md shadow-lg max-h-80 overflow-y-auto">
                        <div className="px-3 py-1 bg-slate-50 text-[10px] text-slate-400 font-bold uppercase sticky top-0 border-b">歷史名稱參考</div>
                         {eqNameSuggestions.map((item: Order) => {
                             const itemCount = getJobItemCount(item);
                             return (
                                <div 
                                    key={item.id} 
                                    onClick={() => handleHistoricalSelect(item)}
                                    className="px-4 py-3 hover:bg-brand-50 cursor-pointer border-b border-slate-50 last:border-none group"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-sm font-bold text-slate-800">{item.equipmentName}</span>
                                        <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-500">{item.equipmentNumber}</span>
                                    </div>
                                    <div className="text-xs text-slate-500">客戶: {item.customerName}</div>
                                    <div className="mt-1 text-xs text-slate-400 group-hover:text-brand-700 flex items-center gap-1">
                                        <ArrowDownCircle size={10} />
                                        帶入: {item.productName}
                                        {itemCount > 1 && <span className="font-bold ml-1">...等 {itemCount} 項</span>}
                                    </div>
                                </div>
                             );
                         })}
                     </div>
                )}
            </div>
        </div>

        <div className="mt-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-1">
            <User size={14}/> 負責校正人員 (可複選)
            </label>
            <div className="flex flex-wrap gap-2">
                {availableTechnicians.length === 0 ? (
                    <div className="text-sm text-slate-400 italic">無校正人員資料，請至「系統設定」新增。</div>
                ) : (
                    availableTechnicians.map(tech => (
                        <button
                        key={tech.id}
                        onClick={() => handleTechnicianToggle(tech.name)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            selectedTechnicians.includes(tech.name)
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                        }`}
                        >
                            {tech.name}
                        </button>
                    ))
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Item Input Area (Product/Service from Inventory) */}
        <div className="lg:col-span-1 space-y-6">
            <div className={`bg-white rounded-lg shadow-sm border border-slate-200 p-6 relative transition-all duration-300 ${prefillMessage ? 'ring-2 ring-amber-400' : ''}`}>
                
                {prefillMessage && (
                    <div className="absolute top-0 left-0 right-0 bg-amber-100 text-amber-800 text-xs px-4 py-1.5 font-bold flex items-center justify-center animate-pulse rounded-t-lg">
                        <History size={12} className="mr-1.5" />
                        {prefillMessage}
                    </div>
                )}

                <h3 className="text-md font-bold text-slate-700 mb-4 pb-2 border-b border-slate-100 flex items-center gap-2 mt-2">
                    <Plus size={18} className="text-brand-500"/>
                    新增校正明細 (Inventory)
                </h3>
                
                <div className="space-y-4">
                    {/* Product Name Search/Input */}
                    <div ref={productWrapperRef} className="relative">
                        <label className="block text-xs font-semibold text-slate-500 mb-1">校正品項名稱 (Service Item)</label>
                        <div className="relative">
                             <input 
                                type="text" 
                                value={productNameQuery}
                                onChange={e => {
                                    setProductNameQuery(e.target.value);
                                    setShowProductSuggestions(true);
                                }}
                                onFocus={() => setShowProductSuggestions(true)}
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none text-sm font-bold text-slate-700"
                                placeholder="搜尋庫存服務項目..."
                            />
                            <Package className="absolute left-3 top-2.5 text-slate-400" size={16} />
                        </div>
                        {showProductSuggestions && productSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full bg-white mt-1 border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                <div className="px-3 py-1 bg-emerald-50 text-[10px] text-emerald-600 font-bold uppercase">商品庫存</div>
                                {productSuggestions.map((item: Product) => (
                                    <div 
                                        key={item.id}
                                        onClick={() => handleProductSelect(item)}
                                        className="px-4 py-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-none group"
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="font-medium text-slate-800 text-sm group-hover:text-brand-700">{item.name}</span>
                                            <span className="text-[10px] text-slate-400">${item.standardPrice}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-0.5">{item.specification}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">規格 (Specification)</label>
                        <input 
                            type="text" 
                            value={currentItem.productSpec || ''}
                            onChange={e => setCurrentItem({...currentItem, productSpec: e.target.value})}
                            className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm"
                            placeholder="例如: 0-150mm"
                        />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">校正方式</label>
                            <select 
                                value={currentItem.calibrationType}
                                onChange={e => setCurrentItem({...currentItem, calibrationType: e.target.value as CalibrationType})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm bg-white"
                            >
                                <option value={CalibrationType.INTERNAL}>內校</option>
                                <option value={CalibrationType.EXTERNAL}>委外</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">分類</label>
                            <input 
                                type="text" 
                                value={currentItem.category || ''}
                                onChange={e => setCurrentItem({...currentItem, category: e.target.value})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">單價</label>
                            <input 
                                type="number" 
                                value={currentItem.price}
                                onChange={e => setCurrentItem({...currentItem, price: Number(e.target.value)})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">數量</label>
                            <input 
                                type="number" 
                                min="1"
                                value={currentItem.quantity}
                                onChange={e => setCurrentItem({...currentItem, quantity: Number(e.target.value)})}
                                className="w-full px-3 py-2 border border-slate-300 rounded-md outline-none text-sm"
                            />
                        </div>
                    </div>

                    {!currentItem.productId && productNameQuery && (
                        <div className="pt-2">
                             <button
                                type="button"
                                onClick={() => setCurrentItem({...currentItem, saveToInventory: !currentItem.saveToInventory})}
                                className={`w-full py-2 px-3 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
                                    currentItem.saveToInventory 
                                    ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-sm' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                                }`}
                             >
                                {currentItem.saveToInventory ? (
                                    <>
                                        <CheckSquare size={16} /> ✓ 已啟用：自動加入此品項至庫存
                                    </>
                                ) : (
                                    <>
                                        <Square size={16} /> 此品項不在庫存中？點此新增
                                    </>
                                )}
                             </button>
                        </div>
                    )}

                    <button 
                        onClick={addToCart}
                        className="w-full mt-4 py-2 bg-slate-800 text-white rounded-md hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                    >
                        <Plus size={16} /> 加入清單
                    </button>
                </div>
            </div>
        </div>

        {/* Cart List */}
        <div className="lg:col-span-2">
            <div className={`bg-white rounded-lg shadow-sm border border-slate-200 min-h-[400px] flex flex-col ${hasAttemptedSubmit && cart.length === 0 ? 'border-red-500 ring-2 ring-red-100' : ''}`}>
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                        <ShoppingCart size={18} /> 訂單明細 ({cart.length}) <span className="text-red-500">*</span>
                    </h3>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300">
                            <ShoppingCart size={48} className={`mb-2 ${hasAttemptedSubmit ? 'text-red-200' : ''}`} />
                            <p className={hasAttemptedSubmit ? 'text-red-500 font-bold' : ''}>
                                {hasAttemptedSubmit ? '請至少加入一項校正明細' : '尚未加入任何品項'}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map((item) => (
                                <div key={item.tempId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-800">{item.productName}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.calibrationType === CalibrationType.INTERNAL ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                {CalibrationTypeLabel[item.calibrationType]}
                                            </span>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1 flex gap-4">
                                            <span>{item.category}</span>
                                            <span className="text-slate-400">規格: {item.productSpec}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4 justify-end">
                                        <div className="text-right flex items-center gap-2">
                                            <div className="flex items-center bg-white border border-slate-200 rounded px-2 py-1">
                                                <span className="text-xs text-slate-400 mr-1">$</span>
                                                <input 
                                                    type="number" 
                                                    value={item.price}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        setCart(cart.map(i => i.tempId === item.tempId ? {...i, price: isNaN(val) ? 0 : val} : i));
                                                    }}
                                                    className="w-16 text-right text-sm font-medium outline-none"
                                                />
                                            </div>
                                            <span className="text-slate-400 text-xs">x {item.quantity}</span>
                                        </div>
                                        <div className="text-sm font-bold text-slate-700 w-20 text-right">
                                            ${(item.price * item.quantity).toLocaleString()}
                                        </div>
                                        <button 
                                            onClick={() => removeFromCart(item.tempId)}
                                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-100 bg-slate-50 space-y-3">
                    <div className="flex justify-end items-center gap-3">
                         <div className="flex items-center gap-2 text-sm text-slate-600">
                             <Percent size={16} />
                             折數 (%):
                         </div>
                         <input 
                            type="number" 
                            min="0" max="100"
                            value={discountRate}
                            onChange={e => setDiscountRate(Math.min(100, Math.max(0, Number(e.target.value))))}
                            className="w-20 px-2 py-1 border border-slate-300 rounded text-right font-medium"
                            placeholder="100"
                         />
                         <span className="text-xs text-slate-400">(80 = 8折)</span>
                    </div>
                    
                    <div className="flex justify-end items-end flex-col">
                        <div className="text-sm text-slate-500">小計: ${subTotal.toLocaleString()}</div>
                        <div className="text-2xl font-bold text-slate-800">
                            總計: ${finalTotal.toLocaleString()}
                        </div>
                    </div>

                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className={`w-full py-3 rounded-lg text-white font-semibold flex justify-center items-center gap-2 transition-all ${
                            loading 
                            ? 'bg-slate-300 cursor-not-allowed' 
                            : 'bg-brand-600 hover:bg-brand-700 shadow-lg shadow-brand-200'
                        }`}
                    >
                        {loading ? '處理中...' : (
                            <>
                                <Save size={18} /> {copyData ? '確認並建立新訂單' : '確認建立校正工單'}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
