import { useState } from 'react';
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

  const sharedHeaderProps = {
    onLogin,
    onOpenNews: () => setCurrentNav('news'),
    onOpenFaq: () => setCurrentNav('faq'),
    activeNav: currentNav,
    onNavigateHome: () => setCurrentNav('home'),
    onNavigateProjectInfo: () => setCurrentNav('project-info'),
    onNavigateHowToJoin: (role?: 'consumer' | 'merchant') => {
      setCurrentNav('how-to-join');
      if (role) setCurrentRole(role);
    },
    onNavigateMerchantSearch: () => setCurrentNav('merchant-search'),
    onNavigateNews: () => setCurrentNav('news'),
    onNavigateFaq: () => setCurrentNav('faq'),
  };

  if (currentNav === 'project-info' || currentNav === 'how-to-join') {
    return (
      <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
        <LandingHeader {...sharedHeaderProps} />
        <ProjectInfoAndEligibilityPage
          initialTab={currentNav}
          initialRole={currentRole}
          onBackToHome={() => setCurrentNav('home')}
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
          onBackToHome={() => setCurrentNav('home')}
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
          onBackToHome={() => setCurrentNav('home')}
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
          onBackToHome={() => setCurrentNav('home')}
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
          onOpenProjectInfo={() => setCurrentNav('project-info')}
          onOpenHowToJoin={(role) => {
            setCurrentNav('how-to-join');
            if (role) setCurrentRole(role);
          }}
        />
        <MerchantDiscoverySection />
      </main>
    </div>
  );
}
