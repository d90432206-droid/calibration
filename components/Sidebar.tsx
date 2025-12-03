
import React, { useEffect, useState } from 'react';
import { ViewState } from '../types';
import { LayoutDashboard, PlusCircle, List, Settings, Database, LogOut, Wifi, WifiOff, CloudLightning } from 'lucide-react';
import { mockGasService, EnvType } from '../services/mockGasService';

interface SidebarProps {
  currentView: ViewState;
  setView: (view: ViewState) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setView }) => {
  const [envType, setEnvType] = useState<EnvType>('mock');

  useEffect(() => {
    // Check connection environment on mount
    setEnvType(mockGasService.getEnvironmentType());
  }, []);
  
  const NavItem = ({ view, icon, label }: { view: ViewState; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setView(view)}
      className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all mb-1 ${
        currentView === view 
          ? 'bg-brand-700 text-white shadow-md' 
          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  );

  const getStatusDisplay = () => {
      switch (envType) {
          case 'gas':
              return {
                  bg: 'bg-emerald-900/30',
                  border: 'border-emerald-800',
                  text: 'text-emerald-400',
                  icon: <Wifi size={14} />,
                  label: '已連線 (GAS Embedded)'
              };
          case 'api':
              return {
                  bg: 'bg-blue-900/30',
                  border: 'border-blue-800',
                  text: 'text-blue-400',
                  icon: <CloudLightning size={14} />,
                  label: 'API 連線 (Vercel)'
              };
          default:
              return {
                  bg: 'bg-amber-900/30',
                  border: 'border-amber-800',
                  text: 'text-amber-500',
                  icon: <WifiOff size={14} />,
                  label: '模擬模式 (Local)'
              };
      }
  };

  const statusStyle = getStatusDisplay();

  return (
    <div className="w-64 bg-slate-900 h-screen flex flex-col p-4 fixed left-0 top-0 hidden md:flex text-slate-100">
      <div className="flex items-center gap-3 px-2 mb-10 mt-4">
        {/* Logo Image Replacement */}
        <div className="flex-shrink-0">
            <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-10 w-auto object-contain"
                onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.parentElement!.innerHTML = '<div class="bg-brand-500 w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white">CC</div>';
                }}
            />
        </div>
        <div>
          <h1 className="font-bold text-white text-sm leading-tight tracking-tight">制宜電測校正管理系統</h1>
          <p className="text-[10px] text-brand-400 font-bold tracking-widest uppercase mt-0.5">Chuyi Calibration System</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">主要功能</p>
        <NavItem view="dashboard" icon={<LayoutDashboard size={18} />} label="營運儀表板" />
        <NavItem view="create-order" icon={<PlusCircle size={18} />} label="建立校正訂單" />
        <NavItem view="order-list" icon={<List size={18} />} label="訂單追蹤" />
        
        <div className="my-6 border-t border-slate-800"></div>
        
        <p className="px-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">資料庫管理</p>
        <NavItem view="inventory" icon={<Database size={18} />} label="商品庫存 (CSV)" />
      </nav>

      <div className="mt-auto space-y-4">
         {/* Connection Status Indicator */}
         <div className={`mx-2 px-3 py-2 rounded-md border text-xs font-bold flex items-center gap-2 ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}>
            {statusStyle.icon}
            <span>{statusStyle.label}</span>
         </div>

         <div className="pt-2 border-t border-slate-800">
            <button 
                onClick={() => setView('settings')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors hover:bg-slate-800 ${currentView === 'settings' ? 'bg-brand-700 text-white shadow-md' : 'text-slate-400'}`}
            >
                <Settings size={18} />
                <span className="font-medium">系統設定</span>
            </button>
            <button className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-slate-400 hover:text-red-400 transition-colors mt-1">
                <LogOut size={18} />
                <span className="font-medium">登出系統</span>
            </button>
         </div>
      </div>
    </div>
  );
};
