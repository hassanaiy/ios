
import React, { useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';

interface PaymentSuccessProps {
  onContinue: () => void;
}

const PaymentSuccess: React.FC<PaymentSuccessProps> = ({ onContinue }) => {
  const { isRTL } = useLanguage();

  useEffect(() => {
    // Play success sound when component mounts
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3');
    audio.play().catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center px-6 text-center">
      {/* Animated Success Icon */}
      <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
        <i className="fas fa-check-circle text-6xl text-green-500"></i>
      </div>

      <h1 className="text-3xl font-black text-gray-900 mb-4">
        {isRTL ? "تم الدفع بنجاح!" : "Payment Successful!"}
      </h1>

      <div className="bg-gray-50 rounded-2xl p-6 w-full max-w-sm mb-8 border border-dashed border-gray-300">
        <p className="text-gray-600 mb-2">
          {isRTL ? "تمت إضافة المبلغ إلى محفظتك بنجاح." : "The amount has been added to your wallet."}
        </p>
        <p className="text-xs text-gray-400">
          {isRTL ? "بوابة دفع OPay المؤمنة" : "Secured by OPay Gateway"}
        </p>
      </div>

      <Button 
        onClick={onContinue} 
        className="w-full max-w-sm h-14 text-lg font-bold shadow-xl shadow-green-200"
      >
        {isRTL ? "العودة للرئيسية" : "Back to Home"}
      </Button>

      {/* Aesthetic Background Line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-green-500"></div>
    </div>
  );
};

export default PaymentSuccess;
