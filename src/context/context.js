import {createContext,useContext} from 'react';
// Keep the context identity independent from repository/fixture hot updates.
export const AppContext=createContext(null);
export const useApp=()=>useContext(AppContext);
