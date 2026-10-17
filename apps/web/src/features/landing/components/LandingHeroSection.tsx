import { useState } from 'react';
import {
  MessageSquare,
  Phone,
  Clock,
  X,
  HelpCircle,
  Newspaper,
} from 'lucide-react';
import { th } from '../../../i18n/th';

export interface LandingHeroSectionProps {
  onLogin?: () => void;
  isNewsOpen?: boolean;
  onCloseNews?: () => void;
  isFaqOpen?: boolean;
  onCloseFaq?: () => void;
}

export function LandingHeroSection({
  onLogin: _onLogin,
  isNewsOpen,
  onCloseNews,
  isFaqOpen,
  onCloseFaq,
}: LandingHeroSectionProps) {
  const [isSupportOpen, setIsSupportOpen] = useState(false);

  return (
    <div className="w-full flex flex-col">
      {/* 1. Full Panoramic Campaign Hero Banner */}
      <section
        aria-label={th.landing.bannerAlt}
        className="w-full overflow-hidden bg-white"
      >
        <img
          src="/images/hero-banner.png"
          srcSet="/images/hero-banner.png 2172w, /images/hero-banner@2x.png 4344w"
          sizes="100vw"
          alt={th.landing.bannerAlt}
          className="w-full h-auto min-w-full block select-none"
        />
      </section>

      {/* 2. Schedule and Project Information Section */}
      <section
        id="schedule-section"
        aria-labelledby="schedule-heading"
        className="w-full bg-white px-4 pt-8 pb-14 sm:pt-10 sm:pb-20 lg:pt-12 lg:pb-24 text-center"
      >
        <div className="mx-auto max-w-4xl">
          {/* Eyebrow: ระยะเวลาโครงการ (เพิ่มเติม) */}
          <h2
            id="schedule-heading"
            className="text-lg sm:text-2xl lg:text-[1.7rem] font-bold text-slate-800 tracking-tight mb-2 sm:mb-3"
          >
            {th.landing.schedule.title}
          </h2>

          {/* Headline: เริ่มใช้สิทธิตั้งแต่วันที่ 1 ต.ค. - 30 พ.ย. 2569 */}
          <h1 className="text-2xl sm:text-4xl lg:text-[2.65rem] font-extrabold text-[#0f172a] tracking-tight leading-snug sm:leading-tight mb-3 sm:mb-4">
            {th.landing.schedule.dates}
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base lg:text-lg font-medium text-slate-500 max-w-2xl mx-auto leading-relaxed">
            {th.landing.schedule.subtitle}
          </p>
        </div>
      </section>

      {/* 3. How It Works / Steps Infographic Section */}
      <section
        aria-label={th.landing.howItWorks.ariaLabel}
        className="w-full bg-slate-50/70 px-4 py-8 sm:py-12 lg:py-16 border-t border-slate-100 flex justify-center"
      >
        <div className="w-full max-w-5xl lg:max-w-6xl">
          <div className="overflow-hidden rounded-2xl sm:rounded-3xl bg-white shadow-lg ring-1 ring-slate-900/5 transition-all hover:shadow-xl">
            <img
              src="/images/how-it-works.png"
              srcSet="/images/how-it-works.png 1962w, /images/how-it-works@2x.png 3924w"
              sizes="(max-width: 1280px) 100vw, 1152px"
              alt={th.landing.howItWorks.imageAlt}
              className="w-full h-auto block select-none"
            />
          </div>
        </div>
      </section>

      {/* 4. Floating Action Button: Fixed at bottom right */}
      <div className="fixed bottom-0 right-4 sm:right-8 z-40">
        <button
          type="button"
          onClick={() => setIsSupportOpen(true)}
          aria-label={th.landing.support.buttonLabel}
          className="inline-flex items-center gap-2.5 rounded-t-xl bg-[#0052cc] px-5 py-3 sm:py-3.5 text-sm sm:text-base font-bold text-white shadow-2xl hover:bg-[#004494] active:scale-98 transition-all cursor-pointer"
        >
          <MessageSquare className="size-5" aria-hidden="true" />
          <span>{th.landing.support.contactSupport}</span>
        </button>
      </div>

      {/* Support Contact Modal */}
      {isSupportOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="size-5 text-[#0052cc]" />
                <h3
                  id="support-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  {th.landing.support.modalTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupportOpen(false)}
                aria-label={th.landing.support.close}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-sm text-slate-700">
              <div className="flex items-center gap-3 rounded-xl bg-blue-50/70 p-3.5 text-[#0052cc]">
                <Phone className="size-5 shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    {th.landing.support.phone}
                  </p>
                  <p className="text-xs text-slate-600">
                    {th.landing.support.hours}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3.5 text-slate-600">
                <Clock className="size-5 shrink-0 text-slate-400" />
                <p className="text-xs">
                  ระบบต้นแบบ Virtual Wallet และภารกิจสะสมแต้มเพื่อร้านค้าชุมชน
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupportOpen(false)}
                className="w-full rounded-xl bg-[#0052cc] py-2.5 text-sm font-semibold text-white hover:bg-[#004494] transition-colors"
              >
                {th.landing.support.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* News Modal */}
      {isNewsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="news-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Newspaper className="size-5 text-[#0052cc]" />
                <h3
                  id="news-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  {th.landing.news.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseNews}
                aria-label={th.landing.news.close}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-slate-700">
              <div className="rounded-xl border border-slate-100 p-3.5 hover:bg-slate-50 transition-colors">
                <span className="text-xs font-semibold text-blue-600">
                  1 ต.ค. 2569
                </span>
                <h4 className="font-bold text-slate-900 mt-1">
                  เปิดให้ประชาชนยืนยันสิทธิผ่านแอปพลิเคชันอย่างเป็นทางการ
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  รัฐบาลเดินหน้าโครงการร่วมจ่ายเพื่อกระตุ้นเศรษฐกิจท้องถิ่นทั่วประเทศ
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onCloseNews}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                {th.landing.news.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {isFaqOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="faq-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-5 text-[#0052cc]" />
                <h3
                  id="faq-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900"
                >
                  {th.landing.faq.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={onCloseFaq}
                aria-label={th.landing.faq.close}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">
                  ใครมีสิทธิเข้าร่วมโครงการได้บ้าง?
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  ประชาชนสัญชาติไทย อายุ 18 ปีบริบูรณ์ขึ้นไปในวันลงทะเบียน
                  และมีบัตรประจำตัวประชาชน
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5">
                <p className="font-bold text-slate-900">
                  เงินสนับสนุนจากรัฐร่วมจ่ายเท่าไหร่?
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  รัฐบาลร่วมจ่าย 60% ประชาชนจ่าย 40% สูงสุดไม่เกิน 150 บาทต่อวัน
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onCloseFaq}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                {th.landing.faq.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
