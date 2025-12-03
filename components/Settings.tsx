
import React, { useState, useEffect } from 'react';
import { Technician } from '../types';
import { mockGasService } from '../services/mockGasService';
import { User, Trash2, Plus, Users, ShieldCheck, Lock, Save, AlertCircle } from 'lucide-react';

export const Settings: React.FC = () => {
    const [technicians, setTechnicians] = useState<Technician[]>([]);
    const [newTechName, setNewTechName] = useState('');
    const [loading, setLoading] = useState(false);

    // Password States
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pwdMessage, setPwdMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await mockGasService.getTechnicians();
        setTechnicians(data);
    };

    const handleAddTechnician = async () => {
        if (!newTechName.trim()) return;
        setLoading(true);
        try {
            await mockGasService.addTechnician(newTechName);
            setNewTechName('');
            loadData();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveTechnician = async (id: string) => {
        if (confirm('確定要刪除這位校正人員嗎？')) {
            await mockGasService.removeTechnician(id);
            loadData();
        }
    };

    const handleUpdatePassword = async () => {
        if (!currentPassword.trim() || !newPassword.trim()) {
            setPwdMessage({ type: 'error', text: '請輸入原密碼與新密碼' });
            return;
        }

        const success = await mockGasService.changeAdminPassword(currentPassword.trim(), newPassword.trim());
        
        if (success) {
            setNewPassword('');
            setCurrentPassword('');
            setPwdMessage({ type: 'success', text: '密碼更新成功！' });
        } else {
            setPwdMessage({ type: 'error', text: '原密碼錯誤，無法修改。' });
        }

        setTimeout(() => setPwdMessage({ type: '', text: '' }), 3000);
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Technician Management */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-brand-50 rounded-lg text-brand-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">校正人員管理</h2>
                        <p className="text-sm text-slate-500">設定系統中的校正工程師名單，用於工單指派。</p>
                    </div>
                </div>

                <div className="flex gap-4 mb-8">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">新增人員姓名</label>
                        <div className="flex gap-2">
                            <input 
                                type="text"
                                value={newTechName}
                                onChange={(e) => setNewTechName(e.target.value)}
                                placeholder="輸入姓名..."
                                className="flex-1 px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddTechnician()}
                            />
                            <button 
                                onClick={handleAddTechnician}
                                disabled={loading || !newTechName.trim()}
                                className="bg-brand-600 text-white px-6 py-2 rounded-md hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                            >
                                <Plus size={18} /> 新增
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase flex justify-between">
                        <span>人員列表</span>
                        <span>共 {technicians.length} 位</span>
                    </div>
                    <div className="divide-y divide-slate-200">
                        {technicians.length === 0 ? (
                            <div className="p-8 text-center text-slate-400">
                                尚未建立任何校正人員資料
                            </div>
                        ) : (
                            technicians.map((tech) => (
                                <div key={tech.id} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                            <User size={16} />
                                        </div>
                                        <span className="font-medium text-slate-700">{tech.name}</span>
                                    </div>
                                    <button 
                                        onClick={() => handleRemoveTechnician(tech.id)}
                                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                        title="刪除"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Admin Password Settings */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-red-50 rounded-lg text-red-600">
                        <ShieldCheck size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-800">管理員權限設定</h2>
                        <p className="text-sm text-slate-500">設定執行敏感操作（如刪除訂單）時所需的管理員密碼。</p>
                    </div>
                </div>
                
                <div className="max-w-md space-y-4">
                     <div>
                         <label className="block text-sm font-semibold text-slate-700 mb-1">原密碼 <span className="text-red-500">*</span></label>
                         <div className="relative">
                            <input 
                                 type="password"
                                 value={currentPassword}
                                 onChange={(e) => setCurrentPassword(e.target.value)}
                                 placeholder="輸入目前密碼..."
                                 className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none"
                             />
                             <Lock size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                         </div>
                     </div>
                     
                     <div>
                         <label className="block text-sm font-semibold text-slate-700 mb-1">新密碼 <span className="text-red-500">*</span></label>
                         <div className="relative">
                            <input 
                                 type="text"
                                 value={newPassword}
                                 onChange={(e) => setNewPassword(e.target.value)}
                                 placeholder="輸入新密碼..."
                                 className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-brand-500 outline-none"
                             />
                             <Lock size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                         </div>
                     </div>

                     <div className="pt-2">
                         <button 
                            onClick={handleUpdatePassword}
                            className="w-full bg-slate-800 text-white px-4 py-2 rounded-md hover:bg-slate-900 flex items-center justify-center gap-2 text-sm font-medium"
                         >
                             <Save size={16} /> 儲存設定
                         </button>
                     </div>
                     
                     {pwdMessage.text && (
                        <div className={`mt-2 text-sm font-bold flex items-center gap-2 ${pwdMessage.type === 'error' ? 'text-red-600' : 'text-emerald-600'}`}>
                             {pwdMessage.type === 'error' && <AlertCircle size={16} />}
                             {pwdMessage.text}
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};
