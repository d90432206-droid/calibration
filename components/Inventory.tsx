
import React, { useEffect, useState } from 'react';
import { Product } from '../types';
import { mockGasService } from '../services/mockGasService';

export const Inventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);

    useEffect(() => {
        mockGasService.getInventory().then(setProducts);
    }, []);

    return (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">商品庫存資料庫 (CSV)</h2>
                <p className="text-slate-500 text-sm mt-1">管理校正標準品項、規格與基本定價</p>
            </div>
            <table className="w-full text-left">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="p-4 text-sm font-bold text-slate-500">商品名稱</th>
                        <th className="p-4 text-sm font-bold text-slate-500">規格 (Spec)</th>
                        <th className="p-4 text-sm font-bold text-slate-500">分類</th>
                        <th className="p-4 text-sm font-bold text-slate-500">標準價格</th>
                        <th className="p-4 text-sm font-bold text-slate-500">最後更新</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {products.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-medium text-slate-800">{p.name}</td>
                            <td className="p-4 text-slate-600 text-sm">{p.specification}</td>
                            <td className="p-4 text-slate-600">
                                <span className="px-2 py-1 bg-slate-100 rounded text-xs">{p.category}</span>
                            </td>
                            <td className="p-4 text-slate-600 font-mono">${p.standardPrice.toLocaleString()}</td>
                            <td className="p-4 text-slate-400 text-sm font-mono">{new Date(p.lastUpdated).toLocaleDateString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
