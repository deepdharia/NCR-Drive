import React from 'react';
import { Play, Award, Compass, Car, Settings, IndianRupee, MapPin, ArrowUpRight, ArrowRight } from 'lucide-react';
import { CAR_CATALOG, getCarById } from '../game/cars/CarCatalog';
import { PlayerSaveData } from '../game/types';

interface MainMenuProps {
  saveData: PlayerSaveData;
  onStartTaxi: () => void;
  onOpenMissions: () => void;
  onStartFreeDrive: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ saveData, onStartTaxi, onOpenMissions, onStartFreeDrive, onOpenGarage, onOpenSettings }) => {
  const car = getCarById(saveData.selectedCarId);
  const hindi = saveData.settings.hindiLabels;
  const modes = [
    { icon: Award, label: hindi ? 'ड्राइविंग चुनौतियाँ' : 'Driving challenges', detail: 'Precision. Patience. Personal bests.', action: onOpenMissions, number: '02' },
    { icon: Compass, label: hindi ? 'फ्री ड्राइव' : 'Free roam', detail: 'Take the long way home.', action: onStartFreeDrive, number: '03' },
    { icon: Car, label: hindi ? 'गैराज' : 'Your garage', detail: `${CAR_CATALOG.length} cars. Make one yours.`, action: onOpenGarage, number: '04' },
  ];
  return (
    <main className="drive-menu absolute inset-0 z-40 font-display text-white select-none">
      <header className="menu-header">
        <a className="drive-brand" href="#" aria-label="NCR Drive home" onClick={(e) => e.preventDefault()}>
          <span className="brand-symbol">N</span>
          <span>NCR<span className="brand-light"> DRIVE</span><small>THE STREETS ARE YOURS</small></span>
        </a>
        <div className="menu-wallet"><span><IndianRupee size={15} />{saveData.cash.toLocaleString('en-IN')}<small>YOUR BALANCE</small></span>
          <button className="menu-settings" onClick={onOpenSettings} aria-label="Settings"><Settings size={20} /></button>
        </div>
      </header>
      <section className="menu-content">
        <div className="menu-eyebrow"><span /> DELHI · GURGAON · HARYANA</div>
        <h1>Your city.<br />Your <em>drive.</em></h1>
        <p className="menu-intro">From the capital’s quiet mornings to the rush of NH-48. Every road has a story.</p>
        <button className="career-button" onClick={onStartTaxi}>
          <span className="career-icon"><Play size={22} fill="currentColor" /></span>
          <span><small>01 / START YOUR JOURNEY</small><strong>{hindi ? 'टैक्सी करियर' : 'Taxi career'}</strong></span>
          <ArrowRight size={24} />
        </button>
        <nav className="mode-list" aria-label="Game modes">
          {modes.map(({ icon: Icon, label, detail, action, number }) => (
            <button key={number} className="mode-button" onClick={action}>
              <Icon size={21} /><span><strong>{label}</strong><small>{detail}</small></span><ArrowUpRight size={19} />
            </button>
          ))}
        </nav>
      </section>
      <aside className="menu-vehicle"><span className="menu-eyebrow">READY TO ROLL</span><strong>{car.name}</strong><button onClick={onOpenGarage}>Explore your garage <ArrowUpRight size={15} /></button></aside>
      <footer className="menu-footer"><span><MapPin size={14} /> MADE FOR THE NCR</span><span className="desktop-hint">WASD / ARROWS <i /> DRIVE &nbsp; C <i /> CAMERA &nbsp; ESC <i /> PAUSE</span><span className="mobile-hint">TOUCH CONTROLS · BEST IN LANDSCAPE</span><span className="menu-status"><i /> READY TO DRIVE</span></footer>
    </main>
  );
};
