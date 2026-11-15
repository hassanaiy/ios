import React, { useState } from 'react';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';

interface PassengerRegistrationProps {
  baseUser: {
    name: string;
    phone: string;
    email: string;
  };
  onComplete: (details: { name: string; phone: string; email: string; avatar: string }) => Promise<void> | void;
}

export default function PassengerRegistration({ baseUser, onComplete }: PassengerRegistrationProps) {
  const { t, isRTL } = useLanguage();
  const [name, setName] = useState(baseUser.name || '');
  const [phone, setPhone] = useState(baseUser.phone || '');
  const [email, setEmail] = useState(baseUser.email || '');
  const [isLoading, setIsLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setPhoneError(null);
    if (!name.trim() || !phone.trim()) {
      alert(t('err_fill_all'));
      if(!phone.trim()) setPhoneError(t('invalid_phone_number_error') || 'رقم الهاتف مفقود');
      return;
    }

    // Simple length validation
    const cleanPhone = phone.replace(/\D/g, '');
    
    if (cleanPhone.length < 7) {
      setPhoneError(t('err_invalid_phone'));
      return;
    }

    setIsLoading(true);
    try {
        await onComplete({
          name,
          phone: cleanPhone,
          email,
          avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
        });
    } catch (e) {
        setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-white flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex-1 overflow-y-auto p-6 pt-safe">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10 mt-8">
              <div className="w-20 h-20 bg-blue-50 rounded-full mx-auto mb-4 flex items-center justify-center text-4xl shadow-sm text-blue-500">
                  <i className="fas fa-user-check"></i>
              </div>
              <h1 className="text-3xl font-bold mb-2 tracking-tight">{t('pax_reg_title')}</h1>
              <p className="text-gray-500 font-medium">{t('pax_setup_desc')}</p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">{t('full_name')}</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder={t('enter_name')} className="w-full p-4 bg-gray-50 rounded-xl font-bold text-lg outline-none border-2 border-transparent focus:border-[#FFC90E] transition-colors" />
            </div>
            <div className="relative">
              <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">{t('phone_required')}</label>
              <input 
                type="tel"
                inputMode="numeric"
                maxLength={15}
                value={phone} 
                onChange={e => {
                  setPhone(e.target.value.replace(/\D/g, ''));
                  if (phoneError) setPhoneError(null);
                }}
                className={`w-full p-4 bg-gray-50 rounded-xl font-bold text-2xl outline-none border-2 transition-colors ${phoneError ? 'border-red-500' : 'border-transparent focus:border-[#FFC90E]'}`} 
                dir="ltr" 
              />
              {phoneError && (
                <p className="text-red-500 text-xs font-bold mt-1 ml-1">{phoneError}</p>
              )}
            </div>
            {!baseUser.email.includes('@whatsapp') && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">{t('email_optional')}</label>
              <input value={email} onChange={e => setEmail(e.target.value)} className="w-full p-4 bg-gray-50 rounded-xl font-bold text-lg outline-none border-2 border-transparent focus:border-[#FFC90E] transition-colors" dir="ltr" />
            </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="p-4 bg-white border-t border-gray-100 pb-safe">
        <Button onClick={handleSubmit} isLoading={isLoading} className="w-full max-w-md mx-auto h-14 bg-[#FFC90E] text-black shadow-lg shadow-yellow-200 rounded-2xl">{t('start_riding')}</Button>
      </div>
    </div>
  );
}
