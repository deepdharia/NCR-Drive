import { PlayerSaveData } from '../types';

const STORAGE_KEY = 'ncr_drive_save_v1';

const DEFAULT_SAVE: PlayerSaveData = {
  cash: 15000, // Starts with Alto and Dzire unlocked, plus ₹15,000 in pocket for first upgrades/repairs
  ownedCarIds: ['alto', 'dzire_taxi'],
  selectedCarId: 'alto',
  carColors: {
    alto: '#E5E7EB',
    dzire_taxi: '#F3F4F6',
  },
  carUpgrades: {
    alto: { engine: 0, brakes: 0, suspension: 0, tyres: 0, tank: 0 },
    dzire_taxi: { engine: 0, brakes: 0, suspension: 0, tyres: 0, tank: 0 },
  },
  highScores: {},
  totalJobsCompleted: 0,
  totalKmDriven: 0,
  settings: {
    quality: 'auto',
    trafficDensity: 'medium',
    controlScheme: 'wheel_right',
    steeringAssist: true,
    soundVolume: 0.8,
    musicVolume: 0.7,
    hindiLabels: false,
    weather: 'clear',
    timeOfDay: 14, // 2 PM daylight
    preferredCamera: 'chase',
    smogEffect: false,
  },
};

let inMemorySave: PlayerSaveData = JSON.parse(JSON.stringify(DEFAULT_SAVE));

export class SaveManager {
  public static load(): PlayerSaveData {
    try {
      const dataStr = localStorage.getItem(STORAGE_KEY);
      if (dataStr) {
        const parsed = JSON.parse(dataStr);
        // Deep merge with defaults so newly added keys never break
        inMemorySave = {
          ...DEFAULT_SAVE,
          ...parsed,
          settings: {
            ...DEFAULT_SAVE.settings,
            ...(parsed.settings || {}),
          },
          carColors: {
            ...DEFAULT_SAVE.carColors,
            ...(parsed.carColors || {}),
          },
          carUpgrades: {
            ...DEFAULT_SAVE.carUpgrades,
            ...(parsed.carUpgrades || {}),
          },
        };
        return inMemorySave;
      }
    } catch {
      // localStorage disabled or iframe restricted; use inMemorySave
    }
    return inMemorySave;
  }

  public static save(data: PlayerSaveData) {
    inMemorySave = data;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Quota exceeded or private browsing
    }
  }

  public static addCash(amount: number): number {
    const data = this.load();
    data.cash += amount;
    this.save(data);
    return data.cash;
  }

  public static spendCash(amount: number): boolean {
    const data = this.load();
    if (data.cash >= amount) {
      data.cash -= amount;
      this.save(data);
      return true;
    }
    return false;
  }

  public static selectCar(carId: string): boolean {
    const data = this.load();
    if (data.ownedCarIds.includes(carId)) {
      data.selectedCarId = carId;
      this.save(data);
      return true;
    }
    return false;
  }

  public static unlockCar(carId: string): boolean {    const data = this.load();
    if (!data.ownedCarIds.includes(carId)) {
      data.ownedCarIds.push(carId);
      data.selectedCarId = carId;
      data.carUpgrades[carId] = { engine: 0, brakes: 0, suspension: 0, tyres: 0, tank: 0 };
      this.save(data);
      return true;
    }
    return false;
  }

  public static setCarColor(carId: string, hex: string) {
    const data = this.load();
    data.carColors[carId] = hex;
    this.save(data);
  }

  public static upgradeCar(carId: string, part: 'engine' | 'brakes' | 'suspension' | 'tyres' | 'tank', cost: number): boolean {
    const data = this.load();
    if (data.cash < cost) return false;

    if (!data.carUpgrades[carId]) {
      data.carUpgrades[carId] = { engine: 0, brakes: 0, suspension: 0, tyres: 0, tank: 0 };
    }

    if (data.carUpgrades[carId][part] < 3) {
      data.cash -= cost;
      data.carUpgrades[carId][part]++;
      this.save(data);
      return true;
    }
    return false;
  }
}
