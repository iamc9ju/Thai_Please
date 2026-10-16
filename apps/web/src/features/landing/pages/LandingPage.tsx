import { useState } from 'react';
import { LandingHeader } from '../components/LandingHeader';
import { LandingHeroSection } from '../components/LandingHeroSection';

export interface LandingPageProps {
  onLogin: () => void;
}

export function LandingPage({ onLogin }: LandingPageProps) {
  const [isNewsOpen, setIsNewsOpen] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans">
      <LandingHeader
        onLogin={onLogin}
        onOpenNews={() => setIsNewsOpen(true)}
        onOpenFaq={() => setIsFaqOpen(true)}
      />
      <main className="flex-1 flex flex-col">
        <LandingHeroSection
          onLogin={onLogin}
          isNewsOpen={isNewsOpen}
          onCloseNews={() => setIsNewsOpen(false)}
          isFaqOpen={isFaqOpen}
          onCloseFaq={() => setIsFaqOpen(false)}
        />
      </main>
    </div>
  );
}
