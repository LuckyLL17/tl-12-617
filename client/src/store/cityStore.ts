import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CityState {
  selectedCity: string;
  selectedDistrict: string | null;
  setCity: (city: string) => void;
  setDistrict: (district: string | null) => void;
  setCityAndDistrict: (city: string, district: string | null) => void;
}

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      selectedCity: '北京',
      selectedDistrict: null,
      setCity: (city) => set({ selectedCity: city, selectedDistrict: null }),
      setDistrict: (district) => set({ selectedDistrict: district }),
      setCityAndDistrict: (city, district) => set({ selectedCity: city, selectedDistrict: district }),
    }),
    {
      name: 'city-storage'
    }
  )
);
