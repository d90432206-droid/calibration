
import React, { useState, useMemo } from 'react';
import { Order, CalibrationStatus, StatusLabel, CalibrationTypeLabel, OrderTemplate } from '../types';
import { mockGasService } from '../services/mockGasService';
import { Calendar, User, Check, Archive, RefreshCcw, Copy, MessageSquare, Building2, Monitor, Package, ChevronDown, ChevronRight, ChevronUp, Trash2, AlertTriangle, X } from 'lucide-react';

interface OrderListProps {
  orders: Order[];
  refreshData: () => void;
  onCopyOrder: (template: OrderTemplate) => void;
}

const statusColorMap: Record<string, string> = {
  [CalibrationStatus.PENDING]: 'bg-amber-50 text-amber-700 border-amber-200',
  [CalibrationStatus.CALIBRATING]: 'bg-blue-50 text-blue-700 border-blue-200',
  [CalibrationStatus.COMPLETED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

// Helper interface for grouped orders
interface OrderGroup {
    orderNumber: string;
    customerName: string;
    equipmentNumber: string;
    equipmentName: string;
    targetDate: string;
    status: CalibrationStatus;
    technicians: string[];
    notes: string;
    isArchived: boolean;
    resurrectReason?: string;
    totalAmount: number;
    items: Order[];
}

export const OrderList: React.FC<OrderListProps> = ({ orders, refreshData, onCopyOrder }) => {
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [editingNotesNo, setEditingNotesNo] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [expandedOrderNos, setExpandedOrderNos] = useState<Set<string>>(new Set());
  
  // Local state for status changes before confirmation
  const [statusDrafts, setStatusDrafts] = useState<Record<string, CalibrationStatus>>({});

  // Delete / Password Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [deleteError, setDeleteError] = useState('');

  // 1. Filter Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => viewMode === 'archived' ? o.isArchived : !o.isArchived);
  }, [orders, viewMode]);

  // 2. Group Orders by Order Number
  const groupedOrders = useMemo(() => {
      const groups = new Map<string, OrderGroup>();

      filteredOrders.forEach(order => {
          if (!groups.has(order.orderNumber)) {
              groups.set(order.orderNumber, {
                  orderNumber: order.orderNumber,
                  customerName: order.customerName,
                  equipmentNumber: order.equipmentNumber,
                  equipmentName: order.equipmentName,
                  targetDate: order.targetDate,
                  status: order.status,
                  technicians: order.technicians || [],
                  notes: order.notes || '',
                  isArchived: order.isArchived,
                  resurrectReason: order.resurrectReason,
                  totalAmount: 0,
                  items: []
              });
          }
          const group = groups.get(order.orderNumber)!;
          group.items.push(order);
          group.totalAmount += order.totalAmount;
      });

      return Array.from(groups.values()).sort((a, b) => {
          return new Date(b.targetDate).getTime() - new Date(a.targetDate).getTime();
      });
  }, [filteredOrders]);

  const toggleExpand = (orderNo: string) => {
      const newSet = new Set(expandedOrderNos);
      if (newSet.has(orderNo)) {
          newSet.delete(orderNo);
      } else {
          newSet.add(orderNo);
      }
      setExpandedOrderNos(newSet);
  };

  const handleStatusChange = (orderNo: string, newStatus: string) => {
    setStatusDrafts(prev => ({ ...prev, [orderNo]: newStatus as CalibrationStatus }));
  };

  const confirmStatusChange = async (group: OrderGroup) => {
    const newStatus = statusDrafts[group.orderNumber];
    if (!newStatus || newStatus === group.status) return;

    // Use Batch Update Service
    await mockGasService.updateOrderStatusByNo(group.orderNumber, newStatus);
    
    // Clear draft
    const newDrafts = { ...statusDrafts };
    delete newDrafts[group.orderNumber];
    setStatusDrafts(newDrafts);
    
    refreshData();
  };

  const handleDateChange = async (orderNo: string, newDate: string) => {
    await mockGasService.updateOrderTargetDateByNo(orderNo, newDate);
    refreshData();
  };

  const handleRestore = async (orderNo: string) => {
      const reason = prompt("請輸入復活訂單的原因：");
      if (reason) {
          // Use Batch Restore Service
          await mockGasService.restoreOrderByNo(orderNo, reason);
          refreshData();
      }
  };

  const saveNotes = async (orderNo: string) => {
      await mockGasService.updateOrderNotesByNo(orderNo, tempNotes);
      setEditingNotesNo(null);
      refreshData();
  };

  const startEditingNotes = (group: OrderGroup) => {
      setTempNotes(group.notes || '');
      setEditingNotesNo(group.orderNumber);
  }

  // --- DELETE LOGIC ---
  const handleDeleteClick = (orderNo: string) => {
      setOrderToDelete(orderNo);
      setPasswordInput('');
      setDeleteError('');
      setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
      if (!orderToDelete) return;

      const isValid = await mockGasService.checkAdminPassword(passwordInput);
      if (isValid) {
          await mockGasService.deleteOrderByNo(orderToDelete);
          setDeleteModalOpen(false);
          setOrderToDelete(null);
          refreshData();
      } else {
          setDeleteError('密碼錯誤，無法刪除');
      }
  };

  const formatDateForInput = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toISOString().split('T')[0];
  };

  // Status Select Component
  const StatusControl = ({ group }: { group: OrderGroup }) => {
    const currentStatus = statusDrafts[group.orderNumber] || group.status;
    const isChanged = statusDrafts[group.orderNumber] && statusDrafts[group.orderNumber] !== group.status;

    return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <select 
                value={currentStatus}
                onChange={(e) => handleStatusChange(group.orderNumber, e.target.value)}
                disabled={viewMode === 'archived'}
                className={`w-full max-w-[140px] px-2 py-1 rounded-md text-xs font-bold border outline-none cursor-pointer appearance-none transition-shadow focus:ring-2 focus:ring-brand-200 ${statusColorMap[currentStatus] || 'bg-gray-100'}`}
            >
                {Object.values(CalibrationStatus).map(s => (
                    <option key={s} value={s}>{StatusLabel[s] || s}</option>
                ))}
            </select>
            {isChanged && (
                <button 
                    onClick={() => confirmStatusChange(group)}
                    className="p-1 bg-brand-600 text-white rounded hover:bg-brand-700 shadow-sm"
                    title="確認修改"
                >
                    <Check size={14} />
                </button>
            )}
        </div>
    );
  };

  return (
    <div className="space-y-4 relative">
      
      {/* Password Modal */}
      {deleteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden animate-fade-in">
                  <div className="bg-red-50 p-4 border-b border-red-100 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-red-700 font-bold">
                          <AlertTriangle size={20} />
                          確認刪除
                      </div>
                      <button onClick={() => setDeleteModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                          <X size={20} />
                      </button>
                  </div>
                  <div className="p-6">
                      <p className="text-slate-600 mb-4 text-sm">
                          您確定要永久刪除訂單 <span className="font-mono font-bold text-slate-800">{orderToDelete}</span> 嗎？此動作無法復原。
                      </p>
                      <label className="block text-xs font-bold text-slate-500 mb-1">請輸入管理員密碼</label>
                      <input 
                          type="password" 
                          value={passwordInput}
                          onChange={e => setPasswordInput(e.target.value)}
                          className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-red-200"
                          placeholder="密碼..."
                          autoFocus
                          onKeyDown={e => e.key === 'Enter' && confirmDelete()}
                      />
                      {deleteError && <p className="text-red-600 text-xs font-bold mt-2">{deleteError}</p>}
                      <div className="mt-6 flex gap-2">
                          <button 
                            onClick={() => setDeleteModalOpen(false)}
                            className="flex-1 py-2 bg-slate-100 text-slate-600 rounded hover:bg-slate-200 font-medium text-sm"
                          >
                              取消
                          </button>
                          <button 
                            onClick={confirmDelete}
                            className="flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium text-sm shadow-md shadow-red-200"
                          >
                              確認刪除
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                {viewMode === 'active' ? '訂單追蹤' : '封存歷史區'}
                {viewMode === 'archived' && <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">Read Only</span>}
            </h2>
            <p className="text-sm text-slate-500">
                {viewMode === 'active' ? '管理進行中的校正案件進度' : '查詢已完成與封存的歷史訂單'}
            </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-lg">
            <button 
                onClick={() => setViewMode('active')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'active' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                進行中
            </button>
            <button 
                onClick={() => setViewMode('archived')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'archived' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <div className="flex items-center gap-1">
                    <Archive size={14} /> 封存區
                </div>
            </button>
        </div>
      </div>

      {/* Desktop View (Table Layout) */}
      <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider">
                    <th className="p-4 font-bold text-slate-500 w-48">訂單追蹤</th>
                    <th className="p-4 font-bold text-slate-500 w-64">案號 / 設備 / 客戶</th>
                    <th className="p-4 font-bold text-slate-500">負責人員</th>
                    <th className="p-4 font-bold text-slate-500 w-32">預計完成日</th>
                    <th className="p-4 font-bold text-slate-500">備註</th>
                    <th className="p-4 font-bold text-slate-500 w-32">狀態</th>
                    <th className="p-4 font-bold text-slate-500 text-right">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
                {groupedOrders.map((group) => {
                    const isExpanded = expandedOrderNos.has(group.orderNumber);
                    return (
                    <React.Fragment key={group.orderNumber}>
                        {/* Main Group Row */}
                        <tr className={`transition-colors group hover:bg-slate-50/80 ${group.resurrectReason ? 'bg-amber-50/30' : ''}`}>
                            <td className="p-4 align-top cursor-pointer" onClick={() => toggleExpand(group.orderNumber)}>
                                <div className="flex items-center gap-2 text-brand-700 font-bold hover:underline">
                                    {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                                    <span className="font-mono">{group.orderNumber}</span>
                                </div>
                                {group.resurrectReason && (
                                    <div className="mt-1 ml-6 text-[10px] text-amber-600 font-bold flex items-center gap-0.5">
                                        <RefreshCcw size={10} /> 復活
                                    </div>
                                )}
                                <div className="ml-6 mt-1 text-xs text-slate-400">共 {group.items.length} 項明細</div>
                            </td>
                            
                            <td className="p-4 align-top">
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[10px] bg-slate-200 px-1.5 rounded text-slate-700 font-bold">
                                            {group.equipmentNumber || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="font-bold text-slate-800 text-sm flex items-center gap-1">
                                        <Monitor size={14} className="text-slate-400"/> {group.equipmentName}
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Building2 size={12}/> {group.customerName}
                                    </div>
                                </div>
                            </td>

                            <td className="p-4 align-top">
                                <div className="flex flex-wrap gap-1">
                                    {group.technicians && group.technicians.length > 0 ? (
                                        group.technicians.map(t => (
                                            <span key={t} className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <User size={10} /> {t}
                                            </span>
                                        ))
                                    ) : <span className="text-xs text-slate-400">未指派</span>}
                                </div>
                            </td>

                            <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}>
                                {viewMode === 'active' ? (
                                    <input 
                                        type="date"
                                        value={formatDateForInput(group.targetDate)}
                                        onChange={(e) => handleDateChange(group.orderNumber, e.target.value)}
                                        className="bg-transparent hover:bg-white border border-transparent hover:border-slate-300 rounded px-2 py-1 cursor-pointer focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-200 outline-none transition-all w-full text-xs"
                                    />
                                ) : (
                                    <span className="text-xs text-slate-500">{new Date(group.targetDate).toLocaleDateString()}</span>
                                )}
                            </td>

                            <td className="p-4 align-top" onClick={(e) => e.stopPropagation()}>
                                {editingNotesNo === group.orderNumber ? (
                                    <div className="flex gap-1">
                                        <input 
                                            type="text" 
                                            value={tempNotes}
                                            onChange={e => setTempNotes(e.target.value)}
                                            className="w-full text-xs border border-brand-300 rounded px-1 py-0.5 focus:ring-1 focus:ring-brand-500 outline-none"
                                            autoFocus
                                            onKeyDown={e => e.key === 'Enter' && saveNotes(group.orderNumber)}
                                        />
                                        <button onClick={() => saveNotes(group.orderNumber)} className="text-green-600"><Check size={14}/></button>
                                    </div>
                                ) : (
                                    <div 
                                        className="text-xs text-slate-500 cursor-pointer hover:text-brand-600 flex items-center gap-1 min-h-[20px]"
                                        onClick={() => viewMode === 'active' && startEditingNotes(group)}
                                        title="點擊編輯備註"
                                    >
                                        {group.notes ? group.notes : (viewMode === 'active' ? <span className="text-slate-300 italic flex items-center"><MessageSquare size={10} className="mr-1"/> +備註</span> : '-')}
                                    </div>
                                )}
                            </td>

                            <td className="p-4 align-top">
                                <StatusControl group={group} />
                            </td>

                            <td className="p-4 text-right align-top" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-2">
                                    {viewMode === 'active' && (
                                        <button 
                                            onClick={() => handleDeleteClick(group.orderNumber)}
                                            title="刪除訂單 (需密碼)"
                                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                    {viewMode === 'archived' && (
                                        <>
                                            <button 
                                                onClick={() => handleRestore(group.orderNumber)}
                                                title="復活整張訂單"
                                                className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded flex items-center gap-1 hover:bg-amber-200 transition-colors shadow-sm"
                                            >
                                                <RefreshCcw size={14} /> 復活
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteClick(group.orderNumber)}
                                                title="永久刪除"
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>

                        {/* Expanded Detail Row */}
                        {isExpanded && (
                            <tr className="bg-slate-50/50 shadow-inner">
                                <td colSpan={7} className="p-4 pl-12">
                                    <div className="bg-white rounded border border-slate-200 overflow-hidden">
                                        <div className="bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500 uppercase">校正項目明細</div>
                                        <table className="w-full text-left text-xs">
                                            <thead>
                                                <tr className="border-b border-slate-100 text-slate-400">
                                                    <th className="px-3 py-2 font-medium">品項名稱</th>
                                                    <th className="px-3 py-2 font-medium">規格</th>
                                                    <th className="px-3 py-2 font-medium">分類</th>
                                                    <th className="px-3 py-2 font-medium">校正方式</th>
                                                    <th className="px-3 py-2 font-medium text-right">單價</th>
                                                    <th className="px-3 py-2 font-medium text-right">數量</th>
                                                    <th className="px-3 py-2 font-medium text-right">小計</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50">
                                                {group.items.map(item => (
                                                    <tr key={item.id} className="hover:bg-slate-50">
                                                        <td className="px-3 py-2 font-bold text-slate-700">{item.productName}</td>
                                                        <td className="px-3 py-2 text-slate-500">{item.productSpec}</td>
                                                        <td className="px-3 py-2 text-slate-500">{item.category}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${item.calibrationType === 'Internal' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-orange-600 border-orange-200 bg-orange-50'}`}>
                                                                {CalibrationTypeLabel[item.calibrationType]}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-mono text-slate-500">${item.unitPrice.toLocaleString()}</td>
                                                        <td className="px-3 py-2 text-right text-slate-500">{item.quantity}</td>
                                                        <td className="px-3 py-2 text-right font-bold text-slate-700">${(item.unitPrice * item.quantity).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-slate-50 border-t border-slate-200">
                                                    <td colSpan={6} className="px-3 py-2 text-right font-bold text-slate-600">折扣後總計:</td>
                                                    <td className="px-3 py-2 text-right font-bold text-brand-700 text-sm">${group.totalAmount.toLocaleString()}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </React.Fragment>
                    );
                })}
                {groupedOrders.length === 0 && (
                    <tr>
                        <td colSpan={7} className="p-12 text-center text-slate-400 flex flex-col items-center">
                            <div className="mb-2 text-slate-300">
                                {viewMode === 'active' ? <Check size={48} /> : <Archive size={48} />}
                            </div>
                            {viewMode === 'active' ? '目前沒有進行中的訂單' : '封存區是空的'}
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        </div>
      </div>

       {/* Mobile View (Card Layout) - Adapted for Groups */}
       <div className="md:hidden space-y-4">
        {groupedOrders.map((group) => {
            const isExpanded = expandedOrderNos.has(group.orderNumber);
            return (
            <div key={group.orderNumber} className={`bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3 ${group.isArchived ? 'opacity-80' : ''}`}>
                <div className="flex justify-between items-start border-b border-slate-50 pb-2">
                     <div className="flex gap-2 mb-1" onClick={() => toggleExpand(group.orderNumber)}>
                        <span className="font-mono text-xs font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer">
                            {group.orderNumber} {isExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                        </span>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-bold text-slate-700">${group.totalAmount.toLocaleString()}</span>
                    </div>
                </div>

                <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">設備資訊</div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs bg-slate-100 px-1 rounded text-slate-600">{group.equipmentNumber}</span>
                        <span className="font-bold text-slate-800 text-sm">{group.equipmentName}</span>
                    </div>
                    <div className="text-xs text-slate-500">{group.customerName}</div>
                </div>

                {/* Mobile Expandable Details */}
                {isExpanded && (
                    <div className="bg-slate-50 p-2 rounded border border-slate-100 space-y-2">
                        {group.items.map((item, idx) => (
                            <div key={idx} className="border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                <div className="font-medium text-sm text-brand-900">{item.productName}</div>
                                <div className="flex justify-between items-end mt-1">
                                    <div className="text-xs text-slate-500">{item.productSpec}</div>
                                    <div className="text-xs font-bold text-slate-600">${item.unitPrice} x {item.quantity}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                <div className="border-t border-slate-50 pt-2 text-sm space-y-2">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">負責人</span>
                        <div className="flex gap-1">
                             {group.technicians?.map(t => <span key={t} className="text-xs bg-slate-50 px-1 rounded">{t}</span>)}
                        </div>
                    </div>
                     <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-400">預計完成</span>
                        {viewMode === 'active' ? (
                             <input 
                                type="date"
                                value={formatDateForInput(group.targetDate)}
                                onChange={(e) => handleDateChange(group.orderNumber, e.target.value)}
                                className="text-xs bg-slate-50 border border-slate-200 rounded px-1 py-0.5 text-slate-700 w-32 text-right"
                             />
                        ) : (
                            <span className="text-xs">{new Date(group.targetDate).toLocaleDateString()}</span>
                        )}
                    </div>
                </div>

                <div className="pt-2 flex justify-between items-center border-t border-slate-50 mt-2">
                    <StatusControl group={group} />
                    
                    <div className="flex gap-2">
                         {viewMode === 'active' && (
                             <button 
                                onClick={() => handleDeleteClick(group.orderNumber)}
                                className="text-slate-400 hover:text-red-600"
                             >
                                 <Trash2 size={18}/>
                             </button>
                         )}
                         {viewMode === 'archived' && (
                             <>
                                <button 
                                    onClick={() => handleRestore(group.orderNumber)} 
                                    className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-md flex items-center gap-1"
                                >
                                    <RefreshCcw size={14}/> 復活
                                </button>
                                <button 
                                    onClick={() => handleDeleteClick(group.orderNumber)}
                                    className="text-slate-300 hover:text-red-500"
                                >
                                    <Trash2 size={18}/>
                                </button>
                             </>
                         )}
                    </div>
                </div>
            </div>
        )})}
      </div>
    </div>
  );
};
