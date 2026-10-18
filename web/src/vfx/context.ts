import { createContext, useContext } from 'react';
import type { VfxRuntime } from './runtime';
import type { Quality } from './config';
export const Context=createContext<{runtime:VfxRuntime;quality:Quality;reduced:boolean}|null>(null);
export const useVfx=()=>useContext(Context)!;
