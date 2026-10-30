import { useState } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  HelpCircle,
  Info,
  Phone,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { th } from '../../../i18n/th';
import {
  HowToJoinSection,
  type EligibilityRoleTab,
} from '../components/HowToJoinSection';
import { ProjectInfoSection } from '../components/ProjectInfoSection';

export type MainProjectTab = 'project-info' | 'how-to-join';

export interface ProjectInfoAndEligibilityPageProps {
  initialTab?: MainProjectTab | undefined;
  initialRole?: EligibilityRoleTab | undefined;
  onBackToHome: () => void;
  onRegisterConsumer?: (() => void) | undefined;
  onRegisterMerchant?: (() => void) | undefined;
  onLoginConsumer?: (() => void) | undefined;
  onLoginMerchant?: (() => void) | undefined;
}

export function ProjectInfoAndEligibilityPage({
  initialTab = 'project-info',
  initialRole = 'consumer',
  onBackToHome,
  onRegisterConsumer,
  onRegisterMerchant,
  onLoginConsumer,
  onLoginMerchant,
}: ProjectInfoAndEligibilityPageProps) {
  const [activeTab, setActiveTab] = useState<MainProjectTab>(initialTab);
  const [activeRole, setActiveRole] = useState<EligibilityRoleTab>(initialRole);
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

  const tMeta = th.projectInfoAndEligibility.meta;
  const tTabs = th.projectInfoAndEligibility.tabs;
  const tFaq = th.projectInfoAndEligibility.faq;

  const toggleFaq = (index: number) => {
    setExpandedFaqIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans flex flex-col">
      {/* Top Breadcrumb & Action Header */}
      <div className="border-b border-slate-200/80 bg-white sticky top-0 z-30 shadow-2xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          {/* Back button & Breadcrumb */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onBackToHome}
              aria-label={tMeta.backToHome}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-slate-900 active:scale-98 transition-all cursor-pointer"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              <span>{tMeta.backToHome}</span>
            </button>

            <nav
              aria-label="Breadcrumb"
              className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-600"
            >
              <button
                type="button"
                onClick={onBackToHome}
                className="hover:text-blue-600 cursor-pointer"
              >
                {tMeta.breadcrumbHome}
              </button>
              <span aria-hidden="true" className="text-slate-400">/</span>
              <span className="text-slate-700">{tMeta.breadcrumbCurrent}</span>
            </nav>
          </div>

          {/* Quick Hotline Pill */}
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-blue-50/80 px-3 py-1.5 rounded-full border border-blue-100">
            <Phone className="size-3.5 text-[#0056b3]" aria-hidden="true" />
            <span className="hidden md:inline">สายด่วน:</span>
            <span className="font-bold text-[#0056b3]">02-111-1122</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12 sm:space-y-16">
        {/* Navigation Tabs Selector */}
        <section aria-label={tTabs.ariaLabel} className="flex justify-center">
          <div
            role="tablist"
            className="inline-flex rounded-2xl bg-white p-1.5 shadow-sm border border-slate-200/80 max-w-full"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'project-info'}
              aria-controls="panel-project-info"
              id="tab-project-info"
              onClick={() => setActiveTab('project-info')}
              className={`flex items-center gap-2 rounded-xl px-5 sm:px-8 py-3 text-sm sm:text-base font-bold transition-all cursor-pointer ${
                activeTab === 'project-info'
                  ? 'bg-[#0056b3] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Info className="size-4.5" aria-hidden="true" />
              <span>{tTabs.projectInfo}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'how-to-join'}
              aria-controls="panel-how-to-join"
              id="tab-how-to-join"
              onClick={() => setActiveTab('how-to-join')}
              className={`flex items-center gap-2 rounded-xl px-5 sm:px-8 py-3 text-sm sm:text-base font-bold transition-all cursor-pointer ${
                activeTab === 'how-to-join'
                  ? 'bg-[#0056b3] text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="size-4.5" aria-hidden="true" />
              <span>{tTabs.howToJoin}</span>
            </button>
          </div>
        </section>

        {/* Tab Content Display */}
        {activeTab === 'project-info' ? (
          <div
            role="tabpanel"
            id="panel-project-info"
            aria-labelledby="tab-project-info"
            className="animate-in fade-in duration-150"
          >
            <ProjectInfoSection
              onSwitchToHowToJoin={() => setActiveTab('how-to-join')}
              onRegister={onRegisterConsumer}
            />
          </div>
        ) : (
          <div
            role="tabpanel"
            id="panel-how-to-join"
            aria-labelledby="tab-how-to-join"
            className="animate-in fade-in duration-150"
          >
            <HowToJoinSection
              selectedRole={activeRole}
              onSelectRole={(role) => setActiveRole(role)}
              onRegisterConsumer={onRegisterConsumer}
              onRegisterMerchant={onRegisterMerchant}
              onLoginConsumer={onLoginConsumer}
              onLoginMerchant={onLoginMerchant}
            />
          </div>
        )}

        {/* FAQ Section */}
        <section
          aria-labelledby="faq-section-heading"
          className="rounded-3xl border border-slate-200/80 bg-white p-6 sm:p-10 shadow-xs space-y-8"
        >
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0056b3] mb-3">
              <HelpCircle className="size-3.5" aria-hidden="true" />
              <span>คำถามที่พบบ่อย</span>
            </div>
            <h2
              id="faq-section-heading"
              className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight"
            >
              {tFaq.title}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-600">
              {tFaq.subtitle}
            </p>
          </div>

          <div className="space-y-3.5">
            {tFaq.items.map((item, index) => {
              const isExpanded = expandedFaqIndex === index;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200/80 bg-slate-50/50 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isExpanded}
                    aria-controls={`faq-answer-${index}`}
                    className="flex w-full items-center justify-between p-4 sm:p-5 text-left text-sm sm:text-base font-bold text-slate-900 hover:bg-slate-100/60 transition-colors cursor-pointer gap-4"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`size-5 text-slate-500 shrink-0 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180 text-[#0056b3]' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {isExpanded && (
                    <div
                      id={`faq-answer-${index}`}
                      className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/50"
                    >
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom Support Banner */}
        <section
          aria-label="ติดต่อสอบถามเพิ่มเติม"
          className="rounded-2xl bg-gradient-to-r from-slate-900 to-blue-950 p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md"
        >
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2 text-blue-300 text-xs sm:text-sm font-semibold">
              <ShieldCheck className="size-4" aria-hidden="true" />
              <span>ศูนย์ช่วยเหลือและบริการประชาชน</span>
            </div>
            <h3 className="text-lg sm:text-xl font-bold">
              ยังมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม?
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              ติดต่อสายด่วนโครงการได้ทุกวันตลอด 24 ชั่วโมง หรือส่งข้อความผ่านระบบบริการช่วยเหลือ
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <a
              href="tel:021111122"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-500 active:scale-98 transition-all"
            >
              <Phone className="size-4" aria-hidden="true" />
              <span>โทร 02-111-1122</span>
            </a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white py-6 text-center text-xs text-slate-600">
        <p>{th.footer}</p>
      </footer>
    </div>
  );
}
