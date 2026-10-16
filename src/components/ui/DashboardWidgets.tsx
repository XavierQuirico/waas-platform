"use client";

import * as React from "react";
import { DashboardCard, DashboardCardContent, DashboardCardHeader, DashboardCardTitle } from "@/components/ui/DashboardCard";

const data = [
  { name: 'Lun', value: 400 },
  { name: 'Mar', value: 300 },
  { name: 'Mie', value: 550 },
  { name: 'Jue', value: 480 },
  { name: 'Vie', value: 700 },
  { name: 'Sab', value: 650 },
  { name: 'Dom', value: 900 },
];

export function RevenueChartWidget() {
  const max = Math.max(...data.map((point) => point.value), 1);
  const points = data.map((point, index) => {
    const x = data.length === 1 ? 0 : (index / (data.length - 1)) * 100;
    const y = 92 - (point.value / max) * 76;
    return { ...point, x, y };
  });
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `0,100 ${line} 100,100`;

  return (
    <DashboardCard className="col-span-1 lg:col-span-2 h-[400px]" meshBg>
      <DashboardCardHeader>
        <DashboardCardTitle>Ingresos Generados</DashboardCardTitle>
        <span className="text-2xl font-headline font-semibold text-brand-primary">+$8,450.00</span>
      </DashboardCardHeader>
      <DashboardCardContent className="h-[300px] w-full mt-4">
        <div className="flex h-full flex-col">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="min-h-0 flex-1 overflow-visible">
            <defs>
              <linearGradient id="dashboardRevenueArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FF8C00" stopOpacity="0.48" />
                <stop offset="95%" stopColor="#FF8C00" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[20, 48, 76].map((y) => (
              <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.6" />
            ))}
            <polygon points={area} fill="url(#dashboardRevenueArea)" />
            <polyline points={line} fill="none" stroke="#FF8C00" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((point) => (
              <circle key={point.name} cx={point.x} cy={point.y} r="2" fill="#FF8C00" />
            ))}
          </svg>
          <div className="mt-4 grid grid-cols-7 gap-2 text-center text-xs text-brand-muted">
            {points.map((point) => (
              <span key={point.name}>{point.name}</span>
            ))}
          </div>
        </div>
      </DashboardCardContent>
    </DashboardCard>
  );
}

export function StatWidget({ title, value, trend, isPositive }: { title: string, value: string, trend: string, isPositive: boolean }) {
  return (
    <DashboardCard>
      <DashboardCardHeader>
        <DashboardCardTitle>{title}</DashboardCardTitle>
        <div className={`px-2 py-1 rounded-md text-xs font-medium ${isPositive ? 'bg-success-600/20 text-success-500' : 'bg-error-600/20 text-error-500'}`}>
          {trend}
        </div>
      </DashboardCardHeader>
      <DashboardCardContent className="mt-2">
        <div className="text-4xl font-headline font-bold text-brand-primary">{value}</div>
        <div className="mt-4 flex items-center">
          <div className="h-1.5 w-full bg-brand-surface-2 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-1000 ${isPositive ? 'bg-brand-amber' : 'bg-brand-deepViolet'}`} 
              style={{ width: '75%' }} 
            />
          </div>
        </div>
      </DashboardCardContent>
    </DashboardCard>
  );
}

const transactions = [
  { id: 1, name: 'Suscripción Anual', date: '14 Abr 2026', amount: '+$1,500.00', status: 'Completado' },
  { id: 2, name: 'Mantenimiento Mensual', date: '11 Abr 2026', amount: '+$150.00', status: 'Completado' },
  { id: 3, name: 'Dominio y Hosting', date: '05 Abr 2026', amount: '+$50.00', status: 'Pendiente' },
]

export function TransactionsWidget() {
  return (
    <DashboardCard className="col-span-1">
      <DashboardCardHeader>
        <DashboardCardTitle>Transacciones Recientes</DashboardCardTitle>
      </DashboardCardHeader>
      <DashboardCardContent className="mt-4">
        <div className="space-y-4">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-brand-surface-2 transition-colors duration-300">
              <div>
                <p className="font-semibold text-sm text-brand-primary">{tx.name}</p>
                <p className="text-xs text-brand-muted">{tx.date}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-sm font-headline text-brand-amber">{tx.amount}</p>
                <p className="text-xs text-brand-muted">{tx.status}</p>
              </div>
            </div>
          ))}
        </div>
      </DashboardCardContent>
    </DashboardCard>
  );
}
