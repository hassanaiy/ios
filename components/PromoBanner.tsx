
import React from 'react';

export default function PromoBanner() {
  return (
    <div
      className="
        mx-3 mt-2
        rounded-xl
        bg-white/85 backdrop-blur-md
        shadow-sm
        px-4 py-3
        flex items-center justify-between
      "
      style={{ height: 70 }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-yellow-100 flex items-center justify-center">
          🚗
        </div>
        <div className="leading-tight">
          <div className="text-sm font-bold text-gray-800">
            رحلات آمنة وسريعة
          </div>
          <div className="text-xs text-gray-500">
            اطلب رحلتك الآن مع مواصلة
          </div>
        </div>
      </div>

      {/* Action */}
      <button
        className="
          text-xs font-semibold
          text-yellow-600
          hover:text-yellow-700
          transition
        "
      >
        ابدأ الآن →
      </button>
    </div>
  );
}
