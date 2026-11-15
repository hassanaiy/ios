import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { Driver } from '../types';

interface VehicleManagementPanelProps {
    driver: Driver;
    onClose: () => void;
}

export const VehicleManagementPanel: React.FC<VehicleManagementPanelProps> = ({ driver, onClose }) => {
    const { t, isRTL } = useLanguage();
    
    // Using a simple state copy since we won't fully mutate db in this scope without a full handler
    const [vehicle, setVehicle] = useState({
        brand: driver.vehicleBrand || '',
        model: driver.vehicleModel || '',
        year: driver.vehicleYear || '',
        color: driver.vehicleColor || '',
        plate: driver.vehiclePlate || ''
    });

    const documents = [
        { id: 'license', title: isRTL ? 'رخصة القيادة' : 'Driver License', status: 'approved', warning: isRTL ? 'تحتاج إلى تحديث' : 'Needs Update' },
        { id: 'insurance', title: isRTL ? 'تأمين السيارة' : 'Vehicle Insurance', status: 'expired', warning: isRTL ? 'تنتهي صلاحية التأمين خلال ١٥ يوماً' : 'Insurance expires in 15 days' },
        { id: 'registration', title: isRTL ? 'رخصة السيارة' : 'Vehicle Registration', status: 'pending', warning: isRTL ? 'قيد المراجعة' : 'Pending Review' }
    ];

    const handleUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        // Fire update request
        alert(isRTL ? "تم إرسال الطلب بنجاح" : "Update request sent successfully");
    };

    return (
        <div className="fixed inset-0 z-[250] bg-gray-50 flex flex-col" dir={isRTL ? 'rtl' : 'ltr'}>
            <div className="pt-safe-top pb-4 px-6 bg-white border-b border-gray-100 flex items-center justify-between shadow-sm shrink-0">
                <h2 className="text-xl font-black text-gray-900">{isRTL ? 'إدارة المركبة' : 'Vehicle Management'}</h2>
                <button onClick={onClose} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-500">
                    <i className="fas fa-times"></i>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                
                <section>
                    <h3 className="font-black text-gray-900 text-lg mb-4">{isRTL ? 'تفاصيل المركبة' : 'Vehicle Details'}</h3>
                    <form onSubmit={handleUpdate} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">{isRTL ? 'الماركة' : 'Brand'}</label>
                                <input type="text" className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold text-sm" value={vehicle.brand} onChange={e => setVehicle({...vehicle, brand: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">{isRTL ? 'الموديل' : 'Model'}</label>
                                <input type="text" className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold text-sm" value={vehicle.model} onChange={e => setVehicle({...vehicle, model: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">{isRTL ? 'السنة' : 'Year'}</label>
                                <input type="text" className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold text-sm" value={vehicle.year} onChange={e => setVehicle({...vehicle, year: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">{isRTL ? 'اللون' : 'Color'}</label>
                                <input type="text" className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold text-sm" value={vehicle.color} onChange={e => setVehicle({...vehicle, color: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 mb-1 block">{isRTL ? 'رقم اللوحة' : 'Plate Number'}</label>
                            <input type="text" className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 font-bold text-sm" value={vehicle.plate} onChange={e => setVehicle({...vehicle, plate: e.target.value})} dir="ltr" />
                        </div>
                        <button type="submit" className="w-full h-12 mt-2 bg-[#0F2B5B] text-white rounded-xl font-bold shadow-md hover:bg-[#0c224a] transition-colors">{isRTL ? 'تحديث البيانات' : 'Update Details'}</button>
                    </form>
                </section>

                <section>
                    <h3 className="font-black text-gray-900 text-lg mb-4">{isRTL ? 'المستندات والتراخيص' : 'Documents & Licenses'}</h3>
                    <div className="space-y-4">
                        {documents.map((doc) => (
                            <div key={doc.id} className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 flex flex-col gap-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center">
                                            <i className="fas fa-file-invoice"></i>
                                        </div>
                                        <h4 className="font-bold text-gray-900">{doc.title}</h4>
                                    </div>
                                    <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full ${
                                        doc.status === 'approved' ? 'bg-green-100 text-green-700' :
                                        doc.status === 'expired' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                        {doc.status}
                                    </span>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center mt-2 border border-dashed border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                                    <span className="text-xs text-red-500 font-bold flex items-center gap-2">
                                        <i className="fas fa-exclamation-circle text-[#D4AF37]"></i>
                                        {doc.warning}
                                    </span>
                                    <div className="text-xs font-bold bg-[#0F2B5B] text-white px-3 py-1.5 rounded-lg">
                                        {isRTL ? 'رفع مستند' : 'Upload'}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
};
