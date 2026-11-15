

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '../components/ui/Button';
import { useLanguage } from '../contexts/LanguageContext';
import { UserRole, Driver } from '../types';
import { uploadFile, updateUserProfile } from '../services/firebaseBridge';

interface DriverRegistrationProps {
  userId: string;
  baseUser: Partial<Driver>;
  onComplete: (details: any) => void;
  onBack: () => void;
}

// --- COMPREHENSIVE DATASETS ---

const COLORS = [
  { id: 'white', en: 'White', ar: 'أبيض', hex: '#FFFFFF', border: true },
  { id: 'black', en: 'Black', ar: 'أسود', hex: '#000000' },
  { id: 'silver', en: 'Silver', ar: 'فضي', hex: '#C0C0C0' },
  { id: 'grey', en: 'Grey', ar: 'رمادي', hex: '#808080' },
  { id: 'red', en: 'Red', ar: 'أحمر', hex: '#FF0000' },
  { id: 'blue', en: 'Blue', ar: 'أزرق', hex: '#0000FF' },
  { id: 'navy', en: 'Navy', ar: 'كحلي', hex: '#000080' },
  { id: 'brown', en: 'Brown', ar: 'بني', hex: '#A52A2A' },
  { id: 'beige', en: 'Beige', ar: 'بيج', hex: '#F5F5DC', border: true },
  { id: 'gold', en: 'Gold', ar: 'ذهبي', hex: '#FFD700' },
  { id: 'green', en: 'Green', ar: 'أخضر', hex: '#008000' },
  { id: 'maroon', en: 'Maroon', ar: 'نبيتي', hex: '#800000' },
  { id: 'yellow', en: 'Yellow', ar: 'أصفر', hex: '#FFFF00', border: true },
  { id: 'orange', en: 'Orange', ar: 'برتقالي', hex: '#FFA500' },
];

const CAR_DATA = [
  {
    id: 'hyundai', en: 'Hyundai', ar: 'هيونداي',
    models: [
      { en: 'Verna', ar: 'فيرنا' },
      { en: 'Elantra', ar: 'إلنترا' },
      { en: 'Elantra CN7', ar: 'إلنترا CN7' },
      { en: 'Elantra AD', ar: 'إلنترا AD' },
      { en: 'Elantra HD', ar: 'إلنترا HD' },
      { en: 'Tucson', ar: 'توسان' },
      { en: 'Accent', ar: 'أكسنت' },
      { en: 'Accent RB', ar: 'أكسنت RB' },
      { en: 'Creta', ar: 'كريتا' },
      { en: 'i10', ar: 'i10' },
      { en: 'i20', ar: 'i20' },
      { en: 'Bayon', ar: 'بايون' },
      { en: 'Matrix', ar: 'ماتريكس' },
      { en: 'Getz', ar: 'جيتز' }
    ]
  },
  {
    id: 'kia', en: 'Kia', ar: 'كيا',
    models: [
      { en: 'Cerato', ar: 'سيراتو' },
      { en: 'Cerato K3', ar: 'سيراتو K3' },
      { en: 'Sportage', ar: 'سبورتاج' },
      { en: 'Rio', ar: 'ريو' },
      { en: 'Picanto', ar: 'بيكانتو' },
      { en: 'Sorento', ar: 'سورينتو' },
      { en: 'XCeed', ar: 'إكسيد' },
      { en: 'Carnival', ar: 'كرنفال' },
      { en: 'Carens', ar: 'كاريتز' },
      { en: 'Soul', ar: 'سول' }
    ]
  },
  {
    id: 'toyota', en: 'Toyota', ar: 'تويوتا',
    models: [
      { en: 'Corolla', ar: 'كورولا' },
      { en: 'Yaris', ar: 'ياريس' },
      { en: 'Camry', ar: 'كامري' },
      { en: 'Fortuner', ar: 'فورتشنر' },
      { en: 'C-HR', ar: 'سي اتش آر' },
      { en: 'Belta', ar: 'بيلتا' },
      { en: 'Rumion', ar: 'روميون' },
      { en: 'Land Cruiser', ar: 'لاند كروزر' },
      { en: 'Hilux', ar: 'هايلكس' },
      { en: 'Avanza', ar: 'افانزا' }
    ]
  },
  {
    id: 'nissan', en: 'Nissan', ar: 'نيسان',
    models: [
      { en: 'Sunny', ar: 'صني' },
      { en: 'Sentra', ar: 'سنترا' },
      { en: 'Qashqai', ar: 'قشقاي' },
      { en: 'Juke', ar: 'جوك' },
      { en: 'Patrol', ar: 'باترول' },
      { en: 'Tiida', ar: 'تيدا' }
    ]
  },
  {
    id: 'chevrolet', en: 'Chevrolet', ar: 'شيفروليه',
    models: [
      { en: 'Optra', ar: 'أوبترا' },
      { en: 'Aveo', ar: 'أفيو' },
      { en: 'Cruze', ar: 'كروز' },
      { en: 'Captiva', ar: 'كابتيفا' },
      { en: 'Lanos', ar: 'لانوس' },
      { en: 'Groove', ar: 'جروف' },
      { en: 'Spark', ar: 'سبارك' }
    ]
  },
  {
    id: 'mg', en: 'MG', ar: 'إم جي',
    models: [
      { en: 'MG 5', ar: 'MG 5' },
      { en: 'MG 6', ar: 'MG 6' },
      { en: 'ZS', ar: 'ZS' },
      { en: 'RX5', ar: 'RX5' },
      { en: 'HS', ar: 'HS' }
    ]
  },
  {
    id: 'chery', en: 'Chery', ar: 'شيري',
    models: [
      { en: 'Tiggo 3', ar: 'تيجو 3' },
      { en: 'Tiggo 7', ar: 'تيجو 7' },
      { en: 'Tiggo 7 Pro', ar: 'تيجو 7 برو' },
      { en: 'Tiggo 8', ar: 'تيجو 8' },
      { en: 'Arrizo 5', ar: 'أريزو 5' },
      { en: 'Envy', ar: 'انفي' }
    ]
  },
  {
    id: 'suzuki', en: 'Suzuki', ar: 'سوزوكي',
    models: [
      { en: 'Swift', ar: 'سويفت' },
      { en: 'Dzire', ar: 'ديزاير' },
      { en: 'Ertiga', ar: 'إرتيجا' },
      { en: 'Ciaz', ar: 'سياز' },
      { en: 'Baleno', ar: 'بالينو' },
      { en: 'Alto', ar: 'ألتو' },
      { en: 'S-Presso', ar: 'اس بريسو' },
      { en: 'Vitara', ar: 'فيتارا' }
    ]
  },
  {
    id: 'renault', en: 'Renault', ar: 'رينو',
    models: [
      { en: 'Logan', ar: 'لوجان' },
      { en: 'Megane', ar: 'ميجان' },
      { en: 'Duster', ar: 'داستر' },
      { en: 'Sandero', ar: 'سانديرو' },
      { en: 'Stepway', ar: 'ستيب واي' },
      { en: 'Kadjar', ar: 'كادجار' },
      { en: 'Austral', ar: 'اوسترال' },
      { en: 'Fluence', ar: 'فلوانس' }
    ]
  },
  {
    id: 'mitsubishi', en: 'Mitsubishi', ar: 'ميتسوبيشي',
    models: [
      { en: 'Lancer', ar: 'لانسر' },
      { en: 'Lancer Shark', ar: 'لانسر شارك' },
      { en: 'Lancer Puma', ar: 'لانسر بومة' },
      { en: 'Xpander', ar: 'اكسباندر' },
      { en: 'Eclipse Cross', ar: 'اكبليس كروس' },
      { en: 'Pajero', ar: 'باجيرو' }
    ]
  },
  {
    id: 'fiat', en: 'Fiat', ar: 'فيات',
    models: [
      { en: 'Tipo', ar: 'تيبو' },
      { en: '500', ar: '500' },
      { en: '500X', ar: '500X' },
      { en: 'Punto', ar: 'بونتو' }
    ]
  },
  {
    id: 'peugeot', en: 'Peugeot', ar: 'بيجو',
    models: [
      { en: '301', ar: '301' },
      { en: '508', ar: '508' },
      { en: '3008', ar: '3008' },
      { en: '5008', ar: '5008' },
      { en: '2008', ar: '2008' }
    ]
  },
  {
    id: 'byd', en: 'BYD', ar: 'بي واي دي',
    models: [
      { en: 'F3', ar: 'F3' },
      { en: 'L3', ar: 'L3' }
    ]
  },
  {
    id: 'lada', en: 'Lada', ar: 'لادا',
    models: [
      { en: 'Granta', ar: 'جرانتا' },
      { en: 'Vesta', ar: 'فيستا' }
    ]
  },
  {
    id: 'geely', en: 'Geely', ar: 'جيلي',
    models: [
      { en: 'Emgrand 7', ar: 'امجراند 7' },
      { en: 'Coolray', ar: 'كول راي' },
      { en: 'Okavango', ar: 'اوكافانجو' },
      { en: 'GX3 Pro', ar: 'GX3 Pro' }
    ]
  },
  {
    id: 'jetour', en: 'Jetour', ar: 'جيتور',
    models: [
      { en: 'X70', ar: 'X70' },
      { en: 'X90', ar: 'X90' },
      { en: 'Dashing', ar: 'داشينج' }
    ]
  },
  {
    id: 'citroen', en: 'Citroen', ar: 'سيتروين',
    models: [
      { en: 'C-Elysee', ar: 'سي إليزيه' },
      { en: 'C4', ar: 'C4' },
      { en: 'C5 Aircross', ar: 'C5 اير كروس' },
      { en: 'C3', ar: 'C3' }
    ]
  },
  {
    id: 'opel', en: 'Opel', ar: 'أوبل',
    models: [
      { en: 'Astra', ar: 'استرا' },
      { en: 'Insignia', ar: 'انسيجنيا' },
      { en: 'Corsa', ar: 'كورسا' },
      { en: 'Mokka', ar: 'موكا' },
      { en: 'Crossland', ar: 'كروس لاند' },
      { en: 'Grandland', ar: 'جراند لاند' }
    ]
  },
  {
    id: 'volkswagen', en: 'Volkswagen', ar: 'فولكس فاجن',
    models: [
      { en: 'Passat', ar: 'باسات' },
      { en: 'Jetta', ar: 'جيتا' },
      { en: 'Golf', ar: 'جولف' },
      { en: 'Tiguan', ar: 'تيجوان' }
    ]
  },
  {
    id: 'bmw', en: 'BMW', ar: 'بي إم دبليو',
    models: [
      { en: '3 Series', ar: 'الفئة الثالثة' },
      { en: '5 Series', ar: 'الفئة الخامسة' },
      { en: 'X1', ar: 'X1' },
      { en: 'X3', ar: 'X3' },
      { en: 'X5', ar: 'X5' }
    ]
  },
  {
    id: 'mercedes', en: 'Mercedes', ar: 'مرسيدس',
    models: [
      { en: 'C-Class', ar: 'C-Class' },
      { en: 'E-Class', ar: 'E-Class' },
      { en: 'S-Class', ar: 'S-Class' },
      { en: 'GLA', ar: 'GLA' },
      { en: 'GLC', ar: 'GLC' }
    ]
  }
];

const MOTO_DATA = [
  {
    id: 'dayun', en: 'Dayun', ar: 'دايون',
    models: [
      { en: 'Dayun 2', ar: 'دايون ٢' },
      { en: 'Dayun 3', ar: 'دايون ٣' },
      { en: 'Dayun 4', ar: 'دايون ٤' },
      { en: 'Dayun 6', ar: 'دايون ٦' },
      { en: 'Dayun 40', ar: 'دايون ٤٠' }
    ]
  },
  {
    id: 'halawa', en: 'Halawa', ar: 'حلاوة',
    models: [
      { en: 'Tiger', ar: 'تايجر' },
      { en: 'Wing', ar: 'وينج' },
      { en: 'Express', ar: 'اكسبريس' },
      { en: 'Alcantar', ar: 'الكانتار' }
    ]
  },
  {
    id: 'hogue', en: 'Haojue/Hoge', ar: 'هووجن',
    models: [
      { en: 'Hoge 3', ar: 'هووجن ٣' },
      { en: 'Hoge 4', ar: 'هووجن ٤' },
      { en: 'Hoge 8', ar: 'هووجن ٨' },
      { en: 'F250', ar: 'F250' },
      { en: 'V250', ar: 'V250' },
      { en: 'Abdullah', ar: 'عبدالله' },
      { en: 'Jumbo', ar: 'جامبو' }
    ]
  },
  {
    id: 'bajaj', en: 'Bajaj', ar: 'باجاج',
    models: [
      { en: 'Boxer 150', ar: 'بوكسر ١٥٠' },
      { en: 'Boxer X', ar: 'بوكسر X' },
      { en: 'Pulsar 180', ar: 'بألسر ١٨٠' },
      { en: 'Discover', ar: 'ديسكفر' }
    ]
  },
  {
    id: 'benelli', en: 'Benelli', ar: 'بينيلي',
    models: [
      { en: 'VLM', ar: 'VLM' },
      { en: 'VLR', ar: 'VLR' },
      { en: 'TNT 150', ar: 'TNT 150' },
      { en: 'TNT 250', ar: 'TNT 250' },
      { en: 'Caffenero', ar: 'كافينيرو' },
      { en: 'Zafferano', ar: 'زافيرانو' }
    ]
  },
  {
    id: 'sym', en: 'SYM', ar: 'إس واي إم',
    models: [
      { en: 'Fiddle II', ar: 'فيدل ٢' },
      { en: 'Fiddle III', ar: 'فيدل ٣' },
      { en: 'Jet 14', ar: 'جيت ١٤' },
      { en: 'Symphony S', ar: 'سيمفوني S' },
      { en: 'Symphony SR', ar: 'سيمفوني SR' },
      { en: 'Symphony ST', ar: 'سيمفوني ST' },
      { en: 'Orbit II', ar: 'أوربت ٢' }
    ]
  },
  {
    id: 'kymco', en: 'Kymco', ar: 'كيمكو',
    models: [
      { en: 'Agility', ar: 'أجيليتي' },
      { en: 'Urban S', ar: 'أوربان S' },
      { en: 'X-Town', ar: 'اكس تاون' }
    ]
  },
  {
    id: 'tvs', en: 'TVS', ar: 'تي في إس',
    models: [
      { en: 'HLX 150', ar: 'HLX 150' },
      { en: 'Apache 160', ar: 'أباتشي ١٦٠' },
      { en: 'Apache 180', ar: 'أباتشي ١٨٠' }
    ]
  },
  {
    id: 'honda', en: 'Honda', ar: 'هوندا',
    models: [
      { en: 'Hornet', ar: 'هورنت' },
      { en: 'CBR', ar: 'CBR' },
      { en: 'Rebel', ar: 'ريبل' },
      { en: 'Goldwing', ar: 'جولد وينج' }
    ]
  },
  {
    id: 'yamaha', en: 'Yamaha', ar: 'ياماها',
    models: [
      { en: 'R1', ar: 'R1' },
      { en: 'R6', ar: 'R6' },
      { en: 'MT-07', ar: 'MT-07' },
      { en: 'MT-09', ar: 'MT-09' }
    ]
  },
  {
    id: 'suzuki', en: 'Suzuki', ar: 'سوزوكي',
    models: [
      { en: 'Gixxer', ar: 'جيكسر' },
      { en: 'Hayabusa', ar: 'هايابوسا' },
      { en: 'Boulevard', ar: 'بوليفارد' }
    ]
  },
  {
    id: 'kawasaki', en: 'Kawasaki', ar: 'كاواساكي',
    models: [
      { en: 'Ninja', ar: 'نينجا' },
      { en: 'Z', ar: 'Z' }
    ]
  },
  {
    id: 'vespa', en: 'Vespa', ar: 'فيسبا',
    models: [
      { en: 'Primavera', ar: 'بريمافيرا' },
      { en: 'Sprint', ar: 'سبرينت' },
      { en: 'GTS', ar: 'GTS' },
      { en: 'LML', ar: 'صباب (LML)' }
    ]
  }
];

// Generate Years 2000-2026
const YEARS = Array.from({ length: 27 }, (_, i) => (2026 - i).toString());

// --- UTILS ---

const formatPlateNumber = (input: string) => {
    // Remove all existing spaces to process raw characters
    const clean = input.replace(/\s+/g, '');
    let result = '';
    
    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        // Check if digit (Western 0-9 or Arabic-Indic ٠-٩)
        const isNumber = /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(char);
        
        const prevChar = i > 0 ? clean[i-1] : null;
        const prevIsNumber = prevChar ? /[0-9\u0660-\u0669\u06F0-\u06F9]/.test(prevChar) : false;
        
        if (i > 0) {
            // Logic:
            // 1. Separate if current is letter (not number). This spaces out letters like "ه ع".
            // 2. Separate if current is number BUT previous was letter (spaces letters from numbers).
            // 3. Keep numbers grouped (no space between two numbers).
            
            if (!isNumber) {
                result += ' ';
            } else if (isNumber && !prevIsNumber) {
                result += ' ';
            }
        }
        
        result += char;
    }
    return result;
};

// --- TYPES ---

type Step = 'vehicle_type' | 'brand' | 'model' | 'year' | 'color' | 'documents';

export default function DriverRegistration({ userId, baseUser, onComplete, onBack }: DriverRegistrationProps) {
  const { t, isRTL, language } = useLanguage();
  const [step, setStep] = useState<Step>('vehicle_type');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  // Selection State
  const [vehicleType, setVehicleType] = useState<'standard' | 'moto'>((baseUser.vehicleType as 'standard' | 'moto') || 'standard');
  const [selectedBrand, setSelectedBrand] = useState<{en:string, ar:string, models: any[]} | null>(null);
  const [selectedModel, setSelectedModel] = useState<{en:string, ar:string} | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>(baseUser.vehicleYear || '');
  const [selectedColor, setSelectedColor] = useState<any | null>(null);
  const [plateNumber, setPlateNumber] = useState(baseUser.vehiclePlate || '');
  const [instapayNumber, setInstapayNumber] = useState(baseUser.instapayNumber || baseUser.phone || '');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');

  // Documents State (File | string for existing URL)
  const [licenseFront, setLicenseFront] = useState<File | string | null>(baseUser.licenseUrl || null);
  const [nidFront, setNidFront] = useState<File | string | null>(baseUser.nationalIdUrl || null);
  const [nidBack, setNidBack] = useState<File | string | null>(baseUser.nationalIdBackUrl || null);
  const [personalPhoto, setPersonalPhoto] = useState<File | string | null>((baseUser as any).personalPhotoUrl || baseUser.avatar || null);
  const [vehicleRegFront, setVehicleRegFront] = useState<File | string | null>(baseUser.vehicleRegFrontUrl || null);
  const [vehicleRegBack, setVehicleRegBack] = useState<File | string | null>(baseUser.vehicleRegBackUrl || null);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | string | null>(baseUser.vehicleImageUrl || null);
  const [criminalRecord, setCriminalRecord] = useState<File | string | null>(baseUser.criminalRecordUrl || null);
  const [hasCriminalRecord, setHasCriminalRecord] = useState<boolean | null>(baseUser.hasCriminalRecord ?? null);


  // Initialize brand/model/color objects if baseUser has them (optional enhancement)
  useEffect(() => {
      if (baseUser.vehicleBrand && !selectedBrand) {
          const found = CAR_DATA.concat(MOTO_DATA).find(b => b.en === baseUser.vehicleBrand || b.ar === baseUser.vehicleBrand);
          if (found) {
              setSelectedBrand(found);
              if (baseUser.vehicleModel) {
                  const modelFound = found.models.find(m => m.en === baseUser.vehicleModel || m.ar === baseUser.vehicleModel);
                  if (modelFound) setSelectedModel(modelFound);
              }
          }
      }
      if (baseUser.vehicleColor && !selectedColor) {
          const colorFound = COLORS.find(c => c.en === baseUser.vehicleColor || c.ar === baseUser.vehicleColor);
          if (colorFound) setSelectedColor(colorFound);
      }
  }, [baseUser]);

  // --- Handlers ---

  const handleBack = () => {
    setSearchQuery('');
    if (step === 'vehicle_type') onBack();
    else if (step === 'brand') setStep('vehicle_type');
    else if (step === 'model') setStep('brand');
    else if (step === 'year') setStep('model');
    else if (step === 'color') setStep('year');
    else if (step === 'documents') setStep('color');
  };

  const handleTypeSelect = (type: 'standard' | 'moto') => {
    setVehicleType(type);
    setStep('brand');
  };

  const handleBrandSelect = (brand: any) => {
    setSelectedBrand(brand);
    setSearchQuery('');
    setStep('model');
  };

  const handleModelSelect = (model: any) => {
    setSelectedModel(model);
    setSearchQuery('');
    setStep('year');
  };

  const handleYearSelect = (year: string) => {
    setSelectedYear(year);
    setStep('color');
  };

  const handleColorSelect = (color: any) => {
    setSelectedColor(color);
    setStep('documents');
  };

  const handleUpload = async (fileOrUrl: File | string | null, path: string) => {
      if (!fileOrUrl) return '';
      if (typeof fileOrUrl === 'string') return fileOrUrl; // Already a URL
      return await uploadFile(fileOrUrl, path);
  };

  const handleSubmit = async () => {
    // Strict Validation for all required documents
    if (!plateNumber || !licenseFront || !nidFront || !nidBack || !personalPhoto || !vehiclePhoto || !vehicleRegFront || !vehicleRegBack || hasCriminalRecord === null) {
        alert(t('alert_missing_fields'));
        return;
    }

    if (!acceptedTerms) {
        alert(t('terms_required_alert'));
        return;
    }

    setLoading(true);
    try {
        const uploads = await Promise.all([
            handleUpload(licenseFront, `drivers/${userId}/license_front`),
            handleUpload(nidFront, `drivers/${userId}/nid_front`),
            handleUpload(nidBack, `drivers/${userId}/nid_back`),
            handleUpload(personalPhoto, `drivers/${userId}/personal_photo`),
            handleUpload(vehicleRegFront, `drivers/${userId}/reg_front`),
            handleUpload(vehicleRegBack, `drivers/${userId}/reg_back`),
            handleUpload(vehiclePhoto, `drivers/${userId}/vehicle_photo`),
            handleUpload(criminalRecord, `drivers/${userId}/criminal_record`)
        ]);

        const [licenseUrl, nidFrontUrl, nidBackUrl, personalPhotoUrl, regFrontUrl, regBackUrl, vehicleUrl, criminalRecordUrl] = uploads;

        const nonDataOrEmpty = (val: string) => (val && !val.startsWith('data:') ? val : '');

        const data = {
            id: userId,
            profileCompleted: true,
            role: UserRole.PASSENGER,
            driverStatus: 'pending' as const,
            status: 'pending' as const,
            kycStatus: 'PENDING_REVIEW' as const,
            isApproved: false,
            approvalNoticeShown: false,
            rejectionNoticeShown: false,
            approvedNotice: null,
            rejectionNotice: null,
            hasPendingDriverApplication: true,
            driverApplicationStatusChangedAt: Date.now(),
            personalPhotoUrl: nonDataOrEmpty(personalPhotoUrl),
            avatar: personalPhotoUrl,
            vehicleType: vehicleType,
            vehicleBrand: language === 'ar' ? selectedBrand?.ar : selectedBrand?.en,
            vehicleModel: language === 'ar' ? selectedModel?.ar : selectedModel?.en,
            vehicleYear: selectedYear,
            vehicleColor: language === 'ar' ? selectedColor?.ar : selectedColor?.en,
            vehiclePlate: plateNumber,
            vehicle: {
                type: vehicleType,
                brand: language === 'ar' ? selectedBrand?.ar : selectedBrand?.en,
                model: language === 'ar' ? selectedModel?.ar : selectedModel?.en,
                year: selectedYear,
                color: language === 'ar' ? selectedColor?.ar : selectedColor?.en,
                plate: plateNumber,
                image: nonDataOrEmpty(vehicleUrl)
            },
            // Primary document URLs (used across AdminPanel & DriverManagementModal)
            licenseUrl,
            nationalIdUrl: nidFrontUrl,
            nationalIdBackUrl: nidBackUrl,
            vehicleRegFrontUrl: regFrontUrl,
            vehicleRegBackUrl: regBackUrl,
            vehicleImageUrl: vehicleUrl,
            criminalRecordUrl,
            // Nested documents structure (omits duplicate base64 strings so Firestore 1MB limit & localStorage quota are never exceeded)
            documents: {
                licenseFront: nonDataOrEmpty(licenseUrl),
                nationalIdFront: nonDataOrEmpty(nidFrontUrl),
                nationalIdBack: nonDataOrEmpty(nidBackUrl),
                vehicleRegFront: nonDataOrEmpty(regFrontUrl),
                vehicleRegBack: nonDataOrEmpty(regBackUrl),
                vehiclePhotos: nonDataOrEmpty(vehicleUrl) ? [vehicleUrl] : [],
                criminalRecord: nonDataOrEmpty(criminalRecordUrl)
            },
            submittedAt: new Date().toISOString(),
            instapayNumber,
            hasCriminalRecord: hasCriminalRecord === true,
            isVerified: false, // Default to not verified on registration
            earnings: baseUser.earnings || 0,
            totalRides: baseUser.totalRides || 0,
            isOnline: false,
            rejectionReason: "" // Clear any previous rejection reason on re-submission
        };

        // SAVE DATA TO FIRESTORE
        await updateUserProfile(userId, data);
        try {
            localStorage.setItem('mowasla_driver_approval_pending_' + userId, 'true');
        } catch (_e) {}

        // Ensure FCM token is captured before admin reviews documents
        try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor.isNativePlatform()) {
                const { CapacitorService } = await import('../services/capacitorService');
                CapacitorService.setupPushNotifications(userId).catch(() => {});
            } else {
                const { saveDeviceToken } = await import('../services/firebase');
                saveDeviceToken(userId).catch(() => {});
            }
        } catch (_pushErr) {}

        // Notify parent to update local state
        onComplete(data);
    } catch (e) {
        if(String(e).includes('permission')) { console.log('Permission error caught:', e); } else { console.error(e); };
        alert(t('alert_upload_error'));
    } finally {
        setLoading(false);
    }
  };

  // --- Filtered Lists ---
  // SELECT THE CORRECT DATA SOURCE BASED ON VEHICLE TYPE
  const currentData = vehicleType === 'moto' ? MOTO_DATA : CAR_DATA;

  const filteredBrands = useMemo(() => {
    if (!searchQuery) return currentData;
    const q = searchQuery.toLowerCase();
    return currentData.filter(b => b.en.toLowerCase().includes(q) || b.ar.includes(q));
  }, [searchQuery, currentData]);

  const filteredModels = useMemo(() => {
    if (!selectedBrand) return [];
    if (!searchQuery) return selectedBrand.models;
    const q = searchQuery.toLowerCase();
    return selectedBrand.models.filter(m => m.en.toLowerCase().includes(q) || m.ar.includes(q));
  }, [searchQuery, selectedBrand]);

  // --- Render Steps ---

  // Common Wrapper with Page Transition
  // Removed PageContainer definition from here

  if (step === 'vehicle_type') {
    return (
      <Wrapper title={t('choose_vehicle_title')} onBack={handleBack} isRTL={isRTL}>
         <PageContainer>
             <div className="space-y-4">
                <SelectionItem 
                  iconUrl="https://cdn-icons-png.flaticon.com/512/3202/3202926.png" 
                  label={t('vehicle_car')} 
                  onClick={() => handleTypeSelect('standard')} 
                  isRTL={isRTL} 
                />
                <SelectionItem 
                  iconUrl="https://cdn-icons-png.flaticon.com/512/3721/3721619.png" 
                  label={t('vehicle_motorcycle')} 
                  onClick={() => handleTypeSelect('moto')} 
                  isRTL={isRTL} 
                />
             </div>
         </PageContainer>
      </Wrapper>
    );
  }

  if (step === 'brand') {
    return (
      <Wrapper title={t('brand_label')} onBack={handleBack} isRTL={isRTL}>
        <PageContainer>
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={isRTL ? "بحث عن ماركة..." : "Search brand..."} />
            <div className="space-y-2 mt-4 pb-4">
              {filteredBrands.map((brand, idx) => (
                 <div key={brand.id} className={`stagger-${(idx % 5) + 1} animate-fade-in-up`}>
                     <SelectionItem 
                       label={language === 'ar' ? brand.ar : brand.en}
                       onClick={() => handleBrandSelect(brand)}
                       isRTL={isRTL}
                     />
                 </div>
              ))}
            </div>
        </PageContainer>
      </Wrapper>
    );
  }

  if (step === 'model') {
    return (
      <Wrapper title={t('model_label')} onBack={handleBack} isRTL={isRTL}>
        <PageContainer>
            <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder={isRTL ? "بحث عن موديل..." : "Search model..."} />
            <div className="space-y-2 mt-4 pb-4">
              {filteredModels.map((model, idx) => (
                 <div key={idx} className={`stagger-${(idx % 5) + 1} animate-fade-in-up`}>
                     <SelectionItem 
                       label={language === 'ar' ? model.ar : model.en}
                       onClick={() => handleModelSelect(model)}
                       isRTL={isRTL}
                     />
                 </div>
              ))}
            </div>
        </PageContainer>
      </Wrapper>
    );
  }

  if (step === 'year') {
    return (
      <Wrapper title={t('year_label')} onBack={handleBack} isRTL={isRTL}>
         <PageContainer>
             <div className="space-y-2 pb-4">
                {YEARS.map((year, idx) => (
                   <div key={year} className={`stagger-${(idx % 5) + 1} animate-fade-in-up`}>
                       <SelectionItem 
                         label={year}
                         onClick={() => handleYearSelect(year)}
                         isRTL={isRTL}
                       />
                   </div>
                ))}
             </div>
         </PageContainer>
      </Wrapper>
    );
  }

  if (step === 'color') {
    return (
      <Wrapper title={t('color_label')} onBack={handleBack} isRTL={isRTL}>
          <PageContainer>
              <div className="space-y-2 pb-4">
                {COLORS.map((color, idx) => (
                   <div 
                     key={color.id} 
                     onClick={() => handleColorSelect(color)}
                     className={`flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-transparent hover:border-gray-900 transition-all cursor-pointer stagger-${(idx % 5) + 1} animate-fade-in-up`}
                   >
                      <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full shadow-sm" style={{ backgroundColor: color.hex, border: color.border ? '1px solid #ddd' : 'none' }}></div>
                          <span className="font-bold text-gray-800">{language === 'ar' ? color.ar : color.en}</span>
                      </div>
                      <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-300`}></i>
                   </div>
                ))}
             </div>
         </PageContainer>
      </Wrapper>
    );
  }

  // 6. Documents (Final)
  if (step === 'documents') {
      return (
        <Wrapper title={t('documents_label')} onBack={handleBack} isRTL={isRTL} noScroll>
             <div className="flex-1 overflow-y-auto pb-32 p-1 animate-page-enter">
                 <div className="mb-6">
                    <div className="mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100 shadow-sm">
                        <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">{isRTL ? 'رقم موبايل إنستاباي' : 'InstaPay Mobile Number'}</label>
                        <input 
                            type="tel" 
                            value={instapayNumber} 
                            onChange={e => setInstapayNumber(e.target.value)} 
                            className="w-full bg-white p-4 rounded-2xl font-black text-xl tracking-widest text-center border-2 border-transparent focus:border-blue-500 outline-none transition-all"
                            placeholder="01XXXXXXXXX"
                        />
                        <p className="text-[10px] text-blue-600/60 font-bold mt-2 text-center">{isRTL ? 'رقم إنستاباي الصحيح مطلوب لاستقبال مدفوعات الركاب.' : 'Correct InstaPay number is required for passenger payments.'}</p>
                    </div>
                     <div className="bg-gray-50 p-4 rounded-2xl mb-6 flex items-center gap-4 border border-gray-100 shadow-sm">
                         <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                             {vehicleType === 'moto' ? '🏍️' : '🚗'}
                         </div>
                         <div>
                             <div className="font-bold text-gray-900">
                                 {language === 'ar' ? selectedBrand?.ar : selectedBrand?.en} {language === 'ar' ? selectedModel?.ar : selectedModel?.en}
                             </div>
                             <div className="text-xs text-gray-500">
                                 {selectedYear} • {language === 'ar' ? selectedColor?.ar : selectedColor?.en}
                             </div>
                         </div>
                     </div>

                     <label className="text-xs font-bold text-gray-400 uppercase ml-1 mb-1 block">{t('plate_label')}</label>
                     <input 
                         type="text" 
                         value={plateNumber} 
                         onChange={e => setPlateNumber(formatPlateNumber(e.target.value))} 
                         className="w-full p-4 bg-gray-50 rounded-xl font-bold outline-none border border-transparent focus:border-gray-900 transition-colors mb-8 text-center text-xl tracking-widest uppercase"
                         placeholder={t('plate_placeholder')}
                     />

                     {/* Personal Documents Section */}
                     <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                           <i className="fas fa-id-card text-blue-500"></i> {t('personal_docs')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                                <DocUpload label={isRTL ? 'صورة شخصية صالحة' : 'Valid Personal Photo'} fileOrUrl={personalPhoto} onSelect={setPersonalPhoto} />
                                <p className="text-[10px] text-gray-400 mt-1 px-1">
                                    {isRTL ? 'هذه الصورة ستظهر للركاب كمظهرك الشخصي في التطبيق.' : 'This photo will be visible to passengers as your profile picture.'}
                                </p>
                            </div>
                            <DocUpload label={t('nid_front')} fileOrUrl={nidFront} onSelect={setNidFront} />
                            <DocUpload label={t('nid_back')} fileOrUrl={nidBack} onSelect={setNidBack} />
                            <DocUpload label={t('license_front')} fileOrUrl={licenseFront} onSelect={setLicenseFront} />
                        </div>
                     </div>

                     {/* Vehicle Documents Section */}
                     <div className="mb-6">
                        <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                           <i className="fas fa-car text-blue-500"></i> {t('vehicle_docs')}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <DocUpload label={t('vehicle_pic')} fileOrUrl={vehiclePhoto} onSelect={setVehiclePhoto} />
                            <DocUpload label={t('reg_front')} fileOrUrl={vehicleRegFront} onSelect={setVehicleRegFront} />
                            <DocUpload label={t('reg_back')} fileOrUrl={vehicleRegBack} onSelect={setVehicleRegBack} />
                        </div>
                     </div>

                     {/* Criminal Record Question Section */}
                      <div className="mb-6">
                          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                              <i className="fas fa-balance-scale text-blue-500"></i> {t('legal_record_title')}
                          </h3>
                          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                              <label className="block text-sm font-bold text-gray-700 mb-3">{t('criminal_record_q')}</label>
                              <div className="flex gap-3">
                                  <button
                                      type="button"
                                      onClick={() => setHasCriminalRecord(true)}
                                      className={`flex-1 p-4 rounded-xl font-bold transition-all ${hasCriminalRecord === true ? 'bg-red-500 text-white shadow-lg' : 'bg-white hover:bg-gray-200'}`}
                                  >
                                      {t('yes')}
                                  </button>
                                  <button
                                      type="button"
                                      onClick={() => setHasCriminalRecord(false)}
                                      className={`flex-1 p-4 rounded-xl font-bold transition-all ${hasCriminalRecord === false ? 'bg-green-500 text-white shadow-lg' : 'bg-white hover:bg-gray-200'}`}
                                  >
                                      {t('no')}
                                  </button>
                              </div>
                          </div>
                      </div>

                     {/* Optional Documents */}
                     {hasCriminalRecord === true && (
                        <div className="mb-6 animate-fade-in-up">
                          <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <i className="fas fa-file-alt text-blue-500"></i> {t('optional_docs_title')}
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                              <DocUpload label={t('doc_criminal_record')} fileOrUrl={criminalRecord} onSelect={setCriminalRecord} />
                          </div>
                        </div>
                     )}

                     {/* Terms Checkbox */}
                     <div className="mb-6 bg-gray-50 p-4 rounded-xl flex items-center gap-3">
                        <input 
                           type="checkbox" 
                           id="terms" 
                           checked={acceptedTerms} 
                           onChange={(e) => {
                               if (e.target.checked) setShowTerms(true);
                               else setAcceptedTerms(false);
                           }} 
                           className="w-5 h-5 rounded border-gray-300 text-[#FFC90E] focus:ring-[#FFC90E]"
                        />
                        <label 
                            htmlFor="terms" 
                            className="text-sm font-bold text-gray-700 cursor-pointer select-none"
                            onClick={(e) => { e.preventDefault(); if (!acceptedTerms) setShowTerms(true); else setAcceptedTerms(false); }}
                        >
                           {t('terms_agreement')}
                        </label>
                     </div>

                 </div>
             </div>
             
             <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe z-20">
                <Button 
                   onClick={handleSubmit} 
                   isLoading={loading} 
                   className="w-full h-14 bg-[#FFC90E] text-gray-900 shadow-xl shadow-yellow-200 rounded-2xl hover:bg-orange-600 active:scale-95 transition-transform"
                >
                    {t('submit_btn')}
                </Button>
            </div>

            {/* Terms Modal */}
            {showTerms && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h2 className="text-lg font-black text-gray-900">{t('terms_modal_title')}</h2>
                            <button onClick={() => setShowTerms(false)} className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-300">
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto" dir={isRTL ? 'rtl' : 'ltr'}>
                            <div className="mb-6">
                                <h3 className="font-bold text-blue-600 mb-2">{t('terms_section_privacy')}</h3>
                                <p className="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{t('terms_privacy_body')}</p>
                            </div>
                            <div className="mb-6">
                                <h3 className="font-bold text-blue-600 mb-2">{t('terms_section_rules')}</h3>
                                <p className="text-sm text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">{t('terms_rules_body')}</p>
                            </div>
                            <div className="mb-2">
                                <h3 className="font-bold text-red-600 mb-2">{t('terms_section_financials')}</h3>
                                <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                                    <p className="text-sm text-red-800 font-bold leading-relaxed whitespace-pre-wrap">{t('terms_financials_body')}</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-white">
                            <Button 
                                onClick={() => { setAcceptedTerms(true); setShowTerms(false); }} 
                                className="w-full h-14 bg-green-600 text-white shadow-green-200"
                            >
                                {t('agree_and_continue')}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Wrapper>
      );
  }

  return null;
}

// --- SUB COMPONENTS ---

const PageContainer = ({ children }: { children?: React.ReactNode }) => (
    <div className="animate-fade-in-up h-full flex flex-col">{children}</div>
);

const Wrapper = ({ children, title, onBack, isRTL, noScroll = false }: any) => (
    <div className="h-full bg-white flex flex-col animate-page-enter" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="p-4 pt-safe flex items-center gap-4 border-b border-gray-100 shadow-sm z-10 bg-white shrink-0">
            <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors active:scale-90">
                <i className={`fas ${isRTL ? 'fa-arrow-right' : 'fa-arrow-left'}`}></i>
            </button>
            <h1 className="font-bold text-lg">{title}</h1>
        </div>
        <div className={`flex-1 p-6 ${noScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
            {children}
        </div>
    </div>
);

const SelectionItem: React.FC<{ label: string; iconUrl?: string; onClick: () => void; isRTL: boolean }> = ({ label, iconUrl, onClick, isRTL }) => (
  <button 
    onClick={onClick}
    className="w-full flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-transparent hover:border-gray-900 transition-all cursor-pointer active:scale-[0.98]"
  >
    <div className="flex items-center gap-4">
      {iconUrl && <img src={iconUrl} className="w-6 h-6 object-contain" alt="" />}
      <span className="font-bold text-gray-800 text-lg">{label}</span>
    </div>
    <i className={`fas ${isRTL ? 'fa-chevron-left' : 'fa-chevron-right'} text-gray-300`}></i>
  </button>
);

const SearchBar = ({ value, onChange, placeholder }: { value: string, onChange: (val: string) => void, placeholder: string }) => (
  <div className="relative">
    <i className="fas fa-search absolute top-1/2 -translate-y-1/2 left-4 text-gray-400 rtl:right-4 rtl:left-auto"></i>
    <input 
      type="text" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      placeholder={placeholder}
      className="w-full p-4 pl-12 rtl:pr-12 rtl:pl-4 bg-gray-50 rounded-xl outline-none border-2 border-transparent focus:border-[#FFC90E] transition-colors font-bold text-gray-700"
    />
  </div>
);

const DocUpload = ({ label, fileOrUrl, onSelect }: { label: string, fileOrUrl: File | string | null, onSelect: (file: File | null) => void }) => {
  const isFile = fileOrUrl instanceof File;
  const isUrl = typeof fileOrUrl === 'string';
  const hasContent = isFile || (isUrl && fileOrUrl);

  const previewUrl = useMemo(() => {
    if (isFile) return URL.createObjectURL(fileOrUrl);
    if (isUrl) return fileOrUrl;
    return null;
  }, [fileOrUrl, isFile, isUrl]);

  return (
    <div className="relative w-full h-32 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300 hover:border-gray-400 transition-colors flex flex-col items-center justify-center cursor-pointer overflow-hidden group active:scale-[0.98]">
      {hasContent ? (
        <>
          <img src={previewUrl as string} className="w-full h-full object-cover" alt={label} />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <i className="fas fa-edit text-white text-2xl"></i>
          </div>
        </>
      ) : (
        <>
          <i className="fas fa-camera text-gray-400 text-2xl mb-2"></i>
          <span className="text-xs text-gray-500 font-bold text-center px-2">{label}</span>
        </>
      )}
      <input 
        type="file" 
        accept="image/*" 
        className="absolute inset-0 opacity-0 cursor-pointer" 
        onChange={(e) => {
          if (e.target.files?.[0]) onSelect(e.target.files[0]);
        }} 
      />
    </div>
  );
};