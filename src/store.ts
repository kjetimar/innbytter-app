import { create } from 'zustand';
interface UIState { currentMatchId?: string; setMatchId: (id?: string)=>void }
export const useUI = create<UIState>((set)=>({ currentMatchId: undefined, setMatchId:(id)=>set({currentMatchId:id}) }));
