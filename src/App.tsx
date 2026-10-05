import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { SaveManager } from './game/save/SaveManager';
import { GameMode, GameScreen, HUDState, PlayerSaveData, QualityLevel, Weather } from './game/types';
import { HUD } from './components/HUD';
import { MainMenu } from './components/MainMenu';
import { GarageModal } from './components/GarageModal';
import { MissionSelectModal } from './components/MissionSelectModal';
import { SettingsModal } from './components/SettingsModal';
import { PauseModal } from './components/PauseModal';
import { MissionResultModal } from './components/MissionResultModal';
import { TaxiOfferModal } from './components/TaxiOfferModal';
import { TaxiOffer, getArchetypeTipHint } from './game/missions/MissionManager';
import { TaxiArchetype } from './game/types';

const INITIAL_HUD: HUDState = {
  speedKmH: 0,
  rpm: 850,
  maxRpm: 6500,
  gear: 'D',
  fuelPct: 100,
  damagePct: 0,
  cash: 15000,
  fps: 60,
  speedLimit: 50,
  isOverSpeed: false,
  leftBlinker: false,
  rightBlinker: false,
  headlights: false,
  currentStreet: 'Kartavya Path',
  currentZone: 'Delhi',
  activeJob: false,
  hasGpsTarget: false,
};

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  // Last run context so Retry / Next Fare can restart the exact same mode.
  const lastRunRef = useRef<{ mode: GameMode; missionId?: string }>({ mode: 'free_drive' });

  const [screen, setScreen] = useState<GameScreen>('main_menu');
  const [saveData, setSaveData] = useState<PlayerSaveData>(() => SaveManager.load());
  const [hudState, setHudState] = useState<HUDState>(INITIAL_HUD);

  // Modals state
  const [showMissions, setShowMissions] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showPause, setShowPause] = useState<boolean>(false);
  // Latest pause-toggle logic, read by the engine's Escape-key callback
  // (registered once at mount) without stale closures.
  const pauseToggleRef = useRef<() => void>(() => {});
  const [missionResult, setMissionResult] = useState<{
    success: boolean;
    title: string;
    cashEarned: number;
    message: string;
    stars?: number;
  } | null>(null);

  // Taxi career: pending fare offer + active-job display meta (archetype/tip).
  const [taxiOffer, setTaxiOffer] = useState<TaxiOffer | null>(null);
  const [taxiMeta, setTaxiMeta] = useState<{ archetype: TaxiArchetype; tipHint: string } | null>(null);

  // Sync the HUD taxi-card meta from the engine's active job.
  const syncTaxiMeta = useCallback(() => {
    const job = engineRef.current?.missionManager.currentTaxiJob;
    if (job) {
      setTaxiMeta({ archetype: job.archetype, tipHint: getArchetypeTipHint(job.archetype) });
    } else {
      setTaxiMeta(null);
    }
  }, []);

  // Initialize GameEngine outside React render loop
  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;

    const engine = new GameEngine(containerRef.current);
    engineRef.current = engine;

    engine.setCallbacks({
      onHudUpdate: (hud) => {
        setHudState(hud);
      },
      onMissionEnd: (res) => {
        setMissionResult(res);
        setSaveData(SaveManager.load());
        setTaxiMeta(null);
      },
      onPauseRequest: () => pauseToggleRef.current(),
    });

    // Start menu preview mode initially
    engine.enterGarage();

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const refreshSave = useCallback(() => {
    setSaveData(SaveManager.load());
  }, []);

  // Handlers for Modes
  // Taxi career: show a fare offer first — the job only starts on ACCEPT.
  const handleStartTaxi = useCallback(() => {
    if (!engineRef.current) return;
    setTaxiOffer(engineRef.current.missionManager.generateTaxiOffer());
    setShowPause(false);
    setShowMissions(false);
    setMissionResult(null);
  }, []);

  const handleAcceptTaxiOffer = useCallback(() => {
    if (!engineRef.current || !taxiOffer) return;
    lastRunRef.current = { mode: 'taxi' };
    engineRef.current.missionManager.pendingTaxiOffer = taxiOffer;
    engineRef.current.startMode('taxi');
    syncTaxiMeta();
    setTaxiOffer(null);
    setScreen('game');
    setShowPause(false);
    setShowMissions(false);
    setMissionResult(null);
  }, [taxiOffer, syncTaxiMeta]);

  const handleDeclineTaxiOffer = useCallback(() => {
    if (!engineRef.current) return;
    // No penalty — a fresh offer appears.
    setTaxiOffer(engineRef.current.missionManager.generateTaxiOffer());
  }, []);

  const handleStartMission = useCallback((missionId: string) => {
    if (!engineRef.current) return;
    lastRunRef.current = { mode: 'mission', missionId };
    engineRef.current.startMode('mission', missionId);
    setScreen('game');
    setShowMissions(false);
    setShowPause(false);
    setMissionResult(null);
  }, []);

  const handleStartFreeDrive = useCallback(() => {
    if (!engineRef.current) return;
    lastRunRef.current = { mode: 'free_drive' };
    engineRef.current.startMode('free_drive');
    setScreen('game');
    setShowPause(false);
    setShowMissions(false);
    setMissionResult(null);
  }, []);

  const handleOpenGarage = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.enterGarage();
    setScreen('garage');
    setShowPause(false);
  }, []);

  const handleDriveFromGarage = useCallback(() => {
    if (!engineRef.current) return;
    lastRunRef.current = { mode: 'free_drive' };
    engineRef.current.startMode('free_drive');
    setScreen('game');
  }, []);

  const handleSelectCar = useCallback((carId: string) => {
    if (!engineRef.current) return;
    engineRef.current.switchCar(carId);
  }, []);

  const handleRepaintCar = useCallback((carId: string, hex: string) => {
    if (!engineRef.current) return;
    engineRef.current.carVisuals.setPaintColor(hex);
  }, []);

  const handleQualityChange = useCallback((quality: QualityLevel) => {
    if (!engineRef.current) return;
    engineRef.current.setQuality(quality);
  }, []);

  const handleWeatherChange = useCallback((weather: Weather) => {
    if (!engineRef.current) return;
    engineRef.current.setWeather(weather);
  }, []);

  const handleRefuelCar = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.physics.refuel();
  }, []);

  const handleRepairCar = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.physics.repair();
  }, []);

  const handleCycleCamera = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.cycleCamera();
  }, []);

  const handlePause = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.setPaused(true);
    setShowPause(true);
  }, []);

  const handleResume = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.setPaused(false);
    setShowPause(false);
  }, []);

  // Escape key toggles pause during gameplay (wired via engine.setCallbacks).
  // Only acts on the game screen; menus handle their own dismissal.
  useEffect(() => {
    pauseToggleRef.current = () => {
      if (showPause) {
        handleResume();
      } else if (screen === 'game') {
        handlePause();
      }
    };
  }, [showPause, screen, handlePause, handleResume]);

  const handleResetCar = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.resetCarToRoad();
    engineRef.current.setPaused(false);
    setShowPause(false);
  }, []);

  const handleRestart = useCallback(() => {
    if (!engineRef.current) return;
    // Actually restart the last run (mission/taxi/free drive), not just reset the car.
    const last = lastRunRef.current;
    engineRef.current.startMode(last.mode, last.missionId);
    if (last.mode === 'taxi') syncTaxiMeta();
    engineRef.current.setPaused(false);
    setShowPause(false);
    setMissionResult(null);
  }, [syncTaxiMeta]);

  // Taxi career loop: NEXT FARE opens a fresh offer instead of dropping to the menu.
  const handleNextFare = useCallback(() => {
    if (!engineRef.current) return;
    setMissionResult(null);
    setTaxiOffer(engineRef.current.missionManager.generateTaxiOffer());
    setShowPause(false);
  }, []);

  const handleMainMenu = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.enterGarage();
    setScreen('main_menu');
    setShowPause(false);
    setMissionResult(null);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-neutral-950 font-display">
      {/* 3D Canvas Mount Point */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* In-Game Driving HUD */}
      {screen === 'game' && engineRef.current && (
        <HUD
          state={{
            ...hudState,
            taxiArchetype: taxiMeta?.archetype,
            taxiTipHint: taxiMeta?.tipHint,
          }}
          inputManager={engineRef.current.inputManager}
          playerX={engineRef.current.physics.position.x}
          playerZ={engineRef.current.physics.position.z}
          playerHeading={engineRef.current.physics.heading}
          hindiLabels={saveData.settings.hindiLabels}
          onCycleCamera={handleCycleCamera}
          onPause={handlePause}
        />
      )}

      {/* Main Menu Screen */}
      {screen === 'main_menu' && (
        <MainMenu
          saveData={saveData}
          onStartTaxi={handleStartTaxi}
          onOpenMissions={() => setShowMissions(true)}
          onStartFreeDrive={handleStartFreeDrive}
          onOpenGarage={handleOpenGarage}
          onOpenSettings={() => setShowSettings(true)}
        />
      )}

      {/* Garage Screen */}
      {screen === 'garage' && (
        <GarageModal
          saveData={saveData}
          onSelectCar={handleSelectCar}
          onRepaint={handleRepaintCar}
          onClose={handleDriveFromGarage}
          onRefreshSave={refreshSave}
          onRefuelCar={handleRefuelCar}
          onRepairCar={handleRepairCar}
        />
      )}

      {/* Dr. Driving Mission Select Modal */}
      {showMissions && (
        <MissionSelectModal
          onSelectMission={handleStartMission}
          onClose={() => setShowMissions(false)}
          hindiLabels={saveData.settings.hindiLabels}
          highScores={saveData.highScores}
        />
      )}

      {/* Settings Modal */}
      {showSettings && (
        <SettingsModal
          saveData={saveData}
          onUpdateSave={(updated) => {
            setSaveData(updated);
            // Keep the engine's cached settings in sync after any change.
            engineRef.current?.refreshSettings();
          }}
          onClose={() => setShowSettings(false)}
          onQualityChange={handleQualityChange}
          onWeatherChange={handleWeatherChange}
          onVolumeChange={(v) => engineRef.current?.audioEngine.setVolume(v)}
          onMuteToggle={() => engineRef.current?.audioEngine.toggleMute() ?? false}
        />
      )}

      {/* Pause Menu Modal */}
      {showPause && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onResetCar={handleResetCar}
          onOpenGarage={handleOpenGarage}
          onOpenSettings={() => setShowSettings(true)}
          onMainMenu={handleMainMenu}
        />
      )}

      {/* Taxi Fare Offer Modal (accept / decline before the job starts) */}
      {taxiOffer && (
        <TaxiOfferModal
          offer={taxiOffer}
          onAccept={handleAcceptTaxiOffer}
          onDecline={handleDeclineTaxiOffer}
          hindiLabels={saveData.settings.hindiLabels}
        />
      )}

      {/* Mission Completion / Failure Result Modal */}
      {missionResult && (
        <MissionResultModal
          success={missionResult.success}
          title={missionResult.title}
          cashEarned={missionResult.cashEarned}
          message={missionResult.message}
          stars={missionResult.stars}
          showNextFare={lastRunRef.current.mode === 'taxi'}
          onNextFare={handleNextFare}
          onContinue={() => {
            setMissionResult(null);
            handleMainMenu();
          }}
          onRetry={() => {
            setMissionResult(null);
            handleRestart();
          }}
        />
      )}
    </div>
  );
}
