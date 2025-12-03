import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({ title, value, icon, trend, trendUp }) => {
  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border-l-4 border-brand-600 border-t border-r border-b border-slate-100 flex flex-col justify-between transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-slate-800 tracking-tight">{value}</h3>
        </div>
        <div className="p-3 bg-brand-50 rounded-lg text-brand-700">
          {icon}
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs font-medium">
          <span className={`flex items-center ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
            {trendUp ? '▲' : '▼'} {trend}
          </span>
          <span className="text-slate-400 ml-2">與上月相比</span>
        </div>
      )}
    </div>
  );
};