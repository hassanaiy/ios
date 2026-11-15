import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../contexts/LanguageContext';
import { Button } from '../components/ui/Button';
import { subscribeToAppSettings, DEFAULT_SUPPORT_WHATSAPP, formatWhatsAppUrl } from '../services/firebase';

// Dummy phone mockup placeholder
const PhoneMockup = ({ src, label }: { src: string; label?: string }) => (
  <div className="relative mx-auto w-[280px] h-[580px] bg-black rounded-[50px] shadow-[0_0_50px_rgba(0,0,0,0.5)] border-[12px] border-gray-900 overflow-hidden flex-shrink-0 ring-1 ring-white/10">
    {/* Inner shadow/reflection */}
    <div className="absolute inset-0 z-20 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"></div>
    {/* Speaker/Notch */}
    <div className="absolute top-0 inset-x-0 h-7 bg-gray-900 rounded-b-[24px] w-32 mx-auto z-30 flex items-center justify-center">
      <div className="w-10 h-1 bg-gray-800 rounded-full"></div>
    </div>
    
    <div className="absolute inset-0 bg-gray-900">
      <img 
        src={src} 
        alt={label || "App Screenshot"} 
        className="w-full h-full object-cover opacity-90 transition-opacity hover:opacity-100 duration-500"
      />
    </div>

    {/* Bottom Bar */}
    <div className="absolute bottom-2 inset-x-0 h-1 w-24 mx-auto bg-white/20 rounded-full z-30"></div>
  </div>
);

const LandingPage = () => {
  const { isRTL, language, setLanguage } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState(DEFAULT_SUPPORT_WHATSAPP);

  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      if (settings?.supportWhatsappNumber && settings.supportWhatsappNumber.trim()) {
        setSupportWhatsapp(settings.supportWhatsappNumber.trim());
      } else {
        setSupportWhatsapp(DEFAULT_SUPPORT_WHATSAPP);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleScroll = (e: any) => {
      setScrolled(e.target.scrollTop > 50);
    };
    const root = document.getElementById('landing-root');
    if (root) root.addEventListener('scroll', handleScroll);
    return () => {
      if (root) root.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const t = (key: string, eng: string, ar: string) => isRTL ? ar : eng;

  // Use the logo from public/logo.png if it exists, otherwise use the stylized pin
  const logoUrl = "/logo.png"; 

  // Screenshots - high-quality placeholders for now, can be replaced by real ones
  const screenshotMap = "https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2064&auto=format&fit=crop";
  const screenshotMenu = "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?q=80&w=2070&auto=format&fit=crop";

  return (
    <div id="landing-root" className={`h-screen overflow-y-auto scroll-smooth bg-black text-white font-sans ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <header className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'bg-black/90 backdrop-blur-xl py-3 shadow-2xl border-b border-white/5' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 md:px-12 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 flex items-center justify-center transition-transform hover:scale-110">
              <img src={logoUrl} alt="Mowasla Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-2xl font-black tracking-tighter text-white uppercase italic">Mowasla</span>
          </div>

          <nav className="hidden lg:flex items-center gap-10 font-bold uppercase text-[11px] tracking-widest text-gray-400">
            <a href="#features" className="hover:text-[#FFC90E] transition-colors">{t('nav_features', 'Features', 'المميزات')}</a>
            <a href="#how-it-works" className="hover:text-[#FFC90E] transition-colors">{t('nav_how', 'How it Works', 'كيف يعمل')}</a>
            <a href="#driver" className="hover:text-[#FFC90E] transition-colors">{t('nav_driver', 'Drive with Us', 'اعمل معنا')}</a>
          </nav>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="w-10 h-10 rounded-full border border-gray-800 flex items-center justify-center hover:bg-[#FFC90E] hover:text-black hover:border-[#FFC90E] transition-all font-black text-[10px] tracking-tight"
            >
              {language === 'ar' ? 'EN' : 'AR'}
            </button>
            <a href="https://waslny-7791e.web.app/">
              <Button className="bg-[#FFC90E] text-black hover:bg-yellow-500 font-black px-6 py-2 h-10 rounded-full text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(255,201,14,0.4)]">
                {t('nav_login', 'Login', 'دخول')}
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-40 pb-20 md:pt-64 md:pb-40 overflow-hidden flex items-center min-h-screen">
        {/* Animated Background Blobs */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-[#020202]"></div>
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              x: [0, 50, 0],
              y: [0, -30, 0]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] bg-[#FFC90E]/20 rounded-full blur-[180px]"
          ></motion.div>
          <motion.div 
            animate={{ 
              scale: [1, 1.1, 1],
              x: [0, -50, 0],
              y: [0, 50, 0]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[180px]"
          ></motion.div>
          
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 contrast-150 brightness-100 mix-blend-overlay"></div>
        </div>

        <div className="container relative z-10 mx-auto px-6 md:px-12 flex flex-col items-center text-center">
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 bg-white/5 text-[#FFC90E] text-[10px] font-black tracking-[0.2em] uppercase mb-10 backdrop-blur-sm"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFC90E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#FFC90E]"></span>
              </span>
              {t('hero_badge', 'PREMIUM RIDE HAILING', 'تطبيق النقل الذكي الأول')}
            </motion.div>
            
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black mb-10 leading-[0.9] tracking-tighter uppercase italic">
              {t('hero_title_1', 'Your Smart ', 'مواصلة... ')}
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-[#FFC90E] via-yellow-400 to-[#FFC90E]">
                {t('hero_title_2', 'Ride', 'راحتك')}
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-500 mb-14 leading-relaxed font-medium max-w-2xl mx-auto">
              {t('hero_desc', 'Experience the luxury of on-demand transportation. Reliable, safe, and tailored for your ultimate comfort.', 'استمتع بتجربة تنقل فاخرة تحت الطلب. موثوقة، آمنة، ومصممة لراحتك التامة.')}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <motion.a 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="https://play.google.com/store/apps/details?id=com.ans.waslny"
              >
                <Button className="w-full sm:w-auto bg-[#FFC90E] text-black hover:bg-yellow-500 font-black px-12 py-5 h-20 rounded-full text-xl shadow-[0_20px_50px_rgba(255,201,14,0.3)] flex items-center gap-4">
                  <i className="fab fa-google-play text-2xl"></i>
                  <div className="text-left rtl:text-right">
                    <div className="text-[10px] uppercase tracking-widest opacity-60 leading-none mb-1">Get it on</div>
                    <div className="leading-none">Google Play</div>
                  </div>
                </Button>
              </motion.a>
              <motion.a 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                href="https://waslny-7791e.web.app/"
              >
                <Button className="w-full sm:w-auto bg-white/5 text-white hover:bg-white/10 font-bold px-12 py-5 h-20 rounded-full text-xl border border-white/10 backdrop-blur-md">
                  {t('btn_login', 'Login to Web', 'دخول عبر المتصفح')}
                </Button>
              </motion.a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* INFO CARDS SECTION */}
      <section id="info" className="py-24 bg-[#0a0a0a] relative">
        <div className="container mx-auto px-6 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                id: 'about',
                title_en: 'About Us',
                title_ar: 'من نحن',
                desc_en: 'We are a pioneering technology company on a mission to reshape the mobility ecosystem. We connect riders with the best captains.',
                desc_ar: 'نحن شركة تكنولوجيا رائدة في مهمة لإعادة تشكيل نظام التنقل. نربط الركاب بأفضل الكباتن.',
                image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800',
                icon: 'fa-users'
              },
              {
                id: 'driver',
                title_en: 'How to be a Driver',
                title_ar: 'كيف تصبح كابتن',
                desc_en: 'Join our fleet easily. Register, submit your documents, complete training, and start earning on your own schedule.',
                desc_ar: 'انضم إلى أسطولنا بسهولة. سجل، قدم مستنداتك، اكمل التدريب وابدأ في كسب المال بمرونة.',
                image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&q=80&w=800',
                icon: 'fa-car'
              },
              {
                id: 'contact',
                title_en: 'Contact Us',
                title_ar: 'اتصل بنا',
                desc_en: 'Need help or have a question? Our support team is available 24/7 to assist you. Reach out via email, phone, or live chat.',
                desc_ar: 'تحتاج إلى مساعدة أو لديك سؤال؟ فريق الدعم لدينا متاح 24/7 لمساعدتك. تواصل عبر البريد، الهاتف أو الدردشة.',
                image: 'https://images.unsplash.com/photo-1596524430615-b46475ddff6e?auto=format&fit=crop&q=80&w=800',
                icon: 'fa-envelope'
              }
            ].map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ delay: idx * 0.2 }}
                whileHover={{ y: -10 }}
                className="group relative rounded-[40px] overflow-hidden bg-black shadow-2xl h-[450px]"
              >
                <div className="absolute inset-0 z-0">
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10 transition-opacity group-hover:opacity-80"></div>
                  <img src={item.image} alt={item.title_en} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                </div>
                <div className="relative z-20 p-10 h-full flex flex-col justify-end">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFC90E] text-black flex items-center justify-center mb-6 text-xl shadow-lg transform transition-transform group-hover:-translate-y-2 group-hover:rotate-6">
                    <i className={`fas ${item.icon}`}></i>
                  </div>
                  <h3 className="text-3xl font-black text-white mb-2 uppercase tracking-tighter transition-transform group-hover:-translate-y-2">
                    {isRTL ? item.title_ar : item.title_en}
                  </h3>
                  <div className="overflow-hidden">
                    <p className="text-gray-300 font-medium leading-relaxed opacity-0 translate-y-8 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 h-0 group-hover:h-auto group-hover:mt-4 group-hover:mb-6">
                      {isRTL ? item.desc_ar : item.desc_en}
                    </p>
                  </div>
                  <button className="self-start text-[#FFC90E] font-bold uppercase text-xs tracking-widest hover:text-white transition-colors flex items-center gap-2 mt-4 group-hover:mt-0">
                    {isRTL ? 'اكتشف المزيد' : 'Learn More'} <i className={`fas ${isRTL ? 'fa-arrow-left' : 'fa-arrow-right'}`}></i>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-32 bg-black relative">
        <div className="container mx-auto px-6 md:px-12">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center max-w-3xl mx-auto mb-20"
          >
            <h2 className="text-4xl md:text-7xl font-black mb-8 tracking-tighter uppercase italic">{t('features_title', 'Engineered to Perfection', 'مميزات استثنائية')}</h2>
            <p className="text-gray-500 text-xl font-medium leading-relaxed">{t('features_desc', 'Everything you need for a comfortable and secure journey, packed into one beautiful app.', 'كل ما تحتاجه لرحلة مريحة وآمنة، مدمج في تطبيق واحد رائع.')}</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'fa-bolt', title_en: 'Fast Booking', title_ar: 'حجز سريع', desc_en: 'Get a ride in seconds with our optimized dispatcher.', desc_ar: 'احصل على رحلتك في ثوانٍ مع نظامنا المتطور.' },
              { icon: 'fa-map-marked-alt', title_en: 'Live Tracking', title_ar: 'تتبع مباشر', desc_en: 'Precision real-time location tracking on the map.', desc_ar: 'تتبع دقيق لموقع السائق في الوقت الفعلي على الخريطة.' },
              { icon: 'fa-shield-alt', title_en: 'Safe Rides', title_ar: 'رحلات آمنة', desc_en: 'Verified drivers and trip sharing for maximum safety.', desc_ar: 'سائقون موثقون مع إمكانية مشاركة الرحلة لأمان تام.' },
              { icon: 'fa-comments', title_en: 'In-app Chat', title_ar: 'دردشة مدمجة', desc_en: 'Privacy-focused communication without sharing numbers.', desc_ar: 'تواصل يحافظ على خصوصيتك دون مشاركة رقمك.' },
              { icon: 'fa-wallet', title_en: 'Multiple Payments', title_ar: 'طرق دفع متنوعة', desc_en: 'Seamlessly pay with cash, wallet, or InstaPay.', desc_ar: 'ادفع نقداً، عبر المحفظة، أو إنستا باي بكل سهولة.' },
              { icon: 'fa-headset', title_en: 'Instant Support', title_ar: 'دعم فوري', desc_en: 'Dedicated concierge team ready 24/7.', desc_ar: 'فريق دعم متخصص جاهز لخدمتك على مدار الساعة.' }
            ].map((feat, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ y: -10 }}
                className="group p-10 rounded-[40px] bg-white/5 border border-white/5 hover:border-[#FFC90E]/30 transition-all duration-500 hover:bg-white/[0.08]"
              >
                <div className="w-16 h-16 rounded-3xl bg-black border border-white/10 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl">
                  <i className={`fas ${feat.icon} text-2xl text-[#FFC90E]`}></i>
                </div>
                <h3 className="text-2xl font-black mb-4 uppercase tracking-tight">{isRTL ? feat.title_ar : feat.title_en}</h3>
                <p className="text-gray-500 leading-relaxed font-medium">{isRTL ? feat.desc_ar : feat.desc_en}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="py-24 bg-black relative overflow-hidden">
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-6">{t('how_title', 'How it Works', 'كيف يعمل التطبيق')}</h2>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-12 text-center relative max-w-5xl mx-auto">
             <div className="hidden md:block absolute top-1/2 left-0 w-full h-1 bg-gray-800 -translate-y-1/2 -z-10"></div>
             
             {[
               { num: 1, icon: 'fa-map-pin', title_en: 'Request', title_ar: 'اطلب الرحلة', desc: 'Enter destination' },
               { num: 2, icon: 'fa-check-circle', title_en: 'Accept', title_ar: 'قبول السائق', desc: 'Driver is on the way' },
               { num: 3, icon: 'fa-smile', title_en: 'Enjoy', title_ar: 'استمتع بوقتك', desc: 'Safe and comfortable' }
             ].map((step, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.2 }}
                  className="flex-1 bg-black p-6 rounded-2xl"
                >
                   <div className="w-20 h-20 mx-auto rounded-full bg-gray-900 border-4 border-[#FFC90E] flex items-center justify-center text-2xl font-black text-[#FFC90E] mb-6 shadow-[0_0_20px_rgba(255,201,14,0.3)]">
                     <i className={`fas ${step.icon}`}></i>
                   </div>
                   <h3 className="text-2xl font-bold mb-2">{isRTL ? step.title_ar : step.title_en}</h3>
                   <p className="text-gray-400">{step.desc}</p>
                </motion.div>
             ))}
          </div>
        </div>
      </section>

      {/* APP PREVIEW */}
      <section className="py-32 bg-black overflow-hidden relative">
         <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/10 via-transparent to-transparent"></div>
         <div className="container mx-auto px-6 md:px-12 flex flex-col lg:flex-row items-center gap-20">
            <motion.div 
               initial={{ opacity: 0, x: isRTL ? 50 : -50 }}
               whileInView={{ opacity: 1, x: 0 }}
               viewport={{ once: true }}
               className="flex-1 text-center lg:text-left rtl:lg:text-right"
            >
               <h2 className="text-4xl md:text-6xl font-black mb-8 tracking-tighter">{t('preview_title', 'Beautiful Inside Out', 'تصميم رائع وعملي')}</h2>
               <p className="text-xl text-gray-400 mb-10 leading-relaxed font-medium">
                 {t('preview_desc', 'A user interface designed to put you in control. Clean, intuitive, and lightning fast.', 'واجهة مستخدم مصممة لتضعك في قلب الحدث. نظيفة، سلسة، وفائقة السرعة.')}
               </p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-left rtl:text-right">
                  {[
                    { label: t("Dark Mode UI", "Dark Mode UI", "واجهة الوضع الداكن"), icon: "fa-moon" },
                    { label: t("Seamless Interactions", "Seamless Interactions", "تفاعلات سلسة"), icon: "fa-fingerprint" },
                    { label: t("Battery Optimized", "Battery Optimized", "توفير البطارية"), icon: "fa-battery-full" },
                    { label: t("High Performance", "High Performance", "أداء فائق"), icon: "fa-rocket" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-[#FFC90E]/10 flex items-center justify-center text-[#FFC90E]">
                        <i className={`fas ${item.icon}`}></i>
                      </div>
                      <span className="font-bold text-sm uppercase tracking-wider">{item.label}</span>
                    </div>
                  ))}
               </div>
            </motion.div>
            <div className="flex-1 relative flex justify-center lg:justify-end">
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[#FFC90E]/5 blur-[120px] rounded-full"></div>
               <div className="relative z-10 flex gap-4 md:gap-8 items-start">
                 <motion.div
                   initial={{ y: 100, opacity: 0, rotate: -5 }}
                   whileInView={{ y: 0, opacity: 1, rotate: 0 }}
                   viewport={{ once: true }}
                   transition={{ duration: 0.8, type: "spring" }}
                 >
                   <PhoneMockup src={screenshotMap} label="Map View" />
                 </motion.div>
                 <motion.div
                   initial={{ y: 150, opacity: 0, rotate: 5 }}
                   whileInView={{ y: 40, opacity: 1, rotate: 0 }}
                   viewport={{ once: true }}
                   transition={{ duration: 0.8, delay: 0.2, type: "spring" }}
                   className="hidden sm:block"
                 >
                   <PhoneMockup src={screenshotMenu} label="Side Menu" />
                 </motion.div>
               </div>
            </div>
         </div>
      </section>

      {/* STATISTICS */}
      <section className="py-20 border-y border-gray-800 bg-black">
         <div className="container mx-auto px-6 md:px-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
               {[
                 { val: '10K+', label_en: 'Users', label_ar: 'مستخدم' },
                 { val: '5K+', label_en: 'Trips', label_ar: 'رحلة' },
                 { val: '4.9', label_en: 'Rating', label_ar: 'تقييم' },
                 { val: '24/7', label_en: 'Support', label_ar: 'دعم فني' },
               ].map((stat, idx) => (
                 <div key={idx}>
                   <div className="text-4xl md:text-5xl font-black text-[#FFC90E] mb-2">{stat.val}</div>
                   <div className="text-gray-400 font-medium uppercase tracking-wider text-sm">{isRTL ? stat.label_ar : stat.label_en}</div>
                 </div>
               ))}
            </div>
         </div>
      </section>

      {/* DRIVER CTA */}
      <section id="driver" className="py-32 relative text-center px-6">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1549317661-bc594ceccbc4?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
        
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black mb-6">{t('driver_cta_title', 'Start Driving With Mowasla', 'ابدأ العمل معنا اليوم')}</h2>
          <p className="text-xl text-gray-300 mb-10">
            {t('driver_cta_desc', 'Be your own boss. Flexible hours, great earnings, and a respected community of top drivers.', 'كن مدير نفسك. ساعات مرنة، أرباح ممتازة، ومجتمع محترم من أفضل السائقين.')}
          </p>
          <a href="https://waslny-7791e.web.app/">
            <Button className="bg-[#FFC90E] text-black hover:bg-yellow-500 font-black px-10 py-5 h-16 rounded-full text-xl shadow-[0_0_40px_rgba(255,201,14,0.4)]">
              {t('btn_drive', 'Become a Driver', 'سجل كسائق الآن')}
            </Button>
          </a>
        </div>
      </section>

      {/* FOOTER & CONTACT */}
      <footer className="bg-black pt-32 pb-16 border-t border-white/5 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-[#FFC90E]/5 to-transparent"></div>
        <div className="container mx-auto px-6 md:px-12 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-20 mb-24">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-16 h-16 transition-transform hover:rotate-12">
                  <img src={logoUrl} alt="Mowasla Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-3xl font-black italic tracking-tighter uppercase">Mowasla</span>
              </div>
              <p className="text-gray-500 mb-10 max-w-sm text-lg font-medium leading-relaxed">
                {t('footer_desc', 'The premium ride-hailing experience designed for modern cities. Fast, safe, and reliable.', 'تجربة النقل الذكي الفاخرة المصممة للمدن الحديثة. سريعة، آمنة، وموثوقة.')}
              </p>
              <div className="flex gap-6">
                {[ 'twitter', 'facebook-f', 'instagram', 'linkedin-in' ].map(icon => (
                  <a key={icon} href="#" className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-[#FFC90E] hover:text-black transition-all flex items-center justify-center border border-white/5 hover:border-[#FFC90E]"><i className={`fab fa-${icon}`}></i></a>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-black mb-10 text-xs tracking-[0.3em] uppercase text-gray-400">{t('contact_us', 'Contact Us', 'تواصل معنا')}</h4>
              <ul className="space-y-6 text-gray-500 font-medium italic">
                <li className="flex items-center gap-4 hover:text-white transition-colors cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#FFC90E] group-hover:bg-[#FFC90E] group-hover:text-black transition-all">
                    <i className="fas fa-envelope text-sm"></i>
                  </div>
                  mowasla@mowasla.online
                </li>
                <li className="flex items-center gap-4 hover:text-white transition-colors cursor-pointer group">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-[#FFC90E] group-hover:bg-[#FFC90E] group-hover:text-black transition-all">
                    <i className="fas fa-phone text-sm"></i>
                  </div>
                  <span dir="ltr">{supportWhatsapp}</span>
                </li>
                <li>
                  <a href={formatWhatsAppUrl(supportWhatsapp)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-4 px-6 py-4 bg-green-500/10 text-green-500 rounded-2xl hover:bg-green-500/20 transition-all font-black uppercase text-xs tracking-widest italic group">
                    <i className="fab fa-whatsapp text-lg group-hover:scale-125 transition-transform"></i> WhatsApp Support
                  </a>
                </li>
              </ul>
            </div>

            <div>
               <h4 className="font-black mb-10 text-xs tracking-[0.3em] uppercase text-gray-400">{t('download', 'Get the App', 'حمل التطبيق')}</h4>
               <div className="space-y-4">
                 <motion.a 
                   whileHover={{ x: 10 }}
                   href="https://play.google.com/store/apps/details?id=com.ans.waslny" 
                   className="block p-4 bg-white/5 rounded-3xl border border-white/5 hover:border-white/20 flex items-center gap-4 transition-all group"
                 >
                   <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center group-hover:text-[#FFC90E] transition-colors">
                     <i className="fab fa-google-play text-2xl"></i>
                   </div>
                   <div>
                     <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black">GET IT ON</div>
                     <div className="font-black text-white italic">Google Play</div>
                   </div>
                 </motion.a>
                 <div className="block p-4 bg-white/5 rounded-3xl border border-white/5 opacity-30 flex items-center gap-4 grayscale">
                   <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-white">
                     <i className="fab fa-apple text-2xl"></i>
                   </div>
                   <div>
                     <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Coming soon</div>
                     <div className="font-black text-white italic">App Store</div>
                   </div>
                 </div>
               </div>
            </div>
          </div>

          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 text-[11px] font-black uppercase tracking-widest text-gray-600">
            <div>&copy; {new Date().getFullYear()} Mowasla. {t('rights', 'All rights reserved.', 'جميع الحقوق محفوظة.')}</div>
            <div className="flex gap-8">
              <a href="/privacy-policy" className="hover:text-white transition-colors">{t('privacy_policy', 'Privacy Policy', 'سياسة الخصوصية')}</a>
              <a href="#" className="hover:text-white transition-colors">{t('terms', 'Terms of Service', 'الشروط والأحكام')}</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
