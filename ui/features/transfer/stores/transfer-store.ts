import { create } from "zustand";

type S = {
  sourceId: string | null;
  targetIds: Set<string>;
  selectedAppIds: Set<number>;
  setSource: (id: string | null) => void;
  toggleTarget: (id: string) => void;
  toggleApp: (id: number) => void;
  reset: () => void;
};

export const useTransferStore = create<S>((set) => ({
  sourceId: null,
  targetIds: new Set(),
  selectedAppIds: new Set(),
  setSource: (id) => set(() => ({ sourceId: id, selectedAppIds: new Set() })),
  toggleTarget: (id) => set((s) => {
    const next = new Set(s.targetIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { targetIds: next };
  }),
  toggleApp: (id) => set((s) => {
    const next = new Set(s.selectedAppIds);
    next.has(id) ? next.delete(id) : next.add(id);
    return { selectedAppIds: next };
  }),
  reset: () => set({ sourceId: null, targetIds: new Set(), selectedAppIds: new Set() }),
}));
