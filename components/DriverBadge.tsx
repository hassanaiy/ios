import React from 'react';
import { DriverLevel } from '../types';

export const DriverBadge: React.FC<{ level?: DriverLevel }> = ({ level }) => {
  if (!level || level === DriverLevel.BRONZE) return null;

  let bgClass = '';
  let textClass = '';
  let icon = '';
  let label = '';
  let glowClass = '';

  switch (level) {
    case DriverLevel.SILVER:
      bgClass = 'bg-gray-200';
      textClass = 'text-gray-700';
      icon = 'fa-medal';
      label = 'Silver';
      break;
    case DriverLevel.GOLD:
      bgClass = 'bg-yellow-100';
      textClass = 'text-yellow-700';
      icon = 'fa-trophy';
      label = 'Gold';
      glowClass = 'shadow-[0_0_15px_rgba(250,204,21,0.5)]';
      break;
    case DriverLevel.VIP:
      bgClass = 'bg-gradient-to-r from-purple-600 to-indigo-600';
      textClass = 'text-white';
      icon = 'fa-crown';
      label = 'VIP';
      glowClass = 'shadow-[0_0_20px_rgba(147,51,234,0.6)] animate-pulse';
      break;
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${bgClass} ${textClass} ${glowClass}`}>
      <i className={`fas ${icon}`}></i>
      <span>{label}</span>
    </div>
  );
};
