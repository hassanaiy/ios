export interface PrivacySubBullet {
  label?: string;
  text: string;
}

export interface PrivacyBullet {
  label?: string;
  text: string;
  subItems?: PrivacySubBullet[];
}

export interface PrivacySection {
  id: string;
  number: string;
  title: string;
  intro?: string;
  bullets?: PrivacyBullet[];
  contactEmail?: string;
}

export interface PrivacyLanguageContent {
  dir: 'rtl' | 'ltr';
  langCode: 'ar' | 'en';
  appName: string;
  pageTitle: string;
  lastUpdatedLabel: string;
  lastUpdatedDate: string;
  docCategory: string;
  navLabels: {
    overview: string;
    data: string;
    usage: string;
    deletion: string;
    contact: string;
  };
  sections: PrivacySection[];
}

export const PRIVACY_PUBLIC_URL = 'https://waslny.ai.studio/privacy-policy';
export const PRIVACY_CONTACT_EMAIL = 'mowasla@mowasla.online';

export const PRIVACY_POLICY_CONTENT: Record<'ar' | 'en', PrivacyLanguageContent> = {
  ar: {
    dir: 'rtl',
    langCode: 'ar',
    appName: 'مواصلة',
    pageTitle: 'سياسة الخصوصية لتطبيق مواصلة',
    lastUpdatedLabel: 'تاريخ آخر تحديث:',
    lastUpdatedDate: '13 نوفمبر 2026',
    docCategory: 'وثيقة عامة · لا تتطلب تسجيل الدخول',
    navLabels: {
      overview: 'مقدمة',
      data: 'المعلومات',
      usage: 'الاستخدام',
      deletion: 'حذف الحساب',
      contact: 'اتصل بنا',
    },
    sections: [
      {
        id: 'introduction',
        number: '01',
        title: '1. مقدمة',
        intro:
          'مرحباً بك في تطبيق "مواصلة". نحن نقدر خصوصيتك وملتزمون بحماية بياناتك الشخصية. تشرح سياسة الخصوصية هذه كيفية جمعنا واستخدامنا وإفصاحنا وحماية معلوماتك عند استخدام تطبيقنا وخدماتنا. يرجى قراءة هذه السياسة بعناية.',
      },
      {
        id: 'information-collected',
        number: '02',
        title: '2. المعلومات التي نجمعها',
        intro:
          'نقوم بجمع المعلومات التي تقدمها مباشرة أو التي يتم جمعها تلقائياً عند استخدام التطبيق:',
        bullets: [
          {
            label: 'البيانات الشخصية:',
            text: 'الاسم، البريد الإلكتروني، رقم الهاتف، وصورة الملف الشخصي.',
          },
          {
            label: 'بيانات الموقع الجغرافي:',
            text: '',
            subItems: [
              {
                label: 'للركاب:',
                text: 'نجمع بيانات موقع دقيقة (GPS) لتحديد مواقع الاستلام وتتبع مسار الرحلة.',
              },
              {
                label: 'للسائقين:',
                text: 'نجمع بيانات موقع دقيقة في الخلفية (حتى عندما يكون التطبيق مغلقاً أو غير مستخدم على الشاشة) لتمكين توجيه الرحلات، تتبع المسارات بدقة، وضمان السلامة العامة. هذا الإذن ضروري للوظائف الأساسية لوضع السائق.',
              },
            ],
          },
          {
            label: 'البيانات المالية:',
            text: 'سجل المعاملات ورصيد المحفظة. نحن لا نخزن أرقام بطاقات الائتمان الكاملة؛ حيث تتم معالجة المدفوعات بشكل آمن عبر مزودي خدمات الدفع المعتمدين (مثل OPay).',
          },
          {
            label: 'معلومات الجهاز:',
            text: 'طراز الجهاز، إصدار نظام التشغيل، ومعرفات الجهاز الفريدة لضمان الأمان، اكتشاف الأخطاء، ومنع الاحتيال.',
          },
        ],
      },
      {
        id: 'how-we-use',
        number: '03',
        title: '3. كيف نستخدم معلوماتك',
        intro: 'نستخدم المعلومات التي جمعناها للأغراض التالية:',
        bullets: [
          { text: 'توفير وإدارة خدمة حجز ومتابعة الرحلات.' },
          { text: 'تسهيل عمليات الدفع والتحويلات المالية وإدارة المحفظة.' },
          { text: 'تحسين أداء التطبيق وتطوير ميزات جديدة وتجربة المستخدم.' },
          { text: 'ضمان أمن وسلامة كل من السائقين والركاب والتحقق من الهويات.' },
          { text: 'إرسال الإشعارات والإرشادات الإدارية، مثل تحديثات السياسات، إيصالات الرحلات، والتنبيهات الأمنية.' },
        ],
      },
      {
        id: 'third-party-sharing',
        number: '04',
        title: '4. مشاركة البيانات مع الأطراف الثالثة',
        intro: 'نحن لا نبيع بياناتك الشخصية أبداً. نشارك المعلومات فقط في الحدود الضرورية التالية:',
        bullets: [
          {
            label: 'مع المستخدمين الآخرين:',
            text: 'يشارك الركاب والسائقون المعلومات الأساسية (الاسم، الصورة، الموقع، تفاصيل المركبة) لتسهيل إتمام الرحلة.',
          },
          {
            label: 'مقدمو الخدمات السحابية والتقنية:',
            text: 'نستخدم خدمات خارجية موثوقة مثل Google Maps (للملاحة والخرائط) و Firebase (لبنية السيرفرات وقواعد البيانات).',
          },
          {
            label: 'المتطلبات القانونية:',
            text: 'إذا كان ذلك مطلوباً بموجب القانون، أو استجابة لطلبات حكومية مشروعة، أو لحماية حقوق وسلامة مستخدمي تطبيق مواصلة.',
          },
        ],
      },
      {
        id: 'retention-deletion',
        number: '05',
        title: '5. الاحتفاظ بالبيانات وحذفها',
        intro: 'نحتفظ ببياناتك طالما كان حسابك نشطاً أو طالما كان ذلك ضرورياً لتزويد الخدمات.',
        bullets: [
          {
            label: 'حذف الحساب:',
            text: 'لديك الحق الكامل في طلب حذف حسابك وبياناتك في أي وقت. يمكنك القيام بذلك مباشرة داخل التطبيق بالذهاب إلى: الإعدادات > حذف الحساب. سيؤدي هذا الإجراء إلى إزالة ملفك الشخصي، سجل الرحلات، وبيانات المحفظة بشكل دائم من أنظمتنا.',
          },
        ],
      },
      {
        id: 'device-permissions',
        number: '06',
        title: '6. أذونات الجهاز المطلوبة',
        bullets: [
          {
            label: 'الموقع (Location):',
            text: 'مطلوب للوظائف الأساسية (تحديد مكان الركاب وتتبع السائقين في الخلفية).',
          },
          {
            label: 'الكاميرا والتخزين (Camera/Storage):',
            text: 'تستخدم لرفع مستندات التحقق (الهوية، رخصة القيادة) وصور الملف الشخصي.',
          },
          {
            label: 'الإشعارات (Notifications):',
            text: 'تُستخدم لإرسال تحديثات حالة الرحلة والعروض.',
          },
        ],
      },
      {
        id: 'contact',
        number: '07',
        title: '7. اتصل بنا',
        intro:
          'إذا كانت لديك أي أسئلة أو استفسارات حول سياسة الخصوصية هذه، يرجى التواصل معنا عبر البريد الإلكتروني:',
        contactEmail: PRIVACY_CONTACT_EMAIL,
      },
    ],
  },
  en: {
    dir: 'ltr',
    langCode: 'en',
    appName: 'Mowasla',
    pageTitle: 'Mowasla Privacy Policy',
    lastUpdatedLabel: 'Last Updated:',
    lastUpdatedDate: 'November 13, 2026',
    docCategory: 'Public Legal Notice · No Sign-In Required',
    navLabels: {
      overview: 'Overview',
      data: 'Data Collected',
      usage: 'Usage',
      deletion: 'Data Deletion',
      contact: 'Contact',
    },
    sections: [
      {
        id: 'introduction',
        number: '01',
        title: '1. Introduction',
        intro:
          'Welcome to the "Mowasla" application. We value your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our application and services. Please read this policy carefully.',
      },
      {
        id: 'information-collected',
        number: '02',
        title: '2. Information We Collect',
        intro:
          'We collect information that you provide directly or that is collected automatically when you use the application:',
        bullets: [
          {
            label: 'Personal Data:',
            text: 'Name, email address, phone number, and profile photo.',
          },
          {
            label: 'Geographic Location Data:',
            text: '',
            subItems: [
              {
                label: 'For Passengers:',
                text: 'We collect precise location data (GPS) to determine pickup locations and track the trip route.',
              },
              {
                label: 'For Drivers:',
                text: 'We collect precise location data in the background (even when the app is closed or not actively in use on screen) to enable trip dispatching, accurately track routes, and ensure public safety. This permission is essential for the core functionality of Driver Mode.',
              },
            ],
          },
          {
            label: 'Financial Data:',
            text: 'Transaction history and wallet balance. We do not store full credit card numbers; payments are processed securely through authorized payment service providers (such as OPay).',
          },
          {
            label: 'Device Information:',
            text: 'Device model, operating system version, and unique device identifiers to ensure security, detect errors, and prevent fraud.',
          },
        ],
      },
      {
        id: 'how-we-use',
        number: '03',
        title: '3. How We Use Your Information',
        intro: 'We use the information we collect for the following purposes:',
        bullets: [
          { text: 'Providing and managing the ride booking and trip tracking service.' },
          { text: 'Facilitating payment transactions, financial transfers, and wallet management.' },
          { text: 'Improving application performance, developing new features, and enhancing user experience.' },
          { text: 'Ensuring the safety and security of both drivers and passengers and verifying identities.' },
          { text: 'Sending notifications and administrative notices, such as policy updates, trip receipts, and security alerts.' },
        ],
      },
      {
        id: 'third-party-sharing',
        number: '04',
        title: '4. Sharing Data with Third Parties',
        intro: 'We never sell your personal data. We only share information within the following necessary limits:',
        bullets: [
          {
            label: 'With Other Users:',
            text: 'Passengers and drivers share essential information (name, photo, location, vehicle details) to facilitate completing the trip.',
          },
          {
            label: 'Cloud & Technical Service Providers:',
            text: 'We use trusted third-party services such as Google Maps (for navigation and mapping) and Firebase (for server infrastructure and databases).',
          },
          {
            label: 'Legal Requirements:',
            text: 'When required by law, in response to lawful government requests, or to protect the rights and safety of Mowasla users.',
          },
        ],
      },
      {
        id: 'retention-deletion',
        number: '05',
        title: '5. Data Retention & Deletion',
        intro: 'We retain your data as long as your account remains active or as necessary to provide services.',
        bullets: [
          {
            label: 'Account Deletion:',
            text: 'You have the full right to request deletion of your account and data at any time. You can do this directly inside the app by going to: Settings > Delete Account. This action will permanently remove your profile, trip history, and wallet data from our systems.',
          },
        ],
      },
      {
        id: 'device-permissions',
        number: '06',
        title: '6. Required Device Permissions',
        bullets: [
          {
            label: 'Location:',
            text: 'Required for core functionality (locating passengers and tracking drivers in the background).',
          },
          {
            label: 'Camera & Storage:',
            text: 'Used to upload verification documents (National ID, Driver\'s License) and profile photos.',
          },
          {
            label: 'Notifications:',
            text: 'Used to send trip status updates and promotional offers.',
          },
        ],
      },
      {
        id: 'contact',
        number: '07',
        title: '7. Contact Us',
        intro:
          'If you have any questions or inquiries regarding this Privacy Policy, please contact us by email:',
        contactEmail: PRIVACY_CONTACT_EMAIL,
      },
    ],
  },
};
