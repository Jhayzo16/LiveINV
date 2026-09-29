import { createContext, useContext } from 'react'

export const FLOATING_TAB_HEIGHT = 64
// Only tab screens reserve space for the floating bar; login/detail screens do not.
export const TabContentInset = createContext(24)
export const useContentBottomInset = () => useContext(TabContentInset)
