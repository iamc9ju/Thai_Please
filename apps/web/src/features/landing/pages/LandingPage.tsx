import { useEffect, useState } from 'react';
import { LandingHeader, type LandingNavSection } from '../components/LandingHeader';
import { LandingHeroSection } from '../components/LandingHeroSection';
import { MerchantDiscoverySection } from '../components/MerchantDiscoverySection';
import { ProjectInfoAndEligibilityPage } from './ProjectInfoAndEligibilityPage';
import { MerchantSearchPage } from './MerchantSearchPage';
import { MofNewsPage } from './MofNewsPage';
import { FaqPage } from './FaqPage';
import type { EligibilityRoleTab } from '../components/HowToJoinSection';

export interface LandingPageProps {
  onLogin: () => void;
  onRegisterConsumer?: (() => void) | undefined;
  onRegisterMerchant?: (() => void) | undefined;
  onLoginConsumer?: (() => void) | undefined;
  onLoginMerchant?: (() => void) | undefined;
  initialNav?: LandingNavSection | undefined;
  initialRole?: EligibilityRoleTab | undefined;
}

export function LandingPage({
  onLogin,
  onRegisterConsumer,
  onRegisterMerchant,
  onLoginConsumer,
  onLoginMerchant,
  initialNav = 'home',
  initialRole = 'consumer',
}: LandingPageProps) {
  const [currentNav, setCurrentNav] = useState<LandingNavSection>(initialNav);
  const [currentRole, setCurrentRole] = useState<EligibilityRoleTab>(initialRole);
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);

  const navigateTo = (nav: LandingNavSection, role?: EligibilityRoleTab) => {
    setCurrentNav(nav);
    if (role) {
      setCurrentRole(role);
    }
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#actions-section') {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  const sharedHeaderProps = {
    onLogin,
    onOpenNews: () => navigateTo('news'),
    onOpenFaq: () => navigateTo('faq'),
    activeNav: currentNav,
    onNavigateHome: () => navigateTo('home'),
    onNavigateProjectInfo: () => navigateTo('project-info'),
    onNavigateHowToJoin: (role?: 'consumer' | 'merchant') => {
      navigateTo('how-to-join', role);
    },
    onNavigateMerchantSearch: () => navigateTo('merchant-search'),
    onNavigateNews: () => navigateTo('news'),
    onNavigateFaq: () => navigateTo('faq'),
  };

  if (currentNav === 'project-info' || currentNav === 'how-to-join') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <LandingHeader {...sharedHeaderProps} />
        <ProjectInfoAndEligibilityPage
          initialTab={currentNav}
          initialRole={currentRole}
          onBackToHome={() => navigateTo('home')}
          onRegisterConsumer={onRegisterConsumer}
          onRegisterMerchant={onRegisterMerchant}
          onLoginConsumer={onLoginConsumer ?? onLogin}
          onLoginMerchant={onLoginMerchant ?? onLogin}
        />
      </div>
    );
  }

  if (currentNav === 'merchant-search') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <LandingHeader {...sharedHeaderProps} />
        <MerchantSearchPage
          onBackToHome={() => navigateTo('home')}
          onLogin={onLogin}
        />
      </div>
    );
  }

  if (currentNav === 'news') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <LandingHeader {...sharedHeaderProps} />
        <MofNewsPage
          onBackToHome={() => navigateTo('home')}
          onLogin={onLogin}
        />
      </div>
    );
  }

  if (currentNav === 'faq') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <LandingHeader {...sharedHeaderProps} />
        <FaqPage
          onBackToHome={() => navigateTo('home')}
          onLogin={onLogin}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <LandingHeader {...sharedHeaderProps} activeNav="home" />
      <main className="flex-1 flex flex-col">
        <LandingHeroSection
          onLogin={onLogin}
          isNewsOpen={isNewsOpen}
          onCloseNews={() => setIsNewsOpen(false)}
          isFaqOpen={isFaqOpen}
          onCloseFaq={() => setIsFaqOpen(false)}
          onOpenProjectInfo={() => navigateTo('project-info')}
          onOpenHowToJoin={(role) => navigateTo('how-to-join', role)}
        />
        <MerchantDiscoverySection
          onViewAllMerchants={() => navigateTo('merchant-search')}
        />
      </main>
    </div>
  );
}
